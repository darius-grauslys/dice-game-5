import * as THREE from "three";
import { FACES, YAW, CAMERA, ROLL_PAD, TABLE_R, DIE } from "../../../../../../common/index.mjs";

// pip positions for die face values 1-6 (fractional 0..1)
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.75], [0.75, 0.25]],
  3: [[0.25, 0.75], [0.5, 0.5], [0.75, 0.25]],
  4: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.25], [0.75, 0.25]],
  5: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.25], [0.75, 0.25], [0.5, 0.5]],
  6: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.5], [0.75, 0.5], [0.25, 0.25], [0.75, 0.25]],
};

const FACE_ORDER = ["+x", "-x", "+y", "-y", "+z", "-z"];

let renderer, scene, camera, tableMesh, diceObjects, rollPadMesh, noticeEl;
let canvasEl, seat;
let animating = false;
let tracks = [];
let noticeText = null;
let noticeTimer = null;
let rafId = null;
let firstPlayDone = false;
let playStart = 0;

function makeFaceTexture(value) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#000000";
  const pos = PIPS[value] || [];
  for (const [px, py] of pos) {
    ctx.beginPath();
    ctx.arc(px * 64, py * 64, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function makeDieMesh(id) {
  const materials = FACE_ORDER.map((face) =>
    new THREE.MeshBasicMaterial({ map: makeFaceTexture(FACES[face]) })
  );
  const geom = new THREE.BoxGeometry(DIE, DIE, DIE);
  const mesh = new THREE.Mesh(geom, materials);
  mesh.userData = { id };
  mesh.visible = false;
  return mesh;
}

function mat3ToMatrix4(m) {
  const e = new Float64Array(16);
  e[0] = m[0][0]; e[1] = m[0][1]; e[2] = m[0][2]; e[3] = 0;
  e[4] = m[1][0]; e[5] = m[1][1]; e[6] = m[1][2]; e[7] = 0;
  e[8] = m[2][0]; e[9] = m[2][1]; e[10] = m[2][2]; e[11] = 0;
  e[12] = 0; e[13] = 0; e[14] = 0; e[15] = 1;
  return new THREE.Matrix4().fromArray(e);
}

function init({ canvas, seat: s }) {
  canvasEl = canvas;
  seat = s;
  const w = canvas.width;
  const h = canvas.height;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(1);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(CAMERA.fov, w / h, 0.1, 100);
  const eye = CAMERA.eye;
  const target = CAMERA.target;
  const yaw = YAW[s];
  camera.position.set(
    yaw[0][0] * eye[0] + yaw[0][1] * eye[1] + yaw[0][2] * eye[2],
    yaw[1][0] * eye[0] + yaw[1][1] * eye[1] + yaw[1][2] * eye[2],
    yaw[2][0] * eye[0] + yaw[2][1] * eye[1] + yaw[2][2] * eye[2]
  );
  camera.lookAt(
    yaw[0][0] * target[0] + yaw[0][1] * target[1] + yaw[0][2] * target[2],
    yaw[1][0] * target[0] + yaw[1][1] * target[1] + yaw[1][2] * target[2],
    yaw[2][0] * target[0] + yaw[2][1] * target[1] + yaw[2][2] * target[2]
  );
  camera.updateMatrixWorld();

  // table: flat dark-green plane at y=0
  const tgeom = new THREE.PlaneGeometry(TABLE_R * 2, TABLE_R * 2);
  tableMesh = new THREE.Mesh(tgeom, new THREE.MeshBasicMaterial({ color: 0x1a4d2e }));
  tableMesh.position.set(0, 0, 0);
  tableMesh.rotation.set(0, 0, 0);
  scene.add(tableMesh);

  // 16 dice
  diceObjects = [];
  for (let i = 0; i < 16; i++) {
    const m = makeDieMesh(i);
    diceObjects.push(m);
    scene.add(m);
  }

  // roll pad: flat square of side ROLL_PAD.size at YAW[seat]·ROLL_PAD.center, a colour unlike the table
  const rgeom = new THREE.PlaneGeometry(ROLL_PAD.size, ROLL_PAD.size);
  rollPadMesh = new THREE.Mesh(rgeom, new THREE.MeshBasicMaterial({ color: 0x2a3d4e }));
  const rc = ROLL_PAD.center;
  rollPadMesh.position.set(
    yaw[0][0] * rc[0] + yaw[0][1] * rc[1] + yaw[0][2] * rc[2],
    yaw[1][0] * rc[0] + yaw[1][1] * rc[1] + yaw[1][2] * rc[2],
    yaw[2][0] * rc[0] + yaw[2][1] * rc[1] + yaw[2][2] * rc[2]
  );
  rollPadMesh.userData = { kind: "roll" };
  // PlaneGeometry default lies in x-y plane with normal +z; rotate so normal is +y:
  rollPadMesh.rotation.set(-Math.PI / 2, 0, 0);
  scene.add(rollPadMesh);

  // notice DOM element
  noticeEl = document.createElement("div");
  noticeEl.style.position = "absolute";
  noticeEl.style.left = "0";
  noticeEl.style.top = "0";
  noticeEl.style.width = w + "px";
  noticeEl.style.height = h + "px";
  noticeEl.style.display = "none";
  noticeEl.style.zIndex = "10";
  noticeEl.style.color = "#ff4444";
  noticeEl.style.fontSize = "16px";
  noticeEl.style.fontWeight = "bold";
  noticeEl.style.textAlign = "center";
  noticeEl.style.bottom = "10px";
  noticeEl.style.margin = "0";
  if (canvasEl.parentNode) canvasEl.parentNode.insertBefore(noticeEl, canvasEl);

  animating = false;
  tracks = [];
  noticeText = null;
  firstPlayDone = false;

  (function loop() {
    rafId = requestAnimationFrame(loop);
    renderer.render(scene, camera);
    tickTracks();
  })();
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame((t) => resolve(t));
  });
}

