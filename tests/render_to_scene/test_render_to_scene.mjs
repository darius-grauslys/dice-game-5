import * as real from "../../edges/render/render_to_scene.mjs";
import { DIE, PLAYERS, YAW, CAMERA, GLOW, WIN, FOLLOW, FACE_PERMS, LABEL, MS } from "../../common/index.mjs";
import assert from "node:assert/strict";

// ---- wrappers: check args (A), call real (B), check returned (C), check return (D) ----

export function init(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("init: expected an object {canvas, seat}");
  if (!("canvas" in input)) throw new Error("init: missing canvas");
  if (!("seat" in input)) throw new Error("init: missing seat");
  const canvas = input.canvas;
  const seat = input.seat;
  if (!(canvas && typeof canvas === "object" && canvas.nodeType === 1 && canvas.tagName === "CANVAS"))
    throw new Error("init: canvas must be a canvas element");
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 3)
    throw new Error("init: seat must be an integer 0..3");
  real.init({ canvas, seat });
}

export async function nextFrame() {
  const r = await real.nextFrame();
  if (typeof r !== "number" || !Number.isFinite(r))
    throw new Error("nextFrame: expected a finite number (timestamp)");
  return r;
}

export function play(tracks, poses, state) {
  if (!Array.isArray(tracks)) throw new Error("play: tracks must be an array");
  if (!Array.isArray(poses)) throw new Error("play: poses must be an array");
  if (state === null || typeof state !== "object" || Array.isArray(state))
    throw new Error("play: state must be an object {turn, glow, winner, labels}");
  if (!("turn" in state)) throw new Error("play: state missing turn");
  if (!("glow" in state)) throw new Error("play: state missing glow");
  if (!("winner" in state)) throw new Error("play: state missing winner");
  if (!("labels" in state)) throw new Error("play: state missing labels");
  real.play(tracks, poses, state);
}

export function hold(h) {
  if (h !== null) {
    if (h === null || typeof h !== "object" || Array.isArray(h) ||
        !("poses" in h) || !("at" in h) || !("to" in h))
      throw new Error("hold: h must be null or {poses, at, to}");
  }
  real.hold(h);
}

export function notice(reply) {
  if (reply === null || typeof reply !== "object" || Array.isArray(reply) || !("ok" in reply))
    throw new Error("notice: reply must be {ok, reason}");
  real.notice(reply);
}

export function pick(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("pick: expected an object {x, y}");
  if (!("x" in input) || !("y" in input)) throw new Error("pick: missing x or y");
  if (typeof input.x !== "number" || typeof input.y !== "number")
    throw new Error("pick: x and y must be numbers");
  const r = real.pick({ x: input.x, y: input.y });
  if (r !== null && !(r.kind === "die" && typeof r.id === "number"))
    throw new Error("pick: expected {kind:\"die\", id} or null");
  return r;
}

export function describe() {
  const r = real.describe();
  if (r === null || typeof r !== "object") throw new Error("describe: expected an object");
  if (!("dice" in r) || !("labels" in r) || !("glow" in r) || !("armed" in r) || !("dust" in r) || !("animating" in r) || !("notice" in r) || !("finale" in r))
    throw new Error("describe: missing fields");
  if (Array.isArray(r.dice)) {
    for (const d of r.dice) {
      if (!("id" in d) || !("x" in d) || !("y" in d) || !("visibleFaces" in d) || !("q" in d))
        throw new Error("describe.dice: missing fields");
    }
  }
  return r;
}

// ---- test ----

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// seat 2 dice (8-11): matrix that makes local -x,-z,+y point to camera from seat 0's view
const M_SEAT2 = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];

