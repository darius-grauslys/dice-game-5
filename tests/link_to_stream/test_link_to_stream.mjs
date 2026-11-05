import assert from "node:assert/strict";
import http from "node:http";

import { Message, Reply, encodeEvent } from "../../common/index.mjs";

import * as real from "../../edges/link/link_to_stream.mjs";

// wrapper for open: checks args, calls real, checks return shape
function open(url, onMessage) {
  if (typeof url !== "string") throw new Error("open: url must be a string");
  if (typeof onMessage !== "function") throw new Error("open: onMessage must be a function");
  const result = real.open(url, onMessage);
  if (result === undefined) throw new Error("open: did not return");
  if (typeof result.close !== "function") throw new Error("open: return must have close function");
  return result;
}

// wrapper for close: checks no args, calls real, checks void return
function close(...args) {
  if (args.length > 0) throw new Error("close: takes no arguments");
  const result = real.close();
  if (result !== undefined) throw new Error("close: should return void");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      handler(req, res, server);
      req.on("close", () => { server.close(); });
      req.on("error", () => { server.close(); });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}/events`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

export async function _sheo_check() {
  const m1 = Message.reply(Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" }));
  const m2 = Message.reply(Reply({ to: "1:3", seat: 1, ok: true, reason: null }));

  // 1. open arg validation: url must be a string, onMessage must be a function
  assert.throws(() => open(123, () => {}), /^Error: open: /);
  assert.throws(() => open("http://x", "not a fn"), /^Error: open: /);

  // 2. close arg validation: takes no arguments
  assert.throws(() => close(1), /^Error: close: /);

  // 3. successful streaming: open returns {close} at once, messages delivered in order
  {
    const received = [];
    const { url, close: closeServer } = await startServer((req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(encodeEvent(m1));
      res.write(encodeEvent(m2));
    });
    const { close: closeFn } = open(url, (m) => received.push(m));
    await wait(50);
    assert.strictEqual(received.length, 2);
    assert.deepStrictEqual(received[0], m1);
    assert.deepStrictEqual(received[1], m2);
    // close aborts the fetch; no error after close, onMessage never called again
    closeFn();
    await wait(50);
    assert.strictEqual(received.length, 2);
    await closeServer();
  }

  // 4. stream ends before close: console.error and stops (no retry)
  {
    const received = [];
    const { url, close: closeServer } = await startServer((req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(encodeEvent(m1));
      res.end();
    });
    const originalError = console.error;
    let errorCount = 0;
    console.error = () => { errorCount++; };
    const { close: closeFn } = open(url, (m) => received.push(m));
    await wait(100);
    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], m1);
    assert.strictEqual(errorCount, 1, "stream ended before close should console.error");
    closeFn();
    await wait(50);
    assert.strictEqual(received.length, 1, "onMessage never called again after stream ended");
    console.error = originalError;
    await closeServer();
  }

  // 5. fetch fails: console.error and stops (no retry)
  {
    let server;
    await new Promise((resolve) => {
      server = http.createServer(() => {});
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));

    const received = [];
    const originalError = console.error;
    let errorCount = 0;
    console.error = () => { errorCount++; };
    const url = `http://127.0.0.1:${port}/events`;
    const { close: closeFn } = open(url, (m) => received.push(m));
    await wait(200);
    assert.strictEqual(received.length, 0);
    assert.ok(errorCount >= 1, "fetch failed should console.error");
    closeFn();
    console.error = originalError;
  }
}
