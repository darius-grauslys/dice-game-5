import * as scene from "./index.mjs";
import { YAW, DIE, LABEL, WIN } from "../../../../../../common/index.mjs";
import * as THREE from "three";

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const QY1 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];

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
  // add dice-seed meta
  const meta = document.createElement("meta");
  meta.name = "dice-seed";
  meta.content = "1";
  document.head.appendChild(meta);

  const seat = (scenario && scenario.seat) ?? 0;
  scene.init({ canvas, seat });

  const poses = buildPoses(seat);
  const labels = buildLabels(seat);

  scene.play([], poses, { turn: 0, glow: [3], winner: null, labels });

  for (let i = 0; i < 60; i++) {
    await scene.nextFrame();
  }

  const desc = scene.describe();

  // hold die 3 turned about y, 1 with at = die 3's described x,y, to = at + (40, 0)
  const die3 = desc.dice.find((d) => d.id === 3);
  const at = { x: die3.x, y: die3.y };
  const to = { x: die3.x + 40, y: die3.y };
  const holdPoses = [{ id: 3, position: poses[3].position, matrix: QY1 }];
  scene.hold({ poses: holdPoses, at, to });

  for (let i = 0; i < 20; i++) {
    await scene.nextFrame();
  }

  const desc2 = scene.describe();
  const die0 = desc2.dice.find((d) => d.id === 0);
  const die3b = desc2.dice.find((d) => d.id === 3);
  const pick0 = scene.pick({ x: die0.x, y: die0.y });
  const pick3 = scene.pick({ x: die3b.x, y: die3b.y });

  const result = {
    describe: {
      dice: desc2.dice.map((d) => ({ id: d.id, x: Math.round(d.x), y: Math.round(d.y), visibleFaces: d.visibleFaces })),
      labels: desc2.labels.map((l) => ({ owner: l.owner, x: Math.round(l.x), y: Math.round(l.y) })),
      glow: desc2.glow,
      animating: desc2.animating,
      notice: desc2.notice,
    },
    pick: { die0: pick0, die3: pick3 },
  };

  if (scenario && scenario.winner !== undefined) {
    scene.play([], poses, { turn: 0, glow: [], winner: scenario.winner, labels });
    await new Promise((r) => setTimeout(r, WIN.window));
    const desc3 = scene.describe();
    result.finalDescribe = {
      dice: desc3.dice.map((d) => ({ id: d.id, visibleFaces: d.visibleFaces })),
      labels: desc3.labels,
      glow: desc3.glow,
      animating: desc3.animating,
      notice: desc3.notice,
      finale: desc3.finale,
    };
  }

  return result;
}
