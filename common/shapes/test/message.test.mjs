import { test } from "node:test";
import assert from "node:assert/strict";
import { Action, Game, Message, Reply } from "../index.mjs";
import { makeGame } from "./helpers.mjs";

const action = Action({ id: "a1", seat: 0, move: "roll", axis: null, dir: null, version: 3 });
const reply = Reply({ to: "a1", seat: 0, ok: true, reason: null });
const game = makeGame();

test("Message.game wraps a Game", () => {
  const m = Message.game(game);
  assert.deepStrictEqual(m, { kind: "message", type: "game", body: game });
  assert.deepStrictEqual(Object.keys(m), ["kind", "type", "body"]);
  assert.ok(Object.isFrozen(m));
  assert.strictEqual(m.body, game);
});

test("Message.action wraps an Action", () => {
  const m = Message.action(action);
  assert.deepStrictEqual(m, { kind: "message", type: "action", body: action });
  assert.strictEqual(m.body, action);
});

test("Message.reply wraps a Reply", () => {
  const m = Message.reply(reply);
  assert.deepStrictEqual(m, { kind: "message", type: "reply", body: reply });
  assert.strictEqual(m.body, reply);
});

test("Message.game rejects the wrong kind", () => {
  for (const value of [action, reply, null, {}, { kind: "last" }])
    assert.throws(
      () => Message.game(value),
      /Message\.game: expected a Game$/,
      `value=${JSON.stringify(value)}`,
    );
});

test("Message.action rejects the wrong kind", () => {
  for (const value of [game, reply, null, {}])
    assert.throws(
      () => Message.action(value),
      /Message\.action: expected an Action$/,
      `value=${JSON.stringify(value)}`,
    );
});

test("Message.reply rejects the wrong kind", () => {
  for (const value of [game, action, null, {}])
    assert.throws(
      () => Message.reply(value),
      /Message\.reply: expected a Reply$/,
      `value=${JSON.stringify(value)}`,
    );
});

test("Message's own object is frozen", () => {
  assert.ok(Object.isFrozen(Message));
});
