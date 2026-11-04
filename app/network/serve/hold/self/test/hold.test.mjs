import { test } from "node:test";
import assert from "node:assert/strict";
import { wait, settle, pending } from "../index.mjs";
import { Reply } from "../../../../../../common/index.mjs";

test("wait returns a Promise that resolves with the settled reply", async () => {
  const id = "a1";
  const p = wait(id);
  assert.strictEqual(pending(), 1);
  const reply = Reply({ to: id, seat: 0, ok: true, reason: null });
  assert.strictEqual(settle(reply), true);
  const r = await p;
  assert.deepStrictEqual(r, reply);
  assert.strictEqual(pending(), 0);
});

test("wait rejects a non-string id with a TypeError starting hold.wait: ", () => {
  for (const id of [5, null, undefined, true, {}, []]) {
    assert.throws(() => wait(id), /^TypeError: hold\.wait: /);
  }
});

test("wait rejects an empty string id", () => {
  assert.throws(() => wait(""), /^TypeError: hold\.wait: /);
});

test("wait rejects a duplicate id with an Error starting hold.wait: ", () => {
  const id = "a1";
  wait(id);
  assert.throws(() => wait(id), /^Error: hold\.wait: /);
  settle(Reply({ to: id, seat: 0, ok: true, reason: null }));
  // after settle, the id is forgotten, so wait works again
  wait(id);
  settle(Reply({ to: id, seat: 0, ok: true, reason: null }));
});

test("settle returns true for a waiting id and forgets it", () => {
  const id = "a1";
  wait(id);
  const reply = Reply({ to: id, seat: 2, ok: false, reason: "stale" });
  assert.strictEqual(settle(reply), true);
  assert.strictEqual(pending(), 0);
});

test("settle returns false when nothing waits for reply.to", () => {
  const reply = Reply({ to: "missing", seat: 0, ok: true, reason: null });
  assert.strictEqual(settle(reply), false);
  assert.strictEqual(pending(), 0);
});

test("settle rejects a non-Reply with a TypeError starting hold.settle: ", () => {
  for (const reply of [null, {}, { kind: "game" }, "reply", 5, true]) {
    assert.throws(() => settle(reply), /^TypeError: hold\.settle: /);
  }
});

test("pending returns the number of waiting ids", () => {
  assert.strictEqual(pending(), 0);
  wait("a1");
  wait("a2");
  assert.strictEqual(pending(), 2);
  settle(Reply({ to: "a1", seat: 0, ok: true, reason: null }));
  assert.strictEqual(pending(), 1);
  wait("a3");
  assert.strictEqual(pending(), 2);
});
