import * as THREE from "three";

// ease curve: t clamped to 0..1, e(t) = t < 0.5 ? 2t² : 1 − (−2t + 2)² / 2
export function ease(t) {
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  if (t < 0.5) return 2 * t * t;
  return 1 - ((-2 * t + 2) ** 2) / 2;
}

// slerp from quaternion `from` to `to` (both [x,y,z,w]) at ease(elapsed/ms)
export function turnAt(from, to, elapsed, ms) {
  const t = ease(elapsed / ms);
  const qFrom = new THREE.Quaternion(from[0], from[1], from[2], from[3]);
  const qTo = new THREE.Quaternion(to[0], to[1], to[2], to[3]);
  const q = qFrom.clone().slerp(qTo, t);
  return [q.x, q.y, q.z, q.w];
}

// two 3x3 matrices equal entry by entry within 1e-9
export function sameRotation(a, b) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (Math.abs(a[i][j] - b[i][j]) > 1e-9) return false;
    }
  }
  return true;
}
