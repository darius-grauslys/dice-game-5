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
  facesFor,
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

function groupsOf(game) {
  return game.players.map((p) =>
    p.queue.groups.map((g) => g.dice.map((d) => [d.id, d.o]))
  );
}

test("init({seed: 2}) emits game with faces, rng, turn, version, last.change and groups", async () => {
  let emitted = null;
  const up = {
    poll() {
      throw new Error("poll should not be called in init");
    },
    emit(msg) {
      emitted = msg;
    },
  };
  await server.init({ seed: 2 }, up);
  assert.ok(emitted);
  assert.strictEqual(emitted.type, "game");
  const g = emitted.body;
  assert.deepStrictEqual(g.faces, [
    [3, 6, 4, 5, 2, 1],
    [1, 6, 5, 4, 2, 3],
    [2, 4, 6, 1, 5, 3],
    [4, 1, 3, 5, 2, 6],
  ]);
  assert.deepStrictEqual(g.faces, facesFor(2));
  assert.strictEqual(g.rng, 3535249234);
  assert.strictEqual(g.turn, 0);
  assert.strictEqual(g.version, 0);
  assert.strictEqual(g.last.change, "deal");
  assert.deepStrictEqual(groupsOf(g), [
    [[[0, 17]], [[1, 22]], [[2, 19]], [[3, 8]]],
    [[[4, 11]], [[5, 21]], [[6, 9], [7, 9]]],
    [[[8, 21]], [[9, 20]], [[10, 19]], [[11, 13]]],
    [[[12, 7]], [[13, 17]], [[14, 11]], [[15, 16]]],
  ]);
});

test("init({seed: 1}) emits game with facesFor(1)", async () => {
  let emitted = null;
  const up = {
    poll() {
      throw new Error("poll should not be called in init");
    },
    emit(msg) {
      emitted = msg;
    },
  };
  await server.init({ seed: 1 }, up);
  assert.ok(emitted);
  assert.deepStrictEqual(emitted.body.faces, [
    [5, 3, 6, 1, 4, 2],
    [2, 3, 4, 5, 6, 1],
    [1, 6, 3, 5, 4, 2],
    [6, 5, 1, 4, 3, 2],
  ]);
});

test("step keeps faces: the returned game has the same faces as the input", () => {
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
    winner: null,
    faces: facesFor(2),
  });
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const [g, reply] = server.step(game, action);
  assert.strictEqual(reply.ok, true);
  assert.deepStrictEqual(g.faces, game.faces);
});

test("next({seed: 10}) after a win emits the next game with the golden values", async () => {
  let emittedGames = [];
  const actions = [
    Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: -1, version: 0 }),
    Action({ id: "a2", seat: 1, move: "turn", axis: "z", dir: 1, version: 1 }),
    Action({ id: "a3", seat: 2, move: "turn", axis: "z", dir: 1, version: 2 }),
    Action({ id: "a4", seat: 3, move: "turn", axis: "x", dir: 1, version: 3 }),
  ];
  let pollCount = 0;
  const up = {
    poll({ wait }) {
      pollCount++;
      if (pollCount === 1) {
        return actions.map((a) => ({ type: "action", body: a }));
      }
      return [];
    },
    emit(msg) {
      if (msg.type === "game") emittedGames.push(msg);
    },
  };
  await server.init({ seed: 9 }, up);
  assert.strictEqual(emittedGames.length, 1);
  assert.strictEqual(emittedGames[0].body.version, 0);

  await server.begin();
  const lastGame = emittedGames[emittedGames.length - 1];
  assert.strictEqual(lastGame.body.version, 4);
  assert.strictEqual(lastGame.body.winner, 3);

  emittedGames = [];
  await server.next({ seed: 10 });
  assert.strictEqual(emittedGames.length, 1);
  const g = emittedGames[0].body;
  assert.strictEqual(g.version, 5);
  assert.strictEqual(g.turn, 0);
  assert.strictEqual(g.winner, null);
  assert.strictEqual(g.rng, 3535249242);
  assert.strictEqual(g.last.change, "deal");
  assert.deepStrictEqual(g.faces, [
    [2, 1, 3, 6, 4, 5],
    [2, 1, 5, 3, 4, 6],
    [5, 4, 1, 2, 3, 6],
    [5, 2, 3, 6, 1, 4],
  ]);
  assert.deepStrictEqual(groupsOf(g), [
    [[[0, 17]], [[1, 6]], [[2, 3]], [[3, 4]]],
    [[[4, 20]], [[5, 18], [6, 6]], [[7, 21]]],
    [[[8, 11]], [[9, 6]], [[10, 0]], [[11, 2]]],
    [[[12, 10], [13, 14]], [[14, 18]], [[15, 13]]],
  ]);
});
