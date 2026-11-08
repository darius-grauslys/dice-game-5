import * as THREE from "three";
import { init, dust, sparkler, step, count, ring } from "./index.mjs";

function radiusAround(p, anchor) {
  const dx = p[0] - anchor[0];
  const dz = p[2] - anchor[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function countGoldPixels(renderer, camera, w, h) {
  const gl = renderer.getContext();
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let gold = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2], a = buf[i + 3];
    if (a < 10) continue;
    // gold #ffd84a: r=255, g=216, b=74; allow twinkle/blend tolerance
    if (r >= 220 && r <= 255 && g >= 180 && g <= 225 && b >= 50 && b <= 100) {
      gold++;
    }
  }
  return gold;
}

export async function _sheo_sim(canvas, scenario) {
  const renderer = new THREE.WebGLRenderer({ canvas, devicePixelRatio: 1 });
  renderer.setSize(400, 300);

  const scene = new THREE.Scene();

  const camera = new THREE.Camera();
  camera.position.set(0, 6, 12);
  camera.lookAt(0, 0, 0);
  camera.fov = 45;

  init(scene);
  console.log("renderer methods:", Object.keys(renderer).filter(k => /read|pixel/i.test(k)).join(","));
  const pts = scene.children.find((c) => c && c.isPoints);
  console.log("points:", pts ? "exists" : "MISSING", "frustumCulled:", pts ? pts.frustumCulled : "n/a");
  console.log("geometry:", pts ? pts.geometry.type : "n/a", "attrs:", pts ? Object.keys(pts.geometry.attributes || {}) : "n/a");
  console.log("drawRange:", pts ? JSON.stringify(pts.geometry.drawRange) : "n/a");
  console.log("material:", pts ? JSON.stringify({size: pts.material.size, sizeAttenuation: pts.material.sizeAttenuation, vertexColors: pts.material.vertexColors, blending: pts.material.blending, transparent: pts.material.transparent}) : "n/a");

  const a1 = [0, 1.5, 0];
  dust(a1);
  step(1000);
  const r1 = ring();
  const pts2 = scene.children.find((c) => c && c.isPoints);
  console.log("after step drawRange:", pts2 ? JSON.stringify(pts2.geometry.drawRange) : "n/a", "count:", count());
  let minR1 = Infinity, maxR1 = -Infinity;
  for (const p of r1) {
    const r = radiusAround(p, a1);
    if (r < minR1) minR1 = r;
    if (r > maxR1) maxR1 = r;
  }
  console.log("after 1000ms: ring().length=" + r1.length + " minR=" + (isFinite(minR1) ? minR1.toFixed(4) : "n/a") + " maxR=" + (isFinite(maxR1) ? maxR1.toFixed(4) : "n/a") + " count=" + count());

  renderer.render(scene, camera);
  const gold1 = countGoldPixels(renderer, camera, 400, 300);
  console.log("gold pixels after 1s ring: " + gold1);

  const a2 = [1.2, 1.5, 0.5];
  dust(a2);
  step(800);
  const r2 = ring();
  let minR2 = Infinity, maxR2 = -Infinity;
  for (const p of r2) {
    const r = radiusAround(p, a2);
    if (r < minR2) minR2 = r;
    if (r > maxR2) maxR2 = r;
  }
  console.log("after move+800ms: ring().length=" + r2.length + " minR=" + (isFinite(minR2) ? minR2.toFixed(4) : "n/a") + " maxR=" + (isFinite(maxR2) ? maxR2.toFixed(4) : "n/a") + " count=" + count());

  dust(null);
  step(5000);
  console.log("after dust(null)+5000ms: count=" + count());
  renderer.render(scene, camera);
  const gold2 = countGoldPixels(renderer, camera, 400, 300);
  console.log("gold pixels after dust(null)+5s: " + gold2);

  sparkler([0, 1.5, 0]);
  step(320);
  renderer.render(scene, camera);
  const gold3 = countGoldPixels(renderer, camera, 400, 300);
  console.log("gold pixels after sparkler 320ms: " + gold3);

  return { ok: true, gold1, gold2, gold3 };
}
