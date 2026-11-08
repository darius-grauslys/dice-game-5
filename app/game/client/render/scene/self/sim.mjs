import * as scene from "./index.mjs";
import { YAW, DIE, LABEL, WIN, MS, GLOW } from "../../../../../../common/index.mjs";
import * as THREE from "three";
import { mat3ToMatrix4 } from "./math.mjs";
import { ease, turnAt, sameRotation } from "./hold.mjs";

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const QY1 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const QY2 = [[-1, 0, 0], [0, 1, 0], [0, 0, -1]];

function quatArray(q) {
  return [q.x, q.y, q.z, q.w];
}

function mat3ToQuat(m) {
  const m4 = mat3ToMatrix4(m);
  const q = new THREE.Quaternion().setFromRotationMatrix(m4);
  return [q.x, q.y, q.z, q.w];
}

function angleBetween(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  return 2 * Math.acos(Math.abs(dot)) * 180 / Math.PI;
}

function deepFreeze(v) {
  if (v && typeof v === "object") {
    for (const key of Object.getOwnPropertyNames(v)) deepFreeze(v[key]);
    Object.freeze(v);
  }
  return v;
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

function countGoldPixels(canvas, box) {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const img = ctx.getImageData(box.x, box.y, box.w, box.h).data;
    let count = 0;
    for (let i = 0; i < img.length; i += 4) {
      const a = img[i + 3];
      if (a > 20) {
        const r = img[i], g = img[i + 1], b = img[i + 2];
        if (r > 190 && g > 150 && b < 140 && (r - b) > 90) count++;
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

export async function _sheo_sim(canvas, scenario) {
  const meta = document.createElement("meta");
  meta.name = "dice-seed";
  meta.content = "1";
  document.head.appendChild(meta);

  const seat = (scenario && scenario.seat) ?? 0;
  scene.init({ canvas, seat });

  const poses = deepFreeze(buildPoses(seat));
  const labels = deepFreeze(buildLabels(seat));

  // 1. after a deal play with turn: 0: describe().dust and labels[0].position (y lower by 0.4)
  scene.play([], poses, Object.freeze({ turn: 0, glow: [0], winner: null, labels }));
  for (let i = 0; i < 60; i++) {
    await scene.nextFrame();
  }
  const d0 = scene.describe();
  const dustAnchor = d0.dust;
  const label0Pos = scene._labelPosition(0);
  console.log("1. dust:", dustAnchor, "labels[0].position y-0.4:", [label0Pos[0], label0Pos[1] - 0.4, label0Pos[2]]);

  // 2. hold die 0 turned a quarter about y, once per frame for 400 ms: describe().armed, and angle between die 0's q before and now (~1.571 rad)
  const qBefore = quatArray(scene._dieQuaternion(0));
  const heldPose0 = { ...poses[0], matrix: QY2 };
  const t0 = performance.now();
  let armedAt400 = [];
  let angleAt400 = 0;
  for (let i = 0; i < 40; i++) {
    scene.hold({ poses: [heldPose0], at: { x: 400, y: 300 }, to: { x: 400, y: 300 } });
    await scene.nextFrame();
    const elapsed = performance.now() - t0;
    if (elapsed >= 400) {
      armedAt400 = scene.describe().armed;
      const qNow = quatArray(scene._dieQuaternion(0));
      angleAt400 = angleBetween(qBefore, qNow) * Math.PI / 180;
    }
  }
  console.log("2. describe().armed:", armedAt400, "angle (rad):", angleAt400.toFixed(4));

  // 3. then hold(null) once per frame: angle back to start at ~125 ms (~0.785) and at 400 ms (~0), and describe().armed ([])
  scene.hold(null);
  const tb = performance.now();
  let angleAt125 = null, angleAt400Back = null, armedAtEnd = [];
  for (let i = 0; i < 80; i++) {
    scene.hold(null);
    await scene.nextFrame();
    const elapsed = performance.now() - tb;
    if (elapsed >= 125 && elapsed < 525 && angleAt125 === null) {
      const qNow = quatArray(scene._dieQuaternion(0));
      angleAt125 = angleBetween(qBefore, qNow) * Math.PI / 180;
    }
    if (elapsed >= 400) {
      const qNow = quatArray(scene._dieQuaternion(0));
      angleAt400Back = angleBetween(qBefore, qNow) * Math.PI / 180;
      armedAtEnd = scene.describe().armed;
    }
  }
  console.log("3. angle back at ~125ms:", angleAt125 ? angleAt125.toFixed(4) : null, "at ~400ms:", angleAt400Back ? angleAt400Back.toFixed(4) : null, "armed:", armedAtEnd);

  // 4. picture (or gold-pixel count in a box around die 0) held vs released
  scene.hold({ poses: [{ ...poses[0], matrix: QY2 }], at: { x: 400, y: 300 }, to: { x: 400, y: 300 } });
  for (let i = 0; i < 30; i++) await scene.nextFrame();
  const boxHeld = { x: 340, y: 210, w: 120, h: 120 };
  const goldHeld = countGoldPixels(canvas, boxHeld);
  scene.hold(null);
  for (let i = 0; i < 30; i++) await scene.nextFrame();
  const goldReleased = countGoldPixels(canvas, boxHeld);
  console.log("4. gold pixels around die 0: held=" + goldHeld + " released=" + goldReleased);

  const result = { dust: dustAnchor, label0: label0Pos, armedAt400, angleAt400, angleAt125, angleAt400Back, armedAtEnd, goldHeld, goldReleased };
  return result;
}
