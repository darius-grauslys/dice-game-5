import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { listen, close } from "../index.mjs";

function makeRequest(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method, path, headers: {} },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk.toString()));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

test("http: 404 for unknown route", async () => {
  const { port } = await listen({ host: "127.0.0.1", port: 0, routes: {} });
  try {
    const r = await makeRequest(port, "GET", "/missing");
    assert.equal(r.status, 404);
    assert.equal(r.headers["content-type"], "text/plain");
    assert.equal(r.headers["cache-control"], "no-store");
    assert.equal(r.body, "not found");
  } finally {
    await close();
  }
});

test("http: route handles GET with query", async () => {
  const routes = {
    "GET /search": ({ method, path, query, body }) => ({
      status: 200,
      type: "text/plain",
      body: `m=${method} p=${path} q=${query.q} b=${body}`,
    }),
  };
  const { port } = await listen({ host: "127.0.0.1", port: 0, routes });
  try {
    const r = await makeRequest(port, "GET", "/search?q=hello");
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-type"], "text/plain");
    assert.equal(r.headers["cache-control"], "no-store");
    assert.equal(r.body, "m=GET p=/search q=hello b=");
  } finally {
    await close();
  }
});

test("http: route handles POST body", async () => {
  const routes = {
    "POST /echo": ({ method, path, query, body }) => ({
      status: 200,
      type: "text/plain",
      body: `body=${body}`,
    }),
  };
  const { port } = await listen({ host: "127.0.0.1", port: 0, routes });
  try {
    const r = await makeRequest(port, "POST", "/echo", "hello world");
    assert.equal(r.status, 200);
    assert.equal(r.body, "body=hello world");
  } finally {
    await close();
  }
});

test("http: route throws -> 500", async () => {
  const routes = {
    "GET /boom": () => {
      throw new Error("boom message");
    },
  };
  const { port } = await listen({ host: "127.0.0.1", port: 0, routes });
  try {
    const r = await makeRequest(port, "GET", "/boom");
    assert.equal(r.status, 500);
    assert.equal(r.headers["content-type"], "text/plain");
    assert.equal(r.headers["cache-control"], "no-store");
    assert.equal(r.body, "boom message");
  } finally {
    await close();
  }
});

test("http: stream response", async () => {
  let streamClosed = false;
  const routes = {
    "GET /stream": () => ({
      status: 200,
      type: "text/plain",
      stream: (send, closed) => {
        send("part1");
        send("part2");
        closed.then(() => { streamClosed = true; });
      },
    }),
  };
  const { port } = await listen({ host: "127.0.0.1", port: 0, routes });
  try {
    let status, headers, data = "";
    const req = http.request(
      { host: "127.0.0.1", port, method: "GET", path: "/stream", headers: {} },
      (res) => {
        status = res.statusCode;
        headers = res.headers;
        res.on("data", (chunk) => (data += chunk.toString()));
      },
    );
    req.on("error", (e) => { throw e; });
    req.end();

    // wait for data to arrive
    await new Promise((resolve) => {
      const t = setInterval(() => {
        if (data.includes("part1")) {
          clearInterval(t);
          resolve();
        }
      }, 10);
      setTimeout(() => { clearInterval(t); resolve(); }, 2000);
    });
    assert.equal(status, 200);
    assert.equal(headers["content-type"], "text/plain");
    assert.equal(headers["cache-control"], "no-store");
    assert.equal(headers["connection"], "keep-alive");
    assert.equal(data, "part1part2");

    // close the socket to trigger closed
    req.socket.destroy();
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(streamClosed);
  } finally {
    await close();
  }
});

test("http: second listen before close throws", async () => {
  const { port: p1 } = await listen({ host: "127.0.0.1", port: 0, routes: {} });
  let threw = false;
  try {
    await listen({ host: "127.0.0.1", port: 0, routes: {} });
  } catch (e) {
    threw = true;
    assert.match(String(e), /^Error: http\.listen: /);
  }
  await close();
  assert.ok(threw);
});

test("http: close when nothing listens resolves", async () => {
  await close();
  await close();
});
