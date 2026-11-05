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

  // init: adds one THREE.Points with additive blending, depthWrite: false
  assert.strictEqual(init(scene), undefined, "init returns void");
  assert.strictEqual(scene.children.length, 1, "init adds one child");
  const points = scene.children[0];
  assert.ok(points.isPoints === true, "child is THREE.Points");
  const mat = points.material;
  assert.ok(mat !== undefined, "points has material");
  assert.strictEqual(mat.blending, 1, "additive blending");
  assert.strictEqual(mat.depthWrite, false, "depthWrite is false");

  const geo = points.geometry;
  const pos = () => geo.positions;
  const col = () => geo.colors;

  const isGold = (c) => Math.abs(c[0]-1)<0.01 && Math.abs(c[1]-216/255)<0.01 && Math.abs(c[2]-74/255)<0.01;
  const isWhite = (c) => Math.abs(c[0]-1)<0.01 && Math.abs(c[1]-1)<0.01 && Math.abs(c[2]-1)<0.01;

  // dust: void return, ~40 particles/s on a ring of radius 0.6 (horizontal),
  // fall 0.5–0.9 units/s, opacity = height/anchor[1], gone at y<=0.
  assert.strictEqual(dust([0, 2, 0]), undefined, "dust returns void");
  step(250);
  let n = count();
  assert.ok(n > 0, "dust creates particles");

  const p = pos();
  const c = col();
  for (let i = 0; i < n; i++) {
    const x = p[i*3], y = p[i*3+1], z = p[i*3+2];
    const r = Math.sqrt(x*x + z*z);
    assert.ok(r > 0.55 && r < 0.65, `dust particle on ring radius 0.6 (i=${i}, r=${r.toFixed(3)})`);
    assert.ok(y < 2 && y > 0, `dust particle fell from y=2 (i=${i}, y=${y.toFixed(3)})`);
    const expectedOpacity = y / 2;
    assert.ok(Math.abs(c[i*4+3] - expectedOpacity) < 0.06, `dust opacity = height/anchor[1] (i=${i})`);
    assert.ok(isGold(c.slice(i*4, i*4+3)) || isWhite(c.slice(i*4, i*4+3)), `dust particle color gold #ffd84a or white (i=${i})`);
  }

  // dust(null): stop making dust, void return; live dust falls on.
  assert.strictEqual(dust(null), undefined, "dust(null) returns void");

  // gone at y<=0: after dust stops and particles fall below the table, they are gone.
  step(4000);
  assert.strictEqual(count(), 0, "dust particles gone at y<=0");

  // sparkler: void return, ~300 particles/s burst from anchor in random directions
  // at 2–5 units/s, fall under gravity 6, fade over a life of 0.6–1.2s.
  assert.strictEqual(sparkler([0, 3, 0]), undefined, "sparkler returns void");
  step(200);
  n = count();
  assert.ok(n > 0, "sparkler creates particles");

  const p2 = pos();
  const c2 = col();
  for (let i = 0; i < n; i++) {
    const x = p2[i*3], y = p2[i*3+1], z = p2[i*3+2];
    const dist = Math.sqrt(x*x + (y-3)*(y-3) + z*z);
    const speed = dist / 0.2;
    // doc: burst at 2–5 units/s; after 200ms with gravity the straight-line
    // speed-equiv ranges ~1.4–5.6 depending on direction. Allow margin.
    assert.ok(speed >= 1.0 && speed <= 7.0, `sparkler speed 2–5/s (i=${i}, speed=${speed.toFixed(2)})`);
    assert.ok(isGold(c2.slice(i*4, i*4+3)) || isWhite(c2.slice(i*4, i*4+3)), `sparkler particle color gold #ffd84a or white (i=${i})`);
  }

  // sparkler(null): stop, void return.
  assert.strictEqual(sparkler(null), undefined, "sparkler(null) returns void");

  // step: void return.
  assert.strictEqual(step(1000), undefined, "step returns void");

  // count: number of live particles.
  const cnt = count();
  assert.strictEqual(typeof cnt, "number", "count returns number");
  assert.ok(Number.isInteger(cnt) && cnt >= 0, "count is a non-negative integer");
}
