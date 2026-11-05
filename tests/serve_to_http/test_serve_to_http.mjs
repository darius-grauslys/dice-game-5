import assert from "node:assert/strict";
import http from "node:http";
import * as real from "../../edges/serve/serve_to_http.mjs";

// wrapped listen: check args, call real, check it returned a promise,
// check the resolved value is {port} with a numeric port, return it.
export async function listen(args) {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new Error("listen: expected an object argument with host, port, routes");
  }
  if (typeof args.host !== "string") {
    throw new Error("listen: host must be a string");
  }
  if (typeof args.port !== "number" || Number.isNaN(args.port)) {
    throw new Error("listen: port must be a number");
  }
  if (typeof args.routes !== "object" || args.routes === null || Array.isArray(args.routes)) {
    throw new Error("listen: routes must be an object");
  }
  const ret = real.listen(args);
  if (!(ret instanceof Promise)) {
    throw new Error("listen: expected a promise");
  }
  const res = await ret;
  if (typeof res !== "object" || res === null || typeof res.port !== "number") {
    throw new Error("listen: expected {port} with numeric port");
  }
  return res;
}

// wrapped close: check no args, call real, check it returned a promise,
// check the resolved value is void, return it.
export async function close() {
  if (arguments.length > 0) {
    throw new Error("close: expected no arguments");
  }
  const ret = real.close();
  if (!(ret instanceof Promise)) {
    throw new Error("close: expected a promise");
  }
  await ret;
  return;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk.toString()));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: data }));
    }).on("error", reject);
  });
}

function httpRequest(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(u, { method, headers: body ? { "content-type": "text/plain" } : {} }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk.toString()));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function _sheo_check() {
  // --- argument validation for listen ---
  await assert.rejects(() => listen(null), /listen:/);
  await assert.rejects(() => listen(1), /listen:/);
  await assert.rejects(() => listen([]), /listen:/);
  await assert.rejects(() => listen({}), /listen:/);
  await assert.rejects(() => listen({ host: "127.0.0.1", port: 0 }), /listen:/);
  await assert.rejects(() => listen({ host: 1, port: 0, routes: {} }), /listen:/);
  await assert.rejects(() => listen({ host: "127.0.0.1", port: "0", routes: {} }), /listen:/);
  await assert.rejects(() => listen({ host: "127.0.0.1", port: 0, routes: "x" }), /listen:/);

  // --- argument validation for close ---
  await assert.rejects(() => close(1), /close:/);

  // --- 404: no route ---
  {
    const { port } = await listen({ host: "127.0.0.1", port: 0, routes: {} });
    const res = await httpGet(`http://127.0.0.1:${port}/missing?q=1`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.headers["content-type"], "text/plain");
    assert.strictEqual(res.headers["cache-control"], "no-store");
    assert.strictEqual(res.text, "not found");
    await close();
  }

  // --- route handling: method, path, query, body ---
  {
    const routes = {
      "GET /hello": async ({ method, path, query, body }) => {
        return { status: 200, type: "text/plain", body: `hello ${query.name}, body=${body}` };
      },
      "POST /echo": async ({ method, path, query, body }) => {
        return { status: 200, type: "text/plain", body };
      }
    };
    const { port } = await listen({ host: "127.0.0.1", port: 0, routes });
    const resHello = await httpGet(`http://127.0.0.1:${port}/hello?name=test`);
    assert.strictEqual(resHello.status, 200);
    assert.strictEqual(resHello.headers["content-type"], "text/plain");
    assert.strictEqual(resHello.headers["cache-control"], "no-store");
    assert.strictEqual(resHello.text, "hello test, body=");
    const resEcho = await httpRequest("POST", `http://127.0.0.1:${port}/echo`, "hi");
    assert.strictEqual(resEcho.status, 200);
    assert.strictEqual(resEcho.text, "hi");
    await close();
  }

  // --- stream response ---
  {
    const routes = {
      "GET /stream": async () => {
        return {
          status: 200,
          type: "text/plain",
          stream: (send, closed) => {
            send("part1");
            send("part2");
          }
        };
      }
    };
    const { port } = await listen({ host: "127.0.0.1", port: 0, routes });
    const res = await new Promise((resolve, reject) => {
      const u = new URL(`http://127.0.0.1:${port}/stream`);
      const req = http.request(u, { method: "GET" }, (res2) => {
        resolve({ status: res2.statusCode, headers: res2.headers });
      });
      req.on("error", reject);
      req.end();
      setTimeout(() => reject(new Error("stream request timeout")), 2000);
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-type"], "text/plain");
    assert.strictEqual(res.headers["cache-control"], "no-store");
    assert.strictEqual(res.headers["connection"], "keep-alive");
    await close();
  }

  // --- route throws: 500 with error message ---
  {
    const routes = {
      "GET /throw": async () => {
        throw new Error("boom");
      }
    };
    const { port } = await listen({ host: "127.0.0.1", port: 0, routes });
    const res = await httpGet(`http://127.0.0.1:${port}/throw`);
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.headers["content-type"], "text/plain");
    assert.strictEqual(res.text, "boom");
    await close();
  }

  // --- second listen before close throws ---
  {
    await listen({ host: "127.0.0.1", port: 0, routes: {} });
    await assert.rejects(() => listen({ host: "127.0.0.1", port: 0, routes: {} }), /^Error: http\.listen: /);
    await close();
  }

  // --- close when nothing listens resolves at once ---
  await close();
}
