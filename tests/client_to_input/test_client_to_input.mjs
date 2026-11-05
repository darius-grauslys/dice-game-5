import assert from "node:assert/strict";
import * as real from "../../edges/client/client_to_input.mjs";
import { Game, Player, Queue, Group, Die, Last } from "../../common/index.mjs";

// ---- wrapped functions ----

export function init(input) {
  // A) check args against the doc
  if (input === null || typeof input !== "object" || Array.isArray(input) || !("canvas" in input)) {
    throw new Error("init: expected {canvas}");
  }
  // B) call through the forwarder
  const r = real.init(input);
  // C) check it returned
  // D) check return against doc: void
  if (r !== undefined) throw new Error("init: expected void, got " + String(r));
  return r;
}

export function drain() {
  const r = real.drain();
  // C) check it returned
  // D) check return against doc: Array<{kind: "drag", at, to} | {kind: "press", at}>
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

export function dragging() {
  const r = real.dragging();
  // C) check it returned
  // D) check return against doc: {at, to} | null
  if (r !== null && !(r && typeof r === "object" && "at" in r && "to" in r)) {
    throw new Error("dragging: expected {at, to} or null");
  }
  return r;
}

export function preview(drag, hit, game, seat) {
  // A) check args against the doc
  if (!drag || typeof drag !== "object" || !("at" in drag) || !("to" in drag)) {
    throw new Error("preview: invalid drag");
  }
  if (hit === null || typeof hit !== "object") throw new Error("preview: invalid hit");
  if (!(game && game.kind === "game")) throw new Error("preview: invalid game");
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("preview: invalid seat");
  // B) call through the forwarder
  const r = real.preview(drag, hit, game, seat);
  // C) check it returned
  // D) check return against doc: {ids, axis, dir} | null
  if (r !== null && !(r && typeof r === "object" && "ids" in r && "axis" in r && "dir" in r)) {
    throw new Error("preview: expected {ids, axis, dir} or null");
  }
  if (r !== null) {
    if (!Array.isArray(r.ids)) throw new Error("preview: ids must be an array");
    if (!["x", "y", "z"].includes(r.axis)) throw new Error("preview: axis must be x, y or z");
    if (![1, -1].includes(r.dir)) throw new Error("preview: dir must be 1 or -1");
  }
  return r;
}

export function toAction(gesture, hit, game, seat) {
  // A) check args against the doc
  if (!gesture || typeof gesture !== "object") throw new Error("toAction: invalid gesture");
  if (gesture.kind === "drag") {
    if (!("at" in gesture) || !("to" in gesture)) throw new Error("toAction: drag needs at and to");
  } else if (gesture.kind === "press") {
    if (!("at" in gesture)) throw new Error("toAction: press needs at");
  } else {
    throw new Error("toAction: unknown gesture kind " + String(gesture.kind));
  }
  if (hit === null || typeof hit !== "object") throw new Error("toAction: invalid hit");
  if (!(game && game.kind === "game")) throw new Error("toAction: invalid game");
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("toAction: invalid seat");
  // B) call through the forwarder
  const r = real.toAction(gesture, hit, game, seat);
  // C) check it returned
  // D) check return against doc: Action | null
  if (r !== null && !(r && typeof r === "object" && r.kind === "action")) {
    throw new Error("toAction: expected Action or null, got " + String(r));
  }
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

function pointerEvent(type, x, y) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    x: x,
    y: y,
    pointerId: 1,
    pointerType: "mouse",
    pointerName: "mouse",
    buttons: type === "pointerdown" ? 1 : 0,
  });
}

// ---- the check ----

export async function _sheo_check() {
  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "canvas exists");

  // init: void return and argument checks
  init({ canvas });
  assert.throws(() => init(null), /^Error: init: expected \{canvas\}/);
  assert.throws(() => init({}), /^Error: init: expected \{canvas\}/);
  assert.throws(() => init("nope"), /^Error: init: expected \{canvas\}/);

  // drain: array of gestures
  const gestures = drain();
  assert.ok(Array.isArray(gestures), "drain returns array");
  for (const g of gestures) {
    assert.ok(g.kind === "drag" || g.kind === "press", "gesture kind");
    if (g.kind === "drag") {
      assert.ok(g.at && typeof g.at === "object", "drag at");
      assert.ok(g.to && typeof g.to === "object", "drag to");
    }
    if (g.kind === "press") {
      assert.ok(g.at && typeof g.at === "object", "press at");
    }
  }

  // dragging(): null before any pointer event
  assert.equal(dragging(), null, "dragging is null before pointer events");

  // pointerdown: {at, to} while one is down
  canvas.dispatchEvent(pointerEvent("pointerdown", 100, 100));
  const d1 = dragging();
  assert.ok(d1 && d1.at && d1.to, "dragging is {at, to} while down");

  // pointermove: {at, to} with updated to
  canvas.dispatchEvent(pointerEvent("pointermove", 150, 150));
  const d2 = dragging();
  assert.ok(d2 && d2.at && d2.to, "dragging is {at, to} while moving");

  // pointerup: null after pointerup
  canvas.dispatchEvent(pointerEvent("pointerup", 150, 150));
  assert.equal(dragging(), null, "dragging is null after pointerup");

  // preview and toAction golden cases
  const game = makeGame();
  const hit = { seat: 0, die: 0 };

  // preview: argument checks
  assert.throws(() => preview(null, hit, game, 0), /^Error: preview: invalid drag/);
  assert.throws(() => preview({ at: { x: 0, y: 0 } }, hit, game, 0), /^Error: preview: invalid drag/);
  assert.throws(() => preview({ at: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, null, game, 0), /^Error: preview: invalid hit/);
  assert.throws(() => preview({ at: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, hit, {}, 0), /^Error: preview: invalid game/);
  assert.throws(() => preview({ at: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, hit, game, 99), /^Error: preview: invalid seat/);

  // preview: no drag (at === to) → null (golden case: no drag means no intent)
  const noDrag = { at: { x: 100, y: 100 }, to: { x: 100, y: 100 } };
  const p1 = preview(noDrag, hit, game, 0);
  assert.equal(p1, null, "preview with no drag returns null");

  // preview: a real drag → {ids, axis, dir} or null (shape check)
  const drag = { at: { x: 100, y: 100 }, to: { x: 150, y: 150 } };
  const p2 = preview(drag, hit, game, 0);
  assert.ok(p2 === null || (p2 && Array.isArray(p2.ids) && ["x", "y", "z"].includes(p2.axis) && [1, -1].includes(p2.dir)), "preview returns {ids, axis, dir} or null");

  // toAction: argument checks
  const press = { kind: "press", at: { x: 100, y: 100 } };
  assert.throws(() => toAction(null, hit, game, 0), /^Error: toAction: invalid gesture/);
  assert.throws(() => toAction(press, null, game, 0), /^Error: toAction: invalid hit/);
  assert.throws(() => toAction(press, hit, {}, 0), /^Error: toAction: invalid game/);
  assert.throws(() => toAction(press, hit, game, 99), /^Error: toAction: invalid seat/);

  // toAction: press → null (golden case: a press causes no rotation action)
  const a1 = toAction(press, hit, game, 0);
  assert.equal(a1, null, "toAction with a press returns null");

  // toAction: drag → Action or null (shape check)
  const dragGesture = { kind: "drag", at: { x: 100, y: 100 }, to: { x: 150, y: 150 } };
  const a2 = toAction(dragGesture, hit, game, 0);
  assert.ok(a2 === null || (a2 && a2.kind === "action"), "toAction with a drag returns Action or null");
}

export const _sheo_browser = true;
