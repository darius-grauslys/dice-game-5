import assert from "node:assert/strict";

import * as real from "../../edges/game/game_to_server.mjs";
import {
  Action, Message, Up, REASONS,
} from "../../common/index.mjs";

// ---- wrapped functions: drop-in for the forwarder ----

export async function init(input, up) {
  // A) check args
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("init: expected an object {seed}");
  if (!("seed" in input)) throw new Error("init: missing seed");
  if (!Number.isSafeInteger(input.seed))
    throw new Error("init: seed must be a safe integer");
  if (!(up && typeof up === "object" && up.kind === "up"))
    throw new Error("init: up must be an Up");
  // B) call real
  const res = await real.init(input, up);
  // C) check it returned
  // D) check return: Promise<void>
  if (res !== undefined) throw new Error("init: expected void");
  return res;
}

export function step(game, action) {
  // A) check args
  if (!(game && typeof game === "object" && game.kind === "game"))
    throw new Error("step: game must be a Game");
  if (!(action && typeof action === "object" && action.kind === "action"))
    throw new Error("step: action must be an Action");
  // B) call real
  const res = real.step(game, action);
  // C) check it returned
  if (!Array.isArray(res) || res.length !== 2)
    throw new Error("step: expected [game, reply]");
  const [g, reply] = res;
  // D) check return value
  if (!(reply && typeof reply === "object" && reply.kind === "reply"))
    throw new Error("step: reply must be a Reply");
  if (reply.to !== action.id) throw new Error("step: reply.to must be action.id");
  if (reply.seat !== action.seat) throw new Error("step: reply.seat must be action.seat");
  if (reply.ok) {
    if (reply.reason !== null) throw new Error("step: reply.reason must be null when ok");
    if (!(g && typeof g === "object" && g.kind === "game"))
      throw new Error("step: g must be a Game");
    if (g.version !== game.version + 1)
      throw new Error("step: g.version must be game.version + 1");
    if (JSON.stringify(g.faces) !== JSON.stringify(game.faces))
      throw new Error("step: g.faces must equal game.faces");
  } else {
    if (!REASONS.includes(reply.reason))
      throw new Error("step: reply.reason must be a REASON");
    if (g !== game) throw new Error("step: game must be unchanged");
  }
  return res;
}

export async function begin() {
  // A) check args: none
  // B) call real
  const res = await real.begin();
  // C) check it returned
  // D) check return: Promise<void>
  if (res !== undefined) throw new Error("begin: expected void");
  return res;
}

export async function next(input) {
  // A) check args
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("next: expected an object {seed}");
  if (!("seed" in input)) throw new Error("next: missing seed");
  if (!Number.isSafeInteger(input.seed))
    throw new Error("next: seed must be a safe integer");
  // B) call real
  const res = await real.next(input);
  // C) check it returned
  // D) check return: Promise<void>
  if (res !== undefined) throw new Error("next: expected void");
  return res;
}

// ---- _sheo_check ----

