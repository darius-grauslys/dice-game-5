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
  assert.strictEqual(mat.blending, THREE.AdditiveBlending, "additive blending");
  assert.strictEqual(mat.depthWrite, false, "depthWrite is false");

  const geo = points.geometry;
  const pos = () => points.geometry.attributes.position.array;
  const col = () => points.geometry.attributes.color.array;

  const isGold = (c) => {
    const r = c[0], g = c[1], b = c[2];
    const m = Math.max(r, g, b);
    if (m <= 0) return false;
    const g1 = (r === m && Math.abs(g/m - 0.847) <= 0.08 && Math.abs(b/m - 0.290) <= 0.08);
    const g2 = (r === m && Math.abs(g/m - 0.686) <= 0.08 && Math.abs(b/m - 0.068) <= 0.08);
    return g1 || g2;
  };
  const isWhite = (c) => {
    const r = c[0], g = c[1], b = c[2];
    const m = Math.max(r, g, b);
    if (m <= 0) return false;
    return g/m >= 0.92 && b/m >= 0.92;
  };

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
    assert.strictEqual(geo.drawRange.count, cnt, "drawRange.count equals count()");
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
    assert.ok(isGold(c2.slice(i*3, i*3+3)) || isWhite(c2.slice(i*3, i*3+3)), `sparkler particle color gold #ffd84a or white (i=${i})`);
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

  // ---- render check: particles must really render (gold pixels on the ring and the dust) ----
  {
    // fresh scene with green background
    const rscene = new THREE.Scene();
    rscene.background = new THREE.Color(0x1a4d2e);
    // canvas 400x300
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 300;
    const renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(400, 300, false);
    const camera = new THREE.PerspectiveCamera(45, 400 / 300, 0.1, 100);
    camera.position.set(0, 6, 12);
    camera.lookAt(0, 0, 0);

    init(rscene);

    // every THREE.Points in the scene has geometry instanceof THREE.BufferGeometry,
    // geometry.attributes.position present with itemSize 3, and frustumCulled === false
    const pointsList = [];
    rscene.traverse((obj) => { if (obj.isPoints) pointsList.push(obj); });
    for (const p of pointsList) {
      assert.ok(p.geometry instanceof THREE.BufferGeometry, "Points geometry is BufferGeometry");
      assert.ok(p.geometry.attributes && p.geometry.attributes.position, "Points has position attribute");
      assert.strictEqual(p.geometry.attributes.position.itemSize, 3, "position attribute itemSize 3");
      assert.strictEqual(p.frustumCulled, false, "Points frustumCulled false");
    }

    // dust([0, 1.1, 0]), step(16) 60 times (≈ 1 s), then render: does not throw
    dust([0, 1.1, 0]);
    for (let i = 0; i < 60; i++) step(16);
    renderer.render(rscene, camera);

    // read pixels and count gold pixels; rows are bottom-up
    const gl = renderer.getContext();
    const buf = new Uint8Array(400 * 300 * 4);
    gl.readPixels(0, 0, 400, 300, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let goldCount = 0;
    for (let i = 0; i < 400 * 300; i++) {
      const r = buf[i*4], g = buf[i*4+1], b = buf[i*4+2];
      if (r > 190 && g > 150 && b < 140 && r - b > 90) goldCount++;
    }
    assert.ok(goldCount >= 150, `at least 150 gold pixels (got ${goldCount})`);

    // the ring shows: project each of ring()'s 48 positions with the camera
    const ringPos = ring();
    const ringProjected = [];
    let ringShown = 0;
    for (let i = 0; i < 48; i++) {
      const v = new THREE.Vector3(ringPos[i][0], ringPos[i][1], ringPos[i][2]);
      v.project(camera);
      const px = (v.x + 1) / 2 * 400;
      const py = (1 - v.y) / 2 * 300;
      ringProjected.push([px, py]);
      // check gold pixel within 4px
      let found = false;
      for (let dy = -4; dy <= 4 && !found; dy++) {
        for (let dx = -4; dx <= 4 && !found; dx++) {
          const ix = Math.round(px + dx);
          const iy_topdown = Math.round(py + dy);
          if (ix >= 0 && ix < 400 && iy_topdown >= 0 && iy_topdown < 300) {
            const iy_read = 299 - iy_topdown;
            const idx = iy_read * 400 + ix;
            const r = buf[idx*4], g = buf[idx*4+1], b = buf[idx*4+2];
            if (r > 190 && g > 150 && b < 140 && r - b > 90) found = true;
          }
        }
      }
      if (found) ringShown++;
    }
    assert.ok(ringShown >= 36, `at least 36 of 48 ring positions have a gold pixel within 4px (got ${ringShown})`);

    // dust falls below it: at least 10 warm pixels (r > 110 and r - b > 40) lie more than 12 px
    // below the ring's lowest projected point (screen y greater), within the ring's projected x range ± 20 px
    let ringMaxY = -Infinity;
    let ringMinX = Infinity, ringMaxX = -Infinity;
    for (const [px, py] of ringProjected) {
      ringMaxY = Math.max(ringMaxY, py);
      ringMinX = Math.min(ringMinX, px);
      ringMaxX = Math.max(ringMaxX, px);
    }
    let warmBelow = 0;
    for (let iy_read = 0; iy_read < 300; iy_read++) {
      const screenY = 299 - iy_read;
      if (screenY <= ringMaxY + 12) continue;
      for (let ix = 0; ix < 400; ix++) {
        if (ix < ringMinX - 20 || ix > ringMaxX + 20) continue;
        const idx = iy_read * 400 + ix;
        const r = buf[idx*4], g = buf[idx*4+1], b = buf[idx*4+2];
        if (r > 110 && r - b > 40) warmBelow++;
      }
    }
    assert.ok(warmBelow >= 10, `at least 10 warm pixels below ring (got ${warmBelow})`);

    // dust(null), step(100) 50 times (5 s), render: at most 5 gold pixels
    dust(null);
    for (let i = 0; i < 50; i++) step(100);
    renderer.render(rscene, camera);
    gl.readPixels(0, 0, 400, 300, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    goldCount = 0;
    for (let i = 0; i < 400 * 300; i++) {
      const r = buf[i*4], g = buf[i*4+1], b = buf[i*4+2];
      if (r > 190 && g > 150 && b < 140 && r - b > 90) goldCount++;
    }
    assert.ok(goldCount <= 5, `at most 5 gold pixels after dust(null) (got ${goldCount})`);

    // sparkler([0, 2, 0]), step(16) 20 times, render: at least 100 pixels that are gold or white
    sparkler([0, 2, 0]);
    for (let i = 0; i < 20; i++) step(16);
    renderer.render(rscene, camera);
    gl.readPixels(0, 0, 400, 300, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let sparkCount = 0;
    for (let i = 0; i < 400 * 300; i++) {
      const r = buf[i*4], g = buf[i*4+1], b = buf[i*4+2];
      if (r > 190 && g > 150 && (r + g + b > 500)) sparkCount++;
    }
    assert.ok(sparkCount >= 100, `at least 100 gold or white pixels from sparkler (got ${sparkCount})`);
    sparkler(null);

    renderer.dispose();
  }
}
