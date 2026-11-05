import * as real from "../../edges/network/network_to_link.mjs";
import assert from "node:assert/strict";
import http from "node:http";
import { Message, Action, Reply } from "../../common/index.mjs";

// ---- drop-in wrappers for link's surface ----

export function start(input) {
  const origin = input?.origin;
  if (typeof origin !== "string" || !origin.startsWith("http")) {
    throw new TypeError("link.start: origin must be a string starting with http");
  }
  return real.start({ origin }).then((up) => {
    assert(up !== undefined, "start returned nothing");
    assert(typeof up.poll === "function", "Up.poll is not a function");
    assert(typeof up.emit === "function", "Up.emit is not a function");
    return up;
  });
}

export function close() {
  return real.close().then((result) => {
    assert(result === undefined, "close did not resolve to void");
    return result;
  });
}

// ---- server for network tests ----

function makeServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      return;
    }
    if (req.method === "POST" && req.url === "/action") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const action = JSON.parse(body);
          if (action.id === "fail") {
            res.writeHead(500);
            res.end("server error");
            return;
          }
          const reply = { kind: "reply", to: action.id, seat: action.seat, ok: true, reason: null };
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(reply));
        } catch (e) {
          res.writeHead(400);
          res.end("bad");
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return server;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the check ----

export async function _sheo_check() {
  // A) start with wrong origin: TypeError starting "link.start: "
  assert.throws(() => start({ origin: "ftp://127.0.0.1:8080" }), /^TypeError: link\.start: /);
  assert.throws(() => start({ origin: 123 }), /^TypeError: link\.start: /);
  assert.throws(() => start({}), /^TypeError: link\.start: /);

  // start a server on a random port
  const server = makeServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  try {
    // B) start returns Up({poll, emit})
    const up = await start({ origin });
    assert(typeof up.poll === "function", "up.poll is not a function");
    assert(typeof up.emit === "function", "up.emit is not a function");

    // poll({wait: false}) on empty queue returns []
    let msgs = await up.poll({ wait: false });
    assert.deepStrictEqual(msgs, []);

    // emit an "action": post.send resolves, queue Message.reply(reply)
    const action = Action({ id: "act-1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
    const actionMsg = Message.action(action);
    await up.emit(actionMsg);
    await wait(50);
    msgs = await up.poll({ wait: false });
    assert.strictEqual(msgs.length, 1, "expected one queued reply");
    assert.strictEqual(msgs[0].kind, "message");
    assert.strictEqual(msgs[0].type, "reply");
    assert.deepStrictEqual(msgs[0].body, Reply({ to: "act-1", seat: 0, ok: true, reason: null }));

    // emit anything else is ignored
    const replyMsg = Message.reply(Reply({ to: "x", seat: 0, ok: true, reason: null }));
    await up.emit(replyMsg);
    await wait(20);
    msgs = await up.poll({ wait: false });
    assert.deepStrictEqual(msgs, [], "non-action emit should be ignored");

    // emit an action that makes post.send reject: console.error, nothing queued
    const actionFail = Action({ id: "fail", seat: 0, move: "turn", axis: "x", dir: 1, version: 1 });
    const actionMsgFail = Message.action(actionFail);
    const origError = console.error;
    let consoleErr = null;
    console.error = (msg) => { consoleErr = String(msg); };
    await up.emit(actionMsgFail);
    // emit doesn't wait for post.send; poll console.error until called (up to 2 s)
    const deadline = Date.now() + 2000;
    while (consoleErr === null && Date.now() < deadline) {
      await wait(10);
    }
    console.error = origError; // restore only after polling
    assert.ok(consoleErr !== null, "console.error should have been called on reject");
    msgs = await up.poll({ wait: false });
    assert.deepStrictEqual(msgs, [], "rejected emit queues nothing");

    // poll with messages: return queued messages in order and empty the queue
    const action2 = Action({ id: "act-3", seat: 2, move: "turn", axis: "y", dir: -1, version: 2 });
    const actionMsg2 = Message.action(action2);
    await up.emit(actionMsg2);
    await wait(50);
    msgs = await up.poll({ wait: false });
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].body.to, "act-3");
    // queue should be empty now
    msgs = await up.poll({ wait: false });
    assert.deepStrictEqual(msgs, []);
  } finally {
    server.close();
  }

  // close() resolves at once to void
  await close();
}
