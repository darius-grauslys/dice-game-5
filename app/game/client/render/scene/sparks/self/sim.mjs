import * as THREE from "three";
import { init, dust, sparkler, step, count } from "./index.mjs";

export async function _sheo_sim(canvas, scenario) {
  const cam = new THREE.Camera();
  console.log("camera keys:", Object.keys(cam), "proto keys:", Object.keys(Object.getPrototypeOf(cam)));
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

  dust([-1.5, 1.5, 0]);
  sparkler([1.5, 1.5, 0]);

  const counts = [];
  for (let i = 0; i < 120; i++) {
    step(16);
    try {
      renderer.render(scene, camera);
    } catch (e) {
      console.log("render error:", e.message);
      throw e;
    }
    if (i === 29 || i === 59 || i === 119) counts.push(count());
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  return { counts };
}
