import * as real from "../../edges/link/link_to_post.mjs";
import { Action, Reply, toJSON, fromJSON, ROUTES, REASONS } from "../../common/index.mjs";
import assert from "node:assert/strict";
import http from "node:http";

// A drop-in for the forwarder: wraps real.send with argument and return checks.
export async function send(origin, action) {
  // A) check arguments against the doc, throw an Error naming the function if wrong.
  if (typeof origin !== "string") {
    throw new Error("send: origin must be a string");
  }
  if (!(action && typeof action === "object" && action.kind === "action")) {
    throw new Error("send: action must be an Action");
  }

  // B) call the function through the edge.
  const result = await real.send(origin, action);

  // C) check that it returned.
  if (result === undefined) {
    throw new Error("send: no return value from real.send");
  }

  // D) check the return value against the doc: it must be a Reply.
  if (!(result && typeof result === "object" && result.kind === "reply")) {
    throw new TypeError("send: expected a Reply");
  }
  if (typeof result.to !== "string" || result.to.length === 0) {
    throw new TypeError("send: Reply.to must be a non-empty string");
  }
  if (!Number.isInteger(result.seat) || result.seat < 0 || result.seat > 3) {
    throw new TypeError("send: Reply.seat must be an integer 0..3");
  }
  if (typeof result.ok !== "boolean") {
    throw new TypeError("send: Reply.ok must be a boolean");
  }
  if (result.ok) {
    if (result.reason !== null) {
      throw new TypeError("send: Reply.reason must be null when ok is true");
    }
  } else if (!REASONS.includes(result.reason)) {
    throw new TypeError("send: Reply.reason must be one of REASONS");
  }

  // Return what the real call returned.
  return result;
}

async function makeServer(handler) {
  const server = http.createServer((req, res) => {
    try {
      handler(req, res);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

export async function _sheo_check() {
  const action = Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });

  // --- argument checks (rule A) ---
  await assert.rejects(() => send(123, action), /^Error: send: origin must be a string$/);
  await assert.rejects(() => send("http://127.0.0.1:1", "not an action"), /^Error: send: action must be an Action$/);
  await assert.rejects(() => send("http://127.0.0.1:1", { kind: "game" }), /^Error: send: action must be an Action$/);

  // --- success: resolves with the Reply (rule: resolve with the Reply) ---
  {
    const reply = Reply({ to: "a1", seat: 0, ok: true, reason: null });
    const { server, origin } = await makeServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(reply));
    });
    const result = await send(origin, action);
    assert.deepStrictEqual(result, { kind: "reply", to: "a1", seat: 0, ok: true, reason: null });
    server.close();
  }

  // --- success: failed reply for every reason ---
  for (const reason of REASONS) {
    const reply = Reply({ to: "a1", seat: 0, ok: false, reason });
    const { server, origin } = await makeServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(reply));
    });
    const result = await send(origin, action);
    assert.deepStrictEqual(result, { kind: "reply", to: "a1", seat: 0, ok: false, reason });
    server.close();
  }

  // --- non-2xx answer rejects with an Error starting "post.send: HTTP <status>: " and body text ---
  {
    const { server, origin } = await makeServer((req, res) => {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("bad request");
    });
    await assert.rejects(
      () => send(origin, action),
      /^Error: post\.send: HTTP 400: bad request$/,
    );
    server.close();
  }

  // --- non-2xx: status 503 ---
  {
    const { server, origin } = await makeServer((req, res) => {
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("service unavailable");
    });
    await assert.rejects(
      () => send(origin, action),
      /^Error: post\.send: HTTP 503: service unavailable$/,
    );
    server.close();
  }

  // --- 2xx but the body isn't a Reply: rejects with a TypeError starting "post.send: " ---
  {
    const { server, origin } = await makeServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ kind: "die", id: 0, o: 0 }));
    });
    await assert.rejects(
      () => send(origin, action),
      /^TypeError: post\.send: /,
    );
    server.close();
  }
}
