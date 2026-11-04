import { test } from "node:test";
import assert from "node:assert/strict";
import { FACES, ORIENTATIONS, TURN } from "../index.mjs";

function deepFrozen(v) {
  if (Array.isArray(v)) {
    assert.ok(Object.isFrozen(v), "array is frozen");
    for (const e of v) deepFrozen(e);
  } else if (v && typeof v === "object") {
    assert.ok(Object.isFrozen(v), "object is frozen");
    for (const key of Object.getOwnPropertyNames(v)) deepFrozen(v[key]);
  }
}

test("FACES is the frozen faces object", () => {
  assert.deepStrictEqual(FACES, { "+x": 2, "-x": 5, "+y": 1, "-y": 6, "+z": 3, "-z": 4 });
  assert.ok(Object.isFrozen(FACES));
});

test("ORIENTATIONS has 24 entries", () => {
  assert.strictEqual(ORIENTATIONS.length, 24);
});

test("ORIENTATIONS[0]", () => {
  const o = ORIENTATIONS[0];
  assert.deepStrictEqual(o, { index: 0, matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], up: 1, key: "1" });
});

test("ORIENTATIONS[1]", () => {
  const o = ORIENTATIONS[1];
  assert.deepStrictEqual(o.matrix, [[1, 0, 0], [0, 0, 1], [0, -1, 0]]);
  assert.strictEqual(o.up, 3);
  assert.strictEqual(o.key, "3a");
});

test("ORIENTATIONS[5]", () => {
  const o = ORIENTATIONS[5];
  assert.deepStrictEqual(o.matrix, [[0, 1, 0], [0, 0, 1], [1, 0, 0]]);
  assert.strictEqual(o.up, 3);
  assert.strictEqual(o.key, "3b");
});

test("ORIENTATIONS[23]", () => {
  const o = ORIENTATIONS[23];
  assert.deepStrictEqual(o.matrix, [[-1, 0, 0], [0, -1, 0], [0, 0, 1]]);
  assert.strictEqual(o.up, 6);
  assert.strictEqual(o.key, "6b");
});

test("key counts over the 24", () => {
  const counts = {};
  for (const o of ORIENTATIONS) counts[o.key] = (counts[o.key] || 0) + 1;
  for (const k of ["1", "4", "5"]) assert.strictEqual(counts[k], 4);
  for (const k of ["2a", "2b", "3a", "3b", "6a", "6b"]) assert.strictEqual(counts[k], 2);
});

test("TURN[0] and TURN[7]", () => {
  assert.deepStrictEqual(TURN[0], { x: { "1": 2, "-1": 1 }, y: { "1": 9, "-1": 13 }, z: { "1": 16, "-1": 7 } });
  assert.deepStrictEqual(TURN[7], { x: { "1": 6, "-1": 5 }, y: { "1": 11, "-1": 15 }, z: { "1": 0, "-1": 23 } });
});

test("TURN round trip and four 1 turns", () => {
  for (let o = 0; o < 24; o++) {
    for (const axis of ["x", "y", "z"]) {
      const a = TURN[o][axis]["1"];
      assert.strictEqual(TURN[a][axis]["-1"], o);
      let c = o;
      for (let t = 0; t < 4; t++) c = TURN[c][axis]["1"];
      assert.strictEqual(c, o);
    }
  }
});

test("From o=0: up after quarter turns", () => {
  const upAfter = (o, axis, dir) => ORIENTATIONS[TURN[o][axis][String(dir)]].up;
  assert.strictEqual(upAfter(0, "x", 1), 4);
  assert.strictEqual(upAfter(0, "y", 1), 1);
  assert.strictEqual(upAfter(0, "z", 1), 2);
});

test("everything is deeply frozen", () => {
  deepFrozen(FACES);
  deepFrozen(ORIENTATIONS);
  deepFrozen(TURN);
});
