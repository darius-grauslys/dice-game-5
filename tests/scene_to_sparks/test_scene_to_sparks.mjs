import * as real from "../../edges/scene/scene_to_sparks.mjs";
import assert from "node:assert/strict";
import * as THREE from "three";

// ---- wrappers: a drop-in for the forwarder ----

function isAnchor(a) {
  return a === null || (Array.isArray(a) && a.length === 3 && a.every((v) => typeof v === "number"));
}

export function init(scene) {
  if (!(scene && scene.isScene === true)) {
    throw new TypeError("init: scene must be a THREE.Scene");
  }
  const r = real.init(scene);
  if (r !== undefined) throw new Error("init: expected void return");
  return r;
}

export function dust(anchor) {
  if (!isAnchor(anchor)) {
    throw new TypeError("dust: anchor must be [x, y, z] or null");
  }
  const r = real.dust(anchor);
  if (r !== undefined) throw new Error("dust: expected void return");
  return r;
}

export function sparkler(anchor) {
  if (!isAnchor(anchor)) {
    throw new TypeError("sparkler: anchor must be [x, y, z] or null");
  }
  const r = real.sparkler(anchor);
  if (r !== undefined) throw new Error("sparkler: expected void return");
  return r;
}

export function step(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    throw new TypeError("step: ms must be a non-negative number");
  }
  const r = real.step(ms);
  if (r !== undefined) throw new Error("step: expected void return");
  return r;
}

export function count() {
  const r = real.count();
  if (typeof r !== "number") throw new Error("count: expected a number");
  return r;
}

export const _sheo_browser = true;

export async function _sheo_check() {
  // ---- argument validation: each wrapper throws naming its function ----
  // assert.throws matches the regex against String(error), which is "TypeError: fn: ...".
  assert.throws(() => init({}), /^TypeError: init:/, "init rejects non-scene");
  assert.throws(() => dust({}), /^TypeError: dust:/, "dust rejects bad anchor");
  assert.throws(() => dust([1, 2]), /^TypeError: dust:/, "dust rejects short anchor");
  assert.throws(() => dust(1), /^TypeError: dust:/, "dust rejects non-array anchor");
  assert.throws(() => sparkler({}), /^TypeError: sparkler:/, "sparkler rejects bad anchor");
  assert.throws(() => step("1"), /^TypeError: step:/, "step rejects non-number ms");
  assert.throws(() => step(-1), /^TypeError: step:/, "step rejects negative ms");

  // ---- build a realistic scene and exercise the contract ----
  const scene = new THREE.Scene();
  assert.ok(scene.isScene === true, "scene is a THREE.Scene");

  // init: adds one THREE.Points with additive blending, depthWrite: false, gold #ffd84a
  assert.strictEqual(init(scene), undefined, "init returns void");
  assert.strictEqual(scene.children.length, 1, "init adds one child");
  const points = scene.children[0];
  assert.ok(points.isPoints === true, "child is THREE.Points");
  const mat = points.material;
  assert.ok(mat !== undefined, "points has material");
  assert.strictEqual(mat.blending, 1, "additive blending");
  assert.strictEqual(mat.depthWrite, false, "depthWrite is false");
  assert.ok(Math.abs(mat.color.r - 1) < 0.01 && Math.abs(mat.color.g - 216/255) < 0.01 && Math.abs(mat.color.b - 74/255) < 0.01, "gold color #ffd84a");

  // dust and sparkler with an anchor: void return
  assert.strictEqual(dust([0, 2, 0]), undefined, "dust returns void");
  assert.strictEqual(sparkler([0, 2, 0]), undefined, "sparkler returns void");

  // dust and sparkler with null (stop): void return
  assert.strictEqual(dust(null), undefined, "dust(null) returns void");
  assert.strictEqual(sparkler(null), undefined, "sparkler(null) returns void");

  // step: void return
  assert.strictEqual(step(1000), undefined, "step returns void");

  // count: number of live particles
  const n = count();
  assert.strictEqual(typeof n, "number", "count returns number");
  assert.ok(Number.isInteger(n) && n >= 0, "count is a non-negative integer");
}
