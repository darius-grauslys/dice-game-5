// layout: where every die rests, as one viewer sees it. Pure.
//
// place(game, viewer) → Pose[]: 16 poses, players 0..3 in order, each player's
// dice in queue order (groups left to right, dice in group order). A Pose is a
// plain frozen object {id, owner, group, slot, position: [x,y,z], matrix}.
// labels(viewer) → [{owner, position: [x,y,z]}].

import { DIE, GAP, GROUP_GAP, TABLE_R, YAW, CAMERA, ORIENTATIONS, STACK, LABEL } from "../../../../../../common/index.mjs";

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

function transpose(M) {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

function normNum(n) {
  return n + 0; // -0 -> 0
}

function atan2(y, x) {
  // angle of vector (x, y), in (-π, π]
  if (x > 0) return Math.atan(y / x);
  if (x < 0) return Math.atan(y / x) + (y >= 0 ? Math.PI : -Math.PI);
  if (y > 0) return Math.PI / 2;
  if (y < 0) return -Math.PI / 2;
  return 0;
}

function showTurn(owner, viewer) {
  // e = YAW[owner]ᵀ · (YAW[viewer] · CAMERA.eye)
  const eyeInView = mulMatVec(YAW[viewer], CAMERA.eye);
  const e = mulMatVec(transpose(YAW[owner]), eyeInView);
  // v = [e[0], e[2] - TABLE_R]
  const v = [e[0], e[2] - TABLE_R];
  // b = [1, 1] if owner === viewer, else [-1, -1]
  const b = owner === viewer ? [1, 1] : [-1, -1];
  const phi = atan2(v[0], v[1]) - atan2(b[0], b[1]);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

export function place(game, viewer) {
  const poses = [];
  const players = game.players;
  for (let seat = 0; seat < 4; seat++) {
    const player = players[seat];
    const queue = player.queue;
    const groups = queue.groups;

    // Walk the queue to compute row-frame positions (stacked groups).
    const diceInfo = []; // {id, o, group, slot, x, z}
    let cursor = 0;
    let slot = 0;
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      const dice = group.dice;
      let lastX = 0;
      for (let k = 0; k < dice.length; k++) {
        const die = dice[k];
        const x = cursor + k * STACK.dx;
        const z = TABLE_R + (k % 2 === 1 ? STACK.dz : 0);
        diceInfo.push({ id: die.id, o: die.o, group: g, slot, x, z });
        lastX = x;
        slot++;
      }
      cursor = lastX + DIE + GAP + GROUP_GAP;
    }

    // Centre the row: subtract (first x + last x) / 2 from every x.
    const n = diceInfo.length;
    const firstX = diceInfo[0].x;
    const lastX = diceInfo[n - 1].x;
    const centre = (firstX + lastX) / 2;

    const yaw = YAW[seat];
    const S = showTurn(seat, viewer);

    for (let i = 0; i < n; i++) {
      const info = diceInfo[i];
      const x = info.x - centre;
      const point = [x, DIE / 2, info.z];
      const position = mulMatVec(yaw, point).map(normNum);
      const orientMat = ORIENTATIONS[info.o].matrix;
      const SxO = mulMatMat(S, orientMat);
      const matrix = mulMatMat(yaw, SxO);

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

export function labels(viewer) {
  const result = [];
  for (let owner = 0; owner < 4; owner++) {
    const c = mulMatVec(YAW[owner], [0, 0, TABLE_R]);
    const eye = mulMatVec(YAW[viewer], CAMERA.eye);
    const u = [c[0] - eye[0], c[2] - eye[2]];
    const unorm = Math.hypot(u[0], u[1]);
    const uunit = [u[0] / unorm, u[1] / unorm];
    const position = [
      c[0] + LABEL.beyond * uunit[0],
      LABEL.height,
      c[2] + LABEL.beyond * uunit[1],
    ].map(normNum);
    const entry = { owner, position };
    Object.freeze(entry.position);
    Object.freeze(entry);
    result.push(entry);
  }
  return result;
}
