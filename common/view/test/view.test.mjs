import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIE, GAP, GROUP_GAP, TABLE_R,
  YAW, CAMERA, ROLL_PAD, DRAG_MIN, DRAG, MS,
  PLAYERS, FACE_PERMS, STACK, SECTORS, FOLLOW, GLOW, LABEL, WIN,
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
  assert.strictEqual(TABLE_R, 4.6);
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

test("phase 3 values", () => {
  assert.deepStrictEqual(PLAYERS, [
    { label: "P1", colour: "#2f7bff", ring: "#9cc2ff" },
    { label: "P2", colour: "#e5322d", ring: "#ff9b98" },
    { label: "P3", colour: "#f2c200", ring: "#fff08a" },
    { label: "P4", colour: "#ff5fae", ring: "#ffc2e0" },
  ]);
  assert.deepStrictEqual(STACK, { dx: 1.05, dz: 1.05 });
  assert.deepStrictEqual(SECTORS, [
    { axis: "y", dir: 1 }, { axis: "x", dir: -1 }, { axis: "z", dir: 1 },
    { axis: "y", dir: -1 }, { axis: "x", dir: 1 }, { axis: "z", dir: -1 },
  ]);
  assert.deepStrictEqual(FOLLOW, { max: 0.6, lift: 0.3 });
  assert.deepStrictEqual(GLOW, { colour: "#ffd84a", periodMs: 2000, min: 0.35, max: 0.9 });
  assert.deepStrictEqual(LABEL, { beyond: 1.4, height: 1.5, size: 0.8, out: { own: 4.1, side: 2.3, far: 4.2 } });
  assert.deepStrictEqual(WIN, { label: 2000, labelMs: 1500, window: 5500, restart: 8000 });
});

test("FACE_PERMS structure", () => {
  assert.strictEqual(FACE_PERMS.length, 720);
  assert.deepStrictEqual(FACE_PERMS[0], [1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual(FACE_PERMS[1], [1, 2, 3, 4, 6, 5]);
  assert.deepStrictEqual(FACE_PERMS[100], [1, 6, 2, 5, 3, 4]);
  assert.deepStrictEqual(FACE_PERMS[719], [6, 5, 4, 3, 2, 1]);

  const set = new Set();
  for (const p of FACE_PERMS) {
    const s = JSON.stringify(p);
    assert.ok(!set.has(s), "duplicate permutation");
    set.add(s);
    assert.strictEqual(p.length, 6);
    const sorted = [...p].sort((a, b) => a - b);
    assert.deepStrictEqual(sorted, [1, 2, 3, 4, 5, 6], "not a permutation of 1..6");
  }
  assert.strictEqual(set.size, 720);

  for (let k = 1; k < FACE_PERMS.length; k++) {
    const a = FACE_PERMS[k - 1], b = FACE_PERMS[k];
    for (let m = 0; m < 6; m++) {
      if (a[m] !== b[m]) { assert.ok(a[m] < b[m], `entry ${k} not lexicographically greater`); break; }
    }
  }
});

test("SECTORS agrees with TURN", () => {
  function key(m) { return [m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]].join(","); }
  function applyTurn(oIdx, axis, dir) {
    const newIdx = TURN[oIdx][axis][dir];
    return ORIENTATIONS[newIdx].matrix;
  }

  // sector 0 (right): {axis:"y", dir:1} turns +z into +x
  const m0 = applyTurn(0, "y", "1");
  assert.deepStrictEqual([m0[0][2], m0[1][2], m0[2][2]], [1, 0, 0]);

  // sector 4 (down-left): {axis:"x", dir:1} turns +y into +z
  const m4 = applyTurn(0, "x", "1");
  assert.deepStrictEqual([m4[0][1], m4[1][1], m4[2][1]], [0, 0, 1]);

  // sector 5 (down-right): {axis:"z", dir:-1} turns +y into +x
  const m5 = applyTurn(0, "z", "-1");
  assert.deepStrictEqual([m5[0][1], m5[1][1], m5[2][1]], [1, 0, 0]);

  // sectors 1, 2, 3 are 4, 5, 0 reversed (dir negated)
  assert.deepStrictEqual(SECTORS[1], { axis: "x", dir: -1 });
  assert.deepStrictEqual(SECTORS[2], { axis: "z", dir: 1 });
  assert.deepStrictEqual(SECTORS[3], { axis: "y", dir: -1 });
});

test("phase 3 values are deeply frozen", () => {
  deepFrozen(PLAYERS);
  deepFrozen(FACE_PERMS);
  for (const p of FACE_PERMS) deepFrozen(p);
  deepFrozen(STACK);
  deepFrozen(SECTORS);
  deepFrozen(FOLLOW);
  deepFrozen(GLOW);
  deepFrozen(LABEL);
  deepFrozen(WIN);
});
