import * as THREE from "three";
import { YAW, CAMERA, FACES } from "../../../../../../common/index.mjs";

const FACE_ORDER = ["+x", "-x", "+y", "-y", "+z", "-z"];

// Convert a row-major 3×3 rotation matrix to a THREE.Matrix4.
// matrix is row-major and maps the die's local axes to world: world = matrix · local.
// Matrix4.set takes rows.
export function mat3ToMatrix4(m) {
  return new THREE.Matrix4().set(
    m[0][0], m[0][1], m[0][2], 0,
    m[1][0], m[1][1], m[1][2], 0,
    m[2][0], m[2][1], m[2][2], 0,
    0, 0, 0, 1
  );
}

// Turn a world normal into the die's owner's row frame:
// YAW[owner] transposed, times the world normal. Rounded to the nearest axis.
export function worldToRowNormal(wn, owner) {
  const yaw = YAW[owner];
  const r = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    r[i] = yaw[0][i] * wn.x + yaw[1][i] * wn.y + yaw[2][i] * wn.z;
  }
  const abs = [Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2])];
  const ax = abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : (abs[1] >= abs[2] ? 1 : 2);
  const sign = r[ax] >= 0 ? 1 : -1;
  return (sign > 0 ? "+" : "-") + "xyz"[ax];
}

// The visible faces of a pose seen from a seat.
// For each face, its world normal is matrix · <its local axis>;
// it is visible when that dotted with (eye - centre) is > 0,
// where eye = YAW[seat] · CAMERA.eye.
export function visibleFaces(pose, seat) {
  const matrix = pose.matrix;
  const position = pose.position;
  const yaw = YAW[seat];
  const eye = [
    yaw[0][0] * CAMERA.eye[0] + yaw[0][1] * CAMERA.eye[1] + yaw[0][2] * CAMERA.eye[2],
    yaw[1][0] * CAMERA.eye[0] + yaw[1][1] * CAMERA.eye[1] + yaw[1][2] * CAMERA.eye[2],
    yaw[2][0] * CAMERA.eye[0] + yaw[2][1] * CAMERA.eye[1] + yaw[2][2] * CAMERA.eye[2],
  ];
  const dx = eye[0] - position[0];
  const dy = eye[1] - position[1];
  const dz = eye[2] - position[2];

  const faces = [
    { face: "+x", n: [matrix[0][0], matrix[1][0], matrix[2][0]] },
    { face: "-x", n: [-matrix[0][0], -matrix[1][0], -matrix[2][0]] },
    { face: "+y", n: [matrix[0][1], matrix[1][1], matrix[2][1]] },
    { face: "-y", n: [-matrix[0][1], -matrix[1][1], -matrix[2][1]] },
    { face: "+z", n: [matrix[0][2], matrix[1][2], matrix[2][2]] },
    { face: "-z", n: [-matrix[0][2], -matrix[1][2], -matrix[2][2]] },
  ];

  const visible = [];
  for (const f of faces) {
    const dot = f.n[0] * dx + f.n[1] * dy + f.n[2] * dz;
    if (dot > 0) visible.push(FACES[f.face]);
  }
  visible.sort((a, b) => a - b);
  return visible;
}

export { FACE_ORDER };
