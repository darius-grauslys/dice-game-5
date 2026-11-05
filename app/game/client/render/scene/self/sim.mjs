import * as scene from "./index.mjs";
import { YAW, CAMERA, ROLL_PAD, DIE } from "../../../../../../common/index.mjs";

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function rowPositions(seat) {
  const yaw = YAW[seat];
  const baseX = [-1.875, -0.625, 0.625, 1.875];
  const poses = [];
  for (let i = 0; i < 4; i++) {
    const bx = baseX[i];
    const by = 0.5;
    const bz = 4;
    const x = yaw[0][0] * bx + yaw[0][1] * by + yaw[0][2] * bz;
    const y = yaw[1][0] * bx + yaw[1][1] * by + yaw[1][2] * bz;
    const z = yaw[2][0] * bx + yaw[2][1] * by + yaw[2][2] * bz;
    poses.push({ position: [x, y, z], matrix: IDENTITY });
  }
  return poses;
}

export async function _sheo_sim(canvas, scenario) {
  const seat = (scenario && scenario.seat) ?? 0;
  scene.init({ canvas, seat });

  // build 16 poses: seat 0's row for dice 0-3, seat 1's row for 4-7, etc.
  const poses = [];
  for (let s = 0; s < 4; s++) {
    const row = rowPositions(s);
    for (let i = 0; i < 4; i++) {
      poses.push(row[i]);
    }
  }

  scene.play([], poses);

  for (let i = 0; i < 5; i++) {
    await scene.nextFrame();
  }

  const desc = scene.describe();

  // pick die 0's centre and the roll pad's centre
  const die0 = desc.dice[0];
  const pickDie0 = scene.pick({ x: die0.x, y: die0.y });
  const pickRoll = scene.pick({ x: desc.roll.x, y: desc.roll.y });

  return {
    describe: {
      diceCount: desc.dice.length,
      seat0Dice: desc.dice.slice(0, 4).map((d) => ({ id: d.id, x: Math.round(d.x), y: Math.round(d.y), visibleFaces: d.visibleFaces })),
      roll: desc.roll,
      animating: desc.animating,
    },
    pickDie0,
    pickRoll,
  };
}
