import { test } from "node:test";
import assert from "node:assert/strict";

import { Game } from "../../../../../../common/index.mjs";
import {
  makePlayers,
} from "../../../../../../common/shapes/test/helpers.mjs";

import { preview } from "../index.mjs";

function gameWithTurn(seat, version = 0, winner = null) {
  const players = makePlayers();
  return Game({
    players,
    turn: seat,
    version,
    rng: 1,
    last: null,
    winner,
  });
}

test("preview: null when game is null", () => {
  const drag = { at: { x: 0, y: 20 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 3 };
  assert.strictEqual(preview(drag, hit, null, 0), null);
});

test("preview: null when game.winner !== null", () => {
  const game = gameWithTurn(0, 0, 3);
  const drag = { at: { x: 0, y: 20 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 3 };
  assert.strictEqual(preview(drag, hit, game, 0), null);
});

test("preview: null when game.turn !== seat", () => {
  const game = gameWithTurn(1, 0, null);
  const drag = { at: { x: 0, y: 20 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 3 };
  assert.strictEqual(preview(drag, hit, game, 0), null);
});

test("preview: null unless hit is a die in the rightmost group", () => {
  const game = gameWithTurn(0, 0, null);
  const drag = { at: { x: 0, y: 20 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 7 }; // die 7 belongs to seat 1
  assert.strictEqual(preview(drag, hit, game, 0), null);
});

test("preview: null if drag distance < DRAG_MIN", () => {
  const game = gameWithTurn(0, 0, null);
  const drag = { at: { x: 0, y: 0 }, to: { x: 5, y: 5 } };
  const hit = { kind: "die", id: 3 };
  assert.strictEqual(preview(drag, hit, game, 0), null);
});

test("preview: returns ids, axis, dir for a valid up-right drag", () => {
  const game = gameWithTurn(0, 0, null);
  // drag up-right: at (0,20) to (20,0) -> dx=20, dy=-20 -> a=45, k=1 -> axis "x", dir -1
  const drag = { at: { x: 0, y: 20 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 3 };
  const p = preview(drag, hit, game, 0);
  assert.ok(p);
  assert.deepStrictEqual(p.ids, [0, 1, 2, 3]);
  assert.strictEqual(p.axis, "x");
  assert.strictEqual(p.dir, -1);
});

test("preview: null for >1-die group with axis y (drag right)", () => {
  const game = gameWithTurn(0, 0, null);
  // drag right: at (0,0) to (20,0) -> dx=20, dy=0 -> a=0, k=0 -> axis "y"
  const drag = { at: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 3 };
  assert.strictEqual(preview(drag, hit, game, 0), null);
});
