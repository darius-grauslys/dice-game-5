import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { start, close } from "../index.mjs";

test("start rejects a non-http origin", () => {
  assert.throws(
    () => start({ origin: "ftp://example.com" }),
    /^TypeError: link\.start: /,
  );
  assert.throws(
    () => start({ origin: "not a url" }),
    /^TypeError: link\.start: /,
  );
  assert.throws(
    () => start({}),
    /^TypeError: link\.start: /,
  );
  assert.throws(
    () => start({ origin: 123 }),
    /^TypeError: link\.start: /,
  );
});

test("start returns an Up with poll and emit", async () => {
  const up = await start({ origin: "http://127.0.0.1:1" });
  assert.strictEqual(up.kind, "up");
  assert.strictEqual(typeof up.poll, "function");
  assert.strictEqual(typeof up.emit, "function");
  await close();
});

test("poll returns [] when queue empty and wait is false", async () => {
  const up = await start({ origin: "http://127.0.0.1:1" });
  const msgs = await up.poll({ wait: false });
  assert.deepStrictEqual(msgs, []);
  await close();
});

test("emit ignores non-action messages", async () => {
  const up = await start({ origin: "http://127.0.0.1:1" });
  const before = console.error;
  let errored = false;
  console.error = () => { errored = true; };
  up.emit({ kind: "message", type: "game", body: {} });
  up.emit({ kind: "message", type: "reply", body: {} });
  console.error = before;
  await close();
  assert.strictEqual(errored, false);
});

test("emit action sends to post and queues a reply", async () => {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/action") {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ kind: "reply", to: "a1", seat: 0, ok: true, reason: null }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const up = await start({ origin });
  await up.emit({ kind: "message", type: "action", body: { kind: "action", id: "a1", seat: 0, move: "roll", axis: null, dir: null, version: 0 } });

  // poll with wait to get the reply
  const msgs = await up.poll({ wait: true });
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].kind, "message");
  assert.strictEqual(msgs[0].type, "reply");
  assert.strictEqual(msgs[0].body.kind, "reply");

  await close();
  await new Promise((resolve) => server.close(resolve));
});
