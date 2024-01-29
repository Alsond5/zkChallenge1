import { Field, MerkleMapWitness, Mina, PrivateKey, PublicKey, fetchAccount } from 'o1js';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { Challenge1, MerkleWitness100 } from '../../../contracts/src/Challenge1';

const state = {
  Challenge1: null as null | typeof Challenge1,
  zkapp: null as null | Challenge1,
  transaction: null as null | Transaction,
};

// ---------------------------------------------------------------------------------------

const functions = {
  setActiveInstanceToBerkeley: async (args: {}) => {
    const Berkeley = Mina.Network(
      'https://proxy.berkeley.minaexplorer.com/graphql'
    );
    console.log('Berkeley Instance Created');
    Mina.setActiveInstance(Berkeley);
  },
  loadContract: async (args: {}) => {
    const { Challenge1 } = await import('../../../contracts/build/src/Challenge1.js');
    state.Challenge1 = Challenge1;
  },
  compileContract: async (args: {}) => {
    await state.Challenge1!.compile();
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: PublicKey, feePayer: PublicKey, pRoot: Field, mRoot: Field }) => {
    state.zkapp = new state.Challenge1!(args.publicKey58);
  },
  getNum: async (args: {}) => {
    const currentNum = state.zkapp!.actionState.get();
    return currentNum.toString();
  },
  createAddUserTransaction: async (args: {address: PublicKey, witness: MerkleWitness100}) => {
    const transaction = await Mina.transaction(() => {
      state.zkapp!.addUser(args.address, args.witness);
    });
    state.transaction = transaction;
  },
  createDepositMessageTransaction: async (args: {message: Field, pWitness: MerkleWitness100, mWitness: MerkleMapWitness}) => {
    const transaction = await Mina.transaction(() => {
      state.zkapp!.depositMessage(args.message, args.pWitness, args.mWitness);
    });
    state.transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    await state.transaction!.prove();
  },
  signUpdateTransaction: async (args: {pk: PrivateKey, zkAppPk: PrivateKey}) => {
    await state.transaction!.sign([args.pk, args.zkAppPk]).send();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};

if (typeof window !== 'undefined') {
  addEventListener(
    'message',
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}

console.log('Web Worker Successfully Initialized.');