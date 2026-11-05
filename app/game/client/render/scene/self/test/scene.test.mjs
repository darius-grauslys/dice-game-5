import { test } from "node:test";
import assert from "node:assert/strict";
import { YAW, FACES } from "../../../../../../../common/index.mjs";

function worldToRowNormal(wn, owner) {
  const yaw = YAW[owner];
  const r = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    r[i] = yaw[0][i] * wn.x + yaw[1][i] * wn.y + yaw[2][i] * wn.z;
  }
  const abs = [Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2])];
  const ax = abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : (abs[1] >= abs[2] ? 1 : 2);
  const sign = r[ax] >= 0 ? 1 : -1;
  return (sign > 0 ? "+" : "-") + "xyz"[ax];
}

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

test("FACES keys match face order", () => {
  const FACE_ORDER = ["+x", "-x", "+y", "-y", "+z", "-z"];
  for (const f of FACE_ORDER) {
    assert.ok(FACES[f] >= 1 && FACES[f] <= 6, `face ${f} has value ${FACES[f]}`);
  }
});
