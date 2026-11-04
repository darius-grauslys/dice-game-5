import { test } from "node:test";
import assert from "node:assert/strict";
import { Die, Group, Queue, Player, Action, Game } from "../../../../../../common/index.mjs";
import { legal, after } from "../index.mjs";

// ---- helpers ----

function die(id, o = 0) {
  return Die({ id, o });
}

function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
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

function action(seat, move, version, axis = "x", dir = 1) {
  return Action({ id: `a${seat}`, seat, move, axis, dir, version });
}

// ---- legal ----

test("legal: ok when nothing blocks", () => {
  const game = makeGame();
  const act = action(0, "turn", 0);
  assert.deepStrictEqual(legal(game, act), { ok: true, reason: null });
});

test("legal: over when game.winner is set", () => {
  const game = makeGame({ winner: 2 });
  const act = action(0, "turn", 0);
  assert.deepStrictEqual(legal(game, act), { ok: false, reason: "over" });
});

test("legal: not-your-turn when action.seat !== game.turn", () => {
  const game = makeGame({ turn: 1 });
  const act = action(0, "turn", 0);
  assert.deepStrictEqual(legal(game, act), { ok: false, reason: "not-your-turn" });
});

test("legal: stale when action.version !== game.version", () => {
  const game = makeGame({ version: 5 });
  const act = action(0, "turn", 4);
  assert.deepStrictEqual(legal(game, act), { ok: false, reason: "stale" });
});

test("legal: order — over beats not-your-turn", () => {
  const game = makeGame({ winner: 3, turn: 1 });
  const act = action(0, "turn", 0);
  assert.deepStrictEqual(legal(game, act), { ok: false, reason: "over" });
});

test("legal: order — not-your-turn beats stale", () => {
  const game = makeGame({ turn: 2, version: 5 });
  const act = action(0, "turn", 4);
  assert.deepStrictEqual(legal(game, act), { ok: false, reason: "not-your-turn" });
});

test("legal: illegal when turning a group with >1 die on a non-x axis", () => {
  const game = makeGame();
  // all players start with one group of 4 dice; turning on y is illegal
  const act = action(0, "turn", 0, "y", 1);
  assert.deepStrictEqual(legal(game, act), { ok: false, reason: "illegal" });
});

test("legal: legal turning a group with >1 die on x axis", () => {
  const game = makeGame();
  const act = action(0, "turn", 0, "x", 1);
  assert.deepStrictEqual(legal(game, act), { ok: true, reason: null });
});

test("legal: roll is never checked for axis legality", () => {
  const game = makeGame();
  const act = Action({ id: "r0", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
  assert.deepStrictEqual(legal(game, act), { ok: true, reason: null });
});

test("legal: a single-die group can turn on any axis", () => {
  const game = makeGame({
    players: [
      Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0)] }), Group({ dice: [die(1), die(2), die(3)] })] }) }),
      ...makePlayers().slice(1),
    ],
  });
  const act = action(0, "turn", 0, "z", 1);
  // rightmost group has 3 dice, axis is z → illegal
  assert.deepStrictEqual(legal(game, act), { ok: false, reason: "illegal" });
});

// ---- after ----

test("after: returns winner when queue is one group of 4 with same o", () => {
  const game = makeGame({
    players: [
      Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0, 5), die(1, 5), die(2, 5), die(3, 5)] })] }) }),
      ...makePlayers().slice(1),
    ],
  });
  const g = after(game, 0);
  assert.strictEqual(g.winner, 0);
  assert.strictEqual(g.turn, game.turn);
});

test("after: advances turn when dice have different o", () => {
  const game = makeGame({
    players: [
      Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0, 5), die(1, 6), die(2, 5), die(3, 5)] })] }) }),
      ...makePlayers().slice(1),
    ],
  });
  const g = after(game, 0);
  assert.strictEqual(g.winner, null);
  assert.strictEqual(g.turn, 1);
});

test("after: advances turn when queue has more than one group", () => {
  const game = makeGame({
    players: [
      Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0, 5), die(1, 5)] }), Group({ dice: [die(2, 5), die(3, 5)] })] }) }),
      ...makePlayers().slice(1),
    ],
  });
  const g = after(game, 0);
  assert.strictEqual(g.winner, null);
  assert.strictEqual(g.turn, 1);
});

test("after: advances turn when group has fewer than 4 dice", () => {
  const game = makeGame({
    players: [
      Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0, 5), die(1, 5), die(2, 5)] })] }) }),
      Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(3, 5), die(4, 5), die(5, 5), die(6, 5)] })] }) }),
      Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(7, 5), die(8, 5), die(9, 5), die(10, 5)] })] }) }),
      Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(11, 5), die(12, 5), die(13, 5), die(14, 5), die(15, 5)] })] }) }),
    ],
  });
  const g = after(game, 0);
  assert.strictEqual(g.winner, null);
  assert.strictEqual(g.turn, 1);
});

test("after: wrap turn around at seat 3", () => {
  const game = makeGame({
    turn: 3,
    players: [
      ...makePlayers().slice(0, 3),
      Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12, 5), die(13, 6), die(14, 5), die(15, 5)] })] }) }),
    ],
  });
  const g = after(game, 3);
  assert.strictEqual(g.winner, null);
  assert.strictEqual(g.turn, 0);
});
