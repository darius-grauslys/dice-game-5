import * as real from "../../edges/server/server_to_turn.mjs";
import {
  Die,
  Group,
  Queue,
  Player,
  Game,
  Action,
  Last,
  TURN,
  ORIENTATIONS,
  Rng,
} from "../../common/index.mjs";

// apply: a drop-in wrapper around the real turn's apply.
export function apply(game, action) {
  // A) check its arguments against the doc, and throw an Error naming the function if they're wrong;
  if (!(game && typeof game === "object" && game.kind === "game")) {
    throw new Error("apply: game must be a Game");
  }
  if (!(action && typeof action === "object" && action.kind === "action")) {
    throw new Error("apply: action must be an Action");
  }
  if (action.move !== "turn") {
    throw new Error("apply: action.move must be 'turn'");
  }

  // B) call the function through the edge;
  const result = real.apply(game, action);

  // C) check that it returned;
  if (result === undefined) {
    throw new Error("apply: did not return a value");
  }

  // D) check the return value against the doc (shape and content, as far as the doc says).
  if (!(result && typeof result === "object" && result.kind === "game")) {
    throw new Error("apply: return value must be a Game");
  }
  if (!(result.last && result.last.kind === "last")) {
    throw new Error("apply: return game must have a last");
  }
  if (result.last.change !== "turn") {
    throw new Error("apply: last.change must be 'turn'");
  }
  if (result.last.action !== action) {
    throw new Error("apply: last.action must be the action");
  }

  return result;
}

