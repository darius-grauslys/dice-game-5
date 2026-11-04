import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIE, GAP, GROUP_GAP, TABLE_R,
  YAW, CAMERA, ROLL_PAD, DRAG_MIN, DRAG, MS,
} from "../index.mjs";
import { ORIENTATIONS, TURN } from "../../tables/index.mjs";

function deepFrozen(v) {
  if (Array.isArray(v)) {
    assert.ok(Object.isFrozen(v), "array is frozen");
    for (const e of v) deepFrozen(e);
  } else if (v && typeof v === "object") {
    assert.ok(Object.isFrozen(v), "object is frozen");
    for (const key of Object.getOwnPropertyNames(v)) deepFrozen(v[key]);
  }
}

function det3(m) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
       - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
       + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

function matMul(A, B) {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += A[i][k] * B[k][j];
      r[i][j] = sum;
    }
  return r;
}

test("surface values", () => {
  assert.strictEqual(DIE, 1);
  assert.strictEqual(GAP, 0.25);
  assert.strictEqual(GROUP_GAP, 0.5);
  assert.strictEqual(TABLE_R, 4);
  assert.strictEqual(DRAG_MIN, 12);
});

test("YAW values", () => {
  assert.deepStrictEqual(YAW, [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
    [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ]);
});

test("CAMERA and ROLL_PAD", () => {
  assert.deepStrictEqual(CAMERA, { eye: [0, 7, 13], target: [0, 0, 2], fov: 45 });
  assert.deepStrictEqual(ROLL_PAD, { center: [0, 0.01, 6.5], size: 1.4 });
});

test("DRAG", () => {
  assert.deepStrictEqual(DRAG, {
    "+z": { right: { axis: "y", dir: 1 }, left: { axis: "y", dir: -1 }, up: { axis: "x", dir: -1 }, down: { axis: "x", dir: 1 } },
    "+y": { right: { axis: "z", dir: -1 }, left: { axis: "z", dir: 1 }, up: { axis: "x", dir: -1 }, down: { axis: "x", dir: 1 } },
  });
});

test("MS", () => {
  assert.deepStrictEqual(MS, { turn: 250, roll: 600, deal: 600, move: 300 });
});

test("YAW composition and rotations", () => {
  assert.deepStrictEqual(YAW[2], matMul(YAW[1], YAW[1]));
  assert.deepStrictEqual(YAW[3], matMul(YAW[1], YAW[2]));
  for (const m of YAW) {
    assert.strictEqual(det3(m), 1);
  }
});

test("DRAG agrees with TURN", () => {
  const worldAxes = {
    "+x": [1, 0, 0], "-x": [-1, 0, 0],
    "+y": [0, 1, 0], "-y": [0, -1, 0],
    "+z": [0, 0, 1], "-z": [0, 0, -1],
  };

  // for "+z": right/left/up/down mean world +x/-x/+y/-y
  const zDrag = {
    right: { axis: "y", dir: "1", world: "+x" },
    left: { axis: "y", dir: "-1", world: "-x" },
    up: { axis: "x", dir: "-1", world: "+y" },
    down: { axis: "x", dir: "1", world: "-y" },
  };
  for (const [dir, e] of Object.entries(zDrag)) {
    const o = TURN[0][e.axis][e.dir];
    // column 2 (local z) of ORIENTATIONS[o].matrix is where +z points
    const vec = [ORIENTATIONS[o].matrix[0][2], ORIENTATIONS[o].matrix[1][2], ORIENTATIONS[o].matrix[2][2]];
    assert.deepStrictEqual(vec, worldAxes[e.world], `+z ${dir} should point world ${e.world}`);
    assert.deepStrictEqual(DRAG["+z"][dir], { axis: e.axis, dir: Number(e.dir) });
  }

  // for "+y": right/left/up/down mean +x/-x/-z/+z
  const yDrag = {
    right: { axis: "z", dir: "-1", world: "+x" },
    left: { axis: "z", dir: "1", world: "-x" },
    up: { axis: "x", dir: "-1", world: "-z" },
    down: { axis: "x", dir: "1", world: "+z" },
  };
  for (const [dir, e] of Object.entries(yDrag)) {
    const o = TURN[0][e.axis][e.dir];
    // column 1 (local y) of ORIENTATIONS[o].matrix is where +y points
    const vec = [ORIENTATIONS[o].matrix[0][1], ORIENTATIONS[o].matrix[1][1], ORIENTATIONS[o].matrix[2][1]];
    assert.deepStrictEqual(vec, worldAxes[e.world], `+y ${dir} should point world ${e.world}`);
    assert.deepStrictEqual(DRAG["+y"][dir], { axis: e.axis, dir: Number(e.dir) });
  }
});

test("everything is deeply frozen", () => {
  deepFrozen(DIE);
  deepFrozen(GAP);
  deepFrozen(GROUP_GAP);
  deepFrozen(TABLE_R);
  deepFrozen(YAW);
  deepFrozen(CAMERA);
  deepFrozen(ROLL_PAD);
  deepFrozen(DRAG_MIN);
  deepFrozen(DRAG);
  deepFrozen(MS);
});
