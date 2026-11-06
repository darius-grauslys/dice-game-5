import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, Last } from "../index.mjs";
import { makePlayers, makeGame } from "./helpers.mjs";

test("with returns a new Game with the patch applied", () => {
  const g = makeGame();
  const last = Last({ action: null, change: "deal", dice: [0], before: [1] });
  const g2 = g.with({ version: 5, last, winner: 2 });
  assert.notStrictEqual(g2, g);
  assert.strictEqual(g2.kind, "game");
  assert.strictEqual(g2.version, 5);
  assert.strictEqual(g2.last, last);
  assert.strictEqual(g2.winner, 2);
  // The untouched fields are the same values as before.
  assert.strictEqual(g2.players, g.players);
  assert.strictEqual(g2.turn, g.turn);
  assert.strictEqual(g2.rng, g.rng);
});

test("with leaves the old Game unchanged", () => {
  const g = makeGame();
  g.with({ turn: 3, winner: 1 });
  assert.strictEqual(g.turn, 0);
  assert.strictEqual(g.winner, null);
  assert.ok(Object.isFrozen(g));
});

test("with runs every check again", () => {
  const g = makeGame();
  assert.throws(() => g.with({ turn: 4 }), /Game\.turn: /);
  assert.throws(() => g.with({ version: -1 }), /Game\.version: /);
  assert.throws(() => g.with({ rng: 4294967296 }), /Game\.rng: /);
  assert.throws(() => g.with({ winner: "2" }), /Game\.winner: /);
  assert.throws(() => g.with({ last: {} }), /Game\.last: /);
  // The invariant runs again: a patched players set that loses a die.
  assert.throws(
    () => g.with({ players: makePlayers().slice(0, 3) }),
    /Game\.players: /,
  );
});

test("with accepts an empty patch and returns a fresh Game", () => {
  const g = makeGame();
  const g2 = g.with({});
  assert.notStrictEqual(g2, g);
  assert.deepStrictEqual(
    Object.keys(g2),
    ["kind", "players", "turn", "version", "rng", "last", "winner", "faces"],
  );
});

test("with rejects an unknown field", () => {
  const g = makeGame();
  assert.throws(() => g.with({ x: 1 }), /Game\.with: unknown field x$/);
});

test("with rejects a non-object patch", () => {
  const g = makeGame();
  for (const patch of [null, 5, "turn", [1]])
    assert.throws(
      () => g.with(patch),
      /Game\.with: /,
      `patch=${JSON.stringify(patch)}`,
    );
});

test("with is non-enumerable", () => {
  const g = makeGame();
  assert.ok(!Object.keys(g).includes("with"));
  assert.ok(!Object.prototype.propertyIsEnumerable.call(g, "with"));
  // It stays out of JSON.stringify...
  assert.ok(!JSON.stringify(g).includes("with"));
  // ...and of deepStrictEqual: two Games with the same fields are equal
  // even though each carries its own `with`.
  const g2 = makeGame();
  assert.deepStrictEqual(g, g2);
  // And it is still callable.
  assert.doesNotThrow(() => g.with({ turn: 1 }));
});
