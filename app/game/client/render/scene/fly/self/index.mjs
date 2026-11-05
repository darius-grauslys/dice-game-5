import { Rng } from "../../../../../../../common/index.mjs";

function show(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return "an array";
  if (typeof v === "object") return "an object";
  return typeof v;
}

export function flight(pose, id, seed, t) {
  if (pose === null || typeof pose !== "object" || Array.isArray(pose)) {
    throw new TypeError(`fly.flight: expected pose, got ${show(pose)}`);
  }
  if (!("position" in pose) || !("matrix" in pose)) {
    throw new TypeError("fly.flight: pose must have position and matrix");
  }
  const position = pose.position;
  if (!Array.isArray(position) || position.length !== 3 || !position.every((v) => typeof v === "number")) {
    throw new TypeError("fly.flight: pose.position must be an array of 3 numbers");
  }
  const matrix = pose.matrix;
  if (!Array.isArray(matrix) || matrix.length !== 3 || !matrix.every((row) => Array.isArray(row) && row.length === 3 && row.every((v) => typeof v === "number"))) {
    throw new TypeError("fly.flight: pose.matrix must be a 3x3 array of numbers");
  }
  if (!Number.isInteger(id) || id < 0 || id > 15) {
    throw new TypeError(`fly.flight: id must be an integer 0..15, got ${show(id)}`);
  }
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError(`fly.flight: seed must be a safe integer, got ${show(seed)}`);
  }
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0) {
    throw new TypeError(`fly.flight: t must be a non-negative number, got ${show(t)}`);
  }

  let r = Rng.seed((seed + 7919 * id) >>> 0);
  let k;
  [k, r] = Rng.int(r, 3600);
  const heading = 2 * Math.PI * k / 3600;
  [k, r] = Rng.int(r, 600);
  const speed = 6 + k / 100;
  [k, r] = Rng.int(r, 500);
  const up = 4 + k / 100;
  let [a, r1] = Rng.int(r, 3);
  let [b, r2] = Rng.int(r1, 3);
  let [c, r3] = Rng.int(r2, 3);
  let ax = a - 1, ay = b - 1, az = c - 1;
  let norm = Math.sqrt(ax * ax + ay * ay + az * az);
  if (norm === 0) { ax = 0; ay = 1; az = 0; norm = 1; }
  else { ax /= norm; ay /= norm; az /= norm; }
  [k, r] = Rng.int(r3, 1200);
  const spin = 6 + k / 100;

  const s = t / 1000;
  const positionOut = [
    position[0] + Math.cos(heading) * speed * s,
    position[1] + up * s - 10 * s * s,
    position[2] + Math.sin(heading) * speed * s,
  ];

  const theta = spin * s;
  const co = Math.cos(theta);
  const sn = Math.sin(theta);
  const m1 = 1 - co;
  const R00 = co + ax * ax * m1;
  const R01 = ax * ay * m1 - az * sn;
  const R02 = ax * az * m1 + ay * sn;
  const R10 = ay * ax * m1 + az * sn;
  const R11 = co + ay * ay * m1;
  const R12 = ay * az * m1 - ax * sn;
  const R20 = az * ax * m1 - ay * sn;
  const R21 = az * ay * m1 + ax * sn;
  const R22 = co + az * az * m1;

  const M = matrix;
  const matOut = [
    [R00 * M[0][0] + R01 * M[1][0] + R02 * M[2][0], R00 * M[0][1] + R01 * M[1][1] + R02 * M[2][1], R00 * M[0][2] + R01 * M[1][2] + R02 * M[2][2]],
    [R10 * M[0][0] + R11 * M[1][0] + R12 * M[2][0], R10 * M[0][1] + R11 * M[1][1] + R12 * M[2][1], R10 * M[0][2] + R11 * M[1][2] + R12 * M[2][2]],
    [R20 * M[0][0] + R21 * M[1][0] + R22 * M[2][0], R20 * M[0][1] + R21 * M[1][1] + R22 * M[2][1], R20 * M[0][2] + R21 * M[1][2] + R22 * M[2][2]],
  ];

  return { position: positionOut, matrix: matOut };
}
