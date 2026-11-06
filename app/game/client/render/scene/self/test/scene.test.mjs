import { test } from "node:test";
import assert from "node:assert/strict";
import { mat3ToMatrix4, worldToRowNormal, visibleFaces, FACE_ORDER } from "../math.mjs";
import { ease, turnAt, sameRotation } from "../hold.mjs";
import { YAW, CAMERA, FACES } from "../../../../../../../common/index.mjs";

test("mat3ToMatrix4: identity", () => {
  const m = mat3ToMatrix4([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  const e = m.elements;
  assert.strictEqual(e[0], 1); assert.strictEqual(e[1], 0); assert.strictEqual(e[2], 0);
  assert.strictEqual(e[4], 0); assert.strictEqual(e[5], 1); assert.strictEqual(e[6], 0);
  assert.strictEqual(e[8], 0); assert.strictEqual(e[9], 0); assert.strictEqual(e[10], 1);
  assert.strictEqual(e[15], 1);
});

test("mat3ToMatrix4: quarter turn (YAW[1])", () => {
  const m = mat3ToMatrix4([[0, 0, 1], [0, 1, 0], [-1, 0, 0]]);
  const e = m.elements;
  // set takes rows; elements are stored column-major: e[0]=a1, e[1]=a2, e[2]=a3, ...
  // m[0]=[0,0,1], m[1]=[0,1,0], m[2]=[-1,0,0]
  assert.strictEqual(e[0], 0); assert.strictEqual(e[1], 0); assert.strictEqual(e[2], -1); assert.strictEqual(e[3], 0);
  assert.strictEqual(e[4], 0); assert.strictEqual(e[5], 1); assert.strictEqual(e[6], 0); assert.strictEqual(e[7], 0);
  assert.strictEqual(e[8], 1); assert.strictEqual(e[9], 0); assert.strictEqual(e[10], 0); assert.strictEqual(e[11], 0);
  assert.strictEqual(e[15], 1);
});

test("worldToRowNormal: seat 0 identity maps +z to +z", () => {
  assert.strictEqual(worldToRowNormal({ x: 0, y: 0, z: 1 }, 0), "+z");
  assert.strictEqual(worldToRowNormal({ x: 1, y: 0, z: 0 }, 0), "+x");
  assert.strictEqual(worldToRowNormal({ x: 0, y: 1, z: 0 }, 0), "+y");
  assert.strictEqual(worldToRowNormal({ x: 0, y: 0, z: -1 }, 0), "-z");
});

test("worldToRowNormal: seat 1 rotation", () => {
  // YAW[1] = [[0,0,1],[0,1,0],[-1,0,0]], transpose times (0,0,1) = (-1,0,0) -> -x
  assert.strictEqual(worldToRowNormal({ x: 0, y: 0, z: 1 }, 1), "-x");
  // transpose times (1,0,0): r[2]=yaw[0][2]*1=1 -> +z
  assert.strictEqual(worldToRowNormal({ x: 1, y: 0, z: 0 }, 1), "+z");
});

test("worldToRowNormal: rounding to nearest axis", () => {
  const n = worldToRowNormal({ x: 0.1, y: 0.05, z: 0.9 }, 0);
  assert.strictEqual(n, "+z");
});

test("visibleFaces: seat 0, die 1 identity -> [1,2,3]", () => {
  const pose = { id: 1, owner: 0, group: 0, slot: 1, position: [-0.625, 0.5, 4], matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
  assert.deepStrictEqual(visibleFaces(pose, 0), [1, 2, 3]);
});

test("visibleFaces: seat 0, die 0 turned with YAW[1] -> [1,3,5]", () => {
  const pose = { id: 0, owner: 0, group: 0, slot: 0, position: [-1.875, 0.5, 4], matrix: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] };
  assert.deepStrictEqual(visibleFaces(pose, 0), [1, 3, 5]);
});

test("FACE_ORDER matches face order", () => {
  assert.deepStrictEqual(FACE_ORDER, ["+x", "-x", "+y", "-y", "+z", "-z"]);
  for (const f of FACE_ORDER) {
    assert.ok(FACES[f] >= 1 && FACES[f] <= 6, `face ${f} has value ${FACES[f]}`);
  }
});

test("ease: 0, 0.5, 1, 2", () => {
  assert.strictEqual(ease(0), 0);
  assert.strictEqual(ease(0.5), 0.5);
  assert.strictEqual(ease(1), 1);
  assert.strictEqual(ease(2), 1);
});

function quatAngle(from, q) {
  const dot = from[0] * q[0] + from[1] * q[1] + from[2] * q[2] + from[3] * q[3];
  return 2 * Math.acos(Math.abs(dot)) * 180 / Math.PI;
}

test("turnAt: identity to quarter y, 0, ms/2, ms, 2ms", () => {
  const from = [0, 0, 0, 1];
  const to = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const ms = 250;
  let a0 = quatAngle(from, turnAt(from, to, 0, ms));
  let a1 = quatAngle(from, turnAt(from, to, ms / 2, ms));
  let a2 = quatAngle(from, turnAt(from, to, ms, ms));
  let a3 = quatAngle(from, turnAt(from, to, 2 * ms, ms));
  assert.ok(Math.abs(a0 - 0) < 0.5, `a0=${a0}`);
  assert.ok(Math.abs(a1 - 45) < 0.5, `a1=${a1}`);
  assert.ok(Math.abs(a2 - 90) < 0.5, `a2=${a2}`);
  assert.ok(Math.abs(a3 - 90) < 0.5, `a3=${a3}`);
});

test("sameRotation: copy true, diff false", () => {
  const a = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const b = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const c = [[1 + 1e-6, 0, 0], [0, 1, 0], [0, 0, 1]];
  assert.ok(sameRotation(a, b));
  assert.ok(!sameRotation(a, c));
});
