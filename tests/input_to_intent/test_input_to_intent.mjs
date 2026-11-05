import assert from "node:assert/strict";
import * as real from "../../edges/input/input_to_intent.mjs";
import { Die, Group, Queue, Player, Action, Game } from "../../common/index.mjs";

// ---- argument validation helpers ----

function checkGesture(gesture) {
  if (!gesture || typeof gesture !== "object" || Array.isArray(gesture)) {
    throw new Error("toAction: gesture must be an object");
  }
  if (gesture.kind === "press") {
    if (!gesture.at || typeof gesture.at !== "object" || !("x" in gesture.at) || !("y" in gesture.at)) {
      throw new Error("toAction: press needs at:{x,y}");
    }
  } else if (gesture.kind === "drag") {
    if (!gesture.at || typeof gesture.at !== "object" || !("x" in gesture.at) || !("y" in gesture.at)) {
      throw new Error("toAction: drag needs at:{x,y}");
    }
    if (!gesture.to || typeof gesture.to !== "object" || !("x" in gesture.to) || !("y" in gesture.to)) {
      throw new Error("toAction: drag needs to:{x,y}");
    }
  } else {
    throw new Error("toAction: gesture.kind must be press or drag");
  }
}

function checkHit(hit) {
  if (hit === null) return;
  if (hit.kind === "roll") return;
  if (hit.kind === "die") {
    if (!("id" in hit) || !("normal" in hit)) {
      throw new Error("toAction: die hit needs id and normal");
    }
    return;
  }
  throw new Error("toAction: hit must be die, roll, or null");
}

function checkGame(game) {
  if (game === null) return;
  if (!game || game.kind !== "game") {
    throw new Error("toAction: game must be a game or null");
  }
}

function checkSeat(seat) {
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) {
    throw new Error("toAction: seat must be 0..3");
  }
}

function checkReturn(result, game, seat) {
  if (result === null) return;
  if (!result || result.kind !== "action") {
    throw new Error("toAction: result must be action or null");
  }
  if (!("id" in result) || !("seat" in result) || !("move" in result) || !("axis" in result) || !("dir" in result) || !("version" in result)) {
    throw new Error("toAction: action missing fields");
  }
  if (game !== null) {
    if (result.id !== `${seat}:${game.version}`) {
      throw new Error(`toAction: action id should be ${seat}:${game.version}, got ${result.id}`);
    }
    if (result.version !== game.version) {
      throw new Error(`toAction: action version should be ${game.version}, got ${result.version}`);
    }
    if (result.seat !== seat) {
      throw new Error(`toAction: action seat should be ${seat}, got ${result.seat}`);
    }
  }
}

// ---- wrapped surface functions ----

export function toAction(gesture, hit, game, seat) {
  checkGesture(gesture);
  checkHit(hit);
  checkGame(game);
  checkSeat(seat);
  const result = real.toAction(gesture, hit, game, seat);
  if (result === undefined) {
    throw new Error("toAction: did not return");
  }
  checkReturn(result, game, seat);
  return result;
}

// ---- fixture ----

function die(id, o = 0) {
  return Die({ id, o });
}

function makeFixtureGame() {
  const s0queue = Queue({ groups: [
    Group({ dice: [die(0), die(1), die(2)] }),
    Group({ dice: [die(3)] }),
  ]});
  const s1queue = Queue({ groups: [Group({ dice: [die(4), die(5), die(6), die(7)] })] });
  const s2queue = Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] });
  const s3queue = Queue({ groups: [Group({ dice: [die(12), die(13), die(14), die(15)] })] });

  return Game({
    players: [
      Player({ seat: 0, queue: s0queue }),
      Player({ seat: 1, queue: s1queue }),
      Player({ seat: 2, queue: s2queue }),
      Player({ seat: 3, queue: s3queue }),
    ],
    turn: 0,
    version: 3,
    rng: 1,
    last: null,
    winner: null,
  });
}

// ---- _sheo_check ----

export async function _sheo_check() {
  const g = makeFixtureGame();
  const dragGesture = { kind: "drag", at: { x: 100, y: 100 }, to: { x: 140, y: 105 } };
  const dragSmall = { kind: "drag", at: { x: 100, y: 100 }, to: { x: 105, y: 105 } };
  const pressGesture = { kind: "press", at: { x: 100, y: 100 } };

  // 1. drag on die 3, face "+z", from (100,100) to (140,105)
  let r = toAction(dragGesture, { kind: "die", id: 3, normal: "+z" }, g, 0);
  assert.deepStrictEqual(r, Action({ id: "0:3", seat: 0, move: "turn", axis: "y", dir: 1, version: 3 }));

  // 2. same on face "+y" from (100,100) to (98,60)
  r = toAction({ kind: "drag", at: { x: 100, y: 100 }, to: { x: 98, y: 60 } }, { kind: "die", id: 3, normal: "+y" }, g, 0);
  assert.deepStrictEqual(r, Action({ id: "0:3", seat: 0, move: "turn", axis: "x", dir: -1, version: 3 }));

  // 3. drag on die 0 (not in rightmost group) → null
  assert.strictEqual(toAction(dragGesture, { kind: "die", id: 0, normal: "+z" }, g, 0), null);

  // 4. drag of (5,5) → null (max(|dx|,|dy|) < DRAG_MIN)
  assert.strictEqual(toAction(dragSmall, { kind: "die", id: 3, normal: "+z" }, g, 0), null);

  // 5. drag on face "-x" → null (no entry in DRAG)
  assert.strictEqual(toAction(dragGesture, { kind: "die", id: 3, normal: "-x" }, g, 0), null);

  // 6. press with hit {kind: "roll"} → roll action
  r = toAction(pressGesture, { kind: "roll" }, g, 0);
  assert.deepStrictEqual(r, Action({ id: "0:3", seat: 0, move: "roll", axis: null, dir: null, version: 3 }));

  // 7. press on a die → null
  assert.strictEqual(toAction(pressGesture, { kind: "die", id: 3, normal: "+z" }, g, 0), null);

  // 8. seat 1 (not its turn) → null
  assert.strictEqual(toAction(dragGesture, { kind: "die", id: 3, normal: "+z" }, g, 1), null);

  // 9. game with winner: 2 → null
  const gWinner = g.with({ winner: 2 });
  assert.strictEqual(toAction(dragGesture, { kind: "die", id: 3, normal: "+z" }, gWinner, 0), null);

  // 10. game === null → null
  assert.strictEqual(toAction(dragGesture, { kind: "die", id: 3, normal: "+z" }, null, 0), null);

  // argument validation: wrong gesture kind
  assert.throws(() => toAction({ kind: "tap" }, { kind: "roll" }, g, 0), /toAction:/);
  // wrong hit kind
  assert.throws(() => toAction(pressGesture, { kind: "foo" }, g, 0), /toAction:/);
  // wrong seat
  assert.throws(() => toAction(pressGesture, { kind: "roll" }, g, 4), /toAction:/);
}
