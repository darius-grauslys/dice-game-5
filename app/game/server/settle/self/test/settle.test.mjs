import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, regroup } from "../index.mjs";
import { Die, Group, Queue, Player, Last, Game, Action, ORIENTATIONS } from "../../../../../../common/index.mjs";

function die(id, o = 0) {
  return Die({ id, o });
}

function grp(ids, os = []) {
  return Group({ dice: ids.map((id, i) => die(id, os[i] ?? 0)) });
}

function fullPlayer(seat) {
  const ids = [seat * 4, seat * 4 + 1, seat * 4 + 2, seat * 4 + 3];
  return player(seat, [grp(ids)]);
}

function player(seat, groups) {
  return Player({ seat, queue: Queue({ groups }) });
}

function baseGame(lastChange) {
  const players = [
    player(0, [grp([0, 1, 2, 3], [0, 0, 0, 0])]),
    fullPlayer(1),
    fullPlayer(2),
    fullPlayer(3),
  ];
  let last = null;
  if (lastChange) {
    const action = Action({
      id: "a",
      seat: 0,
      move: lastChange,
      axis: lastChange === "turn" ? "x" : null,
      dir: lastChange === "turn" ? 1 : null,
      version: 0,
    });
    last = Last({ action, change: lastChange, dice: [0], before: [0] });
  }
  return Game({ players, turn: 0, version: 0, rng: 1, last, winner: null });
}

function customGame(p0groups, lastChange) {
  const players = [player(0, p0groups), fullPlayer(1), fullPlayer(2), fullPlayer(3)];
  let last = null;
  if (lastChange) {
    const action = Action({
      id: "a",
      seat: 0,
      move: lastChange,
      axis: lastChange === "turn" ? "x" : null,
      dir: lastChange === "turn" ? 1 : null,
      version: 0,
    });
    last = Last({ action, change: lastChange, dice: [0], before: [0] });
  }
  return Game({ players, turn: 0, version: 0, rng: 1, last, winner: null });
}

test("apply.move: rightmost group goes leftmost, others keep order", () => {
  const g0 = grp([0, 1], [0, 1]); // key "1", "3a" -> different
  const g1 = grp([2], [0]);       // key "1"
  const g2 = grp([3], [5]);       // key "3b"
  const game = customGame([g0, g1, g2], null);

  const out = apply(game, 0);
  const groups = out.players[0].queue.groups;
  // Move: [g2, g0, g1]
  // Break: no (change is not "roll")
  // Split: g2 has 1 die -> [g2]; g0 has keys ["1","3a"] -> split to [[d0],[d1]]; g1 has [d2]
  // Merge: [g2(3b), [d0](1), [d1](3a), [d2](1)]
  //   - g2 key 3b -> new: [{3b:[g2]}]
  //   - [d0] key 1 -> new: [{3b:[g2]}, {1:[d0]}]
  //   - [d1] key 3a -> new: [{3b:[g2]}, {1:[d0]}, {3a:[d1]}]
  //   - [d2] key 1 -> matches {1}, append d2: {1:[d0,d2]}
  // final: [{3b:[g2]}, {1:[d0,d2]}, {3a:[d1]}]
  assert.strictEqual(groups.length, 3);
  assert.deepStrictEqual(groups[0].dice.map((d) => d.id), [3]);
  assert.deepStrictEqual(groups[1].dice.map((d) => d.id), [0, 2]);
  assert.deepStrictEqual(groups[2].dice.map((d) => d.id), [1]);
});

test("apply.break: when last.change === 'roll', moved group becomes single-die groups", () => {
  const g0 = grp([0], [0]);
  const g1 = grp([1, 2, 3], [1, 5, 0]); // keys "3a", "3b", "1"
  const game2b = customGame([g0, g1], "roll");

  const out = apply(game2b, 0);
  const groups = out.players[0].queue.groups;
  // Move: [g1, g0]
  // Break: g1 now leftmost, g1 dice [d1,d2,d3] -> [[d1],[d2],[d3]]
  // afterBreak: [[d1],[d2],[d3], g0]
  // Split: all single-die, no change
  // Merge: d1 key 3a, d2 key 3b, d3 key 1, d0 key 1 -> 
  //   [d1,3a], [d2,3b], [d3,1], [d0,1]
  // final: [[d1], [d2], [d3,d0]] -> ids [1], [2], [3,0]
  assert.strictEqual(groups.length, 3);
  assert.deepStrictEqual(groups[0].dice.map((d) => d.id), [1]);
  assert.deepStrictEqual(groups[1].dice.map((d) => d.id), [2]);
  assert.deepStrictEqual(groups[2].dice.map((d) => d.id), [3, 0]);
});

