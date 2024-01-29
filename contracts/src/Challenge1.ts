// git remote add origin <your-repo-url>
// git push -u origin main

import { Field, SmartContract, state, State, method, Gadgets, PublicKey, MerkleMapWitness, Poseidon, Struct, MerkleWitness, Reducer, Provable } from 'o1js';

const treeHeight = 100;

export class MerkleWitness100 extends MerkleWitness(treeHeight) {}

class ReducerState extends Struct({
  messagesRoot: Field,
  counter: Field
}) {
  constructor(messagesRoot: Field, counter: Field) {
    super({ messagesRoot, counter });

    this.messagesRoot = messagesRoot;
    this.counter = counter;
  }
}


export class Challenge1 extends SmartContract {
  events = {
    "add-message": PublicKey
  }

  reducer = Reducer({ actionType: Field })

  @state(PublicKey) owner = State<PublicKey>();
  @state(Field) participants = State<Field>();
  @state(Field) counter = State<Field>();
  @state(Field) messages = State<Field>();
  @state(Field) actionState = State<Field>();

  @method initState(pInitialRoot: Field, mInitialRoot: Field) {
    super.init();

    this.actionState.set(Reducer.initialActionState);

    this.owner.set(this.sender);
    this.participants.set(pInitialRoot);
    this.messages.set(mInitialRoot);
  }

  @method messageController(message: Field) {
    // example flag: 000001 => in this case flag 1 is 1, flag 2 is 0...

    // must be 000001
    const s1 = Gadgets.and(message, Field(63n), 254).equals(1n);
    // must be nnn11n => n: doesn't matter
    const s2 = Gadgets.and(message, Field(6n), 254).equals(6n);
    // must be 001nnn => n: doesn't matter
    const s3 = Gadgets.and(message, Field(56n), 254).equals(8n);

    s1.or(s2.or(s3)).assertTrue();
  }

  @method addUser(address: PublicKey, witness: MerkleWitness100) {
    const owner = this.owner.getAndRequireEquals();
    owner.assertEquals(this.sender);

    const participants = this.participants.getAndRequireEquals();

    const hashedAddress = Poseidon.hash(address.toFields());
    const beforeRoot = witness.calculateRoot(Field(0n));
    
    participants.assertEquals(beforeRoot);

    const newRoot = witness.calculateRoot(hashedAddress);
    this.participants.set(newRoot);
  }

  @method depositMessage(message: Field, pWitness: MerkleWitness100, mWitness: MerkleMapWitness) {
    const sender = this.sender;

    const participants = this.participants.getAndRequireEquals();
    const messages = this.messages.getAndRequireEquals();

    const hashedAddress = Poseidon.hash(sender.toFields());

    const pBeforeRoot = pWitness.calculateRoot(hashedAddress);
    participants.assertEquals(pBeforeRoot);

    const [mBeforeRoot, mKey] = mWitness.computeRootAndKey(Field(0n));
    messages.assertEquals(mBeforeRoot);
    hashedAddress.assertEquals(mKey);

    this.messageController(message);

    const [newRoot, key] = mWitness.computeRootAndKey(message);
    hashedAddress.assertEquals(key);
    
    this.reducer.dispatch(newRoot);

    this.emitEvent("add-message", sender);
  }

  @method rollupMessages() {
    const owner = this.owner.getAndRequireEquals();
    owner.assertEquals(this.sender);

    const participants = this.participants.getAndRequireEquals();
    const messages = this.messages.getAndRequireEquals();
    const counter = this.counter.getAndRequireEquals();

    const reducerState = new ReducerState(messages, counter);
    
    const actionState = this.actionState.getAndRequireEquals();

    const pendingActions = this.reducer.getActions({
      fromActionState: actionState
    });

    const { state: newArray, actionState: newActionState } =
    this.reducer.reduce(
      pendingActions,
      ReducerState,
      (state: ReducerState, action: Field) => {
        const newCounter = state.counter.add(1);

        return new ReducerState(action, newCounter);
      },
      { state: reducerState, actionState }
    );

    this.messages.set(newArray.messagesRoot);
    this.counter.set(newArray.counter);
    this.actionState.set(newActionState);
  }
}
