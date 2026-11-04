import { test } from "node:test";
import assert from "node:assert/strict";
import { Action, Last, Die } from "../index.mjs";

const turn = Action({ id: "t1", seat: 0, move: "turn", axis: "z", dir: 1, version: 3 });
const roll = Action({ id: "r1", seat: 1, move: "roll", axis: null, dir: null, version: 4 });

test("Last builds a deal", () => {
  const l = Last({ action: null, change: "deal", dice: [0, 1, 2, 3], before: [1, 2, 3, 4] });
  assert.deepStrictEqual(l, {
    kind: "last",
    action: null,
    change: "deal",
    dice: [0, 1, 2, 3],
    before: [1, 2, 3, 4],
  });
  assert.deepStrictEqual(Object.keys(l), ["kind", "action", "change", "dice", "before"]);
  assert.ok(Object.isFrozen(l));
  assert.ok(Object.isFrozen(l.dice));
  assert.ok(Object.isFrozen(l.before));
});

test("Last builds a turn carrying its Action", () => {
  const l = Last({ action: turn, change: "turn", dice: [5], before: [7] });
  assert.strictEqual(l.action, turn);
});

test("Last builds a roll carrying its Action", () => {
  const l = Last({ action: roll, change: "roll", dice: [9, 10], before: [0, 1] });
  assert.strictEqual(l.action, roll);
});

test("Last rejects a non-null action for a deal", () => {
  assert.throws(
    () => Last({ action: turn, change: "deal", dice: [0], before: [0] }),
    /Last\.action: /,
  );
});

test("Last rejects a null action for a turn and a roll", () => {
  assert.throws(
    () => Last({ action: null, change: "turn", dice: [0], before: [0] }),
    /Last\.action: /,
  );
  assert.throws(
    () => Last({ action: null, change: "roll", dice: [0], before: [0] }),
    /Last\.action: /,
  );
});

test("Last rejects an action whose move is not the change", () => {
  assert.throws(
    () => Last({ action: turn, change: "roll", dice: [0], before: [0] }),
    /Last\.action: /,
  );
  assert.throws(
    () => Last({ action: roll, change: "turn", dice: [0], before: [0] }),
    /Last\.action: /,
  );
});

test("Last rejects an action that is not an Action", () => {
  assert.throws(
    () => Last({ action: Die({ id: 0, o: 0 }), change: "turn", dice: [0], before: [0] }),
    /Last\.action: /,
  );
});

test("Last rejects a bad change", () => {
  for (const change of ["jump", "", null, 5, "DEAL"])
    assert.throws(
      () => Last({ action: null, change, dice: [0], before: [0] }),
      /Last\.change: /,
      `change=${JSON.stringify(change)}`,
    );
});

test("Last rejects a bad dice", () => {
  const cases = [
    [], // empty
    [0, 0], // a repeat
    [16],
    [-1],
    [0.5],
    ["0"],
    [null],
    5,
  ];
  for (const dice of cases)
    assert.throws(
      () => Last({ action: null, change: "deal", dice, before: new Array(dice.length ?? 0).fill(0) }),
      /Last\.dice: /,
      `dice=${JSON.stringify(dice)}`,
    );
});

test("Last rejects a bad before", () => {
  const cases = [
    [], // shorter than dice
    [0, 0, 0, 0, 0], // longer than dice
    [24],
    [-1],
    ["0"],
    [null],
  ];
  for (const before of cases)
    assert.throws(
      () => Last({ action: null, change: "deal", dice: [0], before }),
      /Last\.before: /,
      `before=${JSON.stringify(before)}`,
    );
});

test("Last rejects missing and unknown fields", () => {
  assert.throws(
    () => Last({ change: "deal", dice: [0], before: [0] }),
    /Last\.action: /,
  );
  assert.throws(
    () => Last({ action: null, dice: [0], before: [0] }),
    /Last\.change: /,
  );
  assert.throws(
    () => Last({ action: null, change: "deal", before: [0] }),
    /Last\.dice: /,
  );
  assert.throws(
    () => Last({ action: null, change: "deal", dice: [0] }),
    /Last\.before: /,
  );
  assert.throws(
    () => Last({ action: null, change: "deal", dice: [0], before: [0], note: "x" }),
    /Last\.note: unknown field$/,
  );
});

test("Last's value is deeply frozen", () => {
  const l = Last({ action: null, change: "deal", dice: [0], before: [1] });
  assert.throws(() => { l.action = turn; }, TypeError);
  assert.throws(() => { l.dice.push(1); }, TypeError);
  assert.throws(() => { l.before[0] = 2; }, TypeError);
});