export async function _sheo_check() {
  const assert = (await import("node:assert/strict")).default;

  // Build a realistic game using common's constructors and Rng.
  const seed = Rng.seed(42);
  const rng = Rng.next(seed)[0];

  // 4 players. seat 2 (the actor) has a queue with two groups; the piece is
  // the last (rightmost) Group in game.players[2].queue.groups.
  const players = [
    Player({
      seat: 0,
      queue: Queue({
        groups: [
          Group({
            dice: [
              Die({ id: 0, o: 0 }),
              Die({ id: 1, o: 1 }),
              Die({ id: 2, o: 2 }),
              Die({ id: 3, o: 3 }),
            ],
          }),
        ],
      }),
    }),
    Player({
      seat: 1,
      queue: Queue({
        groups: [
          Group({
            dice: [
              Die({ id: 4, o: 4 }),
              Die({ id: 5, o: 5 }),
              Die({ id: 6, o: 6 }),
              Die({ id: 7, o: 7 }),
            ],
          }),
        ],
      }),
    }),
    Player({
      seat: 2,
      queue: Queue({
        groups: [
          Group({ dice: [Die({ id: 8, o: 8 }), Die({ id: 9, o: 9 })] }),
          Group({
            dice: [
              Die({ id: 10, o: 10 }),
              Die({ id: 11, o: 11 }),
              Die({ id: 12, o: 12 }),
              Die({ id: 13, o: 13 }),
            ],
          }),
        ],
      }),
    }),
    Player({
      seat: 3,
      queue: Queue({
        groups: [
          Group({ dice: [Die({ id: 14, o: 14 }), Die({ id: 15, o: 15 })] }),
        ],
      }),
    }),
  ];

  const game = Game({ players, turn: 2, version: 5, rng, last: null, winner: null });

  const seat = 2;
  const piece = game.players[seat].queue.groups[
    game.players[seat].queue.groups.length - 1
  ];
  const dieIds = piece.dice.map((d) => d.id); // [10, 11, 12, 13]
  const oldOs = piece.dice.map((d) => d.o); // [10, 11, 12, 13]

  // A turn of the piece: axis "x", dir 1.
  const action = Action({ id: "a1", seat, move: "turn", axis: "x", dir: 1, version: 5 });

  const result = apply(game, action);

  // The doc: it returns game.with({players, last}). Only that player is rebuilt.
  // Game fields other than players/last are unchanged.
  assert.strictEqual(result.kind, "game");
  assert.strictEqual(result.turn, 2);
  assert.strictEqual(result.version, 5);
  assert.strictEqual(result.rng, rng);
  assert.strictEqual(result.winner, null);

  // Only the actor's player is rebuilt; others are the same references.
  for (let s = 0; s < 4; s++) {
    if (s === seat) {
      const rebuilt = result.players[s];
      assert.strictEqual(rebuilt.kind, "player");
      assert.strictEqual(rebuilt.seat, seat);
      const newPiece = rebuilt.queue.groups[rebuilt.queue.groups.length - 1];
      assert.strictEqual(newPiece.dice.length, 4);
      const newOs = oldOs.map((o) => TURN[o][action.axis][String(action.dir)]);
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(newPiece.dice[i].id, dieIds[i]);
        assert.strictEqual(newPiece.dice[i].o, newOs[i]);
      }
      // The first group of seat 2 is untouched.
      const firstGroup = rebuilt.queue.groups[0];
      assert.strictEqual(firstGroup.dice.length, 2);
      assert.strictEqual(firstGroup.dice[0].id, 8);
      assert.strictEqual(firstGroup.dice[0].o, 8);
      assert.strictEqual(firstGroup.dice[1].id, 9);
      assert.strictEqual(firstGroup.dice[1].o, 9);
    } else {
      assert.strictEqual(result.players[s], game.players[s]);
    }
  }

  // The doc: last = Last({action, change: "turn", dice: [die ids, in order], before: [old o, in order]}).
  assert.strictEqual(result.last.kind, "last");
  assert.strictEqual(result.last.change, "turn");
  assert.strictEqual(result.last.action, action);
  assert.deepStrictEqual(result.last.dice, dieIds);
  assert.deepStrictEqual(result.last.before, oldOs);

  // ORIENTATIONS has 24 entries; new orientations are valid indices.
  assert.strictEqual(ORIENTATIONS.length, 24);
  for (let i = 0; i < 4; i++) {
    const newO = TURN[oldOs[i]][action.axis][String(action.dir)];
    assert.ok(Number.isInteger(newO) && newO >= 0 && newO < 24);
  }

  // Every rule: test all axes and directions for the piece dice.
  for (const axis of ["x", "y", "z"]) {
    for (const dir of [1, -1]) {
      const a = Action({ id: "ax", seat, move: "turn", axis, dir, version: 5 });
      const r = apply(game, a);
      const p = r.players[seat].queue.groups[r.players[seat].queue.groups.length - 1];
      const ids = p.dice.map((d) => d.id);
      const os = p.dice.map((d) => d.o);
      const expectedIds = dieIds.slice();
      const expectedOs = oldOs.map((o) => TURN[o][axis][String(dir)]);
      assert.deepStrictEqual(ids, expectedIds);
      assert.deepStrictEqual(os, expectedOs);
      assert.strictEqual(r.last.change, "turn");
      assert.strictEqual(r.last.action, a);
      assert.deepStrictEqual(r.last.dice, dieIds);
      assert.deepStrictEqual(r.last.before, oldOs);
      // Only player rebuilt; others unchanged.
      for (let s = 0; s < 4; s++) {
        if (s === seat) continue;
        assert.strictEqual(r.players[s], game.players[s]);
      }
    }
  }

  // Error cases: the wrapper checks its arguments and throws naming the function.
  assert.throws(() => apply({ kind: "notgame" }, action), /^Error: apply:/);
  const badGame = Game({ players, turn: 2, version: 5, rng, last: null, winner: null });
  assert.throws(() => apply(badGame, { kind: "notaction" }), /^Error: apply:/);
  const rollAction = Action({ id: "r1", seat: 2, move: "roll", axis: null, dir: null, version: 5 });
  assert.throws(() => apply(game, rollAction), /^Error: apply:/);
}
