import * as real from "../../edges/serve/serve_to_hold.mjs";
import { Reply } from "../../common/index.mjs";
import assert from "node:assert/strict";

function isReply(v) {
  return v && typeof v === "object" && v.kind === "reply";
}

export async function wait(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("wait: id must be a non-empty string");
  }
  const reply = await real.wait(id);
  if (!isReply(reply)) {
    throw new Error("wait: expected a Reply");
  }
  return reply;
}

export function settle(reply) {
  if (!isReply(reply)) {
    throw new Error('settle: reply must be a Reply (kind === "reply")');
  }
  const result = real.settle(reply);
  if (typeof result !== "boolean") {
    throw new Error("settle: expected a boolean");
  }
  return result;
}

export function pending() {
  const result = real.pending();
  if (typeof result !== "number") {
    throw new Error("pending: expected a number");
  }
  return result;
}

export async function _sheo_check() {
  const id = "action-1";
  const reply = Reply({ to: id, seat: 0, ok: true, reason: null });

  // pending starts at 0
  assert.strictEqual(pending(), 0);

  // wait(id) returns a promise; pending becomes 1
  const waitPromise = wait(id);
  assert.strictEqual(pending(), 1);

  // settle with the reply resolves the promise and returns true
  assert.strictEqual(settle(reply), true);

  // the promise resolves with the reply
  const resolved = await waitPromise;
  assert.strictEqual(resolved.kind, "reply");
  assert.strictEqual(resolved.to, id);
  assert.strictEqual(resolved.seat, 0);
  assert.strictEqual(resolved.ok, true);
  assert.strictEqual(resolved.reason, null);

  // pending back to 0
  assert.strictEqual(pending(), 0);

  // wait(id) twice: second rejects with Error starting hold.wait:
  const waitPromise2 = wait(id);
  await assert.rejects(() => wait(id), /^Error: hold\.wait: /);
  assert.strictEqual(settle(reply), true);
  await waitPromise2;

  // settle for non-waiting id returns false
  const reply2 = Reply({ to: "action-2", seat: 1, ok: false, reason: "stale" });
  assert.strictEqual(settle(reply2), false);

  // settle with invalid reply: wrapper throws Error naming settle
  await assert.throws(() => settle({}), /settle: reply must be a Reply/);
  await assert.throws(() => settle("not a reply"), /settle: reply must be a Reply/);
  await assert.throws(() => settle({ kind: "game" }), /settle: reply must be a Reply/);

  // wait with invalid id: wrapper throws Error naming wait (async, so rejects)
  await assert.rejects(() => wait(""), /wait: id must be a non-empty string/);
  await assert.rejects(() => wait(123), /wait: id must be a non-empty string/);
  await assert.rejects(() => wait(null), /wait: id must be a non-empty string/);
}