function setDiePose(mesh, position, matrix) {
  mesh.position.set(position[0], position[1], position[2]);
  const m4 = mat3ToMatrix4(matrix);
  mesh.quaternion.setFromRotationMatrix(m4);
}

function play(tracksInput, poses) {
  playStart = performance.now();
  tracks = tracksInput || [];

  const states = [];
  for (let i = 0; i < 16; i++) states[i] = { trackId: null };

  for (const tr of tracks) {
    states[tr.id].trackId = tr.id;
  }

  for (let i = 0; i < 16; i++) {
    diceObjects[i].visible = true;
    const st = states[i];
    if (st.trackId !== null) {
      const tr = tracks.find((t) => t.id === i);
      setDiePose(diceObjects[i], tr.from.position, tr.from.matrix);
    } else {
      setDiePose(diceObjects[i], poses[i].position, poses[i].matrix);
    }
  }

  animating = tracks.length > 0;
  firstPlayDone = true;
}

function tickTracks() {
  if (tracks.length === 0) {
    animating = false;
    return;
  }
  const now = performance.now();
  let still = false;
  for (const tr of tracks) {
    const id = tr.id;
    const delay = tr.delay || 0;
    const ms = tr.ms || 0;
    const spin = tr.spin || 0;
    const elapsed = now - playStart;
    if (elapsed < delay) continue;
    const t = Math.min(1, (elapsed - delay) / ms);
    if (t < 1) still = true;

    const fp = tr.from.position;
    const tp = tr.to.position;
    diceObjects[id].position.set(
      fp[0] + t * (tp[0] - fp[0]),
      fp[1] + t * (tp[1] - fp[1]),
      fp[2] + t * (tp[2] - fp[2])
    );

    const fromM4 = mat3ToMatrix4(tr.from.matrix);
    const toM4 = mat3ToMatrix4(tr.to.matrix);
    const fromQ = new THREE.Quaternion().setFromRotationMatrix(fromM4);
    const toQ = new THREE.Quaternion().setFromRotationMatrix(toM4);
    const slerpQ = fromQ.clone().slerp(toQ, t);
    if (spin > 0) {
      const spinQ = new THREE.Quaternion();
      spinQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin * Math.PI * 2 * t);
      slerpQ.multiply(spinQ);
    }
    diceObjects[id].quaternion.copy(slerpQ);
  }
  animating = still;
}

