import assert from "node:assert/strict";
import * as real from "../../edges/input/input_to_intent.mjs";
import { Action, Game, Player, Queue, Group, Die } from "../../common/index.mjs";

// ---- fixture builders ----

function makeDie(id) { return Die({ id, o: 0 }); }
function makeGroup(diceIds) { return Group({ dice: diceIds.map(makeDie) }); }
function makeQueue(groups) { return Queue({ groups: groups.map(makeGroup) }); }
function makePlayer(seat, queue) { return Player({ seat, queue }); }

// Fixture 1: seat 0's rightmost group is [3], turn: 0, version: 3.
function fixtureGame1() {
  const p0 = makePlayer(0, makeQueue([[0, 1, 2], [3]]));
  const p1 = makePlayer(1, makeQueue([[4, 5, 6, 7]]));
  const p2 = makePlayer(2, makeQueue([[8, 9, 10, 11]]));
  const p3 = makePlayer(3, makeQueue([[12, 13, 14, 15]]));
  return Game({ players: [p0, p1, p2, p3], turn: 0, version: 3, rng: 0, last: null, winner: null });
}

// Fixture 2: seat 0's queue [[3], [0, 1]], rightmost group [0, 1] (two dice).
function fixtureGame2() {
  const p0 = makePlayer(0, makeQueue([[3], [0, 1]]));
  const p1 = makePlayer(1, makeQueue([[2, 4, 5, 6, 7]]));
  const p2 = makePlayer(2, makeQueue([[8, 9, 10, 11]]));
  const p3 = makePlayer(3, makeQueue([[12, 13, 14, 15]]));
  return Game({ players: [p0, p1, p2, p3], turn: 0, version: 3, rng: 0, last: null, winner: null });
}

function dragAt(dx, dy) { return { at: { x: 100, y: 100 }, to: { x: 100 + dx, y: 100 + dy } }; }

// ---- wrapped functions ----

export function preview(drag, hit, game, seat) {
  // A) validate args, throw Error naming the function if wrong.
  if (drag === null || typeof drag !== "object" || Array.isArray(drag) || !drag.at || !drag.to ||
      typeof drag.at.x !== "number" || typeof drag.at.y !== "number" || typeof drag.to.x !== "number" || typeof drag.to.y !== "number") {
    throw new Error("preview: invalid drag argument");
  }
  if (hit !== null && !(hit && typeof hit === "object" && hit.kind === "die" && Number.isInteger(hit.id))) {
    throw new Error("preview: invalid hit argument");
  }
  if (game !== null && !(game && typeof game === "object" && game.kind === "game")) {
    throw new Error("preview: invalid game argument");
  }
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) {
    throw new Error("preview: invalid seat argument");
  }
  // B) call real.
  const res = real.preview(drag, hit, game, seat);
  // C) check that it returned.
  if (res === undefined) throw new Error("preview: real call did not return");
  // D) check return shape.
  if (res === null) return null;
  if (!(res && typeof res === "object" && Array.isArray(res.ids) &&
        (res.axis === "x" || res.axis === "y" || res.axis === "z") &&
        (res.dir === 1 || res.dir === -1))) {
    throw new Error("preview: invalid return shape");
  }
  for (const id of res.ids) { if (!Number.isInteger(id)) throw new Error("preview: ids must be integers"); }
  return res;
}

export function toAction(gesture, hit, game, seat) {
  // A) validate args.
  if (gesture === null || typeof gesture !== "object" || Array.isArray(gesture) || typeof gesture.kind !== "string") {
    throw new Error("toAction: invalid gesture argument");
  }
  if (gesture.kind === "drag") {
    if (!gesture.at || !gesture.to || typeof gesture.at.x !== "number" || typeof gesture.at.y !== "number" ||
        typeof gesture.to.x !== "number" || typeof gesture.to.y !== "number") {
      throw new Error("toAction: invalid drag gesture");
    }
  }
  if (hit !== null && !(hit && typeof hit === "object" && hit.kind === "die" && Number.isInteger(hit.id))) {
    throw new Error("toAction: invalid hit argument");
  }
  if (game !== null && !(game && typeof game === "object" && game.kind === "game")) {
    throw new Error("toAction: invalid game argument");
  }
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) {
    throw new Error("toAction: invalid seat argument");
  }
  // B) call real.
  const res = real.toAction(gesture, hit, game, seat);
  // C) check that it returned.
  if (res === undefined) throw new Error("toAction: real call did not return");
  // D) check return shape.
  if (res === null) return null;
  if (!(res && typeof res === "object" && res.kind === "action")) {
    throw new Error("toAction: invalid return shape");
  }
  if (typeof res.id !== "string" || res.id.length === 0) throw new Error("toAction: invalid action id");
  if (!Number.isInteger(res.seat) || res.seat < 0 || res.seat > 3) throw new Error("toAction: invalid action seat");
  if (res.move !== "turn" && res.move !== "roll") throw new Error("toAction: invalid action move");
  if (res.move === "turn") {
    if (res.axis !== "x" && res.axis !== "y" && res.axis !== "z") throw new Error("toAction: invalid action axis");
    if (res.dir !== 1 && res.dir !== -1) throw new Error("toAction: invalid action dir");
  } else {
    if (res.axis !== null) throw new Error("toAction: roll action axis must be null");
    if (res.dir !== null) throw new Error("toAction: roll action dir must be null");
  }
  if (!Number.isInteger(res.version)) throw new Error("toAction: invalid action version");
  return res;
}

