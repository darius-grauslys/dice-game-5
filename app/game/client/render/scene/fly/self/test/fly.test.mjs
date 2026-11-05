import { test } from "node:test";
import assert from "node:assert/strict";
import { flight } from "../index.mjs";

function makePose(position, matrix) {
  return { position: [...position], matrix: matrix.map((row) => [...row]) };
}

const POSE = makePose([0, 2, 0], [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]);

test("flight at t=0 returns the pose exactly", () => {
  for (const id of [0, 1, 7, 15]) {
    for (const seed of [0, 1, 42, 7919]) {
      const out = flight(POSE, id, seed, 0);
      assert.ok(Math.abs(out.position[0] - POSE.position[0]) < 1e-12);
      assert.ok(Math.abs(out.position[1] - POSE.position[1]) < 1e-12);
      assert.ok(Math.abs(out.position[2] - POSE.position[2]) < 1e-12);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          assert.ok(Math.abs(out.matrix[i][j] - POSE.matrix[i][j]) < 1e-12);
        }
      }
    }
  }
});

test("same arguments give the same result; different id or seed differs", () => {
  const a = flight(POSE, 3, 123, 1500);
  const b = flight(POSE, 3, 123, 1500);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      assert.strictEqual(a.matrix[i][j], b.matrix[i][j]);
    }
  }
  assert.strictEqual(a.position[0], b.position[0]);
  assert.strictEqual(a.position[1], b.position[1]);
  assert.strictEqual(a.position[2], b.position[2]);

  const c = flight(POSE, 4, 123, 1500);
  const d = flight(POSE, 3, 124, 1500);
  const sameIdDiffSeed = Math.abs(flight(POSE, 3, 123, 1500).position[0] - d.position[0]) > 1e-9 ||
    Math.abs(flight(POSE, 3, 123, 1500).position[1] - d.position[1]) > 1e-9;
  assert.ok(sameIdDiffSeed);
  const diffIdSameSeed = Math.abs(flight(POSE, 3, 123, 1500).position[0] - c.position[0]) > 1e-9 ||
    Math.abs(flight(POSE, 3, 123, 1500).position[1] - c.position[1]) > 1e-9;
  assert.ok(diffIdSameSeed);
});

test("for any id 0..15 and seed 1: t=500 higher or moved >=3 horizontally; t=4000 y<-20; matrix stays rotation", () => {
  for (let id = 0; id <= 15; id++) {
    const seed = 1;
    const at0 = flight(POSE, id, seed, 0);
    const at500 = flight(POSE, id, seed, 500);
    const dx = at500.position[0] - at0.position[0];
    const dz = at500.position[2] - at0.position[2];
    const horiz = Math.sqrt(dx * dx + dz * dz);
    const higher = at500.position[1] > at0.position[1];
    assert.ok(higher || horiz >= 3, `id ${id}: at t=500 not higher and moved < 3 horizontally (higher=${higher}, horiz=${horiz})`);

    const at4000 = flight(POSE, id, seed, 4000);
    assert.ok(at4000.position[1] < -20, `id ${id}: at t=4000 y=${at4000.position[1]} not < -20`);

    // matrix stays a rotation: orthonormal rows, determinant 1, within 1e-9
    const M = at4000.matrix;
    for (let i = 0; i < 3; i++) {
      let norm2 = 0;
      for (let j = 0; j < 3; j++) norm2 += M[i][j] * M[i][j];
      assert.ok(Math.abs(Math.sqrt(norm2) - 1) < 1e-9, `id ${id}: row ${i} not unit length`);
      for (let j = i + 1; j < 3; j++) {
        let dot = 0;
        for (let k = 0; k < 3; k++) dot += M[i][k] * M[j][k];
        assert.ok(Math.abs(dot) < 1e-9, `id ${id}: rows ${i} and ${j} not orthogonal`);
      }
    }
    // determinant
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
      M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
      M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    assert.ok(Math.abs(det - 1) < 1e-9, `id ${id}: determinant ${det} not 1`);
  }
});

test("flight throws TypeError starting fly.flight: on bad arguments", () => {
  assert.throws(() => flight(null, 0, 1, 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight([], 0, 1, 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2, 0] }, 0, 1, 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2], matrix: POSE.matrix }, 0, 1, 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2, 0], matrix: POSE.matrix }, 16, 1, 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2, 0], matrix: POSE.matrix }, -1, 1, 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2, 0], matrix: POSE.matrix }, 0, 1e100, 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2, 0], matrix: POSE.matrix }, 0, "1", 0), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2, 0], matrix: POSE.matrix }, 0, 1, -1), /^TypeError: fly\.flight: /);
  assert.throws(() => flight({ position: [0, 2, 0], matrix: POSE.matrix }, 0, 1, "0"), /^TypeError: fly\.flight: /);
});
