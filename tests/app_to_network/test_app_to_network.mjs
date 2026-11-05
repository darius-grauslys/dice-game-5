import assert from "node:assert/strict";
import http from "node:http";

import { Message, Reply, Action, Game, Up } from "../../common/index.mjs";
import { PAGE } from "../../common/wire/index.mjs";
import { makeGame } from "../../common/shapes/test/helpers.mjs";

import * as real from "../../edges/app/app_to_network.mjs";

// ---- wrapped initNetwork ----
export async function initNetwork(opts) {
  // A) check its arguments against the doc, and throw an Error naming the function if they're wrong
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) {
    throw new TypeError("initNetwork: opts must be an object");
  }
  if (typeof opts.role !== "string") {
    throw new TypeError("initNetwork: opts.role must be a string");
  }
  const role = opts.role;
  if (role === "server") {
    if (typeof opts.port !== "number" || !Number.isInteger(opts.port)) {
      throw new TypeError("initNetwork: opts.port must be an integer for server");
    }
  } else if (role === "client") {
    if (typeof opts.origin !== "string" || opts.origin.length === 0) {
      throw new TypeError("initNetwork: opts.origin must be a non-empty string for client");
    }
  }
  // B) call the function through the forwarder
  const up = await real.initNetwork(opts);
  // C) check that it returned
  // D) check the return value against the doc: common's Up({poll, emit})
  if (!(up && typeof up === "object" && up.kind === "up")) {
    throw new Error("initNetwork: expected Up");
  }
  if (typeof up.poll !== "function" || typeof up.emit !== "function") {
    throw new Error("initNetwork: Up must have poll and emit functions");
  }
  return up;
}

// ---- wrapped close ----
export async function close() {
  // A) check its arguments against the doc: no arguments expected
  if (arguments.length > 0) {
    throw new TypeError("close: no arguments expected");
  }
  // B) call the function through the forwarder
  await real.close();
  // C) check that it returned; D) void
}

// ---- _sheo_check ----
export async function _sheo_check() {
  // Loop back in one process: server and client in the same process.
  const port = 20000 + Math.floor(Math.random() * 40001); // random 20000–60000
  const serverUp = await initNetwork({ role: "server", port });
  const clientUp = await initNetwork({ role: "client", origin: `http://127.0.0.1:${port}` });

  // client's emit(Message.action(a)) reaches the server's poll
  const action = Action({ id: "a1", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
  const actionMsg = Message.action(action);
  clientUp.emit(actionMsg);

  const serverMessages = await serverUp.poll({ wait: true });
  assert.strictEqual(serverMessages.length, 1, "server poll should return one message");
  assert.strictEqual(serverMessages[0].type, "action", "server should receive an action");
  assert.deepStrictEqual(serverMessages[0].body, action, "server should receive the action");

  // server's emit(Message.reply(r)) reaches the client's poll (as a "reply")
  const reply = Reply({ to: "a1", seat: 0, ok: true, reason: null });
  const replyMsg = Message.reply(reply);
  serverUp.emit(replyMsg);

  const clientMessages = await clientUp.poll({ wait: true });
  assert.strictEqual(clientMessages.length, 1, "client poll should return one message");
  assert.strictEqual(clientMessages[0].type, "reply", "client should receive a reply");
  assert.deepStrictEqual(clientMessages[0].body, reply, "client should receive the reply");

  // server's emit(Message.game(g)) reaches the client's poll
  const game = makeGame();
  const gameMsg = Message.game(game);
  serverUp.emit(gameMsg);

  const clientMessages2 = await clientUp.poll({ wait: true });
  assert.strictEqual(clientMessages2.length, 1, "client poll should return one message");
  assert.strictEqual(clientMessages2[0].type, "game", "client should receive a game");
  assert.deepStrictEqual(clientMessages2[0].body, game, "client should receive the game");

  // GET / answers PAGE
  const pageText = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/`, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
  assert.strictEqual(pageText, PAGE, "GET / should answer PAGE");

  // GET /client.js answers JavaScript
  const clientText = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/client.js`, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
  assert.ok(clientText.length > 0, "GET /client.js should answer JavaScript");

  // a second start of the same role: Error starting network.initNetwork:
  await assert.rejects(
    () => real.initNetwork({ role: "server", port }),
    /^Error: network\.initNetwork: /,
  );
  await assert.rejects(
    () => real.initNetwork({ role: "client", origin: `http://127.0.0.1:${port}` }),
    /^Error: network\.initNetwork: /,
  );

  // any other role: TypeError starting network.initNetwork:
  await assert.rejects(
    () => real.initNetwork({ role: "nope" }),
    /^TypeError: network\.initNetwork: /,
  );

  // close() at the end: closes every role started, and forgets them (they can be started again)
  await close();
  const serverUp2 = await initNetwork({ role: "server", port });
  const clientUp2 = await initNetwork({ role: "client", origin: `http://127.0.0.1:${port}` });
  await close();
}