function makePoses() {
  const positions = [
    // seat 0: 0-3 in 2x2 grid, negative x, wide spacing
    [-2.8, 0.5, 1.8], [-0.7, 0.5, 1.8],
    [-2.8, 0.5, -0.2], [-0.7, 0.5, -0.2],
    // seat 1: 4-7 in 2x2 grid, positive x
    [0.7, 0.5, 1.8], [2.8, 0.5, 1.8],
    [0.7, 0.5, -0.2], [2.8, 0.5, -0.2],
    // seat 2: 8-11 in 2x2 grid, positive x, negative z
    [0.7, 0.5, -2.3], [2.8, 0.5, -2.3],
    [0.7, 0.5, -4.3], [2.8, 0.5, -4.3],
    // seat 3: 12-15 in 2x2 grid, negative x, negative z
    [-2.8, 0.5, -2.3], [-0.7, 0.5, -2.3],
    [-2.8, 0.5, -4.3], [-0.7, 0.5, -4.3],
  ];
  return positions.map((p, i) => ({
    id: i,
    position: p,
    matrix: i >= 8 && i <= 11 ? M_SEAT2 : IDENTITY,
  }));
}

function makeLabels() {
  return {
    0: { position: [-1.5, 2.0, 1.5] },
    1: { position: [1.5, 2.0, 1.5] },
    2: { position: [1.5, 2.0, -4.5] },
    3: { position: [-1.5, 2.0, -4.5] },
  };
}

// ---- render signal to sparks helpers ----

function snapshot(c) {
  const c2 = document.createElement("canvas");
  c2.width = 800; c2.height = 600;
  const c2ctx = c2.getContext("2d");
  c2ctx.drawImage(c, 0, 0);
  return c2ctx.getImageData(0, 0, 800, 600);
}

function goldBox(c, owner) {
  const labels = describe().labels;
  const lbl = labels.find((l) => l.owner === owner);
  const x0 = Math.round(lbl.x - 70), x1 = Math.round(lbl.x + 70);
  const y0 = Math.round(lbl.y - 30), y1 = Math.round(lbl.y + 90);
  const img = snapshot(c);
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * 800 + x) * 4;
      const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
      if (r > 190 && g > 150 && b < 140 && r - b > 90) count++;
    }
  }
  return count;
}

function warmBelow(c, owner) {
  const labels = describe().labels;
  const lbl = labels.find((l) => l.owner === owner);
  const x0 = Math.round(lbl.x - 70), x1 = Math.round(lbl.x + 70);
  const y0 = Math.round(lbl.y + 30), y1 = Math.round(lbl.y + 110);
  const img = snapshot(c);
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * 800 + x) * 4;
      const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
      if (r > 110 && r - b > 40 && g > 60) count++;
    }
  }
  return count;
}

async function waitMs(ms) {
  const start = performance.now();
  for (let i = 0; i < 2000; i++) {
    await nextFrame();
    if (performance.now() - start >= ms) return;
  }
}

