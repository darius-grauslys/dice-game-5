import assert from "node:assert/strict";
import http from "node:http";

import {
  pageFor,
  ROUTES,
  Message,
  Action,
  Reply,
  toJSON,
  fromJSON,
  Game,
  Player,
  Queue,
  Group,
  Die,
} from "../../common/index.mjs";
import * as real from "../../edges/network/network_to_serve.mjs";

// ---- wrapped start ----

export function start(args) {
  // A) check its arguments against the doc, and throw an Error naming the function
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("start: expected an object with host, port, seed");
  }
  const { host, port, seed } = args;
  if (typeof host !== "string") {
    throw new Error("start: host must be a string");
  }
  if (typeof port !== "number" || !Number.isInteger(port) || port < 0) {
    throw new Error("start: port must be an integer >= 0");
  }
  if (seed !== undefined && (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0)) {
    throw new Error("start: seed must be an integer >= 0 or undefined");
  }
  // B) call the function through the forwarder
  const p = real.start(args);
  // C) check that it returned
  if (!(p instanceof Promise)) {
    throw new Error("start: did not return a Promise");
  }
  // D) check the return value against the doc (shape and content)
  return p.then((up) => {
    if (!up || typeof up.kind !== "string" || up.kind !== "up") {
      throw new Error("start: Up should have kind 'up'");
    }
    if (typeof up.poll !== "function" || typeof up.emit !== "function") {
      throw new Error("start: Up should have poll and emit functions");
    }
    return up;
  });
}

// ---- wrapped close ----

export function close() {
  // A) check its arguments against the doc: no arguments expected
  if (arguments.length > 0) {
    throw new Error("close: expected no arguments");
  }
  // B) call the function through the forwarder
  const p = real.close();
  // C) check that it returned
  if (!(p instanceof Promise)) {
    throw new Error("close: did not return a Promise");
  }
  // D) check the return value against the doc: Promise<void>
  return p.then(() => undefined);
}

// ---- HTTP helpers ----

function get(port, path, { stream } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
      if (stream) {
        resolve({ status: res.statusCode, type: res.headers["content-type"] });
        req.destroy();
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          type: res.headers["content-type"],
          body: Buffer.concat(chunks),
        });
      });
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

function postAction(port, bodyText) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/action", method: "POST", headers: { "content-type": "application/json" } },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            type: res.headers["content-type"],
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.write(bodyText);
    req.end();
  });
}

// ---- Game builder ----

function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(Die({ id: seat * 4 + k, o: 0 }));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
  }
  return players;
}

function makeGame(patch = {}) {
  return Game({ players: makePlayers(), turn: 0, version: 0, rng: 1, last: null, winner: null, ...patch });
}

// Poll until non-empty or timeout.
async function drainUntil(up, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const msgs = await up.poll({ wait: false });
    if (msgs.length > 0) return msgs;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("drainUntil: timed out waiting for queued messages");
}

// ---- _sheo_check ----

