import { test } from "node:test";
import assert from "node:assert/strict";
import { FACES, ORIENTATIONS, TURN, facesFor, faces, look } from "../index.mjs";

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

test("facesFor(1) and facesFor(7)", () => {
  assert.deepStrictEqual(facesFor(1), [
    [5, 3, 6, 1, 4, 2],
    [2, 3, 4, 5, 6, 1],
    [1, 6, 3, 5, 4, 2],
    [6, 5, 1, 4, 3, 2],
  ]);
  assert.deepStrictEqual(facesFor(7), [
    [4, 3, 1, 6, 2, 5],
    [3, 4, 1, 5, 2, 6],
    [1, 2, 5, 4, 3, 6],
    [4, 6, 3, 2, 1, 5],
  ]);
  assert.ok(Object.isFrozen(facesFor(1)));
});

test("faces golden values", () => {
  assert.deepStrictEqual(faces(null, 0), { top: 1, bottom: 6, front: 3, back: 4, left: 5, right: 2 });
  assert.deepStrictEqual(faces(null, 1), { top: 3, bottom: 4, front: 6, back: 1, left: 5, right: 2 });
  assert.deepStrictEqual(faces([2, 3, 4, 5, 6, 1], 0), { top: 2, bottom: 1, front: 4, back: 5, left: 6, right: 3 });
  assert.deepStrictEqual(faces([2, 3, 4, 5, 6, 1], 9), { top: 2, bottom: 1, front: 6, back: 3, left: 5, right: 4 });
  assert.deepStrictEqual(faces([2, 3, 4, 5, 6, 1], 23), { top: 1, bottom: 2, front: 4, back: 5, left: 3, right: 6 });
});

test("look golden values", () => {
  assert.strictEqual(look(null, 0), "1");
  assert.strictEqual(look(null, 9), "1");
  assert.strictEqual(look(null, 1), "3:16");
  assert.strictEqual(look(null, 21), "3:16");
  assert.strictEqual(look(null, 5), "3:25");
  assert.strictEqual(look([2, 3, 4, 5, 6, 1], 0), "2:45");
  assert.strictEqual(look([2, 3, 4, 5, 6, 1], 9), "2:36");
  assert.strictEqual(look([2, 3, 4, 5, 6, 1], 20), "2:45");
  assert.strictEqual(look([2, 3, 4, 5, 6, 1], 3), "1");
  assert.strictEqual(look([2, 3, 4, 5, 6, 1], 10), "1");
  assert.strictEqual(look([2, 3, 4, 5, 6, 1], 1), "4");
  assert.strictEqual(look([2, 3, 4, 5, 6, 1], 5), "4");
});

test("perm [2,3,4,5,6,1] falls into 9 looks", () => {
  const perm = [2, 3, 4, 5, 6, 1];
  const groups = {};
  for (let o = 0; o < 24; o++) {
    const l = look(perm, o);
    if (!groups[l]) groups[l] = [];
    groups[l].push(o);
  }
  const expected = {
    "1": [3, 10, 14, 23],
    "4": [1, 5, 17, 21],
    "5": [2, 6, 18, 22],
    "2:45": [0, 20],
    "3:45": [4, 16],
    "6:45": [7, 19],
    "3:12": [8, 12],
    "2:36": [9, 13],
    "6:12": [11, 15],
  };
  assert.deepStrictEqual(groups, expected);
});

test("perm null: look groups match ORIENTATIONS key groups", () => {
  for (let a = 0; a < 24; a++) {
    for (let b = 0; b < 24; b++) {
      const eqLook = look(null, a) === look(null, b);
      const eqKey = ORIENTATIONS[a].key === ORIENTATIONS[b].key;
      assert.strictEqual(eqLook, eqKey);
    }
  }
});

test("faces([1,2,3,4,5,6], o) deep-equals faces(null, o) and results are frozen", () => {
  for (let o = 0; o < 24; o++) {
    assert.deepStrictEqual(faces([1, 2, 3, 4, 5, 6], o), faces(null, o));
    assert.ok(Object.isFrozen(faces(null, o)));
  }
});

test("faces and look throw on bad input", () => {
  assert.throws(() => faces([1, 2, 3, 4, 5, 5], 0), /^TypeError: faces: /);
  assert.throws(() => faces(null, 24), /^TypeError: faces: /);
  assert.throws(() => look(null, -1), /^TypeError: look: /);
});
