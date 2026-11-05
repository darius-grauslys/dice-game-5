import { test } from "node:test";
import assert from "node:assert/strict";
import { fade, next } from "../index.mjs";

test("fade golden values", () => {
  assert.strictEqual(fade(0, 180), 1);
  assert.strictEqual(fade(170, 180), 1);
  assert.strictEqual(fade(175, 180), 0.5);
  assert.strictEqual(fade(180, 180), 0);
  assert.strictEqual(fade(181, 180), 0);
  assert.strictEqual(fade(3, NaN), 1);
});

test("fade: never below 0", () => {
  assert.strictEqual(fade(200, 180), 0);
  assert.strictEqual(fade(300, 100), 0);
});

test("fade: 1 while duration is not finite", () => {
  assert.strictEqual(fade(0, Infinity), 1);
  assert.strictEqual(fade(0, -Infinity), 1);
  assert.strictEqual(fade(5, NaN), 1);
});

test("next golden values", () => {
  assert.strictEqual(next(["a", "b", "c"], "b", 0), "a");
  assert.strictEqual(next(["a", "b", "c"], "b", 0.99), "c");
  assert.strictEqual(next(["a"], "a", 0.5), "a");
  assert.strictEqual(next(["a", "b"], "a", 0.7), "b");
});

test("next: with one track returns that track", () => {
  assert.strictEqual(next(["x"], "x", 0), "x");
  assert.strictEqual(next(["x"], "x", 1), "x");
});

test("next: picks from the others in list order", () => {
  const list = ["a", "b", "c", "d"];
  // current "c": others ["a", "b", "d"], n-1=3
  assert.strictEqual(next(list, "c", 0), "a");
  assert.strictEqual(next(list, "c", 0.5), "b");
  assert.strictEqual(next(list, "c", 0.99), "d");
});
