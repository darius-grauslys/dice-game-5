import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { open } from "../index.mjs";
import { Message, Reply } from "../../../../../../common/index.mjs";

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

test("open returns {close}", () => {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end();
    });
    server.listen(0, "127.0.0.1", async () => {
      const port = server.address().port;
      const handle = open(`http://127.0.0.1:${port}/events`, () => {});
      assert.strictEqual(typeof handle.close, "function");
      handle.close();
      server.close(() => resolve());
    });
  });
});

test("open reads and decodes events", async () => {
  const messages = [];
  const { server, port } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    const msg1 = Message.reply(Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" }));
    const msg2 = Message.reply(Reply({ to: "1:3", seat: 1, ok: false, reason: "stale" }));
    res.write('data: ' + JSON.stringify(msg1) + "\n\n");
    res.write('data: ' + JSON.stringify(msg2) + "\n\n");
    res.end();
  });

  const handle = open(`http://127.0.0.1:${port}/events`, (m) => messages.push(m));

  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (messages.length === 2) { clearInterval(check); resolve(); }
    }, 10);
  });

  handle.close();
  await new Promise((resolve) => server.close(resolve));

  assert.strictEqual(messages.length, 2);
  assert.deepStrictEqual(messages[0], Message.reply(Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" })));
  assert.deepStrictEqual(messages[1], Message.reply(Reply({ to: "1:3", seat: 1, ok: false, reason: "stale" })));
});

test("open stops and reports error on fetch failure", async () => {
  const messages = [];
  const errors = [];
  const origError = console.error;
  console.error = (e) => errors.push(String(e));

  const { server, port } = await startServer((req, res) => {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });

  const handle = open(`http://127.0.0.1:${port}/events`, (m) => messages.push(m));
  await new Promise((resolve) => setTimeout(resolve, 50));

  handle.close();
  await new Promise((resolve) => server.close(resolve));

  console.error = origError;
  assert.strictEqual(messages.length, 0);
  assert.ok(errors.length >= 1);
});

test("onMessage is never called after close", async () => {
  const messages = [];
  const { server, port } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.write('data: ' + JSON.stringify(Message.reply(Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" }))) + "\n\n");
    // keep the response open
  });

  const handle = open(`http://127.0.0.1:${port}/events`, (m) => messages.push(m));

  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (messages.length === 1) { clearInterval(check); resolve(); }
    }, 10);
  });

  const beforeClose = messages.length;
  handle.close();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.strictEqual(messages.length, beforeClose);

  await new Promise((resolve) => server.close(resolve));
});
