import { test } from "node:test";
import assert from "node:assert/strict";

import { tracks } from "../index.mjs";

function pose(id, owner, group, slot, position, matrix) {
  const p = { id, owner, group, slot, position, matrix };
  for (const key of Object.getOwnPropertyNames(p)) {
    const v = p[key];
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        if (Array.isArray(v[i])) {
          for (let j = 0; j < v[i].length; j++) v[i][j] = v[i][j] + 0;
        } else {
          v[i] = v[i] + 0;
        }
      }
      Object.freeze(v);
    }
  }
  Object.freeze(p);
  return p;
}

// prev layout for the fixture game
const prev = [
  pose(0, 0, 0, 0, [-2.375, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
  pose(1, 0, 0, 1, [-1.125, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
  pose(2, 0, 1, 2, [0.625, 0.5, 4], [[0, 1, 0], [0, 0, 1], [1, 0, 0]]),
  pose(3, 0, 2, 3, [2.375, 0.5, 4], [[1, 0, 0], [0, 0, 1], [0, -1, 0]]),
  pose(4, 1, 0, 0, [4, 0.5, 2.625], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(5, 1, 1, 1, [4, 0.5, 0.875], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(6, 1, 2, 2, [4, 0.5, -0.875], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(7, 1, 3, 3, [4, 0.5, -2.625], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(8, 2, 0, 0, [1.875, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(9, 2, 0, 1, [0.625, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(10, 2, 0, 2, [-0.625, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(11, 2, 0, 3, [-1.875, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(12, 3, 0, 0, [-4, 0.5, -2.625], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]),
  pose(13, 3, 1, 1, [-4, 0.5, -0.875], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]),
  pose(14, 3, 2, 2, [-4, 0.5, 0.875], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]),
  pose(15, 3, 3, 3, [-4, 0.5, 2.625], [[0, -1, 0], [0, 0, -1], [1, 0, 0]]),
];

// next layout after seat 0 turned die 3 (o:1) about x,1 and settled it leftmost
// player order 0..3, each player's dice in queue order: p0: [3],[0,1],[2] -> 3,0,1,2
const next = [
  pose(3, 0, 0, 0, [-2.375, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
  pose(0, 0, 1, 1, [-0.625, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
  pose(1, 0, 1, 2, [0.625, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
  pose(2, 0, 2, 3, [2.375, 0.5, 4], [[0, 1, 0], [0, 0, 1], [1, 0, 0]]),
  pose(4, 1, 0, 0, [4, 0.5, 2.625], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(5, 1, 1, 1, [4, 0.5, 0.875], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(6, 1, 2, 2, [4, 0.5, -0.875], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(7, 1, 3, 3, [4, 0.5, -2.625], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
  pose(8, 2, 0, 0, [1.875, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(9, 2, 0, 1, [0.625, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(10, 2, 0, 2, [-0.625, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(11, 2, 0, 3, [-1.875, 0.5, -4], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
  pose(12, 3, 0, 0, [-4, 0.5, -2.625], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]),
  pose(13, 3, 1, 1, [-4, 0.5, -0.875], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]),
  pose(14, 3, 2, 2, [-4, 0.5, 0.875], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]),
  pose(15, 3, 3, 3, [-4, 0.5, 2.625], [[0, -1, 0], [0, 0, -1], [1, 0, 0]]),
];

const last = {
  kind: "last",
  action: {
    kind: "action",
    id: "0:3",
    seat: 0,
    move: "turn",
    axis: "x",
    dir: 1,
    version: 3,
  },
  change: "turn",
  dice: [3],
  before: [1],
};

test("tracks returns exactly the 4 golden tracks for a turn+settle", () => {
  const t = tracks(prev, next, last);
  assert.strictEqual(t.length, 4);

  // next order: 3, 0, 1, 2, 4... so tracks are in order id 3, 0, 1, 2
  assert.deepStrictEqual(
    t[0],
    {
      id: 3,
      kind: "turn",
      from: prev[3],
      to: next[0],
      delay: 0,
      ms: 250,
      spin: 0,
    },
  );
  assert.deepStrictEqual(t[0].from.position, [2.375, 0.5, 4]);
  assert.deepStrictEqual(t[0].to.position, [-2.375, 0.5, 4]);

  assert.deepStrictEqual(
    t[1],
    {
      id: 0,
      kind: "move",
      from: prev[0],
      to: next[1],
      delay: 250,
      ms: 300,
      spin: 0,
    },
  );
  assert.deepStrictEqual(t[1].from.position, [-2.375, 0.5, 4]);
  assert.deepStrictEqual(t[1].to.position, [-0.625, 0.5, 4]);

  assert.deepStrictEqual(
    t[2],
    {
      id: 1,
      kind: "move",
      from: prev[1],
      to: next[2],
      delay: 250,
      ms: 300,
      spin: 0,
    },
  );
  assert.deepStrictEqual(t[2].from.position, [-1.125, 0.5, 4]);
  assert.deepStrictEqual(t[2].to.position, [0.625, 0.5, 4]);

  assert.deepStrictEqual(
    t[3],
    {
      id: 2,
      kind: "move",
      from: prev[2],
      to: next[3],
      delay: 250,
      ms: 300,
      spin: 0,
    },
  );
  assert.deepStrictEqual(t[3].from.position, [0.625, 0.5, 4]);
  assert.deepStrictEqual(t[3].to.position, [2.375, 0.5, 4]);

  for (const tr of t) assert.ok(Object.isFrozen(tr));
});

test("tracks skips dice whose position and matrix are unchanged", () => {
  // only die 3 changes; the rest keep identical prev/next poses
  const t = tracks(prev, prev, null);
  assert.strictEqual(t.length, 0);
});

test("tracks with last.change === 'roll' gives move delay MS.roll", () => {
  const rollLast = {
    kind: "last",
    action: {
      kind: "action",
      id: "0:3",
      seat: 0,
      move: "roll",
      axis: null,
      dir: null,
      version: 3,
    },
    change: "roll",
    dice: [],
    before: [],
  };
  const t = tracks(prev, next, rollLast);
  for (const tr of t) {
    if (tr.kind === "move") assert.strictEqual(tr.delay, 600);
  }
});

test("tracks with last === null gives move delay 0", () => {
  const t = tracks(prev, next, null);
  for (const tr of t) {
    assert.strictEqual(tr.delay, 0);
    assert.strictEqual(tr.kind, "move");
  }
});

test("tracks with last.change === 'deal' gives ms 600 and spin 2 for moved dice", () => {
  const dealLast = {
    kind: "last",
    action: null,
    change: "deal",
    dice: [0, 1, 2, 3],
    before: [0, 0, 0, 0],
  };
  const t = tracks(prev, next, dealLast);
  for (const tr of t) {
    assert.strictEqual(tr.kind, "deal");
    assert.strictEqual(tr.ms, 600);
    assert.strictEqual(tr.spin, 2);
    assert.strictEqual(tr.delay, 0);
  }
});
