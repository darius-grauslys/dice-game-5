import { test } from "node:test";
import assert from "node:assert/strict";
import * as fanout from "../index.mjs";

test("join returns tokens 1, 2, 3...", () => {
  fanout.reset();
  assert.strictEqual(fanout.join(() => {}), 1);
  assert.strictEqual(fanout.join(() => {}), 2);
  assert.strictEqual(fanout.join(() => {}), 3);
});

test("tokens are never reused", () => {
  fanout.reset();
  const a = fanout.join(() => {});
  const b = fanout.join(() => {});
  fanout.leave(a);
  const c = fanout.join(() => {});
  assert.strictEqual(a, 1);
  assert.strictEqual(b, 2);
  assert.strictEqual(c, 3);
});

test("join throws TypeError when send is not a function", () => {
  fanout.reset();
  for (const bad of [undefined, null, 5, "fn", {}, []]) {
    assert.throws(() => fanout.join(bad), /^TypeError: fanout\.join: /);
  }
});

test("join catch-up: send last published text at once", () => {
  fanout.reset();
  let received = [];
  fanout.publish("hello");
  const tok = fanout.join((text) => received.push(text));
  assert.strictEqual(tok, 1);
  assert.deepStrictEqual(received, ["hello"]);
});

test("join catch-up: no catch-up if nothing published", () => {
  fanout.reset();
  let received = [];
  const tok = fanout.join((text) => received.push(text));
  assert.strictEqual(tok, 1);
  assert.deepStrictEqual(received, []);
});

test("publish calls every subscriber's send in join order", () => {
  fanout.reset();
  const order = [];
  fanout.join((t) => order.push(1));
  fanout.join((t) => order.push(2));
  fanout.join((t) => order.push(3));
  const n = fanout.publish("msg");
  assert.strictEqual(n, 3);
  assert.deepStrictEqual(order, [1, 2, 3]);
});

test("publish: a send that throws is dropped, returns count of successes", () => {
  fanout.reset();
  const order = [];
  fanout.join((t) => order.push(1));
  fanout.join(() => { throw new Error("boom"); });
  fanout.join((t) => order.push(3));
  const n = fanout.publish("msg");
  assert.strictEqual(n, 2);
  assert.deepStrictEqual(order, [1, 3]);
});

test("publish: dropped send leaves the fanout for the next publish", () => {
  fanout.reset();
  const order = [];
  fanout.join((t) => order.push(1));
  const j2 = fanout.join(() => { throw new Error("boom"); });
  fanout.join((t) => order.push(3));
  fanout.publish("msg1");
  // j2 should now be gone
  const n = fanout.publish("msg2");
  assert.strictEqual(n, 2);
  assert.deepStrictEqual(order, [1, 3, 1, 3]);
});

test("publish keeps text as the last published", () => {
  fanout.reset();
  fanout.publish("a");
  fanout.publish("b");
  let received = [];
  fanout.join((t) => received.push(t));
  assert.deepStrictEqual(received, ["b"]);
});

test("leave forgets a subscriber; unknown token ignored", () => {
  fanout.reset();
  const order = [];
  const j1 = fanout.join((t) => order.push(1));
  fanout.join((t) => order.push(2));
  fanout.leave(j1);
  fanout.leave(999); // unknown
  const n = fanout.publish("msg");
  assert.strictEqual(n, 1);
  assert.deepStrictEqual(order, [2]);
});

test("reset forgets subscribers and last text, restarts tokens at 1", () => {
  fanout.reset();
  fanout.join(() => {});
  fanout.publish("hi");
  fanout.reset();
  assert.strictEqual(fanout.join(() => {}), 1);
  let received = [];
  fanout.join((t) => received.push(t));
  assert.deepStrictEqual(received, []); // no catch-up after reset
});
