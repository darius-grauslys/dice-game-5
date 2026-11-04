import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../index.mjs";
import { Game, Player, Queue, Group, Die, Action, TURN } from "../../../../../../common/index.mjs";
import { makeGame, makePlayers, die } from "../../../../../../common/shapes/test/helpers.mjs";

test("apply turns the rightmost group's dice", () => {
  const game = makeGame();
  const action = Action({ id: "t1", seat: 0, move: "turn", axis: "z", dir: 1, version: 1 });

  const piece = game.players[0].queue.groups[game.players[0].queue.groups.length - 1];
  const beforeIds = piece.dice.map((d) => d.id);
  const beforeOs = piece.dice.map((d) => d.o);

  const result = apply(game, action);

  // Only player 0's queue changed; other players are the same references.
  assert.strictEqual(result.players[0].seat, 0);
  assert.notStrictEqual(result.players[0].queue, game.players[0].queue);
  for (let s = 1; s < 4; s++) {
    assert.strictEqual(result.players[s], game.players[s]);
  }

  // The last group's dice were turned; ids preserved, orientations updated.
  const newPiece = result.players[0].queue.groups[result.players[0].queue.groups.length - 1];
  const newDice = newPiece.dice;
  assert.strictEqual(newDice.length, 4);
  for (let i = 0; i < 4; i++) {
    const d = newDice[i];
    const expectedO = TURN[beforeOs[i]][action.axis][String(action.dir)];
    assert.strictEqual(d.id, beforeIds[i]);
    assert.strictEqual(d.o, expectedO);
  }

  // last is set correctly
  assert.strictEqual(result.last.kind, "last");
  assert.strictEqual(result.last.action, action);
  assert.strictEqual(result.last.change, "turn");
  assert.deepStrictEqual(result.last.dice, beforeIds);
  assert.deepStrictEqual(result.last.before, beforeOs);

  // game.with returns a new Game; the old one is untouched.
  assert.notStrictEqual(result, game);
  assert.strictEqual(game.players[0].queue.groups[0].dice[0].o, 0);
});

test("apply works for all seats and axes/dirs", () => {
  for (const seat of [0, 1, 2, 3]) {
    const game = makeGame({ turn: seat });
    for (const axis of ["x", "y", "z"]) {
      for (const dir of [1, -1]) {
        const action = Action({ id: "t", seat, move: "turn", axis, dir, version: 1 });
        const piece = game.players[seat].queue.groups[game.players[seat].queue.groups.length - 1];
        const beforeOs = piece.dice.map((d) => d.o);
        const result = apply(game, action);
        const newPiece = result.players[seat].queue.groups[result.players[seat].queue.groups.length - 1];
        for (let i = 0; i < 4; i++) {
          const d = newPiece.dice[i];
          assert.strictEqual(d.o, TURN[beforeOs[i]][axis][String(dir)]);
        }
        assert.strictEqual(result.last.change, "turn");
        assert.strictEqual(result.last.action, action);
      }
    }
  }
});

test("apply preserves group count (single group stays single)", () => {
  const game = makeGame();
  const action = Action({ id: "t1", seat: 0, move: "turn", axis: "x", dir: 1, version: 1 });
  const result = apply(game, action);
  assert.strictEqual(result.players[0].queue.groups.length, 1);
});

test("apply preserves a multi-group queue shape (moves only the last group)", () => {
  const players = makePlayers();
  // Seat 0 has two groups: [die0], [die1, die2, die3].
  players[0] = Player({
    seat: 0,
    queue: Queue({
      groups: [
        Group({ dice: [die(0)] }),
        Group({ dice: [die(1), die(2), die(3)] }),
      ],
    }),
  });
  const game = makeGame({ players });

  const action = Action({ id: "t1", seat: 0, move: "turn", axis: "y", dir: -1, version: 1 });
  const result = apply(game, action);

  // First group untouched.
  assert.strictEqual(result.players[0].queue.groups.length, 2);
  assert.strictEqual(result.players[0].queue.groups[0].dice.length, 1);
  assert.strictEqual(result.players[0].queue.groups[0].dice[0].id, 0);
  assert.strictEqual(result.players[0].queue.groups[0].dice[0].o, 0);

  // Last group turned.
  const lastGroup = result.players[0].queue.groups[1];
  assert.strictEqual(lastGroup.dice.length, 3);
  assert.deepStrictEqual(lastGroup.dice.map((d) => d.id), [1, 2, 3]);
  const beforeOs = [die(1).o, die(2).o, die(3).o];
  for (let i = 0; i < 3; i++) {
    assert.strictEqual(lastGroup.dice[i].o, TURN[beforeOs[i]]["y"]["-1"]);
  }

  assert.deepStrictEqual(result.last.dice, [1, 2, 3]);
  assert.deepStrictEqual(result.last.before, beforeOs);
});
