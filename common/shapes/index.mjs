// common/shapes: the game's state as frozen values and their constructors.
//
// Pure: no imports, no IO, no time, no randomness. The browser loads this too.
//
// Every constructor takes one object of named fields, checks every field
// (and rejects unknown fields) with a TypeError whose message starts
// `<Constructor>.<field>: `, and returns a deeply frozen plain object: the
// `kind` field first, then the fields in the spec's order. Nested values are
// passed through, not copied: a Die inside a Group is the object you passed.

// ---- shared helpers (internal, not exported) ----

const MAX_RNG = 4294967295; // 2^32 - 1

function isInt(v) {
  return typeof v === "number" && Number.isInteger(v);
}

// How a bad value is shown in an error message.
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

function typeError(message) {
  return new TypeError(message);
}

// Fail a field check: missing, or present but of the wrong kind.
function field(prefix, present, expected, value) {
  if (!present) throw typeError(`${prefix}: missing`);
  throw typeError(`${prefix}: expected ${expected}, got ${show(value)}`);
}

// An integer in [min, max] (inclusive), described as "an integer 0..15".
function expectInt(prefix, present, value, min, max) {
  if (!isInt(value) || value < min || value > max)
    field(prefix, present, `an integer ${min}..${max}`, value);
  return value;
}

// A value from a fixed list, described as '"turn", "roll" or "deal"'.
function expectOneOf(prefix, present, value, list) {
  if (!list.includes(value))
    field(prefix, present, list.map((w) => JSON.stringify(w)).join(", "), value);
  return value;
}

// An object already built by its constructor, recognised by its kind,
// optionally allowing null.
function expectKind(prefix, present, value, kind, orNull) {
  if (value === null && orNull) return null;
  const name = `a ${kind[0].toUpperCase()}${kind.slice(1)}`;
  const expected = orNull ? `${name} or null` : name;
  if (!(value && typeof value === "object" && value.kind === kind))
    field(prefix, present, expected, value);
  return value;
}

// A non-empty string.
function expectNonEmptyString(prefix, present, value) {
  if (typeof value !== "string" || value.length === 0)
    field(prefix, present, "a non-empty string", value);
  return value;
}

// A boolean.
function expectBool(prefix, present, value) {
  if (typeof value !== "boolean") field(prefix, present, "a boolean", value);
  return value;
}

// A function.
function expectFn(prefix, present, value) {
  if (typeof value !== "function") field(prefix, present, "a function", value);
  return value;
}

// The input: one object of named fields, nothing unknown.
function checkFields(name, input, fields) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw typeError(`${name}: expected an object, got ${show(input)}`);
  const known = new Set(fields);
  for (const key of Object.keys(input))
    if (!known.has(key)) throw typeError(`${name}.${key}: unknown field`);
  return input;
}

// Deep freeze: the object, every array and object inside it. Functions are
// passed through untouched (Up's poll and emit).
function deepFreeze(v) {
  if (v && typeof v === "object") {
    for (const key of Object.getOwnPropertyNames(v)) deepFreeze(v[key]);
    Object.freeze(v);
  }
  return v;
}

// ---- constants ----

export const AXES = deepFreeze(["x", "y", "z"]);
export const DIRS = deepFreeze([1, -1]);
export const REASONS = deepFreeze([
  "not-your-turn",
  "stale",
  "illegal",
  "over",
  "malformed",
]);

// ---- constructors ----

export function Die(input) {
  const f = checkFields("Die", input, ["id", "o"]);
  const id = expectInt("Die.id", "id" in f, f.id, 0, 15);
  const o = expectInt("Die.o", "o" in f, f.o, 0, 23);
  return deepFreeze({ kind: "die", id, o });
}

export function Group(input) {
  const f = checkFields("Group", input, ["dice"]);
  if (!("dice" in f)) throw typeError("Group.dice: missing");
  const { dice } = f;
  if (!Array.isArray(dice))
    throw typeError(`Group.dice: expected an array of Die, got ${show(dice)}`);
  if (dice.length === 0)
    throw typeError("Group.dice: expected at least one Die");
  dice.forEach((d, i) => {
    if (!(d && typeof d === "object" && d.kind === "die"))
      throw typeError(`Group.dice: expected a Die at index ${i}, got ${show(d)}`);
  });
  return deepFreeze({ kind: "group", dice });
}

