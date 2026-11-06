import { test } from "node:test";
import assert from "node:assert/strict";
import { place, labels } from "../index.mjs";
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
    mk(3, [[[12, 0], [13, 0], [14, 0]], [[15, 2]]]),
  ],
  turn: 0,
  version: 3,
  rng: 7,
  last: null,
  winner: null,
});

function approxEqual(a, b, eps = 1e-6) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!approxEqual(a[i], b[i], eps)) return false;
    }
    return true;
  }
  if (typeof a === "number") {
    return Math.abs(a - b) <= eps;
  }
  return a === b;
}

function assertPose(poses, id, expected) {
  const pose = poses.find((p) => p.id === id);
  assert.ok(pose, `pose for die ${id} exists`);
  assert.strictEqual(pose.owner, expected.owner);
  assert.strictEqual(pose.group, expected.group);
  assert.strictEqual(pose.slot, expected.slot);
  assert.ok(approxEqual(pose.position, expected.position), `position for die ${id}`);
  assert.ok(approxEqual(pose.matrix, expected.matrix), `matrix for die ${id}`);
}

function assertLabel(ls, owner, expectedPos) {
  const entry = ls.find((e) => e.owner === owner);
  assert.ok(entry, `label for owner ${owner} exists`);
  assert.ok(approxEqual(entry.position, expectedPos), `position for label owner ${owner}`);
}

test("place returns 16 poses, players 0..3 in order", () => {
  const poses = place(game, 0);
  assert.strictEqual(poses.length, 16);
  for (let i = 0; i < 16; i++) {
    assert.strictEqual(poses[i].id, i);
    assert.strictEqual(poses[i].owner, Math.floor(i / 4));
    assert.ok(Object.isFrozen(poses[i]));
    assert.ok(Object.isFrozen(poses[i].position));
    assert.ok(Object.isFrozen(poses[i].matrix));
  }
});

test("seat 0's poses, seen by seat 0", () => {
  const poses = place(game, 0);
  assertPose(poses, 0, {
    owner: 0, group: 0, slot: 0,
    position: [-2.275, 0.5, 4.6],
    matrix: [[0.707107, 0, -0.707107], [0, 1, 0], [0.707107, 0, 0.707107]],
  });
  assertPose(poses, 1, {
    owner: 0, group: 0, slot: 1,
    position: [-1.225, 0.5, 5.65],
    matrix: [[0.707107, 0, -0.707107], [0, 1, 0], [0.707107, 0, 0.707107]],
  });
  assertPose(poses, 2, {
    owner: 0, group: 1, slot: 2,
    position: [0.525, 0.5, 4.6],
    matrix: [[-0.707107, 0.707107, 0], [0, 0, 1], [0.707107, 0.707107, 0]],
  });
  assertPose(poses, 3, {
    owner: 0, group: 2, slot: 3,
    position: [2.275, 0.5, 4.6],
    matrix: [[0.707107, 0.707107, 0], [0, 0, 1], [0.707107, -0.707107, 0]],
  });
});

test("others seen by seat 0", () => {
  const poses = place(game, 0);
  assertPose(poses, 4, {
    owner: 1, group: 0, slot: 0,
    position: [4.6, 0.5, 2.625],
    matrix: [[-0.43073, 0, 0.902481], [0, 1, 0], [-0.902481, 0, -0.43073]],
  });
  assertPose(poses, 8, {
    owner: 2, group: 0, slot: 0,
    position: [1.575, 0.5, -4.6],
    matrix: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]],
  });
  assertPose(poses, 9, {
    owner: 2, group: 0, slot: 1,
    position: [0.525, 0.5, -5.65],
    matrix: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]],
  });
  assertPose(poses, 10, {
    owner: 2, group: 0, slot: 2,
    position: [-0.525, 0.5, -6.7],
    matrix: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]],
  });
  assertPose(poses, 11, {
    owner: 2, group: 0, slot: 3,
    position: [-1.575, 0.5, -7.75],
    matrix: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]],
  });
  assertPose(poses, 12, {
    owner: 3, group: 0, slot: 0,
    position: [-4.6, 0.5, -1.925],
    matrix: [[-0.902481, 0, 0.43073], [0, 1, 0], [-0.43073, 0, -0.902481]],
  });
  assertPose(poses, 13, {
    owner: 3, group: 0, slot: 1,
    position: [-5.65, 0.5, -0.875],
    matrix: [[-0.902481, 0, 0.43073], [0, 1, 0], [-0.43073, 0, -0.902481]],
  });
  assertPose(poses, 14, {
    owner: 3, group: 0, slot: 2,
    position: [-6.7, 0.5, 0.175],
    matrix: [[-0.902481, 0, 0.43073], [0, 1, 0], [-0.43073, 0, -0.902481]],
  });
  assertPose(poses, 15, {
    owner: 3, group: 1, slot: 3,
    position: [-4.6, 0.5, 1.925],
    matrix: [[-0.902481, 0.43073, 0], [0, 0, -1], [-0.43073, -0.902481, 0]],
  });
});

test("seat 1's own dice, seen by seat 1", () => {
  const poses = place(game, 1);
  assertPose(poses, 4, {
    owner: 1, group: 0, slot: 0,
    position: [4.6, 0.5, 2.625],
    matrix: [[0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, 0.707107]],
  });
});

test("labels(0)", () => {
  const ls = labels(0);
  assertLabel(ls, 0, [0, 1.5, 8.7]);
  assertLabel(ls, 1, [6.9, 1.5, 0]);
  assertLabel(ls, 2, [0, 1.5, -8.8]);
  assertLabel(ls, 3, [-6.9, 1.5, 0]);
});

test("labels(1)", () => {
  const ls = labels(1);
  assertLabel(ls, 0, [0, 1.5, 6.9]);
  assertLabel(ls, 1, [8.7, 1.5, 0]);
  assertLabel(ls, 2, [0, 1.5, -6.9]);
  assertLabel(ls, 3, [-8.8, 1.5, 0]);
});