function notice(reply) {
  if (noticeTimer) clearTimeout(noticeTimer);
  if (!reply || reply.ok === false) {
    noticeText = reply.reason;
    noticeEl.style.display = "block";
    noticeEl.textContent = reply.reason;
    noticeTimer = setTimeout(() => {
      noticeEl.style.display = "none";
      noticeText = null;
    }, 1500);
  } else {
    noticeText = null;
    noticeEl.style.display = "none";
  }
}

function worldToRowNormal(wn, owner) {
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

function pick({ x, y }) {
  const raycaster = new THREE.Raycaster();
  const rect = canvasEl.getBoundingClientRect
    ? canvasEl.getBoundingClientRect()
    : { left: 0, top: 0, width: canvasEl.width, height: canvasEl.height };
  const nx = rect.width === 0 ? 0 : ((x - rect.left) / rect.width) * 2 - 1;
  const ny = rect.height === 0 ? 0 : 1 - ((y - rect.top) / rect.height) * 2;
  raycaster.setFromCamera({ x: nx, y: ny }, camera);
  const allObjects = diceObjects.concat([rollPadMesh, tableMesh]);
  const intersects = raycaster.intersectObjects(allObjects, false);
  let bestDie = null, bestRoll = null;
  for (const it of intersects) {
    let obj = it.object;
    while (obj && !obj.userData && obj.parent) obj = obj.parent;
    if (!obj || !obj.userData) continue;
    const ud = obj.userData;
    if (ud.kind === "roll") {
      bestRoll = it.distance;
    } else if (ud.id !== undefined) {
      if (!bestDie || it.distance < bestDie.dist) {
        const owner = Math.floor(ud.id / 4);
        bestDie = { id: ud.id, normal: worldToRowNormal(it.normal, owner), dist: it.distance };
      }
    }
  }
  if (bestDie && (!bestRoll || bestDie.dist <= bestRoll)) {
    return { kind: "die", id: bestDie.id, normal: bestDie.normal };
  }
  if (bestRoll) return { kind: "roll" };
  return null;
}

function projectToCanvas(pos) {
  const local = pos.clone().applyMatrix4(camera.matrixWorldInverse);
  if (local.z >= 0) return null;
  const u = local.x / (-local.z);
  const v = local.y / (-local.z);
  const tanHalf = Math.tan((CAMERA.fov * Math.PI / 180) / 2);
  const uNorm = u / (tanHalf * camera.aspect);
  const vNorm = v / tanHalf;
  const cssX = (1 + uNorm) * 0.5 * canvasEl.width;
  const cssY = (1 - vNorm) * 0.5 * canvasEl.height;
  return { x: cssX, y: cssY };
}

function describe() {
  if (!firstPlayDone) return { dice: [], roll: null, animating, notice: noticeText };
  const dice = [];
  for (let i = 0; i < 16; i++) {
    const mesh = diceObjects[i];
    const pos = mesh.position;
    const pr = projectToCanvas(pos);
    let visibleFaces = [];
    const mw = mesh.matrixWorld.elements;
    const me = [mw[0], mw[1], mw[2], mw[3], mw[4], mw[5], mw[6], mw[7], mw[8]];
    const normals = {
      "+x": [me[0], me[3], me[6]],
      "-x": [-me[0], -me[3], -me[6]],
      "+y": [me[1], me[4], me[7]],
      "-y": [-me[1], -me[4], -me[7]],
      "+z": [me[2], me[5], me[8]],
      "-z": [-me[2], -me[5], -me[8]],
    };
    const eyeVec = [CAMERA.eye[0] - pos.x, CAMERA.eye[1] - pos.y, CAMERA.eye[2] - pos.z];
    for (const face of FACE_ORDER) {
      const n = normals[face];
      const dot = n[0] * eyeVec[0] + n[1] * eyeVec[1] + n[2] * eyeVec[2];
      if (dot > 0) visibleFaces.push(FACES[face]);
    }
    visibleFaces.sort((a, b) => a - b);
    dice.push({ id: i, x: pr ? pr.x : 0, y: pr ? pr.y : 0, visibleFaces });
  }
  const rollPos = rollPadMesh.position;
  const rollPr = projectToCanvas(rollPos);
  return { dice, roll: rollPr ? { x: rollPr.x, y: rollPr.y } : null, animating, notice: noticeText };
}

export { init, nextFrame, play, notice, pick, describe };