export function Queue(input) {
  const f = checkFields("Queue", input, ["groups"]);
  if (!("groups" in f)) throw typeError("Queue.groups: missing");
  const { groups } = f;
  if (!Array.isArray(groups))
    throw typeError(
      `Queue.groups: expected an array of Group, got ${show(groups)}`,
    );
  groups.forEach((g, i) => expectKind("Queue.groups", true, g, "group"));
  return deepFreeze({ kind: "queue", groups });
}

export function Player(input) {
  const f = checkFields("Player", input, ["seat", "queue"]);
  const seat = expectInt("Player.seat", "seat" in f, f.seat, 0, 3);
  const queue = expectKind("Player.queue", "queue" in f, f.queue, "queue");
  return deepFreeze({ kind: "player", seat, queue });
}

export function Action(input) {
  const f = checkFields("Action", input, [
    "id",
    "seat",
    "move",
    "axis",
    "dir",
    "version",
  ]);
  const id = expectNonEmptyString("Action.id", "id" in f, f.id);
  const seat = expectInt("Action.seat", "seat" in f, f.seat, 0, 3);
  const move = expectOneOf("Action.move", "move" in f, f.move, ["turn", "roll"]);
  let axis;
  let dir;
  if (move === "turn") {
    axis = expectOneOf("Action.axis", "axis" in f, f.axis, AXES);
    dir = expectOneOf("Action.dir", "dir" in f, f.dir, DIRS);
  } else {
    if ("axis" in f && f.axis !== null)
      field("Action.axis", true, "null (a roll)", f.axis);
    if ("dir" in f && f.dir !== null)
      field("Action.dir", true, "null (a roll)", f.dir);
    axis = null;
    dir = null;
  }
  const version = expectInt(
    "Action.version",
    "version" in f,
    f.version,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  return deepFreeze({ kind: "action", id, seat, move, axis, dir, version });
}

export function Last(input) {
  const f = checkFields("Last", input, ["action", "change", "dice", "before"]);
  const action = expectKind("Last.action", "action" in f, f.action, "action", true);
  const change = expectOneOf("Last.change", "change" in f, f.change, [
    "turn",
    "roll",
    "deal",
  ]);
  if (change === "deal") {
    if (action !== null)
      field("Last.action", true, "null (a deal)", action);
  } else if (action === null) {
    field("Last.action", true, "an Action (a turn or roll)", action);
  } else if (action.move !== change) {
    field(
      "Last.action",
      true,
      `an Action with move ${JSON.stringify(change)}`,
      action,
    );
  }
  if (!("dice" in f)) throw typeError("Last.dice: missing");
  const { dice } = f;
  if (!Array.isArray(dice))
    field("Last.dice", true, "an array of die ids", dice);
  if (dice.length === 0)
    throw typeError("Last.dice: expected at least one die id");
  dice.forEach((d) => expectInt("Last.dice", true, d, 0, 15));
  {
    const seen = new Set();
    for (const d of dice) {
      if (seen.has(d))
        throw typeError(`Last.dice: die ${d} appears twice`);
      seen.add(d);
    }
  }
  if (!("before" in f)) throw typeError("Last.before: missing");
  const { before } = f;
  if (!Array.isArray(before))
    field("Last.before", true, "an array of orientations", before);
  if (before.length !== dice.length)
    throw typeError(
      `Last.before: expected ${dice.length} orientation(s), got ${before.length}`,
    );
  before.forEach((o) => expectInt("Last.before", true, o, 0, 23));
  return deepFreeze({ kind: "last", action, change, dice, before });
}

const GAME_FIELDS = ["players", "turn", "version", "rng", "last", "winner", "faces"];

export function Game(input) {
  const f = checkFields("Game", input, GAME_FIELDS);
  let players;
  if ("players" in f) {
    if (!Array.isArray(f.players))
      field("Game.players", true, "an array of 4 Player", f.players);
    if (f.players.length !== 4)
      throw typeError(
        `Game.players: expected exactly 4 players, got ${f.players.length}`,
      );
    f.players.forEach((p) => expectKind("Game.players", true, p, "player"));
    f.players.forEach((p, i) => {
      if (p.seat !== i)
        throw typeError(
          `Game.players: player ${i} has seat ${p.seat}, expected ${i}`,
        );
    });
    // The invariant: all 16 dice, each exactly once, across the queues.
    const seen = new Array(16).fill(false);
    for (const p of f.players)
      for (const g of p.queue.groups)
        for (const d of g.dice) {
          if (seen[d.id])
            throw typeError(`Game.players: die ${d.id} appears twice`);
          seen[d.id] = true;
        }
    for (let id = 0; id < 16; id++)
      if (!seen[id]) throw typeError(`Game.players: die ${id} is missing`);
    players = f.players;
  } else {
    field("Game.players", false, "an array of 4 Player", undefined);
  }
  const turn = expectInt("Game.turn", "turn" in f, f.turn, 0, 3);
  const version = expectInt(
    "Game.version",
    "version" in f,
    f.version,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const rng = expectInt("Game.rng", "rng" in f, f.rng, 0, MAX_RNG);
  const last = expectKind("Game.last", "last" in f, f.last, "last", true);
  let winner;
  if ("winner" in f)
    winner =
      f.winner === null
        ? null
        : expectInt("Game.winner", true, f.winner, 0, 3);
  else winner = field("Game.winner", false, "null or an integer 0..3", undefined);
  let faces;
  if ("faces" in f) {
    if (f.faces === null) {
      faces = null;
    } else {
      if (!Array.isArray(f.faces) || f.faces.length !== 4)
        throw typeError(
          `Game.faces: expected null or 4 numberings (permutations of 1..6), got ${show(f.faces)}`,
        );
      faces = [];
      for (let i = 0; i < 4; i++) {
        const n = f.faces[i];
        if (!Array.isArray(n) || n.length !== 6)
          throw typeError(
            `Game.faces: expected null or 4 numberings (permutations of 1..6), got ${show(f.faces)}`,
          );
        const seen = new Set();
        for (const v of n) {
          if (!isInt(v) || v < 1 || v > 6)
            throw typeError(
              `Game.faces: expected null or 4 numberings (permutations of 1..6), got ${show(f.faces)}`,
            );
          if (seen.has(v))
            throw typeError(
              `Game.faces: expected null or 4 numberings (permutations of 1..6), got ${show(f.faces)}`,
            );
          seen.add(v);
        }
        faces.push(n);
      }
    }
  } else {
    faces = null;
  }
  const game = { kind: "game", players, turn, version, rng, last, winner, faces };
  // with(patch): a new Game with the patched fields, every check running
  // again; the old Game is untouched. Non-enumerable, so it stays out of
  // Object.keys, JSON.stringify and deepStrictEqual.
  Object.defineProperty(game, "with", {
    value: function with_(patch) {
      if (patch === null || typeof patch !== "object" || Array.isArray(patch))
        throw typeError(`Game.with: expected an object, got ${show(patch)}`);
      const next = {};
      for (const key of GAME_FIELDS) next[key] = game[key];
      for (const key of Object.keys(patch)) {
        if (!GAME_FIELDS.includes(key))
          throw typeError(`Game.with: unknown field ${key}`);
        next[key] = patch[key];
      }
      return Game(next);
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return deepFreeze(game);
}

export function Reply(input) {
  const f = checkFields("Reply", input, ["to", "seat", "ok", "reason"]);
  const to = expectNonEmptyString("Reply.to", "to" in f, f.to);
  const seat = expectInt("Reply.seat", "seat" in f, f.seat, 0, 3);
  const ok = expectBool("Reply.ok", "ok" in f, f.ok);
  let reason;
  if ("reason" in f) {
    if (ok) {
      if (f.reason !== null)
        field("Reply.reason", true, "null (ok is true)", f.reason);
      reason = null;
    } else {
      if (f.reason === null)
        field(
          "Reply.reason",
          true,
          `one of ${REASONS.join(", ")}`,
          f.reason,
        );
      reason = expectOneOf("Reply.reason", true, f.reason, REASONS);
    }
  } else {
    field(
      "Reply.reason",
      false,
      ok ? "null" : `one of ${REASONS.join(", ")}`,
      undefined,
    );
  }
  return deepFreeze({ kind: "reply", to, seat, ok, reason });
}

export function Up(input) {
  const f = checkFields("Up", input, ["poll", "emit"]);
  const poll = expectFn("Up.poll", "poll" in f, f.poll);
  const emit = expectFn("Up.emit", "emit" in f, f.emit);
  // The object is frozen; the functions inside are not.
  return deepFreeze({ kind: "up", poll, emit });
}

// ---- messages (what the network carries) ----

function makeMessage(type) {
  const kind = type; // "game" | "action" | "reply"
  const article = type === "action" ? "an" : "a";
  const name = type[0].toUpperCase() + type.slice(1);
  return (value) => {
    if (!(value && typeof value === "object" && value.kind === kind))
      throw typeError(`Message.${type}: expected ${article} ${name}`);
    return deepFreeze({ kind: "message", type, body: value });
  };
}

export const Message = deepFreeze({
  game: makeMessage("game"),
  action: makeMessage("action"),
  reply: makeMessage("reply"),
});
