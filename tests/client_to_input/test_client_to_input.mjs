import assert from "node:assert/strict";
import * as real from "../../edges/client/client_to_input.mjs";
import { Game, Player, Queue, Group, Die, Last } from "../../common/index.mjs";

// ---- wrapped functions ----

export function init(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input) || !("canvas" in input)) {
    throw new Error("init: expected {canvas}");
  }
  const r = real.init(input);
  if (r !== undefined) throw new Error("init: expected void, got " + String(r));
  return r;
}

export function drain() {
  const r = real.drain();
  if (!Array.isArray(r)) throw new Error("drain: expected array, got " + String(r));
  for (const g of r) {
    if (g.kind === "drag") {
      if (!(g.at && typeof g.at === "object") || !(g.to && typeof g.to === "object")) {
        throw new Error("drain: drag needs at and to");
      }
    } else if (g.kind === "press") {
      if (!(g.at && typeof g.at === "object")) {
        throw new Error("drain: press needs at");
      }
    } else {
      throw new Error("drain: unknown kind " + String(g.kind));
    }
  }
  return r;
}

function isValidGesture(g) {
  if (!g || typeof g !== "object") return false;
  if (g.kind === "drag") return g.at !== undefined && g.to !== undefined;
  if (g.kind === "press") return g.at !== undefined;
  return false;
}

export function toAction(gesture, hit, game, seat) {
  if (!isValidGesture(gesture)) throw new Error("toAction: invalid gesture");
  if (hit === null || typeof hit !== "object") throw new Error("toAction: invalid hit");
  if (!(game && game.kind === "game")) throw new Error("toAction: invalid game");
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("toAction: invalid seat");
  const r = real.toAction(gesture, hit, game, seat);
  if (r !== null && !(r && r.kind === "action")) throw new Error("toAction: expected Action or null, got " + String(r));
  return r;
}

// ---- helpers to build realistic inputs ----

function makeGame() {
  const dicePerPlayer = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ];
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = dicePerPlayer[seat].map((id) => Die({ id, o: 0 }));
    const group = Group({ dice });
    const queue = Queue({ groups: [group] });
    players.push(Player({ seat, queue }));
  }
  const last = Last({ action: null, change: "deal", dice: [0], before: [0] });
  return Game({ players, turn: 0, version: 0, rng: 0, last, winner: null });
}

// ---- the check ----

export async function _sheo_check() {
  // init: void return and argument checks
  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "canvas exists");
  init({ canvas });
  assert.throws(() => init(null), /^Error: init: expected \{canvas\}/);
  assert.throws(() => init({}), /^Error: init: expected \{canvas\}/);
  assert.throws(() => init("nope"), /^Error: init: expected \{canvas\}/);

  // drain: array of gestures
  const gestures = drain();
  assert.ok(Array.isArray(gestures), "drain returns array");
  for (const g of gestures) {
    assert.ok(g.kind === "drag" || g.kind === "press", "gesture kind");
    if (g.kind === "drag") { assert.ok(g.at && typeof g.at === "object", "drag at"); assert.ok(g.to && typeof g.to === "object", "drag to"); }
    if (g.kind === "press") { assert.ok(g.at && typeof g.at === "object", "press at"); }
  }

  // toAction: argument checks and Action|null return
  const game = makeGame();
  const gesture = { kind: "press", at: { x: 100, y: 100 } };
  const hit = { seat: 0, die: 0 };
  assert.throws(() => toAction(null, hit, game, 0), /^Error: toAction: invalid gesture/);
  assert.throws(() => toAction(gesture, null, game, 0), /^Error: toAction: invalid hit/);
  assert.throws(() => toAction(gesture, hit, {}, 0), /^Error: toAction: invalid game/);
  assert.throws(() => toAction(gesture, hit, game, 99), /^Error: toAction: invalid seat/);

  const r = toAction(gesture, hit, game, 0);
  assert.ok(r === null || (r && r.kind === "action"), "toAction returns Action or null");
}

export const _sheo_browser = true;
