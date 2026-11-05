import assert from "node:assert/strict";
import * as real from "../../edges/client/client_to_render.mjs";
import { Die, Group, Queue, Player, Game, Last, Action, Reply } from "../../common/index.mjs";

export const _sheo_browser = true;

// ---- helpers to build realistic shapes ----

function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(Die({ id: seat * 4 + k, o: 0 }));
    players.push(Player({ seat, queue: Queue({ groups: [Group({ dice })] }) }));
  }
  return players;
}

function makeGame(patch = {}) {
  return Game({
    players: makePlayers(),
    turn: 0,
    version: 0,
    rng: 1,
    last: null,
    winner: null,
    ...patch,
  });
}

const turn = Action({ id: "t1", seat: 0, move: "turn", axis: "z", dir: 1, version: 3 });

function makeLast(patch = {}) {
  return Last({ action: turn, change: "turn", dice: [0], before: [0], ...patch });
}

// ---- wrapped functions ----

export function init(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("init: expected an object with {canvas, seat}");
  if (!("canvas" in input)) throw new Error("init: missing canvas");
  if (!("seat" in input)) throw new Error("init: missing seat");
  const seat = input.seat;
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 3)
    throw new Error("init: seat must be an integer 0..3");
  const r = real.init({ canvas: input.canvas, seat });
  if (r !== undefined) throw new Error("init: expected void");
  return r;
}

export function nextFrame() {
  const r = real.nextFrame();
  if (!(r instanceof Promise)) throw new Error("nextFrame: expected a Promise");
  return r;
}

export function show(prev, next) {
  if (prev !== null && !(prev && typeof prev === "object" && prev.kind === "game"))
    throw new Error("show: prev must be null or a Game");
  if (!(next && typeof next === "object" && next.kind === "game"))
    throw new Error("show: next must be a Game");
  const r = real.show(prev, next);
  if (r !== undefined) throw new Error("show: expected void");
  return r;
}

export function notice(reply) {
  if (!(reply && typeof reply === "object" && reply.kind === "reply"))
    throw new Error("notice: expected a Reply");
  const r = real.notice(reply);
  if (r !== undefined) throw new Error("notice: expected void");
  return r;
}

export function pick(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("pick: expected an object with {x, y}");
  if (typeof input.x !== "number" || typeof input.y !== "number")
    throw new Error("pick: x and y must be numbers");
  const r = real.pick({ x: input.x, y: input.y });
  if (r === null) return r;
  if (typeof r.kind === "string") {
    if (r.kind === "die") {
      if (typeof r.id !== "number") throw new Error("pick: die needs id (number)");
      if (!Array.isArray(r.normal)) throw new Error("pick: die needs normal (array)");
      return r;
    }
    if (r.kind === "roll") return r;
  }
  throw new Error("pick: unexpected return shape");
}

export function describe() {
  const r = real.describe();
  if (r === null || typeof r !== "object") throw new Error("describe: expected an object");
  if (!Array.isArray(r.dice)) throw new Error("describe: dice must be an array");
  for (const d of r.dice) {
    if (typeof d.id !== "number" || typeof d.x !== "number" || typeof d.y !== "number")
      throw new Error("describe: die needs id, x, y");
    if (!Array.isArray(d.visibleFaces)) throw new Error("describe: visibleFaces must be an array");
  }
  if (typeof r.roll !== "object" || typeof r.roll.x !== "number" || typeof r.roll.y !== "number")
    throw new Error("describe: roll needs x, y");
  if (typeof r.animating !== "boolean") throw new Error("describe: animating must be a boolean");
  if (!("notice" in r)) throw new Error("describe: missing notice");
  return r;
}

// ---- test ----

export async function _sheo_check() {
  // init: canvas element exists (browser), seat 0..3
  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "canvas element must exist");
  init({ canvas, seat: 0 });

  // nextFrame: returns a Promise<number>
  const n = await nextFrame();
  assert.strictEqual(typeof n, "number");

  // show: prev === null
  const g1 = makeGame();
  show(null, g1);

  // show: prev !== null, next.last is a Last
  const g2 = makeGame({ last: makeLast() });
  show(g1, g2);

  // notice: a Reply
  const reply = Reply({ to: "a1", seat: 0, ok: true, reason: null });
  notice(reply);

  // pick: {kind: "die", id, normal} | {kind: "roll"} | null
  const p = pick({ x: 400, y: 300 });
  assert.ok(
    p === null || (typeof p.kind === "string" && (p.kind === "die" || p.kind === "roll")),
    "pick returns die/roll/null",
  );
  if (p !== null) {
    if (p.kind === "die") {
      assert.strictEqual(typeof p.id, "number");
      assert.ok(Array.isArray(p.normal));
    }
  }

  // describe: {dice: [{id, x, y, visibleFaces}], roll: {x, y}, animating, notice}
  const d = describe();
  assert.ok(Array.isArray(d.dice));
  for (const die of d.dice) {
    assert.strictEqual(typeof die.id, "number");
    assert.strictEqual(typeof die.x, "number");
    assert.strictEqual(typeof die.y, "number");
    assert.ok(Array.isArray(die.visibleFaces));
  }
  assert.strictEqual(typeof d.roll.x, "number");
  assert.strictEqual(typeof d.roll.y, "number");
  assert.strictEqual(typeof d.animating, "boolean");
  assert.ok("notice" in d);
}