test("apply.merge: groups with same key are combined, order preserved", () => {
  // g0: [d0(1), d1(3a)], g1: [d2(3a)], g2: [d3(1)]
  const g0 = grp([0, 1], [0, 1]);
  const g1 = grp([2], [1]);
  const g2 = grp([3], [0]);
  const game = customGame([g0, g1, g2], null);

  const out = apply(game, 0);
  const groups = out.players[0].queue.groups;
  // Move: [g2, g0, g1]
  // Break: no
  // Split: g2 single die [d3] key 1 -> [g2]; g0 keys [1,3a] -> [[d0],[d1]]; g1 [d2] key 3a -> [g1]
  // afterSplit: [g2([d3,1]), [d0,1], [d1,3a], g1([d2,3a])]
  // Merge:
  //   g2 key 1 -> [{1:[d3]}]
  //   [d0] key 1 -> append: [{1:[d3,d0]}]
  //   [d1] key 3a -> [{1:[d3,d0]}, {3a:[d1]}]
  //   g1 key 3a -> append: [{1:[d3,d0]}, {3a:[d1,d2]}]
  // final: [{1:[d3,d0]}, {3a:[d1,d2]}] -> ids [3,0], [1,2]
  assert.strictEqual(groups.length, 2);
  assert.deepStrictEqual(groups[0].dice.map((d) => d.id), [3, 0]);
  assert.deepStrictEqual(groups[1].dice.map((d) => d.id), [1, 2]);
});

test("regroup: steps 3 and 4 only (no move, no break)", () => {
  const g0 = grp([0, 1], [0, 1]); // keys [1, 3a] -> split
  const g1 = grp([2, 3], [1, 5]); // keys 3a, 3b
  const game = customGame([g0, g1], null);

  const out = regroup(game, 0);
  const groups = out.players[0].queue.groups;
  // No move, no break. groups = [g0, g1]
  // Split: g0 keys [1,3a] -> [[d0],[d1]]; g1 keys [3a,3b] -> [[d2],[d3]]
  // afterSplit: [[d0,1], [d1,3a], [d2,3a], [d3,3b]]
  // Merge:
  //   [d0] key 1 -> [{1:[d0]}]
  //   [d1] key 3a -> [{1:[d0]}, {3a:[d1]}]
  //   [d2] key 3a -> append: [{1:[d0]}, {3a:[d1,d2]}]
  //   [d3] key 3b -> [{1:[d0]}, {3a:[d1,d2]}, {3b:[d3]}]
  // final: [{1:[d0]}, {3a:[d1,d2]}, {3b:[d3]}] -> ids [0], [1,2], [3]
  assert.strictEqual(groups.length, 3);
  assert.deepStrictEqual(groups[0].dice.map((d) => d.id), [0]);
  assert.deepStrictEqual(groups[1].dice.map((d) => d.id), [1, 2]);
  assert.deepStrictEqual(groups[2].dice.map((d) => d.id), [3]);
});

test("apply returns game.with({players}), last unchanged", () => {
  const game = baseGame("turn");
  const out = apply(game, 0);
  assert.strictEqual(out.last, game.last);
  assert.notStrictEqual(out, game);
  assert.deepStrictEqual(out.players.map((p) => p.seat), [0, 1, 2, 3]);
});

test("apply leaves other players untouched", () => {
  const game = baseGame("turn");
  const out = apply(game, 0);
  assert.strictEqual(out.players[1].queue.groups[0].dice[0].id, 4);
  assert.strictEqual(out.players[2].queue.groups[0].dice[0].id, 8);
  assert.strictEqual(out.players[3].queue.groups[0].dice[0].id, 12);
});
