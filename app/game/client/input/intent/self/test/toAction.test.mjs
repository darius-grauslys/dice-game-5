import { test } from "node:test";
import assert from "node:assert/strict";
import { Die, Group, Queue, Player, Game, Action } from "../../../../../../../common/index.mjs";
import { preview, toAction } from "../index.mjs";

function die(id, o = 0) {
  return Die({ id, o });
}

// Layout's fixture game: seat 0's rightmost group is [3], turn: 0, version: 3.
function makeFixtureGame(patch = {}) {
  const players = [];
  // seat 0: queue [[0,1,2], [3]], rightmost group [3]
  players.push(Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0), die(1), die(2)] }), Group({ dice: [die(3)] })] }) }));
  // seats 1, 2, 3: normal queues
  for (let seat = 1; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
    players.push(Player({ seat, queue: Queue({ groups: [Group({ dice })] }) }));
  }
  return Game({
    players,
    turn: 0,
    version: 3,
    rng: 1,
    last: null,
    winner: null,
    ...patch,
  });
}

// Same game with seat 0's queue [[2,3], [0,1]] (rightmost group [0,1], two dice).
function makeTwoDiceGame(patch = {}) {
  const players = [];
  // seat 0: queue [[2,3], [0,1]], rightmost group [0,1]
  players.push(Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(2), die(3)] }), Group({ dice: [die(0), die(1)] })] }) }));
  for (let seat = 1; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
    players.push(Player({ seat, queue: Queue({ groups: [Group({ dice })] }) }));
  }
  return Game({
    players,
    turn: 0,
    version: 3,
    rng: 1,
    last: null,
    winner: null,
    ...patch,
  });
}

const at = { x: 100, y: 100 };

// ---- preview: guards ----

test("preview: null if game is null", () => {
  assert.strictEqual(preview({ at, to: { x: 140, y: 100 } }, { kind: "die", id: 3 }, null, 0), null);
});

test("preview: null if game.winner !== null", () => {
  const game = makeFixtureGame({ winner: 2 });
  assert.strictEqual(preview({ at, to: { x: 140, y: 100 } }, { kind: "die", id: 3 }, game, 0), null);
});

test("preview: null if game.turn !== seat", () => {
  const game = makeFixtureGame({ turn: 1 });
  assert.strictEqual(preview({ at, to: { x: 140, y: 100 } }, { kind: "die", id: 3 }, game, 0), null);
});

test("preview: null if hit is null", () => {
  const game = makeFixtureGame();
  assert.strictEqual(preview({ at, to: { x: 140, y: 100 } }, null, game, 0), null);
});

test("preview: null if hit is not a die", () => {
  const game = makeFixtureGame();
  assert.strictEqual(preview({ at, to: { x: 140, y: 100 } }, { kind: "roll" }, game, 0), null);
});

test("preview: null if die not in rightmost group", () => {
  const game = makeFixtureGame();
  // die 0 is not in the rightmost group [3]
  assert.strictEqual(preview({ at, to: { x: 140, y: 100 } }, { kind: "die", id: 0 }, game, 0), null);
});

test("preview: null below DRAG_MIN", () => {
  const game = makeFixtureGame();
  assert.strictEqual(preview({ at, to: { x: 105, y: 95 } }, { kind: "die", id: 3 }, game, 0), null);
});

// ---- preview: golden values ----

test("preview: (40,0) -> {ids:[3], axis:y, dir:1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 140, y: 100 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "y", dir: 1 });
});
test("preview: (30,-30) -> {ids:[3], axis:x, dir:-1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 130, y: 70 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "x", dir: -1 });
});
test("preview: (-10,-40) -> {ids:[3], axis:z, dir:1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 90, y: 60 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "z", dir: 1 });
});
test("preview: (-40,5) -> {ids:[3], axis:y, dir:-1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 60, y: 105 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "y", dir: -1 });
});
test("preview: (-30,30) -> {ids:[3], axis:x, dir:1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 70, y: 130 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "x", dir: 1 });
});
test("preview: (30,30) -> {ids:[3], axis:z, dir:-1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 130, y: 130 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "z", dir: -1 });
});
test("preview: (0,-40) -> {ids:[3], axis:z, dir:1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 100, y: 60 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "z", dir: 1 });
});
test("preview: (0,40) -> {ids:[3], axis:z, dir:-1}", () => {
  const game = makeFixtureGame();
  assert.deepStrictEqual(preview({ at, to: { x: 100, y: 140 } }, { kind: "die", id: 3 }, game, 0), { ids: [3], axis: "z", dir: -1 });
});

// ---- preview: two-dice group ----

test("preview: two-dice group (-30,30) on die 1 -> {ids:[0,1], axis:x, dir:1}", () => {
  const game = makeTwoDiceGame();
  assert.deepStrictEqual(preview({ at, to: { x: 70, y: 130 } }, { kind: "die", id: 1 }, game, 0), { ids: [0, 1], axis: "x", dir: 1 });
});
test("preview: two-dice group (40,0) on die 0 -> null (group turns only about x)", () => {
  const game = makeTwoDiceGame();
  assert.strictEqual(preview({ at, to: { x: 140, y: 100 } }, { kind: "die", id: 0 }, game, 0), null);
});

// ---- toAction: roll ----

test("toAction: roll gesture -> roll action", () => {
  const game = makeFixtureGame();
  const a = toAction({ kind: "roll" }, null, game, 0);
  const expected = Action({ id: "0:3", seat: 0, move: "roll", axis: null, dir: null, version: 3 });
  assert.deepStrictEqual(a, expected);
});

test("toAction: roll ignores hit", () => {
  const game = makeFixtureGame();
  const a = toAction({ kind: "roll" }, { kind: "die", id: 3 }, game, 0);
  const expected = Action({ id: "0:3", seat: 0, move: "roll", axis: null, dir: null, version: 3 });
  assert.deepStrictEqual(a, expected);
});

// ---- toAction: drag ----

test("toAction: drag (30,-30) -> turn action", () => {
  const game = makeFixtureGame();
  const a = toAction({ kind: "drag", at, to: { x: 130, y: 70 } }, { kind: "die", id: 3 }, game, 0);
  const expected = Action({ id: "0:3", seat: 0, move: "turn", axis: "x", dir: -1, version: 3 });
  assert.deepStrictEqual(a, expected);
});

test("toAction: drag preview null -> null", () => {
  const game = makeFixtureGame();
  // below DRAG_MIN
  assert.strictEqual(toAction({ kind: "drag", at, to: { x: 105, y: 95 } }, { kind: "die", id: 3 }, game, 0), null);
});

// ---- toAction: guards / other gestures ----

test("toAction: null if game is null", () => {
  assert.strictEqual(toAction({ kind: "roll" }, null, null, 0), null);
});
test("toAction: null if game.winner !== null", () => {
  const game = makeFixtureGame({ winner: 2 });
  assert.strictEqual(toAction({ kind: "roll" }, null, game, 0), null);
});
test("toAction: null if game.turn !== seat", () => {
  const game = makeFixtureGame({ turn: 1 });
  assert.strictEqual(toAction({ kind: "roll" }, null, game, 0), null);
});
test("toAction: press -> null", () => {
  const game = makeFixtureGame();
  assert.strictEqual(toAction({ kind: "press", at }, null, game, 0), null);
});
test("toAction: seat 1 -> null", () => {
  const game = makeFixtureGame();
  assert.strictEqual(toAction({ kind: "drag", at, to: { x: 140, y: 100 } }, { kind: "die", id: 3 }, game, 1), null);
});
