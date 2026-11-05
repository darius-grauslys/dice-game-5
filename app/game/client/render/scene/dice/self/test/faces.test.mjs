import { test } from "node:test";
import assert from "node:assert/strict";
import { facesFor, makeDie } from "../index.mjs";

test("facesFor(1) golden values", () => {
  const result = facesFor(1);
  assert.deepStrictEqual(result, [
    [5, 3, 6, 1, 4, 2],
    [2, 3, 4, 5, 6, 1],
    [1, 6, 3, 5, 4, 2],
    [6, 5, 1, 4, 3, 2],
  ]);
});

test("facesFor(42) golden values", () => {
  const result = facesFor(42);
  assert.deepStrictEqual(result, [
    [4, 2, 5, 1, 3, 6],
    [3, 1, 4, 6, 2, 5],
    [4, 2, 1, 3, 5, 6],
    [2, 1, 3, 6, 5, 4],
  ]);
});

test("facesFor always returns four different perms", () => {
  for (const seed of [1, 42, 7, 100, 999, 0]) {
    const result = facesFor(seed);
    const strings = result.map((p) => JSON.stringify(p));
    const unique = new Set(strings);
    assert.strictEqual(unique.size, 4, `seed ${seed}`);
  }
});

test("facesFor is pure: same seed gives deep-equal results", () => {
  for (const seed of [1, 42, 7, 100]) {
    const a = facesFor(seed);
    const b = facesFor(seed);
    assert.deepStrictEqual(a, b);
  }
});

test("makeDie validates perm: not a permutation", () => {
  assert.throws(
    () => makeDie({ colour: "#ff0000", ring: "#ff8888", perm: [1, 2, 3, 4, 5] }),
    /^TypeError: dice\.makeDie: /,
  );
  assert.throws(
    () => makeDie({ colour: "#ff0000", ring: "#ff8888", perm: [1, 2, 3, 4, 5, 7] }),
    /^TypeError: dice\.makeDie: /,
  );
  assert.throws(
    () => makeDie({ colour: "#ff0000", ring: "#ff8888", perm: [1, 2, 3, 4, 5, 5] }),
    /^TypeError: dice\.makeDie: /,
  );
});

test("makeDie validates colour/ring: not #rrggbb", () => {
  const perm = [1, 2, 3, 4, 5, 6];
  assert.throws(
    () => makeDie({ colour: "ff0000", ring: "#ff8888", perm }),
    /^TypeError: dice\.makeDie: /,
  );
  assert.throws(
    () => makeDie({ colour: "#ff0000", ring: "ff8888", perm }),
    /^TypeError: dice\.makeDie: /,
  );
});
