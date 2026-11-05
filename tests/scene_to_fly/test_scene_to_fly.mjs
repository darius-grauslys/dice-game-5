import * as real from "../../edges/scene/scene_to_fly.mjs";
import * as assert from "node:assert/strict";
import { YAW } from "../../common/index.mjs";

function isVector3(v) {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

function isMatrix3(m) {
  return (
    Array.isArray(m) && m.length === 3 &&
    m.every((row) => Array.isArray(row) && row.length === 3 && row.every((x) => typeof x === "number" && Number.isFinite(x)))
  );
}

export function flight(pose, id, seed, t) {
  // A) check arguments against the doc
  if (pose === undefined || pose === null || typeof pose !== "object" || Array.isArray(pose))
    throw new Error("flight: pose must be an object with position and matrix");
  if (!("position" in pose) || !isVector3(pose.position))
    throw new Error("flight: pose.position must be a 3-vector of finite numbers");
  if (!("matrix" in pose) || !isMatrix3(pose.matrix))
    throw new Error("flight: pose.matrix must be a 3x3 matrix of finite numbers");
  if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > 15)
    throw new Error("flight: id must be an integer 0..15");
  if (typeof seed !== "number" || !Number.isInteger(seed))
    throw new Error("flight: seed must be an integer");
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0)
    throw new Error("flight: t must be a non-negative finite number");

  // B) call the real function through the edge
  const result = real.flight(pose, id, seed, t);

  // C) check that it returned
  if (result === undefined) throw new Error("flight: real.flight returned undefined");

  // D) check the return value shape against the doc
  if (result === undefined || result === null || typeof result !== "object" || Array.isArray(result))
    throw new Error("flight: return must be an object with position and matrix");
  if (!("position" in result) || !isVector3(result.position))
    throw new Error("flight: return.position must be a 3-vector of finite numbers");
  if (!("matrix" in result) || !isMatrix3(result.matrix))
    throw new Error("flight: return.matrix must be a 3x3 matrix of finite numbers");

  return result;
}

export async function _sheo_check() {
  const pose = { position: [0, 0, 0], matrix: YAW[0] };

  // Golden 1: flight(pose, id, seed, 0) deep-equals {position: pose.position, matrix: pose.matrix} within 1e-12
  for (const id of [0, 7, 15]) {
    for (const seed of [0, 1, 42]) {
      const r = flight(pose, id, seed, 0);
      assert.deepStrictEqual(r.position, pose.position);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          assert.ok(Math.abs(r.matrix[i][j] - pose.matrix[i][j]) <= 1e-12, `matrix[${i}][${j}] mismatch at t=0`);
        }
      }
    }
  }

  // Golden 2: the same arguments give the same result; a different id or seed gives a different path.
  const r1 = flight(pose, 3, 5, 1000);
  const r2 = flight(pose, 3, 5, 1000);
  assert.deepStrictEqual(r1, r2);

  const rDiffId = flight(pose, 4, 5, 1000);
  const rDiffSeed = flight(pose, 3, 6, 1000);
  assert.notDeepStrictEqual(r1, rDiffId);
  assert.notDeepStrictEqual(r1, rDiffSeed);

  // Argument validation: the wrapper throws an Error naming the function when arguments are wrong.
  assert.throws(() => flight(pose, -1, 0, 0), /flight: /);
  assert.throws(() => flight(pose, 16, 0, 0), /flight: /);
  assert.throws(() => flight(pose, 0, 0.5, 0), /flight: /);
  assert.throws(() => flight(pose, 0, 0, -1), /flight: /);
  assert.throws(() => flight({}, 0, 0, 0), /flight: /);
  assert.throws(() => flight({ position: [0, 0] }, 0, 0, 0), /flight: /);

  // Golden 3: for any id 0..15 and seed 1.
  for (let id = 0; id <= 15; id++) {
    const r0 = flight(pose, id, 1, 0);
    const r500 = flight(pose, id, 1, 500);
    const r4000 = flight(pose, id, 1, 4000);

    // at t = 500 the die is higher than at 0 or has moved at least 3 units horizontally
    const y500 = r500.position[1];
    const dx = r500.position[0] - r0.position[0];
    const dz = r500.position[2] - r0.position[2];
    const hdist = Math.sqrt(dx * dx + dz * dz);
    assert.ok(y500 > r0.position[1] || hdist >= 3, `id ${id}: t=500 not higher and <3 units horizontally`);

    // at t = 4000 its y is below -20 (it has left the table)
    assert.ok(r4000.position[1] < -20, `id ${id}: t=4000 y not below -20`);

    // matrix stays a rotation (orthonormal, determinant 1, within 1e-9)
    const M = r4000.matrix;
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(Math.sqrt(M[i].reduce((s, x) => s + x * x, 0)) - 1) <= 1e-9, `id ${id}: row ${i} not unit length`);
      for (let j = i + 1; j < 3; j++) {
        const dot = M[i].reduce((s, x, k) => s + x * M[j][k], 0);
        assert.ok(Math.abs(dot) <= 1e-9, `id ${id}: rows ${i},${j} not orthogonal`);
      }
    }
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
                M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
                M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    assert.ok(Math.abs(det - 1) <= 1e-9, `id ${id}: determinant not 1`);
  }
}
