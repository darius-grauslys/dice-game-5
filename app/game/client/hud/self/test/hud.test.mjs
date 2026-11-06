import { test } from "node:test";
import assert from "node:assert/strict";
import { near, rank } from "../index.mjs";
import { Die, Group, Queue, Player, Game } from "../../../../../../common/index.mjs";

const mk = (seat, groups) =>
  Player({ seat, queue: Queue({ groups: groups.map((g) => Group({ dice: g.map(([id, o]) => Die({ id, o })) })) }) });

const others = [
  mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
  mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]),
  mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]),
];

const at = (groups) => Game({ players: [mk(0, groups), ...others], turn: 0, version: 1, rng: 7, last: null, winner: null });

// ---- near tests ----

test("near: 3 alike + 1", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0], [2, 0]], [[3, 7]]]), 0), true);
});

test("near: 1 + 3 alike", () => {
  assert.strictEqual(near(at([[[3, 7]], [[0, 0], [1, 0], [2, 0]]]), 0), true);
});

test("near: 3 same key, not alike + 1", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 9], [2, 0]], [[3, 7]]]), 0), false);
});

test("near: 2 + 2, an x turn apart", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0]], [[2, 2], [3, 2]]]), 0), true);
});

test("near: 2 + 2, two x turns apart", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0]], [[2, 3], [3, 3]]]), 0), true);
});

test("near: 2 + 2, not x turns apart", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0]], [[2, 4], [3, 4]]]), 0), false);
});

test("near: 2 + 1 + 1", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0]], [[2, 0]], [[3, 0]]]), 0), false);
});

test("near: 4 singles", () => {
  assert.strictEqual(near(at([[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]), 0), false);
});

test("near: one group of 4: 3 the same o, 1 a half turn off", () => {
  assert.strictEqual(near(at([[[2, 0], [3, 20], [0, 0], [1, 0]]]), 0), true);
});

test("near: one group of 4: 3 the same o, 1 a quarter turn off", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0], [2, 9], [3, 0]]]), 0), true);
});

test("near: one group of 4: 2 and 2", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0], [2, 9], [3, 9]]]), 0), false);
});

test("near: one group of 4: all the same o (a win)", () => {
  assert.strictEqual(near(at([[[0, 0], [1, 0], [2, 0], [3, 0]]]), 0), false);
});

test("near: seats 1..3 are false (four single dice)", () => {
  const g = at([[[0, 0], [1, 0], [2, 0]], [[3, 7]]]);
  assert.strictEqual(near(g, 1), false);
  assert.strictEqual(near(g, 2), false);
  assert.strictEqual(near(g, 3), false);
});

// ---- rank tests (golden values) ----

test("rank: golden value 1 (layout fixture, winner 2)", () => {
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [Die({ id: 0, o: 0 }), Die({ id: 1, o: 0 }) ] }), Group({ dice: [Die({ id: 2, o: 5 }) ] }), Group({ dice: [Die({ id: 3, o: 1 }) ] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [Die({ id: 4, o: 0 }) ] }), Group({ dice: [Die({ id: 5, o: 0 }) ] }), Group({ dice: [Die({ id: 6, o: 0 }) ] }), Group({ dice: [Die({ id: 7, o: 0 }) ] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [Die({ id: 8, o: 0 }), Die({ id: 9, o: 0 }), Die({ id: 10, o: 0 }), Die({ id: 11, o: 0 }) ] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [Die({ id: 12, o: 0 }) ] }), Group({ dice: [Die({ id: 13, o: 0 }) ] }), Group({ dice: [Die({ id: 14, o: 0 }) ] }), Group({ dice: [Die({ id: 15, o: 2 }) ] })] }) }),
  ];
  const g = Game({ players, turn: 2, version: 3, rng: 7, last: null, winner: 2 });
  assert.deepStrictEqual(rank(g), [
    { seat: 2, rank: 1, largest: 4, groups: 1 },
    { seat: 0, rank: 2, largest: 2, groups: 1 },
    { seat: 1, rank: 3, largest: 1, groups: 0 },
    { seat: 3, rank: 3, largest: 1, groups: 0 },
  ]);
});

test("rank: tie scenario", () => {
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [Die({ id: 0, o: 1 }), Die({ id: 2, o: 3 }) ] }), Group({ dice: [Die({ id: 1, o: 1 }), Die({ id: 3, o: 3 }) ] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [Die({ id: 4, o: 5 }), Die({ id: 6, o: 7 }) ] }), Group({ dice: [Die({ id: 5, o: 5 }), Die({ id: 7, o: 7 }) ] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [Die({ id: 8, o: 9 }), Die({ id: 9, o: 9 }), Die({ id: 10, o: 9 }), Die({ id: 11, o: 9 }) ] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [Die({ id: 12, o: 13 }), Die({ id: 13, o: 13 }), Die({ id: 14, o: 13 }) ] }), Group({ dice: [Die({ id: 15, o: 0 }) ] })] }) }),
  ];
  const g = Game({ players, turn: 0, version: 1, rng: 7, last: null, winner: null });
  assert.deepStrictEqual(rank(g), [
    { seat: 2, rank: 1, largest: 4, groups: 1 },
    { seat: 3, rank: 2, largest: 3, groups: 1 },
    { seat: 0, rank: 3, largest: 2, groups: 2 },
    { seat: 1, rank: 3, largest: 2, groups: 2 },
  ]);
});
