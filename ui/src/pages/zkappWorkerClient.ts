import { fetchAccount, PublicKey, Field, MerkleMapWitness } from 'o1js';

import type {
  ZkappWorkerRequest,
  ZkappWorkerReponse,
  WorkerFunctions,
} from './zkappWorker';
import { MerkleWitness100 } from '../../../contracts/build/src/Challenge1';

export default class ZkappWorkerClient {
  // ---------------------------------------------------------------------------------------

  setActiveInstanceToBerkeley() {
    return this._call('setActiveInstanceToBerkeley', {});
  }

  loadContract() {
    return this._call('loadContract', {});
  }

  compileContract() {
    return this._call('compileContract', {});
  }

  fetchAccount({
    publicKey,
  }: {
    publicKey: PublicKey;
  }): ReturnType<typeof fetchAccount> {
    const result = this._call('fetchAccount', {
      publicKey58: publicKey.toBase58(),
    });
    return result as ReturnType<typeof fetchAccount>;
  }

  initZkappInstance(publicKey: PublicKey, feePayer: PublicKey, pRoot: Field, mRoot: Field) {
    return this._call('initZkappInstance', {
      publicKey58: publicKey,
      feePayer: feePayer,
      pRoot: pRoot,
      mRoot: mRoot
    });
  }

  async getNum(): Promise<Field> {
    const result = await this._call('getNum', {});
    return Field.fromJSON(JSON.parse(result as string));
  }

  createUpdateTransaction(address: PublicKey, witness: MerkleWitness100) {
    return this._call('createAddUserTransaction', {address, witness});
  }

  createUpdateTransaction2(message: Field, pWitness: MerkleWitness100, mWitness: MerkleMapWitness) {
    return this._call('createAddUserTransaction', {message, pWitness, mWitness});
  }

  proveUpdateTransaction() {
    return this._call('proveUpdateTransaction', {});
  }

  async getTransactionJSON() {
    const result = await this._call('getTransactionJSON', {});
    return result;
  }

  // ---------------------------------------------------------------------------------------

  worker: Worker;

  promises: {
    [id: number]: { resolve: (res: any) => void; reject: (err: any) => void };
  };

  nextId: number;

  constructor() {
    this.worker = new Worker(new URL('./zkappWorker.ts', import.meta.url));
    this.promises = {};
    this.nextId = 0;

    this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
      this.promises[event.data.id].resolve(event.data.data);
      delete this.promises[event.data.id];
    };
  }

  _call(fn: WorkerFunctions, args: any) {
    return new Promise((resolve, reject) => {
      this.promises[this.nextId] = { resolve, reject };

      const message: ZkappWorkerRequest = {
        id: this.nextId,
        fn,
        args,
      };

      this.worker.postMessage(message);

      this.nextId++;
    });
  }
}