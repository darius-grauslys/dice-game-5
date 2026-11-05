import assert from "node:assert/strict";
import * as real from "../../edges/serve/serve_to_fanout.mjs";
import { Message, Reply, encodeEvent } from "../../common/index.mjs";

// ---- fanout wrapper: serves fanout through the edge ----

export function join(send) {
  if (typeof send !== "function") {
    throw new TypeError("fanout.join: send must be a function");
  }
  const res = real.join(send);
  if (typeof res !== "number" || !Number.isInteger(res) || res < 1) {
    throw new Error("fanout.join: expected token >= 1");
  }
  return res;
}

export function leave(token) {
  if (typeof token !== "number" || !Number.isInteger(token)) {
    throw new TypeError("fanout.leave: token must be an integer");
  }
  const res = real.leave(token);
  if (res !== undefined) {
    throw new Error("fanout.leave: expected void");
  }
}

export function publish(text) {
  if (typeof text !== "string") {
    throw new TypeError("fanout.publish: text must be a string");
  }
  const res = real.publish(text);
  if (typeof res !== "number" || !Number.isInteger(res) || res < 0) {
    throw new Error("fanout.publish: expected count >= 0");
  }
  return res;
}

export function reset() {
  const res = real.reset();
  if (res !== undefined) {
    throw new Error("fanout.reset: expected void");
  }
}

// ---- the check ----

export async function _sheo_check() {
  reset();

  // Build a realistic event-stream text using common.
  const reply1 = Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" });
  const message1 = Message.reply(reply1);
  const text = encodeEvent(message1);

  // 1. join returns tokens 1, 2, 3... never reused.
  const r1 = [];
  const send1 = (t) => { r1.push(t); };
  const t1 = join(send1);
  assert.strictEqual(t1, 1);

  const r2 = [];
  const send2 = (t) => { r2.push(t); };
  const t2 = join(send2);
  assert.strictEqual(t2, 2);

  const rThrow = [];
  const sendThrow = (t) => { throw new Error("boom"); };
  const tThrow = join(sendThrow);
  assert.strictEqual(tThrow, 3);

  // 2. publish calls each send in join order; a send that throws is dropped.
  const n = publish(text);
  assert.strictEqual(n, 2);
  assert.strictEqual(r1[0], text);
  assert.strictEqual(r2[0], text);

  // 3. join after publish: catch-up calls send with the last published text.
  const r3 = [];
  const send3 = (t) => { r3.push(t); };
  const t3 = join(send3);
  assert.strictEqual(t3, 4);
  assert.strictEqual(r3[0], text);

  // 4. publish again: sendThrow is gone (dropped), so 3 succeed.
  const reply2 = Reply({ to: "0:4", seat: 0, ok: false, reason: "over" });
  const message2 = Message.reply(reply2);
  const text2 = encodeEvent(message2);
  const n2 = publish(text2);
  assert.strictEqual(n2, 3);
  assert.strictEqual(r1[1], text2);
  assert.strictEqual(r2[1], text2);
  assert.strictEqual(r3[1], text2);

  // 5. tokens are never reused: next join is 5. Catch-up with last published text.
  const r5 = [];
  const send5 = (t) => { r5.push(t); };
  const t5 = join(send5);
  assert.strictEqual(t5, 5);
  assert.strictEqual(r5[0], text2);

  // 6. leave forgets a subscriber; an unknown token is ignored.
  leave(t1);
  leave(999);

  const reply3 = Reply({ to: "0:5", seat: 0, ok: true, reason: null });
  const message3 = Message.reply(reply3);
  const text3 = encodeEvent(message3);
  const n3 = publish(text3);
  assert.strictEqual(n3, 3);
  assert.strictEqual(r2[2], text3);
  assert.strictEqual(r3[2], text3);
  assert.strictEqual(r5[1], text3);

  // 7. reset: forgets every subscriber and the last text, restarts tokens at 1.
  reset();
  const rt1 = join(send1);
  assert.strictEqual(rt1, 1);
  const rAfterReset = [];
  const sendAfterReset = (t) => { rAfterReset.push(t); };
  const rt2 = join(sendAfterReset);
  assert.strictEqual(rt2, 2);
  assert.deepStrictEqual(rAfterReset, []);

  // 8. argument validation: each wrapper throws an Error naming the function.
  assert.throws(() => join("not a function"), /^TypeError: fanout\.join: /);
  assert.throws(() => leave("not a number"), /^TypeError: fanout\.leave: /);
  assert.throws(() => publish(123), /^TypeError: fanout\.publish: /);
}
