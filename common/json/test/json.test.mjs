// common/json/test: round-trips, forged tags, errors, Up, validate.

import test from "node:test";
import assert from "node:assert";

import {
  Die,
  Group,
  Queue,
  Player,
  Last,
  Game,
  Action,
  Reply,
  Message,
  Up,
} from "../../shapes/index.mjs";
import { toJSON, fromJSON, validate } from "../index.mjs";

// ---- helpers to build valid values ----

function makeDie(id, o = 0) {
  return Die({ id, o });
}

function makeGroup(dice) {
  return Group({ dice: dice.map((id) => makeDie(id)) });
}

function makeQueue(dicePerGroup) {
  return Queue({ groups: dicePerGroup.map((dice) => makeGroup(dice)) });
}

function makeGame() {
  const dice0 = [0, 1, 2, 3];
  const dice1 = [4, 5, 6, 7];
  const dice2 = [8, 9, 10, 11];
  const dice3 = [12, 13, 14, 15];
  const p0 = Player({ seat: 0, queue: makeQueue([dice0]) });
  const p1 = Player({ seat: 1, queue: makeQueue([dice1]) });
  const p2 = Player({ seat: 2, queue: makeQueue([dice2]) });
  const p3 = Player({ seat: 3, queue: makeQueue([dice3]) });
  const action = Action({ id: "act-1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const last = Last({ action, change: "turn", dice: [0, 1], before: [0, 1] });
  return Game({ players: [p0, p1, p2, p3], turn: 0, version: 0, rng: 0, last, winner: null });
}

// ---- round trips of every kind ----

test("round trip: die", () => {
  const x = makeDie(3, 7);
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: group", () => {
  const x = makeGroup([0, 1, 2]);
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: queue", () => {
  const x = makeQueue([[0, 1], [2, 3]]);
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: player", () => {
  const x = Player({ seat: 2, queue: makeQueue([[8, 9, 10, 11]]) });
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: action (turn)", () => {
  const x = Action({ id: "a", seat: 1, move: "turn", axis: "y", dir: -1, version: 5 });
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: action (roll)", () => {
  const x = Action({ id: "a", seat: 1, move: "roll", axis: null, dir: null, version: 5 });
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: last", () => {
  const action = Action({ id: "act-1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const x = Last({ action, change: "turn", dice: [0, 1], before: [0, 1] });
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: reply ok", () => {
  const x = Reply({ to: "t", seat: 0, ok: true, reason: null });
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: reply not ok", () => {
  const x = Reply({ to: "t", seat: 2, ok: false, reason: "illegal" });
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: game with working with()", () => {
  const x = makeGame();
  const y = fromJSON(toJSON(x));
  assert.deepStrictEqual(y, x);
  assert.strictEqual(y.with({ turn: 2 }).turn, 2);
});

test("round trip: message action", () => {
  const x = Message.action(Action({ id: "a", seat: 0, move: "roll", axis: null, dir: null, version: 0 }));
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: message reply", () => {
  const x = Message.reply(Reply({ to: "t", seat: 0, ok: true, reason: null }));
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

test("round trip: message game", () => {
  const x = Message.game(makeGame());
  assert.deepStrictEqual(fromJSON(toJSON(x)), x);
});

// ---- forged tag ----

test("forged tag: die with bad id fails", () => {
  assert.throws(
    () => fromJSON('{"kind":"die","id":99}'),
    /^TypeError: Die\.id: expected an integer 0\.\.15, got 99/,
  );
});

test("forged tag: die missing field fails", () => {
  assert.throws(
    () => fromJSON('{"kind":"die","id":1}'),
    /^TypeError: Die\.o: missing/,
  );
});

// ---- unknown kind and bad JSON ----

test("unknown kind fails", () => {
  assert.throws(() => fromJSON('{"kind":"nope"}'), /^TypeError: fromJSON: unknown kind nope/);
});

test("missing kind fails", () => {
  assert.throws(() => fromJSON('{"id":1,"o":2}'), /^TypeError: fromJSON: missing kind/);
});

test("bad JSON fails", () => {
  assert.throws(() => fromJSON("{bad"), /^TypeError: fromJSON: bad JSON:/);
});

// ---- Up (holds a function) ----

test("Up can't be serialised", () => {
  const up = Up({ poll() {}, emit() {} });
  assert.throws(() => toJSON(up), /^TypeError: toJSON: value holding a function can't be serialised/);
});

// ---- validate ----

test("validate returns [] on success", () => {
  assert.deepStrictEqual(validate(JSON.stringify(makeGame())), []);
});

test("validate returns [message] on failure", () => {
  const errs = validate("{bad");
  assert.strictEqual(errs.length, 1);
  assert.match(errs[0], /^fromJSON: bad JSON:/);
});
