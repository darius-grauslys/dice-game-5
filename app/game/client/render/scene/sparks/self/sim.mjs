import * as THREE from "three";
import { init, dust, sparkler, step, count, ring } from "./index.mjs";

function countGoldPixels(renderer, w, h) {
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
  renderer.setSize(800, 600);

  const scene = new THREE.Scene();

  const camera = new THREE.Camera();
  camera.position.set(0, 3, 9);
  camera.lookAt(0, 1.5, 0);
  camera.fov = 70;

  init(scene);

  const a1 = [0, 1.5, 0];
  dust(a1);
  step(1000);
  renderer.render(scene, camera);
  const gold1 = countGoldPixels(renderer, 800, 600);

  const a2 = [1.2, 1.5, 0.5];
  dust(a2);
  step(800);
  dust(null);
  step(5000);
  renderer.render(scene, camera);
  const gold2 = countGoldPixels(renderer, 800, 600);

  sparkler([0, 1.5, 0]);
  step(320);
  renderer.render(scene, camera);
  const gold3 = countGoldPixels(renderer, 800, 600);

  console.log("gold pixels after 1s ring: " + gold1);
  console.log("gold pixels after dust(null)+5s: " + gold2);
  console.log("gold pixels after sparkler 320ms: " + gold3);

  return { ok: true, gold1, gold2, gold3 };
}
