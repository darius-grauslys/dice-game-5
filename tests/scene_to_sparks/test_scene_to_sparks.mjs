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

export function ring() {
  const r = real.ring();
  if (!Array.isArray(r)) throw new Error("ring: expected an array");
  for (const p of r) {
    if (!Array.isArray(p) || p.length !== 3 || !p.every((v) => typeof v === "number")) {
      throw new Error("ring: expected array of [x, y, z]");
    }
  }
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

  // Before any dust: ring() is [].
  assert.deepStrictEqual(ring(), [], "ring() is [] before any dust");

  // dust([1, 1.2, -2]), then step(16) once: ring() has 48 entries, all still
  // outside radius 1.2 from the anchor horizontally (they're forming).
  assert.strictEqual(dust([1, 1.2, -2]), undefined, "dust returns void");
  step(16);
  let r = ring();
  assert.strictEqual(r.length, 48, "ring() has 48 entries after step(16)");
  {
    const cx = 1, cz = -2;
    for (let i = 0; i < 48; i++) {
      const x = r[i][0], z = r[i][2];
      const rhoriz = Math.sqrt((x-cx)*(x-cx) + (z-cz)*(z-cz));
      assert.ok(rhoriz > 1.2, `ring particle forming, outside radius 1.2 (i=${i}, r=${rhoriz.toFixed(3)})`);
    }
  }

  // After 800 ms in total: each of the 48 entries is at horizontal distance
  // 0.9 ± 0.02 from [1, -2] (x, z) and height 1.2 ± 0.02; neighbouring slots
  // are 2π/48 ± 0.01 radians apart (going round the slot order).
  step(784);
  r = ring();
  assert.strictEqual(r.length, 48, "ring() has 48 entries after 800ms");
  {
    const cx = 1, cz = -2, cy = 1.2;
    let prevAngle = null;
    for (let i = 0; i < 48; i++) {
      const x = r[i][0], y = r[i][1], z = r[i][2];
      const rhoriz = Math.sqrt((x-cx)*(x-cx) + (z-cz)*(z-cz));
      assert.ok(Math.abs(rhoriz - 0.9) <= 0.02, `ring particle at radius 0.9 (i=${i}, r=${rhoriz.toFixed(3)})`);
      assert.ok(Math.abs(y - cy) <= 0.02, `ring particle at height 1.2 (i=${i}, y=${y.toFixed(3)})`);
      const angle = Math.atan2(z-cz, x-cx);
      if (prevAngle !== null) {
        let d = angle - prevAngle;
        while (d <= -Math.PI) d += 2*Math.PI;
        while (d > Math.PI) d -= 2*Math.PI;
        assert.ok(Math.abs(d - 2*Math.PI/48) <= 0.01, `neighbouring slots 2π/48 apart (i=${i}, d=${d.toFixed(4)})`);
      }
      prevAngle = angle;
    }
  }

  // After 500 ms more: each slot's angle has grown by 0.4 ± 0.05 radians
  // (the ring turns at 0.8 rad/s).
  const anglesBefore = [];
  {
    const cx = 1, cz = -2;
    for (let i = 0; i < 48; i++) {
      anglesBefore.push(Math.atan2(r[i][2]-cz, r[i][0]-cx));
    }
  }
  step(500);
  {
    const cx = 1, cz = -2;
    r = ring();
    for (let i = 0; i < 48; i++) {
      const angle = Math.atan2(r[i][2]-cz, r[i][0]-cx);
      let d = angle - anglesBefore[i];
      while (d <= -Math.PI) d += 2*Math.PI;
      while (d > Math.PI) d -= 2*Math.PI;
      assert.ok(Math.abs(d - 0.4) <= 0.05, `ring turned 0.4 rad (i=${i}, d=${d.toFixed(4)})`);
    }
  }

  // dust([1, 1.2, -2]) again (a new array, same values), step(16): the ring
  // has not formed again: every entry still at 0.9 ± 0.02 from the anchor,
  // and slot 0's angle continues from before (within 0.05 of where 16 ms more
  // of turning puts it).
  const slot0AngleBefore = Math.atan2(r[0][2]-(-2), r[0][0]-1);
  const expectedSlot0After = slot0AngleBefore + 0.8 * (16/1000);
  assert.strictEqual(dust([1, 1.2, -2]), undefined, "dust with same anchor returns void");
  step(16);
  r = ring();
  assert.strictEqual(r.length, 48, "ring() still 48 entries after same anchor dust");
  {
    const cx = 1, cz = -2;
    for (let i = 0; i < 48; i++) {
      const x = r[i][0], z = r[i][2];
      const rhoriz = Math.sqrt((x-cx)*(x-cx) + (z-cz)*(z-cz));
      assert.ok(Math.abs(rhoriz - 0.9) <= 0.02, `ring particle at radius 0.9 after same anchor (i=${i}, r=${rhoriz.toFixed(3)})`);
    }
    const slot0AngleAfter = Math.atan2(r[0][2]-(-2), r[0][0]-1);
    let d = slot0AngleAfter - expectedSlot0After;
    while (d <= -Math.PI) d += 2*Math.PI;
    while (d > Math.PI) d -= 2*Math.PI;
    assert.ok(Math.abs(d) <= 0.05, `slot 0's angle continues from before (d=${d.toFixed(4)})`);
  }

  // After 1000 ms with the ring set (and no sparkler running: sparkler(null)
  // first, and let its particles die): count() is more than 48 (falling
  // particles too), and every particle that isn't in ring() is below the
  // anchor's height or at it.
  assert.strictEqual(sparkler(null), undefined, "sparkler(null) returns void");
  step(1000);
  const cnt = count();
  assert.ok(cnt > 48, `count() is more than 48 (cnt=${cnt})`);
  {
    const p = pos();
    const ringPos = ring().map((pt) => [pt[0], pt[1], pt[2]]);
    const cy = 1.2;
    for (let i = 0; i < cnt; i++) {
      const x = p[i*3], y = p[i*3+1], z = p[i*3+2];
      let inRing = false;
      for (let k = 0; k < ringPos.length; k++) {
        if (Math.abs(ringPos[k][0]-x)<0.02 && Math.abs(ringPos[k][1]-y)<0.02 && Math.abs(ringPos[k][2]-z)<0.02) {
          inRing = true;
          break;
        }
      }
      if (!inRing) {
        assert.ok(y <= cy + 0.02, `non-ring particle below or at anchor height (i=${i}, y=${y.toFixed(3)}, cy=${cy})`);
      }
    }
  }

  // dust([-1, 1.2, 2]): after 800 ms more, ring() is 48 entries at 0.9 ± 0.02
  // around [-1, 2], height 1.2 ± 0.02.
  assert.strictEqual(dust([-1, 1.2, 2]), undefined, "dust new anchor returns void");
  step(800);
  r = ring();
  assert.strictEqual(r.length, 48, "ring() has 48 entries after new anchor dust");
  {
    const cx = -1, cz = 2, cy = 1.2;
    for (let i = 0; i < 48; i++) {
      const x = r[i][0], y = r[i][1], z = r[i][2];
      const rhoriz = Math.sqrt((x-cx)*(x-cx) + (z-cz)*(z-cz));
      assert.ok(Math.abs(rhoriz - 0.9) <= 0.02, `new ring particle at radius 0.9 (i=${i}, r=${rhoriz.toFixed(3)})`);
      assert.ok(Math.abs(y - cy) <= 0.02, `new ring particle at height 1.2 (i=${i}, y=${y.toFixed(3)})`);
    }
  }

  // dust(null): ring() is [] at once; count() doesn't grow from then on
  // (step 100 ms at a time and check), and is 0 after at most 5000 ms.
  assert.strictEqual(dust(null), undefined, "dust(null) returns void");
  assert.deepStrictEqual(ring(), [], "ring() is [] after dust(null)");
  let c0 = count();
  let elapsed = 0;
  while (elapsed < 5000) {
    step(100);
    elapsed += 100;
    const c = count();
    assert.ok(c <= c0, `count() doesn't grow after dust(null) (c=${c}, c0=${c0})`);
    if (c === 0) break;
  }
  assert.strictEqual(count(), 0, "count() is 0 after dust(null) and falling particles die");

  // sparkler: void return, ~300 particles/s burst from anchor in random directions
  // at 2–5 units/s, fall under gravity 6, fade over a life of 0.6–1.2s.
  assert.strictEqual(sparkler([0, 3, 0]), undefined, "sparkler returns void");
  step(200);
  let n = count();
  assert.ok(n > 0, "sparkler creates particles");

  const p2 = pos();
  const c2 = col();
  for (let i = 0; i < n; i++) {
    const x = p2[i*3], y = p2[i*3+1], z = p2[i*3+2];
    // particles burst from anchor in random directions at 2–5 units/s and fall
    // under gravity 6; after 200ms they stay within a bounded radius of the anchor.
    const dist = Math.sqrt(x*x + (y-3)*(y-3) + z*z);
    assert.ok(dist >= 0 && dist <= 1.5, `sparkler particle within bound (i=${i}, dist=${dist.toFixed(3)})`);
    assert.ok(isGold(c2.slice(i*4, i*4+3)) || isWhite(c2.slice(i*4, i*4+3)), `sparkler particle color gold #ffd84a or white (i=${i})`);
  }

  // sparkler(null): stop, void return.
  assert.strictEqual(sparkler(null), undefined, "sparkler(null) returns void");

  // fade over life 0.6–1.2s: after sparkler stops, live particles die out.
  step(1500);
  assert.strictEqual(count(), 0, "sparkler particles fade out over life 0.6–1.2s");

  // step: void return.
  assert.strictEqual(step(1000), undefined, "step returns void");

  // count: number of live particles.
  const cnt2 = count();
  assert.strictEqual(typeof cnt2, "number", "count returns number");
  assert.ok(Number.isInteger(cnt2) && cnt2 >= 0, "count is a non-negative integer");
}
