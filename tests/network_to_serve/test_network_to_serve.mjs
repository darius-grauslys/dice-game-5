import * as real from "../../edges/network/network_to_serve.mjs";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import {
  Message, Reply, Action, toJSON, fromJSON, PAGE,
} from "../../common/index.mjs";
import { Die, Group, Queue, Player, Game } from "../../common/index.mjs";

// ---- helpers to build valid shapes ----

function makeDie(id, o = 0) {
  return Die({ id, o });
}

function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(makeDie(seat * 4 + k));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
  }
  return players;
}

function makeGame(patch = {}) {
  return Game({ players: makePlayers(), turn: 0, version: 0, rng: 1, last: null, winner: null, ...patch });
}

// ---- wrapped surface ----

export async function start(input) {
  if (input === undefined || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("start: expected an object {host, port}");
  }
  if (typeof input.host !== "string" || typeof input.port !== "number") {
    throw new Error("start: expected {host: string, port: number}");
  }
  const result = await real.start(input);
  if (result.kind !== "up" || typeof result.poll !== "function" || typeof result.emit !== "function") {
    throw new Error("start: returned value is not Up");
  }
  return result;
}

export async function close() {
  if (arguments.length > 0) {
    throw new Error("close: expected no arguments");
  }
  const result = await real.close();
  return result;
}

// ---- HTTP helpers ----

function httpRequest(method, path, body, port, contentType) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (contentType) headers["content-type"] = contentType;
    const req = http.request(
      { hostname: "127.0.0.1", port, method, path, headers },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body: data }));
      }
    );
    req.on("error", reject);
    if (body != null) req.write(body);
    req.end();
  });
}

function findFreePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

// ---- the check ----

export async function _sheo_check() {
  // A) argument checks
  await assert.rejects(() => start(), /^Error: start: expected an object \{host, port\}/);
  await assert.rejects(() => start({ host: "127.0.0.1" }), /^Error: start: expected \{host: string, port: number\}/);
  await assert.rejects(() => start({ host: 127, port: 0 }), /^Error: start: expected \{host: string, port: number\}/);
  await assert.rejects(() => start({ host: "127.0.0.1", port: "0" }), /^Error: start: expected \{host: string, port: number\}/);
  await assert.rejects(() => close(1), /^Error: close: expected no arguments/);

  // start server on a free port
  const port = await findFreePort();
  const up = await start({ host: "127.0.0.1", port });
  assert.strictEqual(up.kind, "up");
  assert.strictEqual(typeof up.poll, "function");
  assert.strictEqual(typeof up.emit, "function");

  // GET /
  const pageResp = await httpRequest("GET", "/", null, port);
  assert.strictEqual(pageResp.status, 200);
  assert.strictEqual(pageResp.type, "text/html");
  assert.strictEqual(pageResp.body, PAGE);

  // GET /client.js
  const clientResp = await httpRequest("GET", "/client.js", null, port);
  assert.strictEqual(clientResp.status, 200);
  assert.strictEqual(clientResp.type, "text/javascript");
  assert.strictEqual(typeof clientResp.body, "string");
  assert.ok(clientResp.body.length > 0);

  // POST /action invalid JSON
  const badJsonResp = await httpRequest("POST", "/action", "{bad", port, "application/json");
  assert.strictEqual(badJsonResp.status, 400);
  assert.strictEqual(badJsonResp.type, "text/plain");
  assert.match(badJsonResp.body, /^fromJSON: bad JSON:/);

  // POST /action valid JSON not an Action
  const gameJson = toJSON(makeGame());
  const notActionResp = await httpRequest("POST", "/action", gameJson, port, "application/json");
  assert.strictEqual(notActionResp.status, 400);
  assert.strictEqual(notActionResp.type, "text/plain");
  assert.strictEqual(typeof notActionResp.body, "string");

  // POST /action: valid action -> queue, poll, emit reply -> 200
  const action = Action({ id: "a1", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
  const actionJson = toJSON(action);

  let actionResp;
  const reqAction = http.request(
    { hostname: "127.0.0.1", port, method: "POST", path: "/action", headers: { "content-type": "application/json" } },
    (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => { actionResp = { status: res.statusCode, type: res.headers["content-type"], body: data }; });
    }
  );
  reqAction.on("error", (e) => { throw e; });
  reqAction.write(actionJson);
  reqAction.end();

  const msgs = await up.poll({ wait: true });
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].kind, "message");
  assert.strictEqual(msgs[0].type, "action");
  assert.strictEqual(msgs[0].body.kind, "action");
  assert.strictEqual(msgs[0].body.id, "a1");

  const reply = Reply({ to: "a1", seat: 0, ok: true, reason: null });
  up.emit(Message.reply(reply));

  while (actionResp === undefined) { await tick(); }
  assert.strictEqual(actionResp.status, 200);
  assert.strictEqual(actionResp.type, "application/json");
  const parsedReply = fromJSON(actionResp.body);
  assert.strictEqual(parsedReply.kind, "reply");
  assert.strictEqual(parsedReply.to, "a1");
  assert.strictEqual(parsedReply.ok, true);

  // POST /action: duplicate id while waiting -> 409
  const action2 = Action({ id: "a2", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
  const action2Json = toJSON(action2);

  let action2Resp;
  const reqAction2 = http.request(
    { hostname: "127.0.0.1", port, method: "POST", path: "/action", headers: { "content-type": "application/json" } },
    (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => { action2Resp = { status: res.statusCode, type: res.headers["content-type"], body: data }; });
    }
  );
  reqAction2.on("error", (e) => { throw e; });
  reqAction2.write(action2Json);
  reqAction2.end();

  let dupResp;
  const reqDup = http.request(
    { hostname: "127.0.0.1", port, method: "POST", path: "/action", headers: { "content-type": "application/json" } },
    (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => { dupResp = { status: res.statusCode, type: res.headers["content-type"], body: data }; });
    }
  );
  reqDup.on("error", (e) => { throw e; });
  reqDup.write(action2Json);
  reqDup.end();

  while (dupResp === undefined) { await tick(); }
  assert.strictEqual(dupResp.status, 409);
  assert.strictEqual(dupResp.type, "text/plain");
  assert.strictEqual(typeof dupResp.body, "string");

  const reply2 = Reply({ to: "a2", seat: 0, ok: true, reason: null });
  up.emit(Message.reply(reply2));
  while (action2Resp === undefined) { await tick(); }
  await up.poll({ wait: false }); // clear the "a2" action from the queue

  // GET /events
  let eventsResp;
  const eventsReq = http.request(
    { hostname: "127.0.0.1", port, method: "GET", path: "/events" },
    (res) => {
      eventsResp = { status: res.statusCode, type: res.headers["content-type"] };
      res.resume();
    }
  );
  eventsReq.end();
  while (eventsResp === undefined) { await tick(); }
  assert.strictEqual(eventsResp.status, 200);
  assert.strictEqual(eventsResp.type, "text/event-stream");
  eventsReq.abort();

  // poll empty queue with wait: false
  const empty = await up.poll({ wait: false });
  assert.deepStrictEqual(empty, []);

  // emit "game" -> fanout.publish(encodeEvent)
  const gmsg = Message.game(makeGame());
  up.emit(gmsg);

  // emit unknown -> ignored
  up.emit({ kind: "notamessage" });

  await close();
}
