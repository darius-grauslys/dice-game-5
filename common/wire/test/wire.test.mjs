import { test } from "node:test";
import assert from "node:assert/strict";

import { Message, Reply } from "../../shapes/index.mjs";
import { toJSON, fromJSON } from "../../json/index.mjs";
import { ROUTES, PAGE, pageFor, encodeEvent, decodeEvents } from "../index.mjs";

test("ROUTES is the frozen object", () => {
  assert.deepStrictEqual(ROUTES, {
    page: "/",
    client: "/client.js",
    action: "/action",
    events: "/events",
    music: "/music.json",
    assets: "/assets/",
  });
  assert.ok(Object.isFrozen(ROUTES));
});

test("PAGE is the exact string", () => {
  assert.strictEqual(
    PAGE,
    '<!doctype html><meta charset="utf-8"><title>dice</title><style>html,body{margin:0;background:#1d2b24}canvas{display:block}</style><canvas width="800" height="600"></canvas><script type="module" src="/client.js"></script>'
  );
});

test("pageFor(7) inserts the dice-seed meta", () => {
  assert.strictEqual(
    pageFor(7),
    '<!doctype html><meta charset="utf-8"><meta name="dice-seed" content="7"><title>dice</title><style>html,body{margin:0;background:#1d2b24}canvas{display:block}</style><canvas width="800" height="600"></canvas><script type="module" src="/client.js"></script>'
  );
});

test("pageFor rejects invalid seeds", () => {
  assert.throws(() => pageFor(-1), /^TypeError: pageFor: /);
  assert.throws(() => pageFor(1.5), /^TypeError: pageFor: /);
  assert.throws(() => pageFor("7"), /^TypeError: pageFor: /);
});

test("encodeEvent encodes a reply message", () => {
  const m = Message.reply(Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" }));
  const ev = encodeEvent(m);
  assert.strictEqual(
    ev,
    'data: {"kind":"message","type":"reply","body":{"kind":"reply","to":"0:3","seat":0,"ok":false,"reason":"stale"}}\n\n'
  );
});

test("encodeEvent rejects a non-message", () => {
  assert.throws(
    () => encodeEvent({ kind: "reply", to: "0:3", seat: 0, ok: false, reason: "stale" }),
    /^TypeError: encodeEvent: /
  );
  assert.throws(() => encodeEvent(null), /^TypeError: encodeEvent: /);
  assert.throws(() => encodeEvent(Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" })), /^TypeError: encodeEvent: /);
});

test("decodeEvents parses one message and returns rest", () => {
  const that =
    'data: {"kind":"message","type":"reply","body":{"kind":"reply","to":"0:3","seat":0,"ok":false,"reason":"stale"}}\n\n';
  const [messages, rest] = decodeEvents(that + ": ping\n\n" + "data: {\"ki");
  assert.strictEqual(rest, 'data: {"ki');
  assert.strictEqual(messages.length, 1);
  const expected = Message.reply(Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" }));
  assert.deepStrictEqual(messages[0], expected);
});

test("decodeEvents on empty string", () => {
  assert.deepStrictEqual(decodeEvents(""), [[], ""]);
});

test("decodeEvents skips comment-only event", () => {
  const text = ": ping\n\ndata: {\"kind\":\"message\",\"type\":\"reply\",\"body\":{\"kind\":\"reply\",\"to\":\"0:3\",\"seat\":0,\"ok\":false,\"reason\":\"stale\"}}\n\n";
  const [messages] = decodeEvents(text);
  assert.strictEqual(messages.length, 1);
});

test("decodeEvents skips event with no data line", () => {
  const text = "some text\n\ndata: {\"kind\":\"message\",\"type\":\"reply\",\"body\":{\"kind\":\"reply\",\"to\":\"0:3\",\"seat\":0,\"ok\":false,\"reason\":\"stale\"}}\n\n";
  const [messages] = decodeEvents(text);
  assert.strictEqual(messages.length, 1);
});

test("decodeEvents throws on a Die's JSON", () => {
  const dieJson = '{"kind":"die","id":0,"o":0}';
  const text = `data: ${dieJson}\n\n`;
  assert.throws(() => decodeEvents(text), /^TypeError: decodeEvents: /);
});

test("decodeEvents messages array is frozen", () => {
  const that =
    'data: {"kind":"message","type":"reply","body":{"kind":"reply","to":"0:3","seat":0,"ok":false,"reason":"stale"}}\n\n';
  const [messages] = decodeEvents(that);
  assert.ok(Object.isFrozen(messages));
});

test("decodeEvents throws when data is not a Message", () => {
  const replyJson = '{"kind":"reply","to":"0:3","seat":0,"ok":false,"reason":"stale"}';
  const text = `data: ${replyJson}\n\n`;
  assert.throws(() => decodeEvents(text), /^TypeError: decodeEvents: /);
});
