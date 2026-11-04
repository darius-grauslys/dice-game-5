import { test } from "node:test";
import assert from "node:assert/strict";
import { AXES, DIRS, REASONS } from "../index.mjs";

test("AXES is the frozen array of axes", () => {
  assert.deepStrictEqual(AXES, ["x", "y", "z"]);
  assert.ok(Object.isFrozen(AXES));
});

test("DIRS is the frozen array of directions", () => {
  assert.deepStrictEqual(DIRS, [1, -1]);
  assert.ok(Object.isFrozen(DIRS));
});

test("REASONS is the frozen array of reasons", () => {
  assert.deepStrictEqual(REASONS, [
    "not-your-turn",
    "stale",
    "illegal",
    "over",
    "malformed",
  ]);
  assert.ok(Object.isFrozen(REASONS));
});

test("the constants are deeply frozen", () => {
  assert.throws(() => { AXES[0] = "w"; }, TypeError);
  assert.throws(() => { DIRS.push(2); }, TypeError);
  assert.throws(() => { REASONS.length = 0; }, TypeError);
});