// ---- _sheo_check ----

export async function _sheo_check() {
  const game = fixtureGame1();
  const hit = { kind: "die", id: 3 };

  // preview golden cases.
  assert.deepStrictEqual(preview(dragAt(40, 0), hit, game, 0), { ids: [3], axis: "y", dir: 1 });
  assert.deepStrictEqual(preview(dragAt(30, -30), hit, game, 0), { ids: [3], axis: "x", dir: -1 });
  assert.deepStrictEqual(preview(dragAt(-10, -40), hit, game, 0), { ids: [3], axis: "z", dir: 1 });
  assert.deepStrictEqual(preview(dragAt(-40, 5), hit, game, 0), { ids: [3], axis: "y", dir: -1 });
  assert.deepStrictEqual(preview(dragAt(-30, 30), hit, game, 0), { ids: [3], axis: "x", dir: 1 });
  assert.deepStrictEqual(preview(dragAt(30, 30), hit, game, 0), { ids: [3], axis: "z", dir: -1 });
  assert.deepStrictEqual(preview(dragAt(0, -40), hit, game, 0), { ids: [3], axis: "z", dir: 1 });
  assert.deepStrictEqual(preview(dragAt(0, 40), hit, game, 0), { ids: [3], axis: "z", dir: -1 });

  // edge cases: under DRAG_MIN.
  assert.strictEqual(preview(dragAt(5, -5), hit, game, 0), null);

  // drag on die 0 (not in the rightmost group) → null.
  assert.strictEqual(preview(dragAt(40, 0), { kind: "die", id: 0 }, game, 0), null);

  // hit null → null.
  assert.strictEqual(preview(dragAt(40, 0), null, game, 0), null);

  // seat 1 → null (game.turn is 0).
  assert.strictEqual(preview(dragAt(40, 0), hit, game, 1), null);

  // winner: 2 → null.
  const gameWinner = game.with({ winner: 2 });
  assert.strictEqual(preview(dragAt(40, 0), hit, gameWinner, 0), null);

  // game null → null.
  assert.strictEqual(preview(dragAt(40, 0), hit, null, 0), null);

  // game.turn !== seat: make a game with turn: 1.
  const gameTurn1 = game.with({ turn: 1 });
  assert.strictEqual(preview(dragAt(40, 0), hit, gameTurn1, 0), null);

  // fixture 2: group [0, 1], two dice.
  const game2 = fixtureGame2();
  const hit1 = { kind: "die", id: 1 };
  const hit0 = { kind: "die", id: 0 };
  assert.deepStrictEqual(preview(dragAt(-30, 30), hit1, game2, 0), { ids: [0, 1], axis: "x", dir: 1 });
  // (40, 0) on die 0 → null (a group turns only about x; (40,0) gives axis y).
  assert.strictEqual(preview(dragAt(40, 0), hit0, game2, 0), null);

  // toAction golden cases.
  const dragGesture = { kind: "drag", at: { x: 100, y: 100 }, to: { x: 130, y: 70 } };
  assert.deepStrictEqual(toAction(dragGesture, hit, game, 0),
    Action({ id: "0:3", seat: 0, move: "turn", axis: "x", dir: -1, version: 3 }));
  assert.deepStrictEqual(toAction({ kind: "roll" }, null, game, 0),
    Action({ id: "0:3", seat: 0, move: "roll", axis: null, dir: null, version: 3 }));
  assert.strictEqual(toAction({ kind: "press" }, hit, game, 0), null);

  // toAction edge cases: game null, winner, turn mismatch.
  assert.strictEqual(toAction({ kind: "roll" }, null, null, 0), null);
  assert.strictEqual(toAction(dragGesture, hit, gameWinner, 0), null);
  assert.strictEqual(toAction({ kind: "roll" }, null, gameTurn1, 0), null);

  // argument validation: preview throws Error naming "preview".
  assert.throws(() => preview(null, hit, game, 0), /preview:/);
  assert.throws(() => preview(dragAt(40, 0), { kind: "die" }, game, 0), /preview:/);
  assert.throws(() => preview(dragAt(40, 0), hit, {}, 0), /preview:/);
  assert.throws(() => preview(dragAt(40, 0), hit, game, 4), /preview:/);

  // argument validation: toAction throws Error naming "toAction".
  assert.throws(() => toAction(null, hit, game, 0), /toAction:/);
  assert.throws(() => toAction({ kind: "drag" }, hit, game, 0), /toAction:/);
  assert.throws(() => toAction({ kind: "drag", at: { x: 100, y: 100 }, to: { x: 140, y: 100 } }, hit, {}, 0), /toAction:/);
  assert.throws(() => toAction({ kind: "roll" }, hit, game, 4), /toAction:/);
}
