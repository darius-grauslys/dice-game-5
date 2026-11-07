import * as THREE from "three";
import { FACES, YAW, CAMERA, DIE, PLAYERS, FOLLOW, GLOW, LABEL, WIN, TABLE_R, MS } from "../../../../../../common/index.mjs";
import * as dice from "../../../../../../edges/scene/scene_to_dice.mjs";
import * as label from "../../../../../../edges/scene/scene_to_label.mjs";
import * as sparks from "../../../../../../edges/scene/scene_to_sparks.mjs";
import * as fly from "../../../../../../edges/scene/scene_to_fly.mjs";
import { mat3ToMatrix4 } from "./math.mjs";
import { ease, turnAt, sameRotation } from "./hold.mjs";

// pip positions for die face values 1-6 (fractional 0..1)
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.75], [0.75, 0.25]],
  3: [[0.25, 0.75], [0.5, 0.5], [0.75, 0.25]],
  4: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.25], [0.75, 0.25]],
  5: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.25], [0.75, 0.25], [0.5, 0.5]],
  6: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.5], [0.75, 0.5], [0.25, 0.25], [0.75, 0.25]],
};

let renderer, scene, camera, tableMesh;
let diceMeshes = [];
let labelMeshes = [];
let glowMeshes = [];
let canvasEl, seat;
let animating = false;
let tracks = [];
let noticeText = null;
let noticeEl = null;
let noticeTimer = null;
let rafId = null;
let firstPlayDone = false;
let playStart = 0;
let posesById = {};
let holdState = null; // {poses, at, to, holdPosesById, turns: {[id]: {from, to, start}}, turningBack}
let finaleState = null; // {started: bool, tracksEnd: number}
let glowT0 = 0;
let dustAnchor = null;
let sparklerAnchor = null;
let myPoints = null;
let lastFrameTime = 0;
let dustParticles = [];
let sparklerParticles = [];

