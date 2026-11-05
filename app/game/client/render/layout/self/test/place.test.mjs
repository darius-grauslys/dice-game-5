import { test } from "node:test";
import assert from "node:assert/strict";
import { place } from "../index.mjs";
import { Die, Group, Queue, Player, Game } from "../../../../../../../common/index.mjs";

const mk = (seat, groups) =>
  Player({
    seat,
    queue: Queue({
      groups: groups.map((g) =>
        Group({ dice: g.map(([id, o]) => Die({ id, o })) }),
      ),
    }),
  });

const game = Game({
  players: [
    mk(0, [[[0, 0], [1, 0]], [[2, 5]], [[3, 1]]]),
    mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
    mk(2, [[[8, 0], [9, 0], [10, 0], [11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 2]]]),
  ],
  turn: 0,
  version: 3,
  rng: 7,
  last: null,
  winner: null,
});

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

test("place returns 16 poses, players 0..3 in order", () => {
  const poses = place(game);
  assert.strictEqual(poses.length, 16);
  for (let i = 0; i < 16; i++) {
    assert.strictEqual(poses[i].id, i);
    assert.ok(Object.isFrozen(poses[i]));
    assert.ok(Object.isFrozen(poses[i].position));
    assert.ok(Object.isFrozen(poses[i].matrix));
  }
});

test("seat 0's poses", () => {
  const poses = place(game);
  assert.deepStrictEqual(poses[0], {
    id: 0,
    owner: 0,
    group: 0,
    slot: 0,
    position: [-2.375, 0.5, 4],
    matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  });
  assert.deepStrictEqual(poses[1], {
    id: 1,
    owner: 0,
    group: 0,
    slot: 1,
    position: [-1.125, 0.5, 4],
    matrix: IDENTITY,
  });
  assert.deepStrictEqual(poses[2], {
    id: 2,
    owner: 0,
    group: 1,
    slot: 2,
    position: [0.625, 0.5, 4],
    matrix: [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  });
  assert.deepStrictEqual(poses[3], {
    id: 3,
    owner: 0,
    group: 2,
    slot: 3,
    position: [2.375, 0.5, 4],
    matrix: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  });
});

test("die 4's pose", () => {
  const poses = place(game);
  assert.deepStrictEqual(poses[4], {
    id: 4,
    owner: 1,
    group: 0,
    slot: 0,
    position: [4, 0.5, 2.625],
    matrix: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  });
});

test("die 8's pose", () => {
  const poses = place(game);
  assert.deepStrictEqual(poses[8], {
    id: 8,
    owner: 2,
    group: 0,
    slot: 0,
    position: [1.875, 0.5, -4],
    matrix: [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
  });
});

test("die 12's pose", () => {
  const poses = place(game);
  assert.deepStrictEqual(poses[12], {
    id: 12,
    owner: 3,
    group: 0,
    slot: 0,
    position: [-4, 0.5, -2.625],
    matrix: [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  });
});

test("die 15's pose", () => {
  const poses = place(game);
  assert.deepStrictEqual(poses[15], {
    id: 15,
    owner: 3,
    group: 3,
    slot: 3,
    position: [-4, 0.5, 2.625],
    matrix: [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
  });
});
