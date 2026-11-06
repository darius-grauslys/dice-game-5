import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, regroup } from "../index.mjs";
import { Die, Group, Queue, Player, Last, Game, Action } from "../../../../../../common/index.mjs";

const mk = (seat, groups) =>
  Player({
    seat,
    queue: Queue({
      groups: groups.map((g) =>
        Group({ dice: g.map(([id, o]) => Die({ id, o })) }),
      ),
    }),
  });

const NUMBERED = [
  [2, 3, 4, 5, 6, 1],
  [1, 2, 3, 4, 5, 6],
  [1, 2, 3, 4, 5, 6],
  [1, 2, 3, 4, 5, 6],
]; // seat 0 numbered [2, 3, 4, 5, 6, 1]: its face 1 shows 2 pips, ...
const others = [
  mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
  mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]),
  mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]),
];
const at = (groups, faces, last = null) =>
  Game({ players: [mk(0, groups), ...others], turn: 0, version: 1, rng: 7, last, winner: null, faces });

const lastTurn = Last({
  action: Action({ id: "0:1", seat: 0, move: "turn", axis: "x", dir: 1, version: 1 }),
  change: "turn",
  dice: [2, 3],
  before: [0, 0],
});
const lastRoll = Last({
  action: Action({ id: "0:1", seat: 0, move: "roll", axis: null, dir: null, version: 1 }),
  change: "roll",
  dice: [3],
  before: [0],
});

function groupsOf(game, seat) {
  return game.players[seat].queue.groups.map((g) => g.dice.map((d) => [d.id, d.o]));
}

test("regroup, seat 0 numbered [2,3,4,5,6,1]", () => {
  const g = regroup(at([[[0, 0]], [[1, 9]], [[2, 3]], [[3, 10]]], NUMBERED), 0);
  assert.deepStrictEqual(groupsOf(g, 0), [[[0, 0]], [[1, 9]], [[2, 3], [3, 10]]]);
});

test("regroup, the same dice, faces null", () => {
  const g = regroup(at([[[0, 0]], [[1, 9]], [[2, 3]], [[3, 10]]], null), 0);
  assert.deepStrictEqual(groupsOf(g, 0), [[[0, 0], [1, 9]], [[2, 3]], [[3, 10]]]);
});

test("apply after a turn, numbered", () => {
  const g = apply(at([[[0, 3]], [[1, 0]], [[2, 20], [3, 10]]], NUMBERED, lastTurn), 0);
  assert.deepStrictEqual(groupsOf(g, 0), [[[2, 20], [1, 0]], [[3, 10], [0, 3]]]);
});

test("apply after a roll, numbered", () => {
  const g = apply(at([[[0, 3]], [[1, 0], [2, 9]], [[3, 20]]], NUMBERED, lastRoll), 0);
  assert.deepStrictEqual(groupsOf(g, 0), [[[3, 20], [1, 0]], [[0, 3]], [[2, 9]]]);
});

test("apply returns game.with({players}), last unchanged", () => {
  const g0 = at([[[0, 3]], [[1, 0]], [[2, 20], [3, 10]]], NUMBERED, lastTurn);
  const g = apply(g0, 0);
  assert.strictEqual(g.last, lastTurn);
  assert.notStrictEqual(g, g0);
  assert.deepStrictEqual(g.players.map((p) => p.seat), [0, 1, 2, 3]);
});

test("apply leaves other seats unchanged", () => {
  const g = apply(at([[[0, 3]], [[1, 0]], [[2, 20], [3, 10]]], NUMBERED, lastTurn), 0);
  assert.deepStrictEqual(groupsOf(g, 1), [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]);
  assert.deepStrictEqual(groupsOf(g, 2), [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]);
  assert.deepStrictEqual(groupsOf(g, 3), [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]);
});
