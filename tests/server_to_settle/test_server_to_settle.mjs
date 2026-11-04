import assert from "node:assert/strict";
import {
  Game,
  Queue,
  Group,
  Player,
  Die,
  Last,
  Action,
  ORIENTATIONS,
} from "../../common/index.mjs";
import * as real from "../../edges/server/server_to_settle.mjs";

function die(id, o = 0) {
  return Die({ id, o });
}

function group(dice) {
  return Group({ dice });
}

function queue(groups) {
  return Queue({ groups });
}

function player(seat, groups) {
  return Player({ seat, queue: queue(groups) });
}

function isGame(g) {
  return (
    g &&
    typeof g === "object" &&
    g.kind === "game" &&
    Array.isArray(g.players) &&
    g.players.length === 4 &&
    g.players.every((p) => p && p.kind === "player")
  );
}

function isSeat(s) {
  return typeof s === "number" && Number.isInteger(s) && s >= 0 && s <= 3;
}

function keyOf(d) {
  return ORIENTATIONS[d.o].key;
}

export function apply(game, seat) {
  if (!isGame(game)) throw new Error("apply: game must be a game");
  if (!isSeat(seat)) throw new Error("apply: seat must be 0..3");
  const result = real.apply(game, seat);
  if (!isGame(result)) throw new Error("apply: did not return a game");
  if (result.last !== game.last) throw new Error("apply: last changed");
  for (let i = 0; i < 4; i++) {
    if (i === seat) continue;
    if (result.players[i] !== game.players[i])
      throw new Error("apply: player " + i + " was rebuilt");
  }
  if (result.players[seat].seat !== seat)
    throw new Error("apply: seat player seat wrong");
  return result;
}

export function regroup(game, seat) {
  if (!isGame(game)) throw new Error("regroup: game must be a game");
  if (!isSeat(seat)) throw new Error("regroup: seat must be 0..3");
  const result = real.regroup(game, seat);
  if (!isGame(result)) throw new Error("regroup: did not return a game");
  if (result.last !== game.last) throw new Error("regroup: last changed");
  for (let i = 0; i < 4; i++) {
    if (i === seat) continue;
    if (result.players[i] !== game.players[i])
      throw new Error("regroup: player " + i + " was rebuilt");
  }
  if (result.players[seat].seat !== seat)
    throw new Error("regroup: seat player seat wrong");
  return result;
}

function buildGame(players, change) {
  let action;
  if (change === "deal") action = null;
  else action = Action({
    id: "a1",
    seat: 0,
    move: change,
    axis: change === "turn" ? "x" : null,
    dir: change === "turn" ? 1 : null,
    version: 0,
  });
  const last = Last({ action, change, dice: [0], before: [0] });
  return Game({ players, turn: 0, version: 0, rng: 1, last, winner: null });
}

function queueDice(q) {
  return q.groups.map((g) => g.dice.map((d) => d.id));
}

