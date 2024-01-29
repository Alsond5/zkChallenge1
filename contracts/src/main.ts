import { Challenge1, MerkleWitness100 } from './Challenge1.js';
import {
  Field,
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleMap,
  Poseidon,
  Bool,
  Encryption,
  CircuitString,
  Signature,
  verify,
  MerkleTree
} from 'o1js';

const participants = new MerkleTree(100);

const useProof = false;
const Local = Mina.LocalBlockchain({ proofsEnabled: useProof });
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } = Local.testAccounts[0];
const { privateKey: senderKey, publicKey: senderAccount } = Local.testAccounts[1];
// ----------------------------------------------------
// Create a public/private key pair. The public key is your address and where you deploy the zkApp to
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();
// create an instance of Square - and deploy it to zkAppAddress
const zkAppInstance = new Challenge1(zkAppAddress);
const deployTxn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  zkAppInstance.deploy();
});
await deployTxn.sign([deployerKey, zkAppPrivateKey]).send();

const messageMap = new MerkleMap();

participants.setLeaf(0n, Poseidon.hash(deployerAccount.toFields()));

let txn = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.initState(participants.getRoot(), messageMap.getRoot());
});
await txn.prove();
await txn.sign([deployerKey, zkAppPrivateKey]).send();

let state_participants = zkAppInstance.participants.get();
console.log('state after init:', state_participants.toBigInt());

participants.setLeaf(1n, Poseidon.hash(senderAccount.toFields()));

txn = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.addUser(senderAccount, new MerkleWitness100(participants.getWitness(1n)));
});
await txn.prove();
await txn.sign([deployerKey]).send();

state_participants = zkAppInstance.participants.get();
console.log('state after init:', state_participants.toBigInt());

txn = await Mina.transaction(senderAccount, () => {
    zkAppInstance.depositMessage(Field(54593n), new MerkleWitness100(participants.getWitness(1n)), messageMap.getWitness(Poseidon.hash(senderAccount.toFields())));
});
await txn.prove();
await txn.sign([senderKey]).send();

txn = await Mina.transaction(deployerAccount, () => {
  zkAppInstance.rollupMessages();
});
await txn.prove();
await txn.sign([deployerKey]).send();

let message = zkAppInstance.messages.get();
console.log('state after init:', message.toBigInt());

message = zkAppInstance.counter.get();
console.log('state after init:', message.toBigInt());

messageMap.set(Poseidon.hash(senderAccount.toFields()), Field(54593n));

console.log("calculated:", messageMap.getRoot());