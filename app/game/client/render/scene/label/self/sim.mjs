import * as THREE from "three";
import { PLAYERS, LABEL } from "../../../../../../../common/index.mjs";
import { makeLabel } from "./index.mjs";

export async function _sheo_sim(canvas, scenario) {
  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight("#ffffff", 0.6);
  scene.add(ambient);
  const light1 = new THREE.PointLight("#ffffff", 1.2, 50);
  light1.position.set(0, 6, 8);
  scene.add(light1);
  const light2 = new THREE.PointLight("#ffffff", 0.8, 50);
  light2.position.set(0, 4, -6);
  scene.add(light2);

  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 6);
  scene.add(camera);

  const labels = ["P1", "P2", "P3", "P4"];
  const group = new THREE.Group();
  const meshes = [];
  labels.forEach((label, i) => {
    const p = PLAYERS[i];
    const ml = makeLabel({ text: label, colour: p.colour });
    ml.position.x = (i - 1.5) * 2.2;
    group.add(ml);
    ml.traverse((m) => { if (m.isMesh) meshes.push(m); });
  });
  scene.add(group);

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(800, 600);
  renderer.render(scene, camera);

  const boxes = meshes.map((m) => {
    const b = new THREE.Box3().setFromObject(m);
    return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
  });

  return { boxes };
}
