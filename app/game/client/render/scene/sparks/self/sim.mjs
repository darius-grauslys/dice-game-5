import * as THREE from "three";
import { init, dust, sparkler, step, count, ring } from "./index.mjs";

function radiusAround(p, anchor) {
  const dx = p[0] - anchor[0];
  const dz = p[2] - anchor[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export async function _sheo_sim(canvas, scenario) {
  const renderer = new THREE.WebGLRenderer({ canvas, devicePixelRatio: 1 });
  renderer.setSize(800, 600);
  const origRenderBufferDirect = renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect = function (buffer, program, gl, camera, scope) {
    if (buffer && buffer.isCamera) return;
    if (buffer && buffer.object && buffer.object.isPoints && !buffer.material) {
      buffer.material = buffer.object.material;
    } else if (buffer && buffer.isPoints && !buffer.material) {
      buffer.material = buffer.material || (buffer.object && buffer.object.material);
    }
    return origRenderBufferDirect(buffer, program, gl, camera, scope);
  };

  const scene = new THREE.Scene();

  const camera = new THREE.Camera();
  camera.position.set(0, 2, 6);
  camera.fov = 45;

  init(scene);

  const a1 = [0, 1.5, 0];
  dust(a1);
  step(1000);
  const r1 = ring();
  let minR1 = Infinity, maxR1 = -Infinity;
  for (const p of r1) {
    const r = radiusAround(p, a1);
    if (r < minR1) minR1 = r;
    if (r > maxR1) maxR1 = r;
  }
  console.log("after 1000ms: ring().length=" + r1.length + " minR=" + (isFinite(minR1) ? minR1.toFixed(4) : "n/a") + " maxR=" + (isFinite(maxR1) ? maxR1.toFixed(4) : "n/a") + " count=" + count());

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

  try {
    renderer.render(scene, camera);
  } catch (e) {
    console.log("render error:", e.message);
    throw e;
  }

  return { ok: true };
}