export async function _sheo_check() {
  // a valid game for argument checks
  const baseP0 = player(0, [group([die(0, 0), die(1, 9), die(2, 2), die(3, 0)])]);
  const baseP1 = player(1, [group([die(4), die(5), die(6), die(7)])]);
  const baseP2 = player(2, [group([die(8), die(9), die(10), die(11)])]);
  const baseP3 = player(3, [group([die(12), die(13), die(14), die(15)])]);
  const game = buildGame([baseP0, baseP1, baseP2, baseP3], "roll");

  // --- apply: Move + Break (roll) + Split + Merge ---
  {
    const p0 = player(0, [
      group([die(0, 0), die(2, 2)]),
      group([die(4, 0), die(6, 2)]),
    ]);
    const p1 = player(1, [group([die(1), die(3), die(5), die(7)])]);
    const p2 = player(2, [group([die(8), die(9), die(10), die(11)])]);
    const p3 = player(3, [group([die(12), die(13), die(14), die(15)])]);
    const game = buildGame([p0, p1, p2, p3], "roll");

    const out = apply(game, 0);
    const q = out.players[0].queue;
    assert.deepStrictEqual(queueDice(q), [
      [4, 0],
      [6, 2],
    ]);
    // keys: group 0 all "1", group 1 all "4"
    assert.strictEqual(keyOf(q.groups[0].dice[0]), "1");
    assert.strictEqual(keyOf(q.groups[0].dice[1]), "1");
    assert.strictEqual(keyOf(q.groups[1].dice[0]), "4");
    assert.strictEqual(keyOf(q.groups[1].dice[1]), "4");
  }

  // --- apply: Move + no Break (turn) + Split + Merge (no split needed) ---
  {
    const p0 = player(0, [
      group([die(0, 0), die(1, 9)]),
      group([die(2, 2)]),
    ]);
    const p1 = player(1, [group([die(3), die(4), die(5), die(6)])]);
    const p2 = player(2, [group([die(7), die(8), die(9), die(10)])]);
    const p3 = player(3, [group([die(11), die(12), die(13), die(14), die(15)])]);
    const game = buildGame([p0, p1, p2, p3], "turn");

    const out = apply(game, 0);
    const q = out.players[0].queue;
    // Move: [G([d2]), G([d0,d1])]; no break (turn); no split; merge keeps order.
    assert.deepStrictEqual(queueDice(q), [
      [2],
      [0, 1],
    ]);
    assert.strictEqual(keyOf(q.groups[0].dice[0]), "4");
    assert.strictEqual(keyOf(q.groups[1].dice[0]), "1");
    assert.strictEqual(keyOf(q.groups[1].dice[1]), "1");
  }

  // --- regroup: Split + Merge (after deal, no move/break) ---
  {
    const p0 = player(0, [
      group([die(0, 0), die(2, 2)]),
      group([die(4, 0), die(6, 2)]),
    ]);
    const p1 = player(1, [group([die(1), die(3), die(5), die(7)])]);
    const p2 = player(2, [group([die(8), die(9), die(10), die(11)])]);
    const p3 = player(3, [group([die(12), die(13), die(14), die(15)])]);
    const game = buildGame([p0, p1, p2, p3], "deal");

    const out = regroup(game, 0);
    const q = out.players[0].queue;
    // Split: G([d0,d2])->[G(d0),G(d2)], G([d4,d6])->[G(d4),G(d6)]
    // Merge: d0 key1, d2 key4, d4 key1->append to d0, d6 key4->append to d2
    assert.deepStrictEqual(queueDice(q), [
      [0, 4],
      [2, 6],
    ]);
    assert.strictEqual(keyOf(q.groups[0].dice[0]), "1");
    assert.strictEqual(keyOf(q.groups[0].dice[1]), "1");
    assert.strictEqual(keyOf(q.groups[1].dice[0]), "4");
    assert.strictEqual(keyOf(q.groups[1].dice[1]), "4");
  }

  // --- regroup: no split, no merge changes ---
  {
    const p0 = player(0, [
      group([die(0, 0), die(1, 9)]),
      group([die(2, 2)]),
    ]);
    const p1 = player(1, [group([die(3), die(4), die(5), die(6)])]);
    const p2 = player(2, [group([die(7), die(8), die(9), die(10)])]);
    const p3 = player(3, [group([die(11), die(12), die(13), die(14), die(15)])]);
    const game = buildGame([p0, p1, p2, p3], "deal");

    const out = regroup(game, 0);
    const q = out.players[0].queue;
    assert.deepStrictEqual(queueDice(q), [
      [0, 1],
      [2],
    ]);
    assert.strictEqual(keyOf(q.groups[0].dice[0]), "1");
    assert.strictEqual(keyOf(q.groups[0].dice[1]), "1");
    assert.strictEqual(keyOf(q.groups[1].dice[0]), "4");
  }

  // --- argument checks ---
  assert.throws(() => apply({}, 0), /^Error: apply: game must be a game/);
  assert.throws(() => apply(game, 4), /^Error: apply: seat must be 0..3/);
  assert.throws(() => regroup({}, 0), /^Error: regroup: game must be a game/);
  assert.throws(() => regroup(game, -1), /^Error: regroup: seat must be 0..3/);
}
