import { test } from "node:test";
import assert from "node:assert/strict";
import { Player, Queue } from "../index.mjs";
import { die } from "./helpers.mjs";

const emptyQueue = () => Queue({ groups: [] });

test("Player builds a valid value", () => {
  const q = emptyQueue();
  const p = Player({ seat: 2, queue: q });
  assert.deepStrictEqual(p, { kind: "player", seat: 2, queue: q });
  assert.deepStrictEqual(Object.keys(p), ["kind", "seat", "queue"]);
  assert.ok(Object.isFrozen(p));
  // Rule 5: shared values are passed through, not copied.
  assert.strictEqual(p.queue, q);
});

test("Player rejects a bad seat", () => {
  for (const seat of [4, -1, 1.5, "1", null, true])
    assert.throws(
      () => Player({ seat, queue: emptyQueue() }),
      /Player\.seat: /,
      `seat=${JSON.stringify(seat)}`,
    );
});

test("Player rejects a bad queue", () => {
  for (const queue of [null, 5, {}, die(0), { kind: "group", dice: [] }])
    assert.throws(
      () => Player({ seat: 0, queue }),
      /Player\.queue: /,
      `queue=${JSON.stringify(queue)}`,
    );
});

test("Player rejects missing and unknown fields", () => {
  assert.throws(() => Player({ queue: emptyQueue() }), /Player\.seat: /);
  assert.throws(() => Player({ seat: 0 }), /Player\.queue: /);
  assert.throws(() => Player({}), /Player\.seat: /);
  assert.throws(
    () => Player({ seat: 0, queue: emptyQueue(), name: "Ada" }),
    /Player\.name: unknown field$/,
  );
});

test("Player's value is deeply frozen", () => {
  const p = Player({ seat: 0, queue: emptyQueue() });
  assert.throws(() => { p.seat = 1; }, TypeError);
  assert.throws(() => { p.queue = emptyQueue(); }, TypeError);
});
