import * as real from "../../edges/render/render_to_scene.mjs";
import { DIE, PLAYERS, YAW, CAMERA, GLOW, WIN, FOLLOW, FACE_PERMS } from "../../common/index.mjs";
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
  if (!("dice" in r) || !("labels" in r) || !("glow" in r) || !("animating" in r) || !("notice" in r) || !("finale" in r))
    throw new Error("describe: missing fields");
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
}

export const _sheo_browser = true;
