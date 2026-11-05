import { test } from "node:test";
import assert from "node:assert/strict";
import { Die, Group, Queue, Player, Game, Action } from "../../../../../../../common/index.mjs";
import { toAction } from "../index.mjs";

function die(id, o = 0) {
  return Die({ id, o });
}

function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
  }
  return players;
}

function makeGame(patch = {}) {
  return Game({
    players: makePlayers(),
    turn: 0,
    version: 0,
    rng: 1,
    last: null,
    winner: null,
    ...patch,
  });
}

test("toAction returns null if game is null", () => {
  const hit = { kind: "roll" };
  const gesture = { kind: "press", at: { x: 0, y: 0 } };
  assert.strictEqual(toAction(gesture, hit, null, 0), null);
});

test("toAction returns null if game.winner !== null", () => {
  const game = makeGame({ winner: 1 });
  const hit = { kind: "roll" };
  const gesture = { kind: "press", at: { x: 0, y: 0 } };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction returns null if game.turn !== seat", () => {
  const game = makeGame({ turn: 1 });
  const hit = { kind: "roll" };
  const gesture = { kind: "press", at: { x: 0, y: 0 } };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: press with roll returns a roll action", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "roll" };
  const gesture = { kind: "press", at: { x: 10, y: 10 } };
  const a = toAction(gesture, hit, game, 0);
  assert.ok(a);
  assert.strictEqual(a.kind, "action");
  assert.strictEqual(a.id, "0:5");
  assert.strictEqual(a.seat, 0);
  assert.strictEqual(a.move, "roll");
  assert.strictEqual(a.axis, null);
  assert.strictEqual(a.dir, null);
  assert.strictEqual(a.version, 5);
});

test("toAction: press with non-roll hit returns null", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+z" };
  const gesture = { kind: "press", at: { x: 10, y: 10 } };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: press with null hit returns null (no throw)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const gesture = { kind: "press", at: { x: 10, y: 10 } };
  assert.strictEqual(toAction(gesture, null, game, 0), null);
});

test("toAction: drag of a die not in the rightmost group returns null", () => {
  const game = makeGame({ turn: 0, version: 5 });
  // Seat 0's queue has 1 group with dice 0,1,2,3. Rightmost group is that one.
  const hit = { kind: "die", id: 12, normal: "+z" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 50, y: 0 } };
  // die 12 belongs to seat 3, not seat 0.
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: drag below DRAG_MIN returns null", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+z" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 10, y: 0 } };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: drag right on +z returns turn action (y, 1)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+z" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  const a = toAction(gesture, hit, game, 0);
  assert.ok(a);
  assert.strictEqual(a.move, "turn");
  assert.strictEqual(a.axis, "y");
  assert.strictEqual(a.dir, 1);
  assert.strictEqual(a.id, "0:5");
  assert.strictEqual(a.version, 5);
});

test("toAction: drag left on +z returns turn action (y, -1)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+z" };
  const gesture = { kind: "drag", at: { x: 20, y: 0 }, to: { x: 0, y: 0 } };
  const a = toAction(gesture, hit, game, 0);
  assert.ok(a);
  assert.strictEqual(a.move, "turn");
  assert.strictEqual(a.axis, "y");
  assert.strictEqual(a.dir, -1);
});

test("toAction: drag up on +z returns turn action (x, -1)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+z" };
  const gesture = { kind: "drag", at: { x: 0, y: 20 }, to: { x: 0, y: 0 } };
  const a = toAction(gesture, hit, game, 0);
  assert.ok(a);
  assert.strictEqual(a.move, "turn");
  assert.strictEqual(a.axis, "x");
  assert.strictEqual(a.dir, -1);
});

test("toAction: drag down on +z returns turn action (x, 1)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+z" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 0, y: 20 } };
  const a = toAction(gesture, hit, game, 0);
  assert.ok(a);
  assert.strictEqual(a.move, "turn");
  assert.strictEqual(a.axis, "x");
  assert.strictEqual(a.dir, 1);
});

test("toAction: drag on +y right returns turn action (z, -1)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+y" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  const a = toAction(gesture, hit, game, 0);
  assert.ok(a);
  assert.strictEqual(a.move, "turn");
  assert.strictEqual(a.axis, "z");
  assert.strictEqual(a.dir, -1);
});

test("toAction: drag with unknown normal returns null", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "-z" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: drag with unknown normal +x returns null", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 0, normal: "+x" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  assert.strictEqual(toAction(gesture, hit, game, 0), null);
});

test("toAction: drag of die in rightmost group returns action", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const hit = { kind: "die", id: 3, normal: "+z" };
  const gesture = { kind: "drag", at: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  const a = toAction(gesture, hit, game, 0);
  assert.ok(a);
  assert.strictEqual(a.move, "turn");
});

test("toAction: drag rightmost group die 3 on +z with dx=40,dy=5 returns (y,1)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const a = toAction(
    { kind: "drag", at: { x: 100, y: 100 }, to: { x: 140, y: 105 } },
    { kind: "die", id: 3, normal: "+z" },
    game,
    0,
  );
  const expected = Action({ id: "0:5", seat: 0, move: "turn", axis: "y", dir: 1, version: 5 });
  assert.deepStrictEqual(a, expected);
});

test("toAction: press roll with version 5 game returns roll action", () => {
  const game = makeGame({ turn: 0, version: 5 });
  const a = toAction(
    { kind: "press", at: { x: 10, y: 10 } },
    { kind: "roll" },
    game,
    0,
  );
  const expected = Action({ id: "0:5", seat: 0, move: "roll", axis: null, dir: null, version: 5 });
  assert.deepStrictEqual(a, expected);
});

test("toAction: press with null hit returns null (no throw)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  assert.strictEqual(toAction({ kind: "press", at: { x: 10, y: 10 } }, null, game, 0), null);
});

test("toAction: drag with null hit returns null (no throw)", () => {
  const game = makeGame({ turn: 0, version: 5 });
  assert.strictEqual(toAction({ kind: "drag", at: { x: 0, y: 0 }, to: { x: 50, y: 0 } }, null, game, 0), null);
});
