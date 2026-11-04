// common/tables: the die's 24 orientations and the quarter-turn table.
//
// Pure: no imports, no IO, no time, no randomness. Computed once when the
// module loads, then deeply frozen.

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
