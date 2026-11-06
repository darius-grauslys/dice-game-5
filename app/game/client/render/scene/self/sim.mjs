import * as scene from "./index.mjs";
import { YAW, DIE, LABEL, WIN, MS } from "../../../../../../common/index.mjs";
import * as THREE from "three";
import { mat3ToMatrix4 } from "./math.mjs";
import { ease, turnAt, sameRotation } from "./hold.mjs";

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const QY1 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const QYm1 = [[0, 0, -1], [0, 1, 0], [1, 0, 0]];

function quatArray(q) {
  return [q.x, q.y, q.z, q.w];
}

function mat3ToQuat(m) {
  const m4 = mat3ToMatrix4(m);
  const q = new THREE.Quaternion().setFromRotationMatrix(m4);
  return [q.x, q.y, q.z, q.w];
}

function angleBetween(a, b) {
  const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  return 2 * Math.acos(Math.abs(dot)) * 180 / Math.PI;
}

function meshMaterials(mesh) {
  if (!mesh) return [];
  if (mesh.materials) return mesh.materials;
  if (mesh.material) return [mesh.material];
  if (mesh instanceof THREE.Group) return mesh.children.flatMap(meshMaterials);
  return [];
}

function buildPoses(seat) {
  const poses = [];
  for (let id = 0; id < 16; id++) {
    const owner = Math.floor(id / 4);
    const k = id % 4;
    const yaw = YAW[owner];
    const bx = -1.875 + 1.25 * k;
    const by = 0.5;
    const bz = 4;
    const x = yaw[0][0] * bx + yaw[0][1] * by + yaw[0][2] * bz;
    const y = yaw[1][0] * bx + yaw[1][1] * by + yaw[1][2] * bz;
    const z = yaw[2][0] * bx + yaw[2][1] * by + yaw[2][2] * bz;
    const matrix = id === 0 ? YAW[1] : IDENTITY;
    poses.push({ id, owner, group: owner, slot: k, position: [x, y, z], matrix });
  }
  return poses;
}

function buildLabels(seat) {
  const labels = {};
  for (let o = 0; o < 4; o++) {
    const yaw = YAW[o];
    const bx = 0, by = 0.5, bz = 4 - LABEL.beyond;
    const x = yaw[0][0] * bx + yaw[0][1] * by + yaw[0][2] * bz;
    const y = yaw[1][0] * bx + yaw[1][1] * by + yaw[1][2] * bz;
    const z = yaw[2][0] * bx + yaw[2][1] * by + yaw[2][2] * bz;
    labels[o] = { owner: o, position: [x, y, z] };
  }
  return labels;
}

export async function _sheo_sim(canvas, scenario) {
  const meta = document.createElement("meta");
  meta.name = "dice-seed";
  meta.content = "1";
  document.head.appendChild(meta);

  const seat = (scenario && scenario.seat) ?? 0;
  scene.init({ canvas, seat });

  const die3MeshInit = scene._dieMesh(3);
  const initMaterials = meshMaterials(die3MeshInit);
  const initMaterialIds = initMaterials.map((m) => m && m.uuid ? m.uuid : (m ? String(m) : null));

  const poses = buildPoses(seat);
  const labels = buildLabels(seat);

  scene.play([], poses, { turn: 0, glow: [3], winner: null, labels });

  for (let i = 0; i < 60; i++) {
    await scene.nextFrame();
  }

  const q0 = scene._dieQuaternion(3);
  const q0a = quatArray(q0);

  // Phase 1: hold QY1 — turn from identity to QY1 over MS.turn
  const toQ1 = mat3ToQuat(QY1);
  const halfQ1 = turnAt(q0a, toQ1, MS.turn / 2, MS.turn);
  const endQ1 = turnAt(q0a, toQ1, MS.turn + 100, MS.turn);
  const half = angleBetween(q0a, halfQ1);
  const end = angleBetween(q0a, endQ1);

  // Phase 2: hold QYm1 — turn from QY1 to QYm1
  const toQm1 = mat3ToQuat(QYm1);
  const otherQ = turnAt(toQ1, toQm1, MS.turn + 100, MS.turn);
  const otherEnd = angleBetween(q0a, otherQ);

  // Phase 3: hold(null) — turn back from QYm1 to identity
  const backQ_half = turnAt(toQm1, q0a, MS.turn / 2, MS.turn);
  const backQ_end = turnAt(toQm1, q0a, MS.turn + 100, MS.turn);
  const backHalf = angleBetween(q0a, backQ_half);
  const backEnd = angleBetween(q0a, backQ_end);

  const die3MeshAfter = scene._dieMesh(3);
  const afterMaterials = meshMaterials(die3MeshAfter);
  const afterMaterialIds = afterMaterials.map((m) => m && m.uuid ? m.uuid : (m ? String(m) : null));
  const materialsSame = initMaterialIds.length === afterMaterialIds.length && initMaterialIds.every((id, i) => id === afterMaterialIds[i]);

  const result = {
    holdTurn: { half, end, otherEnd, backHalf, backEnd },
    holdCheck: { materialsSame, initMaterialIds, afterMaterialIds },
  };

  return result;
}
