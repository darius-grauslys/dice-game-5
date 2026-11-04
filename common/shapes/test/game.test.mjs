import { test } from "node:test";
import assert from "node:assert/strict";
import { Die, Group, Queue, Player, Last, Game } from "../index.mjs";
import { die, makePlayers, makeGame } from "./helpers.mjs";

test("Game builds a valid value", () => {
  const players = makePlayers();
  const g = makeGame({ players, turn: 2 });
  assert.deepStrictEqual(Object.keys(g), [
    "kind",
    "players",
    "turn",
    "version",
    "rng",
    "last",
    "winner",
  ]);
  assert.strictEqual(g.kind, "game");
  assert.strictEqual(g.players, players);
  assert.strictEqual(g.turn, 2);
  assert.strictEqual(g.version, 0);
  assert.strictEqual(g.rng, 1);
  assert.strictEqual(g.last, null);
  assert.strictEqual(g.winner, null);
  assert.ok(Object.isFrozen(g));
});

test("Game accepts a non-null last and winner", () => {
  const last = Last({ action: null, change: "deal", dice: [0], before: [1] });
  const g = makeGame({ last, winner: 3 });
  assert.strictEqual(g.last, last);
  assert.strictEqual(g.winner, 3);
});

test("Game's invariant: every die appears exactly once", () => {
  const g = makeGame();
  const seen = [];
  for (const p of g.players)
    for (const group of p.queue.groups)
      for (const d of group.dice) seen.push(d.id);
  assert.deepStrictEqual(seen.sort((a, b) => a - b), [...Array(16).keys()]);
});

test("Game rejects a duplicated die", () => {
  const players = makePlayers();
  // Seat 3 also holds die 0, which seat 0 owns.
  players[3] = Player({
    seat: 3,
    queue: Queue({
      groups: [Group({ dice: [die(0), die(12), die(13), die(14)] })],
    }),
  });
  assert.throws(
    () => makeGame({ players }),
    /Game\.players: die 0 appears twice/,
  );
});

test("Game rejects a missing die", () => {
  const players = makePlayers();
  // Seat 3 keeps only three distinct dice: die 15 is simply absent.
  players[3] = Player({
    seat: 3,
    queue: Queue({
      groups: [Group({ dice: [die(12), die(13), die(14)] })],
    }),
  });
  assert.throws(
    () => makeGame({ players }),
    /Game\.players: die 15 is missing/,
  );
});

test("Game rejects a bad players", () => {
  const players = makePlayers();
  for (const bad of [null, 5, {}, players.slice(0, 3), [...players, players[0]]])
    assert.throws(
      () => makeGame({ players: bad }),
      /Game\.players: /,
      `players=${JSON.stringify(bad)}`,
    );
});

test("Game rejects players out of seat order", () => {
  const players = makePlayers();
  [players[0], players[1]] = [players[1], players[0]];
  assert.throws(() => makeGame({ players }), /Game\.players: /);
});

test("Game rejects a bad turn", () => {
  for (const turn of [4, -1, 1.5, "0", null])
    assert.throws(
      () => makeGame({ turn }),
      /Game\.turn: /,
      `turn=${JSON.stringify(turn)}`,
    );
});

test("Game rejects a bad version", () => {
  for (const version of [-1, 0.5, "1", null])
    assert.throws(
      () => makeGame({ version }),
      /Game\.version: /,
      `version=${JSON.stringify(version)}`,
    );
});

test("Game rejects a bad rng", () => {
  for (const rng of [4294967296, -1, 0.5, "1", null])
    assert.throws(
      () => makeGame({ rng }),
      /Game\.rng: /,
      `rng=${JSON.stringify(rng)}`,
    );
});

test("Game rejects a bad last", () => {
  for (const last of [5, {}, die(0)])
    assert.throws(
      () => makeGame({ last }),
      /Game\.last: /,
      `last=${JSON.stringify(last)}`,
    );
});

test("Game rejects a bad winner", () => {
  for (const winner of [4, -1, "2", true, 1.5])
    assert.throws(
      () => makeGame({ winner }),
      /Game\.winner: /,
      `winner=${JSON.stringify(winner)}`,
    );
});

test("Game rejects missing and unknown fields", () => {
  assert.throws(() => makeGame({ players: undefined }), /Game\.players: /);
  assert.throws(() => makeGame({ turn: undefined }), /Game\.turn: /);
  assert.throws(() => makeGame({ version: undefined }), /Game\.version: /);
  assert.throws(() => makeGame({ rng: undefined }), /Game\.rng: /);
  assert.throws(() => makeGame({ last: undefined }), /Game\.last: /);
  assert.throws(() => makeGame({ winner: undefined }), /Game\.winner: /);
  assert.throws(
    () => makeGame({ extra: 1 }),
    /Game\.extra: unknown field$/,
  );
});

test("Game's value is deeply frozen", () => {
  const g = makeGame();
  assert.throws(() => { g.turn = 1; }, TypeError);
  assert.throws(() => { g.players.push(Player({ seat: 4, queue: Queue({ groups: [] }) })); }, TypeError);
});
