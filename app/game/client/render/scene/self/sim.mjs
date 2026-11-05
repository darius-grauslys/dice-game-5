import * as scene from "./index.mjs";
import { YAW, ROLL_PAD, DIE } from "../../../../../../common/index.mjs";

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function rowPositions(owner) {
  const yaw = YAW[owner];
  const poses = [];
  for (let k = 0; k < 4; k++) {
    const bx = -1.875 + 1.25 * k;
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

  // build 16 poses: die id has owner = floor(id/4), slot k = id % 4
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

  // pass them to scene.play([], poses) in reverse id order (15 first)
  const posesRev = [...poses].reverse();
  scene.play([], posesRev);

  for (let i = 0; i < 5; i++) {
    await scene.nextFrame();
  }

  const desc = scene.describe();

  // play one track for die 5: from its pose to the same pose 1 higher in y, delay 200, ms 300, spin 0
  const pose5 = poses.find((p) => p.id === 5);
  const track = {
    id: 5,
    kind: "move",
    from: { position: pose5.position, matrix: pose5.matrix },
    to: { position: [pose5.position[0], pose5.position[1] + 1, pose5.position[2]], matrix: pose5.matrix },
    delay: 200,
    ms: 300,
    spin: 0,
  };
  scene.play([track], poses);

  for (let i = 0; i < 2; i++) {
    await scene.nextFrame();
  }
  const animatingDuringDelay = scene.describe().animating;

  const die0 = desc.dice[0];
  const pickDie0 = scene.pick({ x: die0.x, y: die0.y });

  const ownFirstId = 4 * seat;
  const ownFirst = desc.dice[ownFirstId];
  const pickOwnFirst = scene.pick({ x: ownFirst.x, y: ownFirst.y });

  const pickRoll = scene.pick({ x: desc.roll.x, y: desc.roll.y });

  return {
    describe: {
      diceCount: desc.dice.length,
      seat0Dice: desc.dice.slice(0, 4).map((d) => ({ id: d.id, x: Math.round(d.x), y: Math.round(d.y), visibleFaces: d.visibleFaces })),
      roll: desc.roll,
      animating: desc.animating,
    },
    animatingDuringDelay,
    pickDie0,
    pickOwnFirst,
    pickRoll,
  };
}
