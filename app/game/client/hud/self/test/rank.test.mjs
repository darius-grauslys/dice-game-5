import { test } from "node:test";
import assert from "node:assert/strict";
import { rank } from "../index.mjs";
import { Die, Group, Queue, Player, Game } from "../../../../../../common/index.mjs";

function die(id, o = 0) {
  return Die({ id, o });
}

function game(players, winner = null) {
  return Game({ players, turn: 0, version: 0, rng: 1, last: null, winner });
}

test("rank: golden value 1 (layout fixture, winner 2)", () => {
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0), die(1)] }), Group({ dice: [die(2)] }), Group({ dice: [die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4)] }), Group({ dice: [die(5)] }), Group({ dice: [die(6)] }), Group({ dice: [die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12)] }), Group({ dice: [die(13)] }), Group({ dice: [die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  const g = game(players, 2);
  assert.deepStrictEqual(rank(g), [
    { seat: 2, rank: 1, largest: 4, groups: 1 },
    { seat: 0, rank: 2, largest: 2, groups: 1 },
    { seat: 1, rank: 3, largest: 1, groups: 0 },
    { seat: 3, rank: 3, largest: 1, groups: 0 },
  ]);
});

test("rank: tie scenario", () => {
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0), die(1)] }), Group({ dice: [die(2), die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4), die(5)] }), Group({ dice: [die(6), die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12), die(13), die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  const g = game(players, null);
  assert.deepStrictEqual(rank(g), [
    { seat: 2, rank: 1, largest: 4, groups: 1 },
    { seat: 3, rank: 2, largest: 3, groups: 1 },
    { seat: 0, rank: 3, largest: 2, groups: 2 },
    { seat: 1, rank: 3, largest: 2, groups: 2 },
  ]);
});

test("rank: all singletons -> all rank 1", () => {
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0)] }), Group({ dice: [die(1)] }), Group({ dice: [die(2)] }), Group({ dice: [die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4)] }), Group({ dice: [die(5)] }), Group({ dice: [die(6)] }), Group({ dice: [die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8)] }), Group({ dice: [die(9)] }), Group({ dice: [die(10)] }), Group({ dice: [die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12)] }), Group({ dice: [die(13)] }), Group({ dice: [die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  const g = game(players, null);
  const r = rank(g);
  for (const row of r) assert.strictEqual(row.rank, 1);
  assert.strictEqual(r[0].seat, 0);
  assert.strictEqual(r[1].seat, 1);
  assert.strictEqual(r[2].seat, 2);
  assert.strictEqual(r[3].seat, 3);
});

test("rank: returns fresh objects", () => {
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0), die(1)] }), Group({ dice: [die(2)] }), Group({ dice: [die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4)] }), Group({ dice: [die(5)] }), Group({ dice: [die(6)] }), Group({ dice: [die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12)] }), Group({ dice: [die(13)] }), Group({ dice: [die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  const g = game(players, null);
  const a = rank(g);
  const b = rank(g);
  assert.notStrictEqual(a, b);
  for (let i = 0; i < 4; i++) assert.notStrictEqual(a[i], b[i]);
});
