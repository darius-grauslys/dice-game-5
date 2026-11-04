import { test } from "node:test";
import assert from "node:assert/strict";
import { Die, Group } from "../index.mjs";
import { die } from "./helpers.mjs";

test("Group builds a valid value", () => {
  const a = die(0);
  const b = die(1);
  const g = Group({ dice: [a, b] });
  assert.deepStrictEqual(g, { kind: "group", dice: [a, b] });
  assert.deepStrictEqual(Object.keys(g), ["kind", "dice"]);
  assert.ok(Object.isFrozen(g));
  assert.ok(Object.isFrozen(g.dice));
  // Rule 5: shared values are passed through, not copied.
  assert.strictEqual(g.dice[0], a);
  assert.strictEqual(g.dice[1], b);
});

test("Group rejects a bad dice", () => {
  for (const dice of [null, 5, "dice", {}, die(0), [die(0), { id: 1, o: 0 }], [die(0), null]])
    assert.throws(
      () => Group({ dice }),
      /Group\.dice: /,
      `dice=${JSON.stringify(dice)}`,
    );
});

test("Group rejects an empty dice", () => {
  assert.throws(() => Group({ dice: [] }), /Group\.dice: /);
});

test("Group rejects missing and unknown fields", () => {
  assert.throws(() => Group({}), /Group\.dice: /);
  assert.throws(
    () => Group({ dice: [die(0)], spare: die(1) }),
    /Group\.spare: unknown field$/,
  );
});

test("Group's value is deeply frozen", () => {
  const g = Group({ dice: [die(0)] });
  assert.throws(() => { g.dice = []; }, TypeError);
  assert.throws(() => { g.dice.push(die(1)); }, TypeError);
});