export async function _sheo_check() {
  // ---------- init: seed 2 golden values ----------
  {
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async ({ wait }) => {
        if (pollQueue.length) return pollQueue.shift();
        if (!wait) return [];
        return [];
      },
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed: 2 }, up);
    // init emits exactly one Message.game(game)
    assert.strictEqual(emitted.length, 1, "init emits one game message");
    const m = emitted[0];
    assert.strictEqual(m.kind, "message");
    assert.strictEqual(m.type, "game");
    const game = m.body;
    assert.strictEqual(game.kind, "game");
    assert.deepStrictEqual(game.faces, [[3, 6, 4, 5, 2, 1], [1, 6, 5, 4, 2, 3], [2, 4, 6, 1, 5, 3], [4, 1, 3, 5, 2, 6]], "facesFor(2)");
    assert.strictEqual(game.rng, 3535249234, "rng");
    assert.strictEqual(game.turn, 0, "turn is 0");
    assert.strictEqual(game.version, 0, "version is 0");
    assert.strictEqual(game.winner, null, "winner is null");
    assert.strictEqual(game.last.kind, "last");
    assert.strictEqual(game.last.change, "deal", "last.change is deal");
    // groups: [id, o] pairs per group per seat
    const groups = game.players.map((p) => p.queue.groups.map((g) => g.dice.map((d) => [d.id, d.o])));
    assert.deepStrictEqual(groups, [
      [[[0, 17]], [[1, 22]], [[2, 19]], [[3, 8]]],
      [[[4, 11]], [[5, 21]], [[6, 9], [7, 9]]],
      [[[8, 21]], [[9, 20]], [[10, 19]], [[11, 13]]],
      [[[12, 7]], [[13, 17]], [[14, 11]], [[15, 16]]],
    ], "groups seed 2");
  }

  // ---------- init: seed 1 faces ----------
  {
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async ({ wait }) => {
        if (pollQueue.length) return pollQueue.shift();
        if (!wait) return [];
        return [];
      },
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed: 1 }, up);
    const game = emitted[0].body;
    assert.deepStrictEqual(game.faces, [
      [5, 3, 6, 1, 4, 2],
      [2, 3, 4, 5, 6, 1],
      [1, 6, 3, 5, 4, 2],
      [6, 5, 1, 4, 3, 2],
    ], "facesFor(1)");
  }

  // ---------- step: keeps faces ----------
  {
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async ({ wait }) => {
        if (pollQueue.length) return pollQueue.shift();
        if (!wait) return [];
        return [];
      },
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed: 2 }, up);
    const game = emitted[0].body;
    const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: game.version });
    const [g, reply] = step(game, action);
    assert.strictEqual(reply.kind, "reply");
    assert.strictEqual(reply.ok, true);
    assert.strictEqual(reply.reason, null);
    assert.strictEqual(g.kind, "game");
    assert.deepStrictEqual(g.faces, game.faces, "step keeps faces");
  }

  // ---------- step: purity ----------
  {
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async ({ wait }) => {
        if (pollQueue.length) return pollQueue.shift();
        if (!wait) return [];
        return [];
      },
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed: 2 }, up);
    const game = emitted[0].body;
    const snapshot = JSON.stringify(game);
    const action = Action({ id: "a1", seat: 0, move: "turn", axis: "y", dir: -1, version: game.version });
    step(game, action);
    assert.strictEqual(JSON.stringify(game), snapshot, "step does not mutate the game");
  }

  // ---------- step: legal, illegal (not-your-turn), stale ----------
  {
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async ({ wait }) => {
        if (pollQueue.length) return pollQueue.shift();
        if (!wait) return [];
        return [];
      },
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed: 2 }, up);
    const game = emitted[0].body;

    // legal turn: player 0's turn
    const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: game.version });
    const [g, reply] = step(game, action);
    assert.strictEqual(reply.kind, "reply");
    assert.strictEqual(reply.to, "a1");
    assert.strictEqual(reply.seat, 0);
    assert.strictEqual(reply.ok, true);
    assert.strictEqual(reply.reason, null);
    assert.strictEqual(g.kind, "game");
    assert.strictEqual(g.version, game.version + 1, "legal step increments version");
    assert.notStrictEqual(g, game, "legal step returns a new game");

    // illegal: not-your-turn
    const action2 = Action({ id: "a2", seat: 1, move: "turn", axis: "x", dir: 1, version: game.version });
    const [g2, reply2] = step(game, action2);
    assert.strictEqual(reply2.kind, "reply");
    assert.strictEqual(reply2.to, "a2");
    assert.strictEqual(reply2.seat, 1);
    assert.strictEqual(reply2.ok, false);
    assert.strictEqual(reply2.reason, "not-your-turn");
    assert.strictEqual(g2, game, "illegal step returns unchanged game");

    // stale
    const action3 = Action({ id: "a3", seat: 0, move: "turn", axis: "x", dir: 1, version: game.version + 999 });
    const [g3, reply3] = step(game, action3);
    assert.strictEqual(reply3.kind, "reply");
    assert.strictEqual(reply3.to, "a3");
    assert.strictEqual(reply3.seat, 0);
    assert.strictEqual(reply3.ok, false);
    assert.strictEqual(reply3.reason, "stale");
    assert.strictEqual(g3, game, "stale step returns unchanged game");
  }

  // ---------- begin: a short game through begin() ----------
  {
    const emitted = [];
    const actions = [
      Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: -1, version: 0 }),
      Action({ id: "a2", seat: 1, move: "turn", axis: "z", dir: 1, version: 1 }),
      Action({ id: "a3", seat: 2, move: "turn", axis: "z", dir: 1, version: 2 }),
      Action({ id: "a4", seat: 3, move: "turn", axis: "x", dir: 1, version: 3 }),
    ];
    let ai = 0;
    const up = Up({
      poll: async ({ wait }) => {
        if (ai < actions.length) {
          const a = actions[ai];
          ai++;
          return [Message.action(a)];
        }
        if (wait) throw new Error("begin: poll with no actions");
        return [];
      },
      emit: (msg) => { emitted.push(msg); },
    });

    await init({ seed: 9 }, up);
    await begin();

    // assert: exactly 4 replies, each ok: true, reason: null, to: "a1".."a4", seat: 0..3
    const replies = emitted.filter((m) => m.type === "reply");
    assert.strictEqual(replies.length, 4, "begin emitted exactly 4 replies");
    for (let i = 0; i < 4; i++) {
      const body = replies[i].body;
      assert.strictEqual(body.kind, "reply");
      assert.strictEqual(body.ok, true);
      assert.strictEqual(body.reason, null);
      assert.strictEqual(body.to, `a${i + 1}`);
      assert.strictEqual(body.seat, i);
    }
    // at least one game message
    const games = emitted.filter((m) => m.type === "game");
    assert.ok(games.length >= 1, "begin emitted game messages");
    // the last emitted game has winner: 3
    const lastGame = games[games.length - 1].body;
    assert.strictEqual(lastGame.winner, 3, "last emitted game has winner 3");
  }

  // ---------- next: after a win ----------
  {
    const emitted = [];
    const actions = [
      Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: -1, version: 0 }),
      Action({ id: "a2", seat: 1, move: "turn", axis: "z", dir: 1, version: 1 }),
      Action({ id: "a3", seat: 2, move: "turn", axis: "z", dir: 1, version: 2 }),
      Action({ id: "a4", seat: 3, move: "turn", axis: "x", dir: 1, version: 3 }),
    ];
    let ai = 0;
    const up = Up({
      poll: async ({ wait }) => {
        if (ai < actions.length) {
          const a = actions[ai];
          ai++;
          return [Message.action(a)];
        }
        if (wait) throw new Error("begin: poll with no actions");
        return [];
      },
      emit: (msg) => { emitted.push(msg); },
    });

    await init({ seed: 9 }, up);
    await begin();

    // After those four actions the kept game is won: version: 4, winner: 3.
    const gamesBefore = emitted.filter((m) => m.type === "game");
    const lastBefore = gamesBefore[gamesBefore.length - 1].body;
    assert.strictEqual(lastBefore.version, 4, "kept game version after begin is 4");
    assert.strictEqual(lastBefore.winner, 3, "kept game winner after begin is 3");

    await next({ seed: 10 });

    // next emits exactly one game Message
    const gamesAfter = emitted.filter((m) => m.type === "game");
    assert.strictEqual(gamesAfter.length, gamesBefore.length + 1, "next emits exactly one more game message");
    const nextGame = gamesAfter[gamesAfter.length - 1].body;

    assert.strictEqual(nextGame.kind, "game");
    assert.strictEqual(nextGame.version, 5, "next game version is 5");
    assert.strictEqual(nextGame.turn, 0, "next game turn is 0");
    assert.strictEqual(nextGame.winner, null, "next game winner is null");
    assert.strictEqual(nextGame.rng, 3535249242, "next game rng is 3535249242");
    assert.strictEqual(nextGame.last.kind, "last");
    assert.strictEqual(nextGame.last.change, "deal", "next game last.change is deal");
    assert.deepStrictEqual(nextGame.faces, [[2, 1, 3, 6, 4, 5], [2, 1, 5, 3, 4, 6], [5, 4, 1, 2, 3, 6], [5, 2, 3, 6, 1, 4]], "next game faces is facesFor(9)");
    const groups = nextGame.players.map((p) => p.queue.groups.map((g) => g.dice.map((d) => [d.id, d.o])));
    assert.deepStrictEqual(groups, [
      [[[0, 17]], [[1, 6]], [[2, 3]], [[3, 4]]],
      [[[4, 20]], [[5, 18], [6, 6]], [[7, 21]]],
      [[[8, 11]], [[9, 6]], [[10, 0]], [[11, 2]]],
      [[[12, 10], [13, 14]], [[14, 18]], [[15, 13]]],
    ], "next game groups");
  }
}
