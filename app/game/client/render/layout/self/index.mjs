// layout: where every die rests. Pure.
//
// place(game) → Pose[]: 16 poses, players 0..3 in order, each player's dice
// in queue order (groups left to right, dice in group order). A Pose is a
// plain frozen object {id, owner, group, slot, position: [x,y,z], matrix}.

import { DIE, GAP, GROUP_GAP, TABLE_R, YAW, ORIENTATIONS } from "../../../../../../common/index.mjs";

function mulMatMat(A, B) {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += A[i][k] * B[k][j];
      r[i][j] = sum + 0; // -0 -> 0
    }
  return r;
}

function mulMatVec(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

function normNum(n) {
  return n + 0; // -0 -> 0
}

export function place(game) {
  const poses = [];
  const players = game.players;
  for (let seat = 0; seat < 4; seat++) {
    const player = players[seat];
    const queue = player.queue;
    const groups = queue.groups;

    // Walk the queue to compute row-frame x positions.
    const diceInfo = []; // {id, o, group, slot, x}
    let cursor = 0;
    let slot = 0;
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      const dice = group.dice;
      for (let d = 0; d < dice.length; d++) {
        const die = dice[d];
        const x = cursor;
        diceInfo.push({ id: die.id, o: die.o, group: g, slot, x });
        cursor += DIE + GAP;
        slot++;
      }
      cursor += GROUP_GAP;
    }

    // Centre the row: subtract (first x + last x) / 2 from every x.
    const n = diceInfo.length;
    const firstX = diceInfo[0].x;
    const lastX = diceInfo[n - 1].x;
    const centre = (firstX + lastX) / 2;

    const yaw = YAW[seat];
    for (let i = 0; i < n; i++) {
      const info = diceInfo[i];
      const x = info.x - centre;
      const point = [x, DIE / 2, TABLE_R];
      const position = mulMatVec(yaw, point).map(normNum);
      const orientMat = ORIENTATIONS[info.o].matrix;
      const matrix = mulMatMat(yaw, orientMat);

      const pose = {
        id: info.id,
        owner: seat,
        group: info.group,
        slot: info.slot,
        position,
        matrix,
      };
      Object.freeze(pose.position);
      Object.freeze(pose.matrix[0]);
      Object.freeze(pose.matrix[1]);
      Object.freeze(pose.matrix[2]);
      Object.freeze(pose.matrix);
      Object.freeze(pose);
      poses.push(pose);
    }
  }
  return poses;
}
