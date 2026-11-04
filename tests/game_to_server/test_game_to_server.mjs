import assert from "node:assert/strict";

import * as real from "../../edges/game/game_to_server.mjs";
import {
  Die, Group, Queue, Player, Action, Game, Reply, Message, Up, Rng, TURN, ORIENTATIONS, REASONS,
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

// ---- _sheo_check ----

export async function _sheo_check() {
  // ---------- init ----------
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
    const seed = 123;
    await init({ seed }, up);
    // init emits exactly one Message.game(game)
    assert.strictEqual(emitted.length, 1, "init emits one game message");
    const m = emitted[0];
    assert.strictEqual(m.kind, "message");
    assert.strictEqual(m.type, "game");
    const game = m.body;
    assert.strictEqual(game.kind, "game");
    assert.strictEqual(game.version, 0, "init game version is 0");
    assert.strictEqual(game.turn, 0, "init game turn is 0");
    assert.strictEqual(game.winner, null, "init game winner is null");
    assert.ok(Number.isInteger(game.rng) && game.rng >= 0 && game.rng <= 4294967295, "init game rng is a u32");
    // invariant: all 16 dice present
    const seen = new Array(16).fill(false);
    for (const p of game.players)
      for (const g of p.queue.groups)
        for (const d of g.dice) seen[d.id] = true;
    for (let id = 0; id < 16; id++) assert.ok(seen[id], `die ${id} present`);
  }

  // ---------- step: legal ----------
  {
    const seed = 7;
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async () => pollQueue,
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed }, up);
    const game = emitted[0].body;
    // legal turn: player 0's turn, not stale
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
  }

  // ---------- step: illegal (not-your-turn) ----------
  {
    const seed = 7;
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async () => pollQueue,
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed }, up);
    const game = emitted[0].body;
    const action = Action({ id: "a2", seat: 1, move: "turn", axis: "x", dir: 1, version: game.version });
    const [g, reply] = step(game, action);
    assert.strictEqual(reply.kind, "reply");
    assert.strictEqual(reply.to, "a2");
    assert.strictEqual(reply.seat, 1);
    assert.strictEqual(reply.ok, false);
    assert.strictEqual(reply.reason, "not-your-turn");
    assert.strictEqual(g, game, "illegal step returns unchanged game");
  }

  // ---------- step: illegal (stale) ----------
  {
    const seed = 7;
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async () => pollQueue,
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed }, up);
    const game = emitted[0].body;
    const action = Action({ id: "a3", seat: 0, move: "turn", axis: "x", dir: 1, version: game.version + 999 });
    const [g, reply] = step(game, action);
    assert.strictEqual(reply.kind, "reply");
    assert.strictEqual(reply.ok, false);
    assert.strictEqual(reply.reason, "stale");
    assert.strictEqual(g, game, "stale step returns unchanged game");
  }

  // ---------- step: purity ----------
  {
    const seed = 11;
    const emitted = [];
    let pollQueue = [];
    const up = Up({
      poll: async () => pollQueue,
      emit: (msg) => { emitted.push(msg); },
    });
    await init({ seed }, up);
    const game = emitted[0].body;
    const snapshot = JSON.stringify(game);
    const action = Action({ id: "a4", seat: 0, move: "turn", axis: "y", dir: -1, version: game.version });
    step(game, action);
    assert.strictEqual(JSON.stringify(game), snapshot, "step does not mutate the game");
  }

  // ---------- begin ----------
  {
    const emitted = [];
    const actions = [
      Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: -1, version: 0 }),
      Action({ id: "a2", seat: 1, move: "turn", axis: "z", dir: 1, version: 1 }),
      Action({ id: "a3", seat: 2, move: "turn", axis: "z", dir: 1, version: 2 }),
      Action({ id: "a4", seat: 3, move: "turn", axis: "x", dir: 1, version: 3 }),
    ];
    let aq = [];
    const up = Up({
      poll: async ({ wait }) => {
        const a = aq.shift();
        if (a === undefined) {
          if (!wait) return [];
          throw new Error("begin: poll with no actions");
        }
        return [Message.action(a)];
      },
      emit: (msg) => { emitted.push(msg); },
    });

    await init({ seed: 9 }, up);
    // queue the winning sequence
    for (const a of actions) aq.push(a);
    await begin();

    // begin emitted replies for each action and a game after version changes
    const replies = emitted.filter((m) => m.type === "reply");
    assert.strictEqual(replies.length, 4, "begin emitted 4 replies");
    // verify reply shapes
    for (let i = 0; i < 4; i++) {
      const r = replies[i].body;
      assert.strictEqual(r.kind, "reply");
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.reason, null);
      assert.strictEqual(r.to, `a${i + 1}`);
      assert.strictEqual(r.seat, i);
    }
    // at least one game message emitted when version changed
    const games = emitted.filter((m) => m.type === "game");
    assert.ok(games.length >= 1, "begin emitted game messages");
  }
}
