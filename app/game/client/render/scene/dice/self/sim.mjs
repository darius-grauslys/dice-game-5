import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { facesFor, makeDie } from "./index.mjs";
import { PLAYERS } from "../../../../../../../common/index.mjs";

export async function _sheo_sim(canvas, scenario) {
  const width = canvas.width || 800;
  const height = canvas.height || 600;

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2a22);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334433, 0.9);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 10, 6);
  scene.add(dirLight);

  const camera = new THREE.PerspectiveCamera(45, 1);
  camera.position.set(2.2, 2.2, 2.8);
  camera.lookAt(0, 0, 0);

  const perms = facesFor(1);
  const spacing = 2.2;
  for (let seat = 0; seat < 4; seat++) {
    const { colour, ring } = PLAYERS[seat];
    const die = makeDie({ colour, ring, perm: perms[seat] });
    die.position.set((seat - 1.5) * spacing, 0, 0);
    die.rotation.set(0, 0, 0);
    scene.add(die);
  }

  renderer.render(scene, camera);

  return { perms: facesFor(1) };
}
