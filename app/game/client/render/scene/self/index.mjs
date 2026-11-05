import * as THREE from "three";
import { FACES, YAW, CAMERA, ROLL_PAD, TABLE_R, DIE } from "../../../../../../common/index.mjs";
import { mat3ToMatrix4, worldToRowNormal, visibleFaces, FACE_ORDER } from "./math.mjs";

// pip positions for die face values 1-6 (fractional 0..1)
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.75], [0.75, 0.25]],
  3: [[0.25, 0.75], [0.5, 0.5], [0.75, 0.25]],
  4: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.25], [0.75, 0.25]],
  5: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.25], [0.75, 0.25], [0.5, 0.5]],
  6: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.5], [0.75, 0.5], [0.25, 0.25], [0.75, 0.25]],
};

let renderer, scene, camera, tableMesh, diceObjects, rollPadMesh, noticeEl;
let canvasEl, seat;
let animating = false;
let tracks = [];
let noticeText = null;
let noticeTimer = null;
let rafId = null;
let firstPlayDone = false;
let playStart = 0;
let posesById = {};

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

  // table: flat dark-green plane at y=0, rotated -π/2 about x, large enough to hold every row and the pad
  const tgeom = new THREE.PlaneGeometry(20, 20);
  tableMesh = new THREE.Mesh(tgeom, new THREE.MeshBasicMaterial({ color: 0x1a4d2e }));
  tableMesh.position.set(0, 0, 0);
  tableMesh.rotation.set(-Math.PI / 2, 0, 0);
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
  posesById = {};

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

  posesById = {};
  for (const p of poses) posesById[p.id] = p;

  const trackById = {};
  for (const tr of tracks) trackById[tr.id] = tr;

  for (let i = 0; i < 16; i++) {
    diceObjects[i].visible = true;
    const tr = trackById[i];
    if (tr) {
      setDiePose(diceObjects[i], tr.from.position, tr.from.matrix);
    } else {
      setDiePose(diceObjects[i], posesById[i].position, posesById[i].matrix);
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
    if (elapsed < delay) {
      still = true;
      continue;
    }
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
  if (reply && reply.ok === false) {
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
        const mesh = diceObjects[ud.id];
        const owner = Math.floor(ud.id / 4);
        const worldNormal = it.normal.clone().transformDirection(mesh.matrixWorld);
        const normal = worldToRowNormal(worldNormal, owner);
        bestDie = { id: ud.id, normal, dist: it.distance };
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
    // find the pose for this die id to compute visible faces
    const pose = posesById[i];
    const faces = pose ? visibleFaces(pose, seat) : [];
    dice.push({ id: i, x: pr ? pr.x : 0, y: pr ? pr.y : 0, visibleFaces: faces });
  }
  const rollPos = rollPadMesh.position;
  const rollPr = projectToCanvas(rollPos);
  return { dice, roll: rollPr ? { x: rollPr.x, y: rollPr.y } : null, animating, notice: noticeText };
}

export { init, nextFrame, play, notice, pick, describe };
