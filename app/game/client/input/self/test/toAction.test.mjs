import { test } from "node:test";
import assert from "node:assert/strict";

import { Game } from "../../../../../../common/index.mjs";
import {
  makePlayers,
} from "../../../../../../common/shapes/test/helpers.mjs";

import { toAction } from "../index.mjs";

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

test("toAction: null when game is null", () => {
  const gesture = { kind: "press", at: { x: 0, y: 0 } };
  const hit = { kind: "roll" };
  assert.strictEqual(toAction(gesture, hit, null, 0), null);
});

test("toAction: null when game.winner !== null", () => {
  const game = gameWithTurn(0, 0, 3);
  const gesture = { kind: "press", at: { x: 0, y: 0 } };
  const hit = { kind: "roll" };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: null when game.turn !== seat", () => {
  const game = gameWithTurn(1, 0, null);
  const gesture = { kind: "press", at: { x: 0, y: 0 } };
  const hit = { kind: "roll" };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: roll gesture returns a roll action with correct id and version", () => {
  const game = gameWithTurn(2, 5, null);
  const gesture = { kind: "roll" };
  const hit = { kind: "roll" }; // ignored for a roll gesture
  const action = toAction(gesture, hit, game, 2);
  assert.ok(action);
  assert.strictEqual(action.kind, "action");
  assert.strictEqual(action.id, "2:5");
  assert.strictEqual(action.seat, 2);
  assert.strictEqual(action.move, "roll");
  assert.strictEqual(action.axis, null);
  assert.strictEqual(action.dir, null);
  assert.strictEqual(action.version, 5);
});

test("toAction: press gesture returns null", () => {
  const game = gameWithTurn(0, 0, null);
  const gesture = { kind: "press", at: { x: 10, y: 10 } };
  const hit = { kind: "roll" };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: drag on a die of the rightmost group returns a turn action", () => {
  const game = gameWithTurn(0, 3, null);
  // rightmost group of seat 0's queue: dice [0,1,2,3]; drag up-right gives axis "x"
  const gesture = { kind: "drag", at: { x: 0, y: 20 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 3 };
  const action = toAction(gesture, hit, game, 0);
  assert.ok(action);
  assert.strictEqual(action.kind, "action");
  assert.strictEqual(action.id, "0:3");
  assert.strictEqual(action.seat, 0);
  assert.strictEqual(action.move, "turn");
  assert.strictEqual(action.version, 3);
  assert.strictEqual(action.axis, "x");
  assert.strictEqual(action.dir, -1);
});

test("toAction: drag with insufficient distance returns null", () => {
  const game = gameWithTurn(0, 0, null);
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 5, y: 0 } };
  const hit = { kind: "die", id: 3 };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: drag on a die not in the rightmost group returns null", () => {
  const game = gameWithTurn(0, 0, null);
  const gesture = { kind: "drag", at: { x: 0, y: 20 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 7 }; // die 7 belongs to seat 1
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: drag of a >1-die group with axis y returns null", () => {
  const game = gameWithTurn(0, 0, null);
  // drag right: sector 0 -> axis "y"; a group of >1 die turns only about its row (axis x)
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  const hit = { kind: "die", id: 3 };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});
