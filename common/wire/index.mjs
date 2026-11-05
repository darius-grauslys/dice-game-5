// common/wire: what the network carries, as data and pure functions.

import { toJSON, fromJSON } from "../json/index.mjs";

export const ROUTES = Object.freeze({
  page: "/",
  client: "/client.js",
  action: "/action",
  events: "/events",
  music: "/music.json",
  assets: "/assets/",
});

export const PAGE =
  '<!doctype html><meta charset="utf-8"><title>dice</title><style>html,body{margin:0;background:#1d2b24}canvas{display:block}</style><canvas width="800" height="600"></canvas><script type="module" src="/client.js"></script>';

export function pageFor(seed) {
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0) {
    throw new TypeError("pageFor: seed must be an integer >= 0");
  }
  return PAGE.replace(
    '<meta charset="utf-8">',
    '<meta charset="utf-8"><meta name="dice-seed" content="' + seed + '">'
  );
}

export function encodeEvent(message) {
  if (!(message && typeof message === "object" && message.kind === "message")) {
    throw new TypeError("encodeEvent: expected a Message");
  }
  return "data: " + toJSON(message) + "\n\n";
}

export function decodeEvents(text) {
  const parts = text.split("\n\n");
  const rest = parts.pop();
  const messages = [];
  for (const part of parts) {
    const lines = part.split("\n");
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        dataLines.push(line.slice(6));
      } else if (line.startsWith(":")) {
        // comment: ignored
      }
    }
    if (dataLines.length === 0) {
      // an event with no data line is skipped
      continue;
    }
    const jsonText = dataLines.join("\n");
    const value = fromJSON(jsonText);
    if (!(value && typeof value === "object" && value.kind === "message")) {
      throw new TypeError(`decodeEvents: expected a Message, got ${show(value)}`);
    }
    messages.push(value);
  }
  return [Object.freeze(messages), rest];
}

function show(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "function") return "a function";
  if (Array.isArray(v)) return "an array";
  if (v && typeof v === "object") {
    if (typeof v.kind === "string") return `a ${v.kind}`;
    return "an object";
  }
  return typeof v;
}
