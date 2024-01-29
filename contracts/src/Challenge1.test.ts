import { Challenge1, MerkleWitness100 } from './Challenge1';
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleTree, MerkleMap, Poseidon } from 'o1js';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;

describe('Add', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: Challenge1,
    participants: MerkleTree,
    messageMap: MerkleMap;

  beforeAll(async () => {
    if (proofsEnabled) await Challenge1.compile();
  });

  beforeEach(async () => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new Challenge1(zkAppAddress);

    participants = new MerkleTree(100);
    messageMap = new MerkleMap();

    await localDeploy();
  });

  async function localDeploy() {
    let txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();

    participants.setLeaf(0n, Poseidon.hash(deployerAccount.toFields()));

    txn = await Mina.transaction(deployerAccount, () => {
        zkApp.initState(participants.getRoot(), messageMap.getRoot());
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `Challenge1` smart contract', async () => {
    const state_participants = zkApp.participants.get();
    const state_messages = zkApp.messages.get();

    expect(state_participants).toEqual(participants.getRoot());
    expect(state_messages).toEqual(messageMap.getRoot());
  });

  it('correctly add user on the `Challenge1` smart contract', async () => {
    participants.setLeaf(1n, Poseidon.hash(senderAccount.toFields()));

    // update transaction
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.addUser(senderAccount, new MerkleWitness100(participants.getWitness(1n)));
    });
    await txn.prove();
    await txn.sign([deployerKey]).send();

    const state_participants = zkApp.participants.get();
    
    expect(state_participants).toEqual(participants.getRoot());
  });

  
  it('correctly add message on the `Challenge1` smart contract', async () => {
    participants.setLeaf(1n, Poseidon.hash(senderAccount.toFields()));
    
    // update transaction
    let txn = await Mina.transaction(deployerAccount, () => {
      zkApp.addUser(senderAccount, new MerkleWitness100(participants.getWitness(1n)));
    });
    await txn.prove();
    await txn.sign([deployerKey]).send();

    txn = await Mina.transaction(senderAccount, () => {
      zkApp.depositMessage(Field(54593n), new MerkleWitness100(participants.getWitness(1n)), messageMap.getWitness(Poseidon.hash(senderAccount.toFields())));
    });
    await txn.prove();
    await txn.sign([senderKey]).send();
    
    txn = await Mina.transaction(deployerAccount, () => {
      zkApp.rollupMessages();
    });
    await txn.prove();
    await txn.sign([deployerKey]).send();

    messageMap.set(Poseidon.hash(senderAccount.toFields()), Field(54593n));

    const state_messages = zkApp.messages.get();
    const counter = zkApp.counter.get();
    
    expect(state_messages).toEqual(messageMap.getRoot());
    expect(counter).toEqual(Field(1));
  });
});
