import assert from "node:assert/strict";
import { Mesh } from "three";
import * as real from "../../edges/scene/scene_to_dice.mjs";
import { FACE_PERMS, PLAYERS } from "../../common/index.mjs";

// ---- helpers ----

function isPerm(v) {
  if (!Array.isArray(v) || v.length !== 6) return false;
  const seen = new Set();
  for (const x of v) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > 6) return false;
    if (seen.has(x)) return false;
    seen.add(x);
  }
  return true;
}

function isHexColor(v) {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

function show(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "bigint") return `${v}n`;
  if (typeof v === "function") return "a function";
  if (Array.isArray(v)) return "an array";
  if (typeof v === "object") return "an object";
  return typeof v;
}

// ---- wrapped surface functions ----

function facesFor(seed) {
  // A) check args
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`facesFor: expected a safe integer seed, got ${show(seed)}`);
  }
  // B) call real
  const result = real.facesFor(seed);
  // C) check it returned
  if (result === undefined) {
    throw new Error("facesFor: did not return");
  }
  // D) check return value
  if (!Array.isArray(result) || result.length !== 4) {
    throw new Error("facesFor: expected an array of 4 perms");
  }
  const seen = new Set();
  for (const perm of result) {
    if (!isPerm(perm)) throw new Error(`facesFor: expected a permutation of 1..6, got ${show(perm)}`);
    const key = perm.join(",");
    if (seen.has(key)) throw new Error("facesFor: perms are not all different");
    seen.add(key);
  }
  return result;
}

function makeDie(input) {
  // A) check args
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`makeDie: expected an object {colour, ring, perm}, got ${show(input)}`);
  }
  const { colour, ring, perm } = input;
  if (!isHexColor(colour)) {
    throw new Error(`makeDie: colour must be a #rrggbb string, got ${show(colour)}`);
  }
  if (!isHexColor(ring)) {
    throw new Error(`makeDie: ring must be a #rrggbb string, got ${show(ring)}`);
  }
  if (!isPerm(perm)) {
    throw new Error(`makeDie: perm must be a permutation of 1..6, got ${show(perm)}`);
  }
  // B) call real
  const result = real.makeDie({ colour, ring, perm });
  // C) check it returned
  if (result === undefined) {
    throw new Error("makeDie: did not return");
  }
  // D) check return value
  if (!(result instanceof Mesh)) {
    throw new Error("makeDie: expected a THREE.Mesh");
  }
  const mats = result.material;
  if (!Array.isArray(mats) || mats.length !== 6) {
    throw new Error("makeDie: expected 6 materials");
  }
  for (const mat of mats) {
    if (!mat.map) throw new Error("makeDie: material map not set");
  }
  if (result.userData?.kind !== "die") {
    throw new Error("makeDie: mesh.userData.kind should be 'die'");
  }
  return result;
}

export { facesFor, makeDie };

// ---- test ----

export async function _sheo_check() {
  // facesFor golden values
  const f1 = facesFor(1);
  assert.deepStrictEqual(
    f1,
    [[5, 3, 6, 1, 4, 2], [2, 3, 4, 5, 6, 1], [1, 6, 3, 5, 4, 2], [6, 5, 1, 4, 3, 2]],
  );

  const f42 = facesFor(42);
  assert.deepStrictEqual(
    f42,
    [[4, 2, 5, 1, 3, 6], [3, 1, 4, 6, 2, 5], [4, 2, 1, 3, 5, 6], [2, 1, 3, 6, 5, 4]],
  );

  // The four are always different; facesFor(s) twice gives deep-equal results.
  for (const s of [1, 42, 7, 100, 2024]) {
    const a = facesFor(s);
    assert.strictEqual(a.length, 4);
    const seen = new Set();
    for (const perm of a) {
      const key = perm.join(",");
      assert.ok(!seen.has(key), "perms should be different");
      seen.add(key);
    }
    const b = facesFor(s);
    assert.deepStrictEqual(a, b);
  }

  // facesFor arg validation
  assert.throws(() => facesFor(1.5), /^Error: facesFor: expected a safe integer seed/);
  assert.throws(() => facesFor("1"), /^Error: facesFor: expected a safe integer seed/);
  assert.throws(() => facesFor(2 ** 53), /^Error: facesFor: expected a safe integer seed/);
  assert.throws(() => facesFor(null), /^Error: facesFor: expected a safe integer seed/);

  // makeDie with realistic inputs
  const p = FACE_PERMS[547]; // [5,3,6,1,4,2]
  const player = PLAYERS[0]; // { label: "P1", colour: "#2f7bff", ring: "#9cc2ff" }
  const mesh = makeDie({ colour: player.colour, ring: player.ring, perm: p });
  assert.ok(mesh instanceof Mesh);
  assert.strictEqual(mesh.userData.kind, "die");
  assert.strictEqual(mesh.material.length, 6);
  for (const mat of mesh.material) {
    assert.ok(mat.map, "material map should be set");
  }

  // makeDie arg validation
  assert.throws(
    () => makeDie({ colour: player.colour, ring: player.ring, perm: [1, 2, 3, 4, 5] }),
    /^Error: makeDie: perm must be a permutation of 1..6/,
  );
  assert.throws(
    () => makeDie({ colour: player.colour, ring: player.ring, perm: [1, 2, 3, 4, 5, 7] }),
    /^Error: makeDie: perm must be a permutation of 1..6/,
  );
  assert.throws(
    () => makeDie({ colour: player.colour, ring: player.ring, perm: [1, 2, 3, 4, 5, 1] }),
    /^Error: makeDie: perm must be a permutation of 1..6/,
  );
  assert.throws(
    () => makeDie({ colour: "red", ring: player.ring, perm: p }),
    /^Error: makeDie: colour must be a #rrggbb string/,
  );
  assert.throws(
    () => makeDie({ colour: player.colour, ring: "red", perm: p }),
    /^Error: makeDie: ring must be a #rrggbb string/,
  );
  assert.throws(
    () => makeDie({ colour: 123, ring: player.ring, perm: p }),
    /^Error: makeDie: colour must be a #rrggbb string/,
  );
}

export const _sheo_browser = true;
