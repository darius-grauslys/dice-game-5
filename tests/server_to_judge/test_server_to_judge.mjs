import assert from "node:assert/strict";
import {
  Die, Group, Queue, Player, Action, Game,
} from "../../common/index.mjs";
import * as real from "../../edges/server/server_to_judge.mjs";

// ---- wrapped legal ----

export function legal(game, action) {
  // A) check its arguments against the doc, and throw an Error naming the function if they're wrong;
  if (!(game && typeof game === "object" && game.kind === "game")) {
    throw new Error("legal: game must be a Game");
  }
  if (!(action && typeof action === "object" && action.kind === "action")) {
    throw new Error("legal: action must be an Action");
  }
  // B) call the function through the forwarder;
  const result = real.legal(game, action);
  // C) check that it returned;
  if (result === undefined) throw new Error("legal: did not return");
  // D) check the return value against the doc (shape and content).
  if (!(result && typeof result === "object" && "ok" in result && "reason" in result)) {
    throw new Error("legal: return must be {ok, reason}");
  }
  if (typeof result.ok !== "boolean") throw new Error("legal: ok must be a boolean");
  if (result.ok) {
    if (result.reason !== null) throw new Error("legal: ok true requires reason null");
  } else {
    if (typeof result.reason !== "string") throw new Error("legal: ok false requires reason string");
    if (!["over", "not-your-turn", "stale", "illegal"].includes(result.reason)) {
      throw new Error("legal: reason must be one of over, not-your-turn, stale, illegal");
    }
  }
  return result;
}

// ---- wrapped after ----

export function after(game, seat) {
  // A) check its arguments against the doc, and throw an Error naming the function if they're wrong;
  if (!(game && typeof game === "object" && game.kind === "game")) {
    throw new Error("after: game must be a Game");
  }
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) {
    throw new Error("after: seat must be an integer 0..3");
  }
  // B) call the function through the forwarder;
  const result = real.after(game, seat);
  // C) check that it returned;
  if (result === undefined) throw new Error("after: did not return");
  // D) check the return value against the doc (shape and content).
  if (!(result && typeof result === "object" && result.kind === "game")) {
    throw new Error("after: return must be a Game");
  }
  return result;
}

// ---- helpers to build realistic inputs ----

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

// ---- _sheo_check ----

export async function _sheo_check() {
  // ===== legal =====

  // Rule 1: game.winner !== null → "over"
  {
    const game = makeGame({ winner: 2 });
    const action = Action({ id: "a1", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
    const r = legal(game, action);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, "over");
  }

  // Rule 2: action.seat !== game.turn → "not-your-turn"
  {
    const game = makeGame({ winner: null, turn: 0 });
    const action = Action({ id: "a2", seat: 1, move: "roll", axis: null, dir: null, version: 0 });
    const r = legal(game, action);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, "not-your-turn");
  }

  // Rule 3: action.version !== game.version → "stale"
  {
    const game = makeGame({ winner: null, turn: 0, version: 5 });
    const action = Action({ id: "a3", seat: 0, move: "roll", axis: null, dir: null, version: 6 });
    const r = legal(game, action);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, "stale");
  }

  // Rule 4: action.move === "turn", the actor's rightmost group has more than one die, and action.axis !== "x" → "illegal".
  // makePlayers gives each player one group of 4 dice, so the rightmost group has 4 dice (> 1).
  {
    const game = makeGame({ winner: null, turn: 0, version: 0 });
    const action = Action({ id: "a4", seat: 0, move: "turn", axis: "y", dir: 1, version: 0 });
    const r = legal(game, action);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, "illegal");
  }

  // Rule 4 variant: axis === "x" is legal even when the rightmost group has more than one die.
  {
    const game = makeGame({ winner: null, turn: 0, version: 0 });
    const action = Action({ id: "a5", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
    const r = legal(game, action);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.reason, null);
  }

  // Otherwise: {ok: true, reason: null}. A roll with no stale/over/not-your-turn is legal.
  {
    const game = makeGame({ winner: null, turn: 0, version: 0 });
    const action = Action({ id: "a6", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
    const r = legal(game, action);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.reason, null);
  }

  // ===== after =====

  // Seat's queue is exactly one group of 4 dice and all four have the same o → winner, turn unchanged.
  {
    const game = makeGame({ winner: null, turn: 0, version: 0 });
    const g = after(game, 0);
    assert.strictEqual(g.kind, "game");
    assert.strictEqual(g.winner, 0);
    assert.strictEqual(g.turn, 0);
  }

  // Different seat also wins under the same condition.
  {
    const game = makeGame({ winner: null, turn: 1, version: 0 });
    const g = after(game, 2);
    assert.strictEqual(g.kind, "game");
    assert.strictEqual(g.winner, 2);
    assert.strictEqual(g.turn, 1); // turn unchanged
  }

  // Otherwise: return game.with({turn: (seat + 1) % 4}).
  // Build a game where player 0's queue is not exactly one group of 4 dice with all same o.
  {
    const players = makePlayers();
    players[0] = Player({
      seat: 0,
      queue: Queue({ groups: [Group({ dice: [die(0), die(1)] }), Group({ dice: [die(2), die(3)] })] }),
    });
    const game = Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });
    const g = after(game, 0);
    assert.strictEqual(g.kind, "game");
    assert.strictEqual(g.winner, null);
    assert.strictEqual(g.turn, 1); // (0 + 1) % 4
  }

  // Seat with 2 groups: turn changes to (seat+1)%4.
  {
    const players = makePlayers();
    players[1] = Player({
      seat: 1,
      queue: Queue({ groups: [Group({ dice: [die(4), die(5)] }), Group({ dice: [die(6), die(7)] })] }),
    });
    const game = Game({ players, turn: 1, version: 0, rng: 1, last: null, winner: null });
    const g = after(game, 1);
    assert.strictEqual(g.kind, "game");
    assert.strictEqual(g.winner, null);
    assert.strictEqual(g.turn, 2); // (1 + 1) % 4
  }
}
