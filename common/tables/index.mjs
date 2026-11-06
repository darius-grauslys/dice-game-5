// common/tables: the die's 24 orientations, the quarter-turn table, and the
// die-numbering helpers facesFor, faces and look.
//
// FACES, ORIENTATIONS and TURN are computed once when the module loads, then
// deeply frozen. facesFor, faces and look are pure functions: no IO, no time,
// no randomness. They import Rng from ../rng/index.mjs and FACE_PERMS from
// ../view/index.mjs.

import { Rng } from "../rng/index.mjs";
import { FACE_PERMS } from "../view/index.mjs";

const facesObj = { "+x": 2, "-x": 5, "+y": 1, "-y": 6, "+z": 3, "-z": 4 };

function det3(m) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
       - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
       + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

function isRotation(m) {
  for (let i = 0; i < 3; i++) {
    let rc = 0;
    for (let j = 0; j < 3; j++) {
      if (Math.abs(m[i][j]) !== 1 && m[i][j] !== 0) return false;
      if (m[i][j] !== 0) rc++;
    }
    if (rc !== 1) return false;
  }
  for (let j = 0; j < 3; j++) {
    let c = 0;
    for (let i = 0; i < 3; i++) {
      if (m[i][j] !== 0) c++;
    }
    if (c !== 1) return false;
  }
  return det3(m) === 1;
}

const mats = [];
for (let a = -1; a <= 1; a++)
  for (let b = -1; b <= 1; b++)
    for (let c = -1; c <= 1; c++)
      for (let d = -1; d <= 1; d++)
        for (let e = -1; e <= 1; e++)
          for (let f = -1; f <= 1; f++)
            for (let g = -1; g <= 1; g++)
              for (let h = -1; h <= 1; h++)
                for (let i = -1; i <= 1; i++) {
                  const m = [[a, b, c], [d, e, f], [g, h, i]];
                  if (isRotation(m)) mats.push(m);
                }

function rowMajor(m) {
  return [m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]];
}

mats.sort((A, B) => {
  const a = rowMajor(A), b = rowMajor(B);
  for (let k = 0; k < 9; k++) {
    if (a[k] !== b[k]) return b[k] - a[k];
  }
  return 0;
});

function deepFreeze(v) {
  if (v && typeof v === "object") {
    for (const key of Object.getOwnPropertyNames(v)) deepFreeze(v[key]);
    Object.freeze(v);
  }
  return v;
}

const orientations = mats.map((m, idx) => {
  let j = -1, s = 0;
  for (let c = 0; c < 3; c++) {
    if (m[1][c] !== 0) { j = c; s = m[1][c]; }
  }
  const signStr = s > 0 ? "+" : "-";
  const up = facesObj[signStr + "xyz"[j]];
  let key;
  if ([1, 4, 5].includes(up)) {
    key = String(up);
  } else {
    let col;
    if (up === 2) col = 1;
    else if (up === 3) col = 0;
    else if (up === 6) col = 2;
    key = m[0][col] !== 0 ? up + "a" : up + "b";
  }
  return deepFreeze({ index: idx, matrix: m, up, key });
});

const Qm = {
  x: { "1": [[1, 0, 0], [0, 0, -1], [0, 1, 0]], "-1": [[1, 0, 0], [0, 0, 1], [0, -1, 0]] },
  y: { "1": [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], "-1": [[0, 0, -1], [0, 1, 0], [1, 0, 0]] },
  z: { "1": [[0, -1, 0], [1, 0, 0], [0, 0, 1]], "-1": [[0, 1, 0], [-1, 0, 0], [0, 0, 1]] },
};

function matMul(A, B) {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += A[i][k] * B[k][j];
      r[i][j] = sum;
    }
  return r;
}

function matKey(m) {
  return [m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]].join(",");
}

const matToIdx = {};
for (const o of orientations) matToIdx[matKey(o.matrix)] = o.index;

const turn = [];
for (let o = 0; o < 24; o++) {
  const M = orientations[o].matrix;
  const row = {};
  for (const axis of ["x", "y", "z"]) {
    row[axis] = {};
    for (const dir of ["1", "-1"]) {
      const Qarr = Qm[axis][dir];
      const P = matMul(Qarr, M);
      row[axis][dir] = matToIdx[matKey(P)];
    }
  }
  turn.push(deepFreeze(row));
}

export const FACES = deepFreeze(facesObj);
export const ORIENTATIONS = deepFreeze(orientations);
export const TURN = deepFreeze(turn);

// Numbering helpers: how dice look to their owner by their owner's numbering.

function checkPerm(perm, fn) {
  if (perm !== null) {
    if (!Array.isArray(perm) || perm.length !== 6) {
      throw new TypeError(`${fn}: perm must be null or an array of 6 integers`);
    }
    for (const x of perm) {
      if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > 6) {
        throw new TypeError(`${fn}: perm must be a permutation of 1..6`);
      }
    }
    const sorted = [...perm].sort((a, b) => a - b);
    if (sorted.join(",") !== "1,2,3,4,5,6") {
      throw new TypeError(`${fn}: perm must be a permutation of 1..6`);
    }
  }
}

function checkO(o, fn) {
  if (!Number.isInteger(o) || o < 0 || o > 23) {
    throw new TypeError(`${fn}: o must be an integer 0..23`);
  }
}

function faces(perm, o) {
  checkPerm(perm, "faces");
  checkO(o, "faces");
  const p = perm ?? [1, 2, 3, 4, 5, 6];
  const M = ORIENTATIONS[o].matrix;
  const Mt = [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
  function dirFace(vec) {
    const r = [Mt[0][0] * vec[0] + Mt[0][1] * vec[1] + Mt[0][2] * vec[2],
               Mt[1][0] * vec[0] + Mt[1][1] * vec[1] + Mt[1][2] * vec[2],
               Mt[2][0] * vec[0] + Mt[2][1] * vec[1] + Mt[2][2] * vec[2]];
    let name;
    if (r[0] === 1) name = "+x"; else if (r[0] === -1) name = "-x";
    else if (r[1] === 1) name = "+y"; else if (r[1] === -1) name = "-y";
    else if (r[2] === 1) name = "+z"; else if (r[2] === -1) name = "-z";
    return p[FACES[name] - 1];
  }
  const result = {
    top: dirFace([0, 1, 0]),
    bottom: dirFace([0, -1, 0]),
    front: dirFace([0, 0, 1]),
    back: dirFace([0, 0, -1]),
    left: dirFace([-1, 0, 0]),
    right: dirFace([1, 0, 0]),
  };
  return Object.freeze(result);
}

function look(perm, o) {
  checkPerm(perm, "look");
  checkO(o, "look");
  const f = faces(perm, o);
  if ([1, 4, 5].includes(f.top)) return String(f.top);
  const fronts = [f.front, f.back].sort((a, b) => a - b);
  return `${f.top}:${fronts[0]}${fronts[1]}`;
}

function facesFor(seed) {
  let r = Rng.seed(seed);
  const drawn = new Set();
  const perms = [];
  for (let seat = 0; seat < 4; seat++) {
    let k;
    do {
      [k, r] = Rng.int(r, 720);
    } while (drawn.has(k));
    drawn.add(k);
    perms.push(Object.freeze(FACE_PERMS[k].slice()));
  }
  return Object.freeze(perms);
}

export { facesFor, faces, look };
