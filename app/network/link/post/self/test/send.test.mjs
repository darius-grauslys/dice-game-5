import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { send } from "../index.mjs";
import { Action, Reply } from "../../../../../../common/index.mjs";

function startServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

test("send posts an action and returns the Reply", async () => {
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const replyBody = { kind: "reply", to: "a1", seat: 0, ok: true, reason: null };
  const { server, port } = await startServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      assert.strictEqual(req.method, "POST");
      assert.strictEqual(req.headers["content-type"], "application/json");
      assert.strictEqual(body, JSON.stringify(action));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(replyBody));
    });
  });
  try {
    const origin = `http://127.0.0.1:${port}`;
    const r = await send(origin, action);
    assert.strictEqual(r.kind, "reply");
    assert.strictEqual(r.to, "a1");
    assert.strictEqual(r.seat, 0);
    assert.strictEqual(r.ok, true);
    assert.ok(Object.isFrozen(r));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("send rejects a non-2xx response with an Error starting post.send: HTTP", async () => {
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const { server, port } = await startServer((req, res) => {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("bad action");
  });
  try {
    const origin = `http://127.0.0.1:${port}`;
    await assert.rejects(
      () => send(origin, action),
      /^Error: post\.send: HTTP 400: bad action$/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("send rejects a non-Reply body with a TypeError starting post.send: ", async () => {
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  const { server, port } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ kind: "action", id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 }));
  });
  try {
    const origin = `http://127.0.0.1:${port}`;
    await assert.rejects(
      () => send(origin, action),
      /^TypeError: post\.send: expected a Reply$/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("send rejects a 500 response with body text", async () => {
  const action = Action({ id: "a1", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
  const { server, port } = await startServer((req, res) => {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("server error");
  });
  try {
    const origin = `http://127.0.0.1:${port}`;
    await assert.rejects(
      () => send(origin, action),
      /^Error: post\.send: HTTP 500: server error$/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