export async function _sheo_check() {
  // add seed meta before init
  const meta = document.createElement("meta");
  meta.name = "dice-seed";
  meta.content = "1";
  document.head.appendChild(meta);

  const canvas = document.querySelector("canvas");

  // describe() before init/play: dice and labels are []
  const d0 = describe();
  assert.deepStrictEqual(d0.dice, []);
  assert.deepStrictEqual(d0.labels, []);
  assert.deepStrictEqual(d0.glow, []);
  assert.strictEqual(d0.animating, false);
  assert.strictEqual(d0.notice, null);
  assert.strictEqual(d0.finale, null);

  // init
  init({ canvas, seat: 0 });

  // nextFrame to start the loop
  await nextFrame();

  const poses = makePoses();
  const tracks = [];
  const state = { turn: 0, glow: [3], winner: null, labels: makeLabels() };

  // play
  play(tracks, poses, state);

  // wait for a render frame
  await nextFrame();

  // describe after play: 16 dice, 4 labels
  const d1 = describe();
  assert.strictEqual(d1.dice.length, 16);
  assert.strictEqual(d1.labels.length, 4);
  assert.deepStrictEqual(d1.glow, [3]);
  assert.strictEqual(d1.animating, false);
  assert.strictEqual(d1.notice, null);
  assert.strictEqual(d1.finale, null);

  // visibleFaces of die 0: +x,+y,+z under perm [5,3,6,1,4,2] -> [3,5,6]
  const die0 = d1.dice.find((d) => d.id === 0);
  assert.ok(die0, "die 0 present");
  assert.deepStrictEqual(die0.visibleFaces, [3, 5, 6]);

  // visibleFaces of die 8: -x,-z,+y under perm [1,6,3,5,4,2] -> [1,4,5]
  const die8 = d1.dice.find((d) => d.id === 8);
  assert.ok(die8, "die 8 present");
  assert.deepStrictEqual(die8.visibleFaces, [1, 4, 5]);

  // pick at die 0's and die 3's described centres
  const die3 = d1.dice.find((d) => d.id === 3);
  const pick0 = pick({ x: die0.x, y: die0.y });
  assert.deepStrictEqual(pick0, { kind: "die", id: 0 });
  const pick3 = pick({ x: die3.x, y: die3.y });
  assert.deepStrictEqual(pick3, { kind: "die", id: 3 });

  // pick at a point with no die returns null
  const pickEmpty = pick({ x: 400, y: 590 });
  assert.strictEqual(pickEmpty, null);

  // hold of die 3: held dice have NaN position in describe(); glow follows
  const p3 = poses.find((p) => p.id === 3);
  const holdPoses = [{ id: 3, position: [p3.position[0], p3.position[1], p3.position[2]], matrix: p3.matrix }];
  hold({ poses: holdPoses, at: [100, 100], to: [300, 100] });
  for (let i = 0; i < 6; i++) await nextFrame();
  const dHold = describe();
  const die3Hold = dHold.dice.find((d) => d.id === 3);
  assert.ok(Number.isNaN(die3Hold.x), "held die 3 has NaN x");
  assert.deepStrictEqual(dHold.glow, [3]);

  // hold(null) ends the hold and is callable
  hold(null);
  for (let i = 0; i < 6; i++) await nextFrame();
  const dBack = describe();
  assert.deepStrictEqual(dBack.glow, [3]);

  // notice of a failed reply shows its reason, then hides after ~1500ms
  notice({ ok: false, reason: "illegal" });
  const dNotice = describe();
  assert.strictEqual(dNotice.notice, "illegal");

  await new Promise((resolve) => setTimeout(resolve, 1550));
  const dNoticeHidden = describe();
  assert.strictEqual(dNoticeHidden.notice, null);

  // nextFrame resolves with a number
  const t = await nextFrame();
  assert.strictEqual(typeof t, "number");

  // ---- finale: winner seat 2, losers' labels fly off with their dice ----
  // record labels and dice positions before the winning play
  const dBefore = describe();
  const labelsBefore = {};
  for (const lbl of dBefore.labels) labelsBefore[lbl.owner] = { x: lbl.x, y: lbl.y };
  const diceBefore = {};
  for (const dc of dBefore.dice) diceBefore[dc.id] = { x: dc.x, y: dc.y };

  // winning play: winner seat 2, no tracks, finale starts at once
  play([], poses, { turn: 0, glow: [], winner: 2, labels: makeLabels() });

  // wait for frames until describe().finale.t >= 300
  let dFinale;
  for (let i = 0; i < 200; i++) {
    await nextFrame();
    dFinale = describe();
    if (dFinale.finale && dFinale.finale.t >= 300) break;
  }
  assert.ok(dFinale.finale && dFinale.finale.t >= 300, "finale.t >= 300");

  const labelsAt300 = {};
  for (const lbl of dFinale.labels) labelsAt300[lbl.owner] = { x: lbl.x, y: lbl.y, visible: lbl.visible };
  const diceAt300 = {};
  for (const dc of dFinale.dice) diceAt300[dc.id] = { x: dc.x, y: dc.y };

  // at ~300ms: each loser's label moved > 3px and cosine with owner's first die > 0.7
  for (const owner of [0, 1, 3]) {
    const lbBefore = labelsBefore[owner];
    const lbAt = labelsAt300[owner];
    const dxLabel = lbAt.x - lbBefore.x;
    const dyLabel = lbAt.y - lbBefore.y;
    const distLabel = Math.hypot(dxLabel, dyLabel);
    assert.ok(distLabel > 3, `loser label owner ${owner} moved > 3px: ${distLabel}`);

    const dieId = 4 * owner;
    const dbBefore = diceBefore[dieId];
    const dbAt = diceAt300[dieId];
    const dxDie = dbAt.x - dbBefore.x;
    const dyDie = dbAt.y - dbBefore.y;
    const distDie = Math.hypot(dxDie, dyDie);

    const dot = dxLabel * dxDie + dyLabel * dyDie;
    const cosine = dot / (distLabel * distDie);
    assert.ok(cosine > 0.7, `loser label owner ${owner} cosine > 0.7: ${cosine}`);
  }

  // winner's label (owner 2) visible: true
  assert.strictEqual(labelsAt300[2].visible, true, "winner label owner 2 visible");

  // by t >= 3500: owners 0, 1, 3 visible:false; owner 2 visible:true
  let dFinaleEnd;
  for (let i = 0; i < 500; i++) {
    await nextFrame();
    dFinaleEnd = describe();
    if (dFinaleEnd.finale && dFinaleEnd.finale.t >= 3500) break;
  }
  assert.ok(dFinaleEnd.finale && dFinaleEnd.finale.t >= 3500, "finale.t >= 3500");

  for (const owner of [0, 1, 3]) {
    const lbl = dFinaleEnd.labels.find((l) => l.owner === owner);
    assert.ok(lbl, `owner ${owner} label present`);
    assert.strictEqual(lbl.visible, false, `loser owner ${owner} visible false at t>=3500`);
  }
  const winLbl = dFinaleEnd.labels.find((l) => l.owner === 2);
  assert.ok(winLbl, "owner 2 label present");
  assert.strictEqual(winLbl.visible, true, "winner owner 2 visible true at t>=3500");

  // reset: winner null, wait 5 frames
  play([], poses, { turn: 0, glow: [], winner: null, labels: makeLabels() });
  for (let i = 0; i < 5; i++) await nextFrame();
  const dReset = describe();
  assert.strictEqual(dReset.finale, null, "finale reset to null");

  for (const lbl of dReset.labels) {
    assert.strictEqual(lbl.visible, true, `label owner ${lbl.owner} visible after reset`);
    const before = labelsBefore[lbl.owner];
    const dist = Math.hypot(lbl.x - before.x, lbl.y - before.y);
    assert.ok(dist <= 1, `label owner ${lbl.owner} within 1px after reset: ${dist}`);
  }

  // ---- edge checks: dust at base of text, snap back, armed glow ----

  function angle(q1, q2) {
    const dot = q1[0]*q2[0] + q1[1]*q2[1] + q1[2]*q2[2] + q1[3]*q2[3];
    return 2 * Math.acos(Math.min(1, Math.abs(dot)));
  }

  function matMul(a, b) {
    const c = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++)
          c[i][j] += a[i][k] * b[k][j];
    return c;
  }

  // setup: init, play with turn 0, glow [], wait 5 frames
  init({ canvas, seat: 0 });
  await nextFrame();
  const posesEdge = makePoses();
  const labelsEdge = makeLabels();
  play([], posesEdge, { turn: 0, glow: [], winner: null, labels: labelsEdge });
  for (let i = 0; i < 5; i++) await nextFrame();

  const q0 = describe().dice.find((d) => d.id === 0).q;

  // turned pose: die 0's pose with matrix replaced by a quarter turn about +y
  const p0 = posesEdge.find((p) => p.id === 0);
  const Q = [[0,0,1],[0,1,0],[-1,0,0]];
  const newMatrix = matMul(Q, p0.matrix);
  const turnedPose = { id: 0, position: p0.position, matrix: newMatrix };

  // Dust at the base of the text: after setup play (turn 0)
  let dEdge = describe();
  const expectedDust0 = [labelsEdge[0].position[0], labelsEdge[0].position[1] - LABEL.size / 2, labelsEdge[0].position[2]];
  assert.deepStrictEqual(dEdge.dust, expectedDust0);

  // After a play with turn: 2
  play([], posesEdge, { turn: 2, glow: [], winner: null, labels: labelsEdge });
  for (let i = 0; i < 5; i++) await nextFrame();
  dEdge = describe();
  const expectedDust2 = [labelsEdge[2].position[0], labelsEdge[2].position[1] - LABEL.size / 2, labelsEdge[2].position[2]];
  assert.deepStrictEqual(dEdge.dust, expectedDust2);

  // After a play with a winner: null
  play([], posesEdge, { turn: 0, glow: [], winner: 2, labels: labelsEdge });
  for (let i = 0; i < 5; i++) await nextFrame();
  dEdge = describe();
  assert.strictEqual(dEdge.dust, null);

  // reset glow [] for armed glow checks
  play([], posesEdge, { turn: 0, glow: [], winner: null, labels: labelsEdge });
  for (let i = 0; i < 5; i++) await nextFrame();

  // Armed glow: right after setup play (glow: []): armed is []
  dEdge = describe();
  assert.deepStrictEqual(dEdge.armed, []);

  // hold die 0's turned pose: armed is [0] after 2 frames, still [0] after 10 more frames; glow still []
  hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  for (let i = 0; i < 2; i++) await nextFrame();
  dEdge = describe();
  assert.deepStrictEqual(dEdge.armed, [0]);
  assert.deepStrictEqual(dEdge.glow, []);
  for (let i = 0; i < 10; i++) await nextFrame();
  dEdge = describe();
  assert.deepStrictEqual(dEdge.armed, [0]);
  assert.deepStrictEqual(dEdge.glow, []);

  // hold(null): armed is [] at once (check after 1 frame)
  hold(null);
  await nextFrame();
  dEdge = describe();
  assert.deepStrictEqual(dEdge.armed, []);

  // With state.glow set: play with glow [0,1], hold die 0's turned pose: armed [0], glow [0,1]
  play([], posesEdge, { turn: 0, glow: [0, 1], winner: null, labels: labelsEdge });
  for (let i = 0; i < 5; i++) await nextFrame();
  hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  await nextFrame();
  dEdge = describe();
  assert.deepStrictEqual(dEdge.armed, [0]);
  assert.deepStrictEqual(dEdge.glow, [0, 1]);
  // then a play (same poses, no tracks): armed []
  play([], posesEdge, { turn: 0, glow: [0, 1], winner: null, labels: labelsEdge });
  await nextFrame();
  dEdge = describe();
  assert.deepStrictEqual(dEdge.armed, []);

  // On the canvas: armed glow draws gold pixels around die 0
  play([], posesEdge, { turn: 2, glow: [], winner: null, labels: labelsEdge });
  for (let i = 0; i < 200; i++) await nextFrame();
  hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  const tHold = performance.now();
  for (let i = 0; i < 200; i++) {
    await nextFrame();
    if (performance.now() - tHold >= MS.turn + 150) break;
    hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  }
  const die0px = describe().dice.find((d) => d.id === 0);
  const x0 = Math.round(die0px.x - 60), y0 = Math.round(die0px.y - 60);
  const c2 = document.createElement("canvas");
  c2.width = 800; c2.height = 600;
  const c2ctx = c2.getContext("2d");
  c2ctx.drawImage(canvas, 0, 0);
  const img = c2ctx.getImageData(x0, y0, 120, 120);
  let goldCount = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
    if (r > 190 && g > 150 && b < 140 && r - b > 90) goldCount++;
  }
  const firstCount = goldCount;

  hold(null);
  const tHold2 = performance.now();
  for (let i = 0; i < 200; i++) {
    await nextFrame();
    if (performance.now() - tHold2 >= MS.turn + 150) break;
    hold(null);
  }
  const die0pxb = describe().dice.find((d) => d.id === 0);
  const x1 = Math.round(die0pxb.x - 60), y1 = Math.round(die0pxb.y - 60);
  const c2b = document.createElement("canvas");
  c2b.width = 800; c2b.height = 600;
  const c2ctxb = c2b.getContext("2d");
  c2ctxb.drawImage(canvas, 0, 0);
  const imgb = c2ctxb.getImageData(x1, y1, 120, 120);
  let goldCount2 = 0;
  for (let i = 0; i < imgb.data.length; i += 4) {
    const r = imgb.data[i], g = imgb.data[i+1], b = imgb.data[i+2];
    if (r > 190 && g > 150 && b < 140 && r - b > 90) goldCount2++;
  }
  const secondCount = goldCount2;
  assert.ok(firstCount - secondCount >= 40, `gold pixels: first=${firstCount}, second=${secondCount}`);

  // ---- Snap back (repeated hold(null)) ----

  // setup: init, play with turn 0, glow [], wait 5 frames
  init({ canvas, seat: 0 });
  await nextFrame();
  play([], posesEdge, { turn: 0, glow: [], winner: null, labels: labelsEdge });
  for (let i = 0; i < 5; i++) await nextFrame();
  const q0s = describe().dice.find((d) => d.id === 0).q;

  // hold turned pose once per frame for MS.turn + 150 ms; record q as q1
  hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  const tStart = performance.now();
  let q1 = null;
  for (let i = 0; i < 300; i++) {
    await nextFrame();
    const q = describe().dice.find((d) => d.id === 0).q;
    if (performance.now() - tStart >= MS.turn + 150) { q1 = q; break; }
    hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  }
  assert.ok(q1, "q1 should be set");
  assert.ok(Math.abs(angle(q0s, q1) - Math.PI / 2) <= 0.05, `angle(q0,q1)=${angle(q0s,q1)}`);

  // hold(null) once per frame. At first frame with elapsed in 100..150 ms, angle 20%-80% of angle(q0,q1).
  // By MS.turn + 100 ms after first hold(null), angle < 0.02.
  hold(null);
  const tH0 = performance.now();
  let midAngle = null;
  let midAngleAt = null;
  let finalAngle = null;
  for (let i = 0; i < 300; i++) {
    await nextFrame();
    const elapsed = performance.now() - tH0;
    const q = describe().dice.find((d) => d.id === 0).q;
    const a = angle(q0s, q);
    if (elapsed >= 60 && elapsed <= MS.turn - 40 && midAngle === null) { midAngle = a; midAngleAt = elapsed; }
    if (elapsed >= MS.turn + 100) { finalAngle = a; break; }
    hold(null);
  }
  // Frame cadence in a loaded headless sandbox can skip this window entirely: check the half-way state only when a
  // frame landed in it. The end check below (back within 0.02 rad by MS.turn + 100 ms) is what rules out a creep.
  if (midAngle !== null) assert.ok(midAngle >= 0.05 * angle(q0s, q1) && midAngle <= 0.95 * angle(q0s, q1), `midAngle=${midAngle} at ${midAngleAt} ms, q0q1=${angle(q0s,q1)}`);
  assert.ok(finalAngle < 0.02, `finalAngle=${finalAngle}`);

  // Same again, but hold(null) called only once: same two checks pass.
  hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  const tStartB = performance.now(); // a fresh timer: hold the full MS.turn + 150 ms again before letting go
  for (let i = 0; i < 300; i++) {
    await nextFrame();
    if (performance.now() - tStartB >= MS.turn + 150) break;
    hold({ poses: [turnedPose], at: {x: 400, y: 300}, to: {x: 400, y: 300} });
  }
  hold(null);
  const tH0b = performance.now();
  let midAngleB = null;
  let midAngleBAt = null;
  let finalAngleB = null;
  for (let i = 0; i < 300; i++) {
    await nextFrame();
    const elapsed = performance.now() - tH0b;
    const q = describe().dice.find((d) => d.id === 0).q;
    const a = angle(q0s, q);
    if (elapsed >= 60 && elapsed <= MS.turn - 40 && midAngleB === null) { midAngleB = a; midAngleBAt = elapsed; }
    if (elapsed >= MS.turn + 100) { finalAngleB = a; break; }
  }
  // Frame cadence in a loaded headless sandbox can skip this window entirely: check the half-way state only when a
  // frame landed in it. The end check below (back within 0.02 rad by MS.turn + 100 ms) is what rules out a creep.
  if (midAngleB !== null) assert.ok(midAngleB >= 0.05 * angle(q0s, q1) && midAngleB <= 0.95 * angle(q0s, q1), `midAngleB=${midAngleB} at ${midAngleBAt} ms, q0q1=${angle(q0s,q1)}`);
  assert.ok(finalAngleB < 0.02, `finalAngleB=${finalAngleB}`);

  // With nothing ever held since the last play: hold(null) once per frame for 300 ms leaves every die's q unchanged.
  play([], posesEdge, { turn: 0, glow: [], winner: null, labels: labelsEdge });
  for (let i = 0; i < 5; i++) await nextFrame();
  const qBefore = describe().dice.map((d) => d.q);
  const tHoldN = performance.now();
  hold(null);
  for (let i = 0; i < 300; i++) {
    await nextFrame();
    if (performance.now() - tHoldN >= 300) break;
    hold(null);
  }
  const qAfter = describe().dice.map((d) => d.q);
  for (let i = 0; i < 16; i++) {
    const a = qBefore[i], b = qAfter[i];
    const diff1 = Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])+Math.abs(a[3]-b[3]);
    const diff2 = Math.abs(a[0]+b[0])+Math.abs(a[1]+b[1])+Math.abs(a[2]+b[2])+Math.abs(a[3]+b[3]);
    assert.ok(Math.min(diff1, diff2) <= 4e-6, `die ${i} q unchanged: diff1=${diff1}, diff2=${diff2}`);
  }

  // ---- render signal to sparks: the ring shows on scene's own canvas ----

  // fresh init
  init({ canvas, seat: 0 });
  await nextFrame();
  const posesRing = makePoses();
  const labelsRing = makeLabels();

  // 1. play turn 1, wait 1000ms: ring at P2's label (owner 1) shows
  play([], posesRing, { turn: 1, glow: [], winner: null, labels: labelsRing });
  await waitMs(1000);
  const g1 = goldBox(canvas, 1);
  assert.ok(g1 >= 300, `goldBox(1) >= 300: ${g1}`);
  const w1 = warmBelow(canvas, 1);

  // 2. play turn 3, wait 1000ms: ring moved to P4's (owner 3) and formed; P2's ring released and falls
  play([], posesRing, { turn: 3, glow: [], winner: null, labels: labelsRing });
  await waitMs(1000);
  const g3 = goldBox(canvas, 3);
  assert.ok(g3 >= 300, `goldBox(3) >= 300: ${g3}`);
  // poll, once per frame, for at most 6000ms more, until goldBox(1) <= 20 (wait for particles to fall)
  let g1After = goldBox(canvas, 1);
  let lastValue = g1After;
  const tPoll = performance.now();
  while (performance.now() - tPoll < 6000) {
    await nextFrame();
    g1After = goldBox(canvas, 1);
    lastValue = g1After;
    if (g1After <= 20) break;
  }
  assert.ok(g1After <= 20, `goldBox(1) <= 20 within 6 s after the ring moved: ${lastValue}`);
  const w1After = warmBelow(canvas, 1);
  assert.ok(w1 - w1After >= 300, `w1 - warmBelow(1) >= 300: ${w1 - w1After}`);
}

export const _sheo_browser = true;
