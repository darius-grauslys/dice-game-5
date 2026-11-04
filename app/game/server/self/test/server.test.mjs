import { test } from "node:test";
import assert from "node:assert";

import {
  Die,
  Group,
  Queue,
  Player,
  Game,
  Action,
  Reply,
  Message,
} from "../../../../../common/index.mjs";
import * as server from "../index.mjs";

function makeBlankGame() {
  const players = [];
  for (let s = 0; s < 4; s++) {
    const groups = [];
    for (let i = 0; i < 4; i++) {
      const die = Die({ id: 4 * s + i, o: 0 });
      groups.push(Group({ dice: [die] }));
    }
    const queue = Queue({ groups });
    players.push(Player({ seat: s, queue }));
  }
  return Game({ players, turn: 0, version: 0, rng: 0, last: null, winner: null });
}

test("init builds a blank game and emits it", async () => {
  let emitted = null;
  const up = {
    poll() {
      throw new Error("poll should not be called in init");
    },
    emit(msg) {
      emitted = msg;
    },
  };
  await server.init({ seed: 42 }, up);
  assert.ok(emitted);
  assert.strictEqual(emitted.kind, "message");
  assert.strictEqual(emitted.type, "game");
  assert.strictEqual(emitted.body.kind, "game");
  assert.strictEqual(emitted.body.players.length, 4);
  assert.strictEqual(emitted.body.turn, 0);
  assert.strictEqual(emitted.body.winner, null);
});

test("step: refuses when game is over", () => {
  const players = [];
  for (let s = 0; s < 4; s++) {
    const groups = [];
    for (let i = 0; i < 4; i++) {
      const die = Die({ id: 4 * s + i, o: 0 });
      groups.push(Group({ dice: [die] }));
    }
    const queue = Queue({ groups });
    players.push(Player({ seat: s, queue }));
  }
  const game = Game({
    players,
    turn: 0,
    version: 0,
    rng: 0,
    last: null,
    winner: 2,
  });
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const [g, reply] = server.step(game, action);
  assert.strictEqual(g, game);
  assert.strictEqual(reply.ok, false);
  assert.strictEqual(reply.reason, "over");
});

test("step: refuses when not your turn", () => {
  const game = makeBlankGame();
  const action = Action({ id: "a1", seat: 1, move: "turn", axis: "x", dir: 1, version: 0 });
  const [g, reply] = server.step(game, action);
  assert.strictEqual(g, game);
  assert.strictEqual(reply.ok, false);
  assert.strictEqual(reply.reason, "not-your-turn");
});

test("step: refuses when stale", () => {
  const game = makeBlankGame();
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 99 });
  const [g, reply] = server.step(game, action);
  assert.strictEqual(g, game);
  assert.strictEqual(reply.ok, false);
  assert.strictEqual(reply.reason, "stale");
});

test("step: accepts a legal single-die turn and bumps version", () => {
  const game = makeBlankGame();
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const [g, reply] = server.step(game, action);
  assert.notStrictEqual(g, game);
  assert.strictEqual(reply.ok, true);
  assert.strictEqual(reply.reason, null);
  assert.strictEqual(reply.to, "a1");
  assert.strictEqual(reply.seat, 0);
  assert.strictEqual(g.version, game.version + 1);
  assert.strictEqual(g.turn, 1); // after: turn passes to next player
});

test("step: pure — does not mutate the input game", () => {
  const game = makeBlankGame();
  const before = JSON.stringify(game);
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const [g, reply] = server.step(game, action);
  assert.strictEqual(reply.ok, true);
  assert.notStrictEqual(g, game);
  // game should be unchanged (version still 0)
  assert.strictEqual(game.version, 0);
});
