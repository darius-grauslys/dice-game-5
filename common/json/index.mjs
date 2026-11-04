// common/json: serialise game values to JSON text and rebuild them.

import { Die, Group, Queue, Player, Last, Game, Action, Reply, Message } from "../shapes/index.mjs";

// Does this value (recursively) hold a function? Non-enumerable properties
// (like Game.with) are skipped: JSON.stringify leaves them out anyway.
function holdsFunction(v) {
  if (typeof v === "function") return true;
  if (v && typeof v === "object") {
    for (const key of Object.getOwnPropertyNames(v)) {
      const desc = Object.getOwnPropertyDescriptor(v, key);
      if (desc && !desc.enumerable) continue;
      if (holdsFunction(v[key])) return true;
    }
  } else if (Array.isArray(v)) {
    for (const item of v) {
      if (holdsFunction(item)) return true;
    }
  }
  return false;
}

export function toJSON(value) {
  if (holdsFunction(value)) {
    throw new TypeError("toJSON: value holding a function can't be serialised");
  }
  return JSON.stringify(value);
}

function rebuild(obj) {
  if (Array.isArray(obj)) {
    return obj.map(rebuild);
  }
  if (typeof obj === "object" && obj !== null) {
    if (typeof obj.kind !== "string") {
      throw new TypeError("fromJSON: missing kind");
    }
    const kind = obj.kind;

    switch (kind) {
      case "die": {
        const fields = { ...obj };
        delete fields.kind;
        return Die(fields);
      }
      case "group": {
        const fields = { ...obj };
        delete fields.kind;
        fields.dice = obj.dice ? obj.dice.map(rebuild) : [];
        return Group(fields);
      }
      case "queue": {
        const fields = { ...obj };
        delete fields.kind;
        fields.groups = obj.groups ? obj.groups.map(rebuild) : [];
        return Queue(fields);
      }
      case "player": {
        const fields = { ...obj };
        delete fields.kind;
        fields.queue = rebuild(fields.queue);
        return Player(fields);
      }
      case "action": {
        const fields = { ...obj };
        delete fields.kind;
        return Action(fields);
      }
      case "last": {
        const fields = { ...obj };
        delete fields.kind;
        fields.action = fields.action ? rebuild(fields.action) : null;
        return Last(fields);
      }
      case "game": {
        const fields = { ...obj };
        delete fields.kind;
        fields.players = fields.players ? fields.players.map(rebuild) : [];
        fields.last = fields.last ? rebuild(fields.last) : null;
        return Game(fields);
      }
      case "reply": {
        const fields = { ...obj };
        delete fields.kind;
        return Reply(fields);
      }
      case "message": {
        const fields = { ...obj };
        delete fields.kind;
        if (fields.type === "game") return Message.game(rebuild(fields.body));
        if (fields.type === "action") return Message.action(rebuild(fields.body));
        if (fields.type === "reply") return Message.reply(rebuild(fields.body));
        throw new TypeError(`fromJSON: unknown message type ${fields.type}`);
      }
      default:
        throw new TypeError(`fromJSON: unknown kind ${kind}`);
    }
  }
  throw new TypeError("fromJSON: expected an object");
}

export function fromJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new TypeError(`fromJSON: bad JSON: ${e.message}`);
  }
  return rebuild(parsed);
}

export function validate(json) {
  try {
    fromJSON(json);
    return [];
  } catch (e) {
    return [e.message];
  }
}
