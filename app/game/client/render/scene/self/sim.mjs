import * as scene from "./index.mjs";
import { YAW, LABEL } from "../../../../../../common/index.mjs";

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
    const matrix = id === 0 ? YAW[1] : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
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
    const c2d = document.createElement("canvas");
    c2d.width = canvas.width;
    c2d.height = canvas.height;
    const c2dctx = c2d.getContext("2d");
    if (!c2dctx) return 0;
    c2dctx.drawImage(canvas, 0, 0);
    const img = c2dctx.getImageData(box.x, box.y, box.w, box.h).data;
    let count = 0;
    for (let i = 0; i < img.length; i += 4) {
      const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
      if (a > 20 && r > 190 && g > 150 && b < 140 && (r - b) > 90) count++;
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

  const poses = buildPoses(seat);
  const labels = buildLabels(seat);

  // 1. after a deal play with turn: 1: gold-pixel count in a 140x120 box around label 1's describe() position
  scene.play([], poses, Object.freeze({ turn: 1, glow: [], winner: null, labels }));
  for (let i = 0; i < 60; i++) {
    await scene.nextFrame();
  }
  const t1 = performance.now();
  while (performance.now() - t1 < 1000) {
    await scene.nextFrame();
  }
  let d1 = scene.describe();
  const box1 = { x: Math.round(d1.labels[1].x - 70), y: Math.round(d1.labels[1].y - 60), w: 140, h: 120 };
  const goldLabel1 = countGoldPixels(canvas, box1);
  console.log("after play turn:1, gold pixels around label 1:", goldLabel1);

  // 2. play with turn: 3: gold-pixel count for labels 3 and 1
  scene.play([], poses, Object.freeze({ turn: 3, glow: [], winner: null, labels }));
  for (let i = 0; i < 60; i++) {
    await scene.nextFrame();
  }
  const t3 = performance.now();
  while (performance.now() - t3 < 2500) {
    await scene.nextFrame();
  }
  const d3 = scene.describe();
  const box3 = { x: Math.round(d3.labels[3].x - 70), y: Math.round(d3.labels[3].y - 60), w: 140, h: 120 };
  const goldLabel3 = countGoldPixels(canvas, box3);
  const box1b = { x: Math.round(d3.labels[1].x - 70), y: Math.round(d3.labels[1].y - 60), w: 140, h: 120 };
  const goldLabel1b = countGoldPixels(canvas, box1b);
  console.log("after play turn:3, gold pixels around label 3:", goldLabel3, "label 1:", goldLabel1b);

  const result = { goldLabel1, goldLabel3, goldLabel1b };
  return result;
}
