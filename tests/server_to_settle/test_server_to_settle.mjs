import assert from "node:assert/strict";
import {
  Game,
  Queue,
  Group,
  Player,
  Die,
  Last,
  Action,
  look,
} from "../../common/index.mjs";
import * as real from "../../edges/server/server_to_settle.mjs";

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

// A drop-in for the forwarder: each function wraps the real call.
// A) check its arguments against the doc, and throw an Error naming the function if wrong;
// B) call the function through "../../edges/server/server_to_settle.mjs" (imported as * as real);
// C) check that it returned;
// D) check the return value against the doc (shape and content, as far as the doc says).

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

const mk = (seat, groups) => Player({ seat, queue: Queue({ groups: groups.map((g) => Group({ dice: g.map(([id, o]) => Die({ id, o })) })) }) });
const NUMBERED = [[2, 3, 4, 5, 6, 1], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]]; // seat 0 numbered [2, 3, 4, 5, 6, 1]: its face 1 shows 2 pips, ...
const others = [mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]), mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]), mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]])];
const at = (groups, faces, last = null) => Game({ players: [mk(0, groups), ...others], turn: 0, version: 1, rng: 7, last, winner: null, faces });

const lastTurn = Last({ action: Action({ id: "0:1", seat: 0, move: "turn", axis: "x", dir: 1, version: 1 }), change: "turn", dice: [2, 3], before: [0, 0] });
const lastRoll = Last({ action: Action({ id: "0:1", seat: 0, move: "roll", axis: null, dir: null, version: 1 }), change: "roll", dice: [3], before: [0] });

const groupsOf = (g) => g.players[0].queue.groups.map((grp) => grp.dice.map((d) => [d.id, d.o]));

export async function _sheo_check() {
  // --- look: how dice look to their owner by their owner's numbering ---
  {
    const perm = NUMBERED[0];
    // numbered [2,3,4,5,6,1]: o 0 and o 9 both have face 1 on top (2 pips), turned a quarter apart: not alike.
    assert.strictEqual(look(perm, 0), "2:45");
    assert.strictEqual(look(perm, 9), "2:36");
    assert.notStrictEqual(look(perm, 0), look(perm, 9));
    // o 3 and o 10 have face 6 on top (keys 6b, 6a), which shows 1 pip: alike.
    assert.strictEqual(look(perm, 3), "1");
    assert.strictEqual(look(perm, 10), "1");
    assert.strictEqual(look(perm, 3), look(perm, 10));
    // With faces null it's the other way round: o 0 and o 9 alike.
    assert.strictEqual(look(null, 0), "1");
    assert.strictEqual(look(null, 9), "1");
    assert.strictEqual(look(null, 0), look(null, 9));
  }

  // Golden: regroup, seat 0 numbered [2,3,4,5,6,1]
  {
    const g = at([[[0, 0]], [[1, 9]], [[2, 3]], [[3, 10]]], NUMBERED);
    const r = regroup(g, 0);
    assert.deepStrictEqual(groupsOf(r), [[[0, 0]], [[1, 9]], [[2, 3], [3, 10]]]);
  }

  // Golden: regroup, the same dice, faces null
  {
    const g = at([[[0, 0]], [[1, 9]], [[2, 3]], [[3, 10]]], null);
    const r = regroup(g, 0);
    assert.deepStrictEqual(groupsOf(r), [[[0, 0], [1, 9]], [[2, 3]], [[3, 10]]]);
  }

  // Golden: apply after a turn, numbered
  {
    const g = at([[[0, 3]], [[1, 0]], [[2, 20], [3, 10]]], NUMBERED, lastTurn);
    const r = apply(g, 0);
    assert.deepStrictEqual(groupsOf(r), [[[2, 20], [1, 0]], [[3, 10], [0, 3]]]);
  }

  // Golden: apply after a roll, numbered
  {
    const g = at([[[0, 3]], [[1, 0], [2, 9]], [[3, 20]]], NUMBERED, lastRoll);
    const r = apply(g, 0);
    assert.deepStrictEqual(groupsOf(r), [[[3, 20], [1, 0]], [[0, 3]], [[2, 9]]]);
  }

  // A valid game for argument checks
  const game = at([[[0, 0]], [[1, 9]], [[2, 3]], [[3, 10]]], NUMBERED);

  // --- argument checks ---
  assert.throws(() => apply({}, 0), /^Error: apply: game must be a game/);
  assert.throws(() => apply(game, 4), /^Error: apply: seat must be 0..3/);
  assert.throws(() => regroup({}, 0), /^Error: regroup: game must be a game/);
  assert.throws(() => regroup(game, -1), /^Error: regroup: seat must be 0..3/);
}