export async function _sheo_check() {
  const port = 20000 + Math.floor(Math.random() * 40000);

  // start server
  const up = await start({ host: "127.0.0.1", port, seed: 7 });

  try {
    // 1. GET / answers pageFor(7)
    const home = await get(port, "/");
    assert.strictEqual(home.status, 200);
    assert.strictEqual(home.type, "text/html");
    assert.strictEqual(home.body.toString("utf8"), pageFor(7));

    // 2. GET /music.json answers a JSON array of strings starting /assets/music/ and ending .mp3
    const music = await get(port, ROUTES.music);
    assert.strictEqual(music.status, 200);
    assert.strictEqual(music.type, "application/json");
    const musicRoutes = JSON.parse(music.body.toString("utf8"));
    assert.ok(Array.isArray(musicRoutes));
    assert.ok(musicRoutes.length > 0, "music routes should not be empty");
    for (const r of musicRoutes) {
      assert.ok(r.startsWith("/assets/music/"), `route ${r} should start with /assets/music/`);
      assert.ok(r.endsWith(".mp3"), `route ${r} should end with .mp3`);
    }

    // 3. fetching the first gives audio/mpeg and non-empty bytes
    const firstMp3 = musicRoutes[0];
    const mp3 = await get(port, firstMp3);
    assert.strictEqual(mp3.status, 200);
    assert.strictEqual(mp3.type, "audio/mpeg");
    assert.ok(mp3.body.length > 0, "mp3 bytes should be non-empty");

    // 4. GET /assets/ui/mute.png gives image/png bytes starting with the PNG signature
    const png = await get(port, "/assets/ui/mute.png");
    assert.strictEqual(png.status, 200);
    assert.strictEqual(png.type, "image/png");
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    assert.ok(png.body.slice(0, 4).equals(pngSig), "png bytes should start with PNG signature");

    // 5. GET /client.js answers text/javascript
    const client = await get(port, ROUTES.client);
    assert.strictEqual(client.status, 200);
    assert.strictEqual(client.type, "text/javascript");
    assert.ok(client.body.length > 0, "client.js should be non-empty");

    // 6. GET /events answers text/event-stream
    const events = await get(port, ROUTES.events, { stream: true });
    assert.strictEqual(events.status, 200);
    assert.strictEqual(events.type, "text/event-stream");

    // 7. POST /action with invalid JSON → 400, text/plain
    const badPost = await postAction(port, "not json");
    assert.strictEqual(badPost.status, 400);
    assert.strictEqual(badPost.type, "text/plain");
    assert.ok(typeof badPost.body.toString("utf8") === "string", "400 body should be a string");

    // 8. POST /action with valid JSON but not an Action → 400, text/plain
    const notActionText = JSON.stringify({ kind: "game" });
    const notActionPost = await postAction(port, notActionText);
    assert.strictEqual(notActionPost.status, 400);
    assert.strictEqual(notActionPost.type, "text/plain");

    // 9. POST /action with a valid action → 200, application/json, toJSON(reply)
    const actionObj = { kind: "action", id: "act-1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 };
    const actionText = toJSON(actionObj);
    const postP = postAction(port, actionText);
    // wait for the action to be queued: this means hold.wait(action.id) has been called
    const polled = await drainUntil(up);
    assert.strictEqual(polled.length, 1);
    assert.strictEqual(polled[0].kind, "message");
    assert.strictEqual(polled[0].type, "action");
    assert.strictEqual(polled[0].body.id, "act-1");
    up.emit(Message.reply(Reply({ to: "act-1", seat: 0, ok: true, reason: null })));
    const postRes = await postP;
    assert.strictEqual(postRes.status, 200);
    assert.strictEqual(postRes.type, "application/json");
    const parsedReply = JSON.parse(postRes.body.toString("utf8"));
    assert.strictEqual(parsedReply.kind, "reply");
    assert.strictEqual(parsedReply.to, "act-1");

    // 10. POST /action same id twice → one 200, one 409
    const dupObj = { kind: "action", id: "dup-1", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 };
    const dupText = toJSON(dupObj);
    const p1 = postAction(port, dupText);
    const p2 = postAction(port, dupText);
    // wait for the first action to be queued: the second POST's hold.wait throws → 409
    await drainUntil(up);
    up.emit(Message.reply(Reply({ to: "dup-1", seat: 0, ok: true, reason: null })));
    const [r1, r2] = await Promise.all([p1, p2]);
    const statuses = [r1.status, r2.status].sort();
    assert.deepStrictEqual(statuses, [200, 409]);

    // 11. poll: empty queue returns []
    const empty = await up.poll({ wait: false });
    assert.deepStrictEqual(empty, []);

    // 12. emit: reply settles hold (no pending hold here, no effect), game publishes to fanout, else ignored
    up.emit(Message.reply(Reply({ to: "nope", seat: 0, ok: true, reason: null })));
    up.emit(Message.game(makeGame()));
    up.emit({ kind: "weird" });
    const emptyAfter = await up.poll({ wait: false });
    assert.deepStrictEqual(emptyAfter, []);
  } finally {
    // close at the end
    await close();
  }
}