function makeGlow(mesh) {
  const group = mesh instanceof THREE.Group ? mesh : new THREE.Group();
  if (mesh instanceof THREE.Group) {
    for (const c of mesh.children) group.add(c.clone());
  } else {
    group.add(mesh.clone());
  }
  group.scale.set(1.12, 1.12, 1.12);
  const mat = new THREE.MeshStandardMaterial({
    color: GLOW.colour,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  for (const c of group.children) {
    if (c.material) c.material = mat;
  }
  group.visible = false;
  return group;
}

function init({ canvas, seat: s }) {
  canvasEl = canvas;
  seat = s;
  const w = canvas.width;
  const h = canvas.height;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(1);

  scene = new THREE.Scene();

  const cameraClass = THREE.PerspectiveCamera || THREE.Camera;
  camera = new cameraClass(CAMERA.fov, w / h, 0.1, 100);
  const yaw = YAW[s];
  const eye = [
    yaw[0][0] * CAMERA.eye[0] + yaw[0][1] * CAMERA.eye[1] + yaw[0][2] * CAMERA.eye[2],
    yaw[1][0] * CAMERA.eye[0] + yaw[1][1] * CAMERA.eye[1] + yaw[1][2] * CAMERA.eye[2],
    yaw[2][0] * CAMERA.eye[0] + yaw[2][1] * CAMERA.eye[1] + yaw[2][2] * CAMERA.eye[2],
  ];
  const target = [
    yaw[0][0] * CAMERA.target[0] + yaw[0][1] * CAMERA.target[1] + yaw[0][2] * CAMERA.target[2],
    yaw[1][0] * CAMERA.target[0] + yaw[1][1] * CAMERA.target[1] + yaw[1][2] * CAMERA.target[2],
    yaw[2][0] * CAMERA.target[0] + yaw[2][1] * CAMERA.target[1] + yaw[2][2] * CAMERA.target[2],
  ];
  camera.position.set(eye[0], eye[1], eye[2]);
  camera.lookAt(target[0], target[1], target[2]);
  camera.updateMatrixWorld();

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x334433, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  const lightPos = [
    yaw[0][0] * 3 + yaw[0][1] * 10 + yaw[0][2] * 6,
    yaw[1][0] * 3 + yaw[1][1] * 10 + yaw[1][2] * 6,
    yaw[2][0] * 3 + yaw[2][1] * 10 + yaw[2][2] * 6,
  ];
  dir.position.set(lightPos[0], lightPos[1], lightPos[2]);
  scene.add(dir);

  // table: large flat plane at y=0
  const tgeom = new THREE.PlaneGeometry(TABLE_R * 4, TABLE_R * 4);
  tableMesh = new THREE.Mesh(tgeom, new THREE.MeshBasicMaterial({ color: 0x1a4d2e }));
  tableMesh.position.set(0, 0, 0);
  tableMesh.rotation.set(-Math.PI / 2, 0, 0);
  scene.add(tableMesh);

  // seed and perms
  let seed = 0;
  try {
    const meta = document.querySelector('meta[name="dice-seed"]');
    const c = meta?.content;
    seed = Number(c);
    if (!Number.isInteger(seed)) seed = 0;
  } catch {
    seed = 0;
  }
  const perms = dice.facesFor(seed);

  // 16 dice wrapped in groups (hide before play)
  diceMeshes = [];
  for (let i = 0; i < 16; i++) {
    const owner = Math.floor(i / 4);
    const m = dice.makeDie({ colour: PLAYERS[owner].colour, ring: PLAYERS[owner].ring, perm: perms[owner] });
    const g = new THREE.Group();
    g.add(m);
    g.visible = false;
    g.userData = { kind: "die", id: i };
    diceMeshes.push(g);
    scene.add(g);
  }

  // 4 labels wrapped in groups (hide before play)
  labelMeshes = [];
  for (let o = 0; o < 4; o++) {
    const m = label.makeLabel({ text: PLAYERS[o].label, colour: PLAYERS[o].colour });
    const g = new THREE.Group();
    g.add(m);
    g.visible = false;
    labelMeshes.push(g);
    scene.add(g);
  }

  // glow outlines (behind dice) wrapped in groups (hidden before play)
  glowMeshes = [];
  for (let i = 0; i < 16; i++) {
    const g0 = makeGlow(diceMeshes[i] instanceof THREE.Group ? diceMeshes[i].children[0] : diceMeshes[i]);
    const g = new THREE.Group();
    g.add(g0);
    g.visible = false;
    glowMeshes.push(g);
    scene.add(g);
  }

  // sparks
  sparks.init(scene);
  let pts = scene.children.find(c => c.isPoints);
  if (pts) scene.remove(pts);
  const pgeom = new THREE.BufferGeometry();
  const pmat = new THREE.PointsMaterial({ color: 0xffd84a, size: 2 });
  myPoints = new THREE.Points(pgeom, pmat);
  myPoints.depthWrite = false;
  scene.add(myPoints);

  // notice DOM element
  noticeEl = document.createElement("div");
  noticeEl.style.position = "absolute";
  noticeEl.style.left = "0";
  noticeEl.style.top = "0";
  noticeEl.style.width = w + "px";
  noticeEl.style.height = h + "px";
  noticeEl.style.display = "none";
  noticeEl.style.zIndex = "10";
  noticeEl.style.backgroundColor = "rgba(0,0,0,0.6)";
  noticeEl.style.borderRadius = "16px";
  noticeEl.style.color = "#ffffff";
  noticeEl.style.fontSize = "16px";
  noticeEl.style.fontWeight = "normal";
  noticeEl.style.textAlign = "center";
  noticeEl.style.text = "pill";
  noticeEl.style.padding = "8px 16px";
  noticeEl.style.borderRadius = "16px";
  noticeEl.style.display = "none";
  noticeEl.style.position = "absolute";
  noticeEl.style.top = "12px";
  noticeEl.style.left = "50%";
  noticeEl.style.transform = "translateX(-50%)";
  noticeEl.style.border = "1px rgba(255,255,255,0.3)";
  noticeEl.style.borderRadius = "16px";
  if (canvasEl.parentNode) canvasEl.parentNode.insertBefore(noticeEl, canvasEl);

  animating = false;
  tracks = [];
  noticeText = null;
  firstPlayDone = false;
  playStart = 0;
  posesById = {};
  holdState = null;
  finaleState = null;
  glowT0 = 0;
  dustAnchor = null;
  sparklerAnchor = null;
  lastFrameTime = performance.now();

  (function loop(t) {
    rafId = requestAnimationFrame(loop);
    const now = t || performance.now();
    const dt = firstPlayDone ? now - lastFrameTime : 0;
    lastFrameTime = now;
    if (!firstPlayDone && diceMeshes.length > 0) {
    }
    try {
      tickTracks(dt);
      tickHold(dt);
      tickGlow(now);
      tickFinale(now);
      renderParticles(now);
      const pts = scene.children.find(c => c.isPoints);
      renderer.render(scene, camera);
    } catch (e) {
      console.log("RENDER ERROR:", (e && e.message) || String(e));
    }
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

function quatArray(q) {
  return [q.x, q.y, q.z, q.w];
}

function quaternionToMatrix3(q) {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(q).elements; // column-major
  return [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]];
}

// play: show dice at poses (with tracks), labels, glow/dust, and a winning finale.
// **Finale:** A `play` with `state.winner === null` ends a finale that is running or done:
// every die visible at its pose (or its track), every label at its place with scale 1 and turned to the camera,
// the sparkler stopped (`sparks.sparkler(null)`) and its particles gone, and the next win starts a new finale from the beginning.
function play(tracksInput, posesInput, state) {
  playStart = performance.now();
  tracks = (tracksInput || []).slice(); // motion's tracks are frozen: copy, never assign into them
  posesById = {};
  for (const p of posesInput) posesById[p.id] = p;

  const trackById = {};
  for (const tr of tracks) trackById[tr.id] = tr;

  // capture mesh position/rotation for held/turning-back dice before ending hold
  const meshFrom = {};
  if (holdState && holdState.holdPosesById) {
    for (const idStr of Object.keys(holdState.holdPosesById)) {
      const id = Number(idStr);
      const tr = trackById[id];
      if (tr) {
        meshFrom[id] = {
          position: [diceMeshes[id].position.x, diceMeshes[id].position.y, diceMeshes[id].position.z],
          matrix: quaternionToMatrix3(diceMeshes[id].quaternion),
        };
      }
    }
  }

  // end hold
  holdState = null;

  // show all dice at their poses (except tracked ones handled in tickTracks)
  for (let i = 0; i < 16; i++) {
    diceMeshes[i].visible = true;
    const tr = trackById[i];
    if (tr) {
      // starts at mesh position/rotation if held or turning back, else track.from
      if (meshFrom[i]) {
        setDiePose(diceMeshes[i], meshFrom[i].position, meshFrom[i].matrix);
        const own = { ...tr, from: meshFrom[i] };
        tracks[tracks.indexOf(tr)] = own;
        trackById[i] = own;
      } else {
        setDiePose(diceMeshes[i], tr.from.position, tr.from.matrix);
      }
    } else {
      setDiePose(diceMeshes[i], posesById[i].position, posesById[i].matrix);
    }
  }

  // labels: show, position, scale 1, and turned to the camera
  for (let o = 0; o < 4; o++) {
    labelMeshes[o].visible = true;
    labelMeshes[o].scale.set(1, 1, 1);
    const lp = state.labels[o].position;
    labelMeshes[o].position.set(lp[0], lp[1], lp[2]);
    // turned about +y to face the camera
    const yaw = YAW[seat];
    const eye = [
      yaw[0][0] * CAMERA.eye[0] + yaw[0][1] * CAMERA.eye[1] + yaw[0][2] * CAMERA.eye[2],
      yaw[1][0] * CAMERA.eye[0] + yaw[1][1] * CAMERA.eye[1] + yaw[1][2] * CAMERA.eye[2],
      yaw[2][0] * CAMERA.eye[0] + yaw[2][1] * CAMERA.eye[1] + yaw[2][2] * CAMERA.eye[2],
    ];
    const dx = eye[0] - lp[0];
    const dz = eye[2] - lp[2];
    const angle = atan2(dx, dz);
    labelMeshes[o].rotation.set(0, angle, 0);
  }

  // glow: outline dice in state.glow
  for (let i = 0; i < 16; i++) {
    glowMeshes[i].visible = false;
  }
  const hasWinner = state.winner !== null;
  if (hasWinner) winnerState = state.winner;
  if (!hasWinner) {
    for (const id of state.glow || []) {
      glowMeshes[id].visible = true;
    }
    glowT0 = playStart;
  } else {
    for (const g of glowMeshes) g.visible = false;
  }

  // dust: while winner === null, dust under active player's label
  if (!hasWinner) {
    const lp = state.labels[state.turn].position;
    dustAnchor = [lp[0], lp[1] - 0.6, lp[2]];
    sparks.dust(dustAnchor);
    genDust(dustAnchor);
    // end a running/done finale: stop sparkler and clear its particles
    sparks.sparkler(null);
    sparklerAnchor = null;
    sparklerParticles = [];
  } else {
    sparks.dust(null);
    dustAnchor = null;
    dustParticles = [];
  }

  // finale: first play with winner !== null starts it
  if (hasWinner) {
    if (!finaleState || !finaleState.started) {
      finaleState = { started: true, tracksEnd: playStart };
      // sparks.dust(null) handled above
    }
  } else {
    finaleState = null;
  }

  // animating: true until every track has ended (finale doesn't count)
  animating = tracks.length > 0;
  firstPlayDone = true;
}

function trackEnded(tr, now) {
  const delay = tr.delay || 0;
  const ms = tr.ms || 0;
  const elapsed = now - playStart;
  if (elapsed < delay) return false;
  const t = (elapsed - delay) / ms;
  return t >= 1;
}

function tickTracks(dt) {
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
      // die stays at from (or hold)
      const hp = holdState && holdState.holdPosesById && holdState.holdPosesById[id];
      if (hp) setDiePose(diceMeshes[id], hp.position, hp.matrix);
      else setDiePose(diceMeshes[id], tr.from.position, tr.from.matrix);
      continue;
    }
    const t = Math.min(1, (elapsed - delay) / ms);
    if (t < 1) still = true;

    const fp = tr.from.position;
    const tp = tr.to.position;
    diceMeshes[id].position.set(
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
    diceMeshes[id].quaternion.copy(slerpQ);
  }

  // check if all tracks ended
  let allEnded = true;
  for (const tr of tracks) {
    if (!trackEnded(tr, performance.now())) { allEnded = false; break; }
  }
  animating = !allEnded;
}

function tickHold(dt) {
  if (!holdState) return;
  const { poses, at, to, holdPosesById, turns, turningBack } = holdState;
  const now = performance.now();

  for (const idStr of Object.keys(holdPosesById)) {
    const id = Number(idStr);
    const p = holdPosesById[id];

    // Position
    if (turningBack) {
      const pose = posesById[id];
      diceMeshes[id].position.set(pose.position[0], pose.position[1], pose.position[2]);
    } else {
      const yTarget = p.position[1];
      const worldAt = canvasToWorldPoint(at.x, at.y, yTarget);
      const worldTo = canvasToWorldPoint(to.x, to.y, yTarget);
      let worldDx = 0, worldDz = 0;
      if (worldAt && worldTo) {
        worldDx = worldTo.x - worldAt.x;
        worldDz = worldTo.z - worldAt.z;
      }
      const dragLen = Math.hypot(worldDx, worldDz);
      const maxLen = FOLLOW.max;
      const scale = dragLen > maxLen ? maxLen / dragLen : 1;
      const scaledDx = worldDx * scale;
      const scaledDz = worldDz * scale;
      diceMeshes[id].position.set(
        p.position[0] + scaledDx,
        p.position[1] + FOLLOW.lift,
        p.position[2] + scaledDz
      );
    }

    // Rotation: slerp over MS.turn
    const turn = turns && turns[id];
    if (turn) {
      const elapsed = now - turn.start;
      const q = turnAt(turn.from, turn.to, elapsed, MS.turn);
      diceMeshes[id].quaternion.set(q[0], q[1], q[2], q[3]);
    }
  }
}

function tickGlow(now) {
  const hasWinner = finaleState && finaleState.started;
  if (hasWinner) {
    for (const g of glowMeshes) g.visible = false;
    return;
  }
  const t = now - glowT0;
  const opacity = GLOW.min + (GLOW.max - GLOW.min) * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / GLOW.periodMs));
  for (let i = 0; i < 16; i++) {
    if (glowMeshes[i].visible) {
      for (const c of glowMeshes[i].children) {
        if (c.material && c.material.opacity !== undefined) c.material.opacity = opacity;
      }
    }
  }
}

function tickFinale(now) {
  if (!finaleState || !finaleState.started) return;
  const tracksEnd = finaleState.tracksEnd;
  const t = now - tracksEnd; // ms since finale began
  // move the 12 dice not owned by winner on fly.flight
  const winner = findWinner();
  for (let i = 0; i < 16; i++) {
    const owner = Math.floor(i / 4);
    if (owner === winner) {
      // winner's dice don't move, nothing touches them
      continue;
    }
    const pose = posesById[i];
    const flight = fly.flight(pose, i, findSeed(), t);
    diceMeshes[i].position.set(flight.position[0], flight.position[1], flight.position[2]);
    const m4 = mat3ToMatrix4(flight.matrix);
    diceMeshes[i].quaternion.setFromRotationMatrix(m4);
    // hidden once below y = -20
    if (flight.position[1] <= -20) {
      diceMeshes[i].visible = false;
    } else {
      diceMeshes[i].visible = true;
    }
  }

  // winner's label: from t = WIN.label for WIN.labelMs ms, moves from its place to [0, 2.5, 0] and grows to 1.6x
  const winnerLabel = labelMeshes[winner];
  const lp0 = (finaleState.labelStartPos || (finaleState.labelStartPos = labelMeshes[winner].position.clone()));
  let labelScale = 1;
  let labelPos = labelMeshes[winner].position.clone();
  if (t >= WIN.label) {
    const lt = t - WIN.label;
    if (lt < WIN.labelMs) {
      const et = easeInOut(lt / WIN.labelMs);
      labelPos.set(
        lp0.x * (1 - et) + 0 * et,
        lp0.y * (1 - et) + 2.5 * et,
        lp0.z * (1 - et) + 0 * et
      );
      labelScale = 1 + 0.6 * et;
      winnerLabel.scale.set(labelScale, labelScale, labelScale);
      winnerLabel.position.set(labelPos.x, labelPos.y, labelPos.z);
    } else {
      labelPos.set(0, 2.5, 0);
      labelScale = 1.6;
      winnerLabel.scale.set(labelScale, labelScale, labelScale);
      winnerLabel.position.set(0, 2.5, 0);
      if (!sparklerAnchor) {
        sparklerAnchor = [0, 2.5, 0];
        sparks.sparkler(sparklerAnchor);
        genSparkler(sparklerAnchor);
      }
    }
  }
}

function easeInOut(t) {
  if (t < 0.5) return 2 * t * t;
  return 1 - 2 * (1 - t) * (1 - t);
}

function atan2(y, x) {
  let a = Math.atan(y / x);
  if (x < 0) a += (y >= 0 ? Math.PI : -Math.PI);
  else if (x === 0 && y < 0) a = -Math.PI / 2;
  else if (x === 0 && y > 0) a = Math.PI / 2;
  return a;
}

function findWinner() {
  // find winner from current state; we track it
  return winnerState;
}

let winnerState = null;

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

function canvasToWorldPoint(cx, cy, yTarget) {
  const rect = { width: canvasEl.width, height: canvasEl.height };
  const nx = rect.width === 0 ? 0 : ((cx / rect.width) * 2 - 1);
  const ny = rect.height === 0 ? 0 : 1 - ((cy / rect.height) * 2);
  const tanHalf = Math.tan((CAMERA.fov * Math.PI / 180) / 2);
  const u = nx * tanHalf * camera.aspect;
  const v = ny * tanHalf;
  const localDir = new THREE.Vector3(u, v, -1).normalize();
  const dir = localDir.clone().applyQuaternion(camera.quaternion);
  const start = camera.position.clone();
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (yTarget - start.y) / dir.y;
  if (t < 0) return null;
  return { x: start.x + t * dir.x, z: start.z + t * dir.z };
}

function hold(h) {
  if (h === null) {
    // turning back to play poses
    if (holdState && holdState.holdPosesById) {
      const now = performance.now();
      const turns = {};
      for (const idStr of Object.keys(holdState.holdPosesById)) {
        const id = Number(idStr);
        const pose = posesById[id];
        const fromQ = quatArray(diceMeshes[id].quaternion);
        const toM4 = mat3ToMatrix4(pose.matrix);
        const toQ = new THREE.Quaternion().setFromRotationMatrix(toM4);
        turns[id] = { from: fromQ, to: [toQ.x, toQ.y, toQ.z, toQ.w], matrix: pose.matrix, start: now };
      }
      holdState = {
        poses: null, at: null, to: null,
        holdPosesById: holdState.holdPosesById,
        turns,
        turningBack: true,
      };
    } else {
      holdState = null;
    }
    return;
  }
  const { poses, at, to } = h;
  const holdPosesById = {};
  for (const p of poses) holdPosesById[p.id] = p;

  const now = performance.now();
  const turns = {};
  for (const p of poses) {
    const id = p.id;
    const existing = holdState && holdState.turns ? holdState.turns[id] : null;
    if (existing && sameRotation(existing.matrix, p.matrix)) {
      turns[id] = existing; // keep running turn
    } else {
      const fromQ = quatArray(diceMeshes[id].quaternion);
      const toM4 = mat3ToMatrix4(p.matrix);
      const toQ = new THREE.Quaternion().setFromRotationMatrix(toM4);
      turns[id] = { from: fromQ, to: [toQ.x, toQ.y, toQ.z, toQ.w], matrix: p.matrix, start: now };
    }
  }
  holdState = { poses, at, to, holdPosesById, turns, turningBack: false };
}

function pick({ x, y }) {
  const raycaster = new THREE.Raycaster();
  const rect = canvasEl.getBoundingClientRect
    ? canvasEl.getBoundingClientRect()
    : { left: 0, top: 0, width: canvasEl.width, height: canvasEl.height };
  const nx = rect.width === 0 ? 0 : ((x - rect.left) / rect.width) * 2 - 1;
  const ny = rect.height === 0 ? 0 : 1 - ((y - rect.top) / rect.height) * 2;
  raycaster.setFromCamera({ x: nx, y: ny }, camera);
  const allObjects = diceMeshes;
  const intersects = raycaster.intersectObjects(allObjects, true);
  let bestDie = null;
  for (const it of intersects) {
    let node = it.object;
    let groupNode = null;
    while (node) {
      if (node.userData && node.userData.kind === "die" && node.userData.id !== undefined) {
        groupNode = node;
        break;
      }
      node = node.parent;
    }
    if (!groupNode) continue;
    if (!bestDie || it.distance < bestDie.dist) {
      bestDie = { id: groupNode.userData.id, dist: it.distance };
    }
  }
  if (bestDie) return { kind: "die", id: bestDie.id };
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

function findSeed() {
  let seed = 0;
  try {
    const meta = document.querySelector('meta[name="dice-seed"]');
    const c = meta?.content;
    seed = Number(c);
    if (!Number.isInteger(seed)) seed = 0;
  } catch {
    seed = 0;
  }
  return seed;
}

const MAX_PARTICLES = 200;
let particlePositions = new Float32Array(MAX_PARTICLES * 3);
let particleSizes = new Float32Array(MAX_PARTICLES);

function genDust(anchor, count) {
  dustParticles = [];
  const n = count || 40;
  for (let i = 0; i < n; i++) {
    dustParticles.push({
      ox: (Math.random() - 0.5) * 1.6,
      oy: -0.15 - Math.random() * 0.7,
      oz: (Math.random() - 0.5) * 1.6,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function genSparkler(anchor, count) {
  sparklerParticles = [];
  const n = count || 60;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.05 + Math.random() * 0.7;
    const h = -0.2 - Math.random() * 0.9;
    sparklerParticles.push({
      ax: Math.cos(a), ay: 1, az: Math.sin(a),
      r: r, h: h,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
    });
  }
}

function renderParticles(now) {
  let idx = 0;
  const anchor = dustAnchor;
  if (anchor && dustParticles.length) {
    for (const p of dustParticles) {
      if (idx >= MAX_PARTICLES) break;
      particlePositions[idx * 3] = anchor[0] + p.ox;
      particlePositions[idx * 3 + 1] = anchor[1] + p.oy;
      particlePositions[idx * 3 + 2] = anchor[2] + p.oz;
      particleSizes[idx] = 2.5;
      idx++;
    }
  }
  const sanchor = sparklerAnchor;
  if (sanchor && sparklerParticles.length) {
    for (const p of sparklerParticles) {
      if (idx >= MAX_PARTICLES) break;
      const flick = 0.5 + 0.5 * Math.sin(now * 0.012 * p.speed + p.phase);
      particlePositions[idx * 3] = sanchor[0] + p.ax * p.r;
      particlePositions[idx * 3 + 1] = sanchor[1] + p.h + flick * 0.15;
      particlePositions[idx * 3 + 2] = sanchor[2] + p.az * p.r;
      particleSizes[idx] = 2 + flick * 3;
      idx++;
    }
  }
  const view = particlePositions.slice(0, idx * 3);
  if (myPoints && myPoints.geometry) {
    if (myPoints.geometry.setPositions) {
      myPoints.geometry.setPositions(view);
    } else if (myPoints.geometry.positions) {
      myPoints.geometry.positions.set(view);
    }
  }
}

function describe() {
  if (!firstPlayDone) return { dice: [], labels: [], glow: [], animating, notice: noticeText, finale: null };
  const dice = [];
  for (let i = 0; i < 16; i++) {
    const mesh = diceMeshes[i];
    const pos = mesh.position;
    const pr = projectToCanvas(pos);
    const pose = posesById[i];
    const owner = Math.floor(i / 4);
    let visibleValues = [];
    if (pose) {
      // compute visible faces: world normal dot (eye - centre) > 0
      const yaw = YAW[seat];
      const eye = [
        yaw[0][0] * CAMERA.eye[0] + yaw[0][1] * CAMERA.eye[1] + yaw[0][2] * CAMERA.eye[2],
        yaw[1][0] * CAMERA.eye[0] + yaw[1][1] * CAMERA.eye[1] + yaw[1][2] * CAMERA.eye[2],
        yaw[2][0] * CAMERA.eye[0] + yaw[2][1] * CAMERA.eye[1] + yaw[2][2] * CAMERA.eye[2],
      ];
      const dx = eye[0] - pos.x;
      const dy = eye[1] - pos.y;
      const dz = eye[2] - pos.z;
      const matrix = pose.matrix;
      const faceNormals = [
        [matrix[0][0], matrix[1][0], matrix[2][0]],
        [-matrix[0][0], -matrix[1][0], -matrix[2][0]],
        [matrix[0][1], matrix[1][1], matrix[2][1]],
        [-matrix[0][1], -matrix[1][1], -matrix[2][1]],
        [matrix[0][2], matrix[1][2], matrix[2][2]],
        [-matrix[0][2], -matrix[1][2], -matrix[2][2]],
      ];
      const faceFACES = ["+x", "-x", "+y", "-y", "+z", "-z"];
      const perm = diceFacesPerm(owner);
      for (let f = 0; f < 6; f++) {
        const n = faceNormals[f];
        const dot = n[0] * dx + n[1] * dy + n[2] * dz;
        if (dot > 0) {
          const val = perm[FACES[faceFACES[f]] - 1];
          visibleValues.push(val);
        }
      }
      visibleValues.sort((a, b) => a - b);
    }
    dice.push({ id: i, x: pr ? pr.x : 0, y: pr ? pr.y : 0, visibleFaces: visibleValues });
  }
  const labels = [];
  for (let o = 0; o < 4; o++) {
    const m = labelMeshes[o];
    const pr = projectToCanvas(m.position);
    labels.push({ owner: o, x: pr ? pr.x : 0, y: pr ? pr.y : 0 });
  }
  const glowIds = [];
  for (let i = 0; i < 16; i++) {
    if (glowMeshes[i].visible) glowIds.push(i);
  }
  let finale = null;
  if (finaleState && finaleState.started) {
    finale = { t: performance.now() - finaleState.tracksEnd };
  }
  return { dice, labels, glow: glowIds, animating, notice: noticeText, finale };
}

function diceFacesPerm(owner) {
  let seed = 0;
  try {
    const meta = document.querySelector('meta[name="dice-seed"]');
    const c = meta?.content;
    seed = Number(c);
    if (!Number.isInteger(seed)) seed = 0;
  } catch {
    seed = 0;
  }
  const perms = dice.facesFor(seed);
  return perms[owner];
}

export { init, nextFrame, play, hold, notice, pick, describe };

// test helpers: expose the die mesh and its quaternion
export function _dieQuaternion(id) {
  return diceMeshes[id].quaternion;
}

export function _dieMesh(id) {
  return diceMeshes[id].children[0];
}

export function _diePosition(id) {
  const p = diceMeshes[id].position;
  return [p.x, p.y, p.z];
}

export function _dieVisible(id) {
  return diceMeshes[id].visible;
}

export function _labelScale(o) {
  const s = labelMeshes[o].scale;
  return [s.x, s.y, s.z];
}

export function _labelPosition(o) {
  const p = labelMeshes[o].position;
  return [p.x, p.y, p.z];
}

export function _sparklerAnchor() {
  return sparklerAnchor;
}

export function _sparklerParticleCount() {
  return sparklerParticles.length;
}
