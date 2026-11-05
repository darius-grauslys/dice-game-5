import { test } from "node:test";
import assert from "node:assert/strict";
import { createQueue } from "../queue.mjs";
import { Message } from "../../../../../common/index.mjs";

test("poll returns empty when queue is empty", async () => {
  const { enqueue, poll } = createQueue();
  const msgs = await poll({ wait: false });
  assert.deepEqual(msgs, []);
});

test("poll returns queued messages in order and empties the queue", async () => {
  const { enqueue, poll } = createQueue();
  const a = Message.action({ kind: "action", id: "1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const b = Message.action({ kind: "action", id: "2", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
  enqueue(a);
  enqueue(b);
  const msgs = await poll({ wait: false });
  assert.deepEqual(msgs, [a, b]);
  const msgs2 = await poll({ wait: false });
  assert.deepEqual(msgs2, []);
});

test("poll with wait true resolves when something is queued", async () => {
  const { enqueue, poll } = createQueue();
  let resolved = false;
  const p = poll({ wait: true }).then((msgs) => {
    resolved = true;
    assert.equal(msgs.length, 1);
  });
  setTimeout(() => enqueue({ kind: "message", type: "action", body: {} }), 10);
  await p;
  assert.equal(resolved, true);
});
