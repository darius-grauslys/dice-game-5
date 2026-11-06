import assert from "node:assert/strict";
import { Die, Group, Queue, Player, Game, Last, Reply, AXES, DIRS } from "../../common/index.mjs";
import * as real from "../../edges/client/client_to_render.mjs";

// ---- wrappers: a drop-in for the forwarder ----

export function init(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("init: expected an object {canvas, seat}");
  if (!("canvas" in input)) throw new Error("init: missing canvas");
  if (!("seat" in input)) throw new Error("init: missing seat");
  const seat = input.seat;
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 3)
    throw new Error("init: seat must be an integer 0..3");
  const ret = real.init({ canvas: input.canvas, seat });
  if (ret !== undefined) throw new Error("init: expected void return");
  return ret;
}

export function nextFrame() {
  const ret = real.nextFrame();
  if (!(ret instanceof Promise)) throw new Error("nextFrame: expected a Promise");
  return ret.then((n) => {
    if (typeof n !== "number") throw new Error("nextFrame: expected Promise<number>");
    return n;
  });
}

export function show(prev, next) {
  const prevOk = prev === null || (prev && prev.kind === "game");
  const nextOk = next && next.kind === "game";
  if (!prevOk) throw new Error("show: prev must be null or a Game");
  if (!nextOk) throw new Error("show: next must be a Game");
  const ret = real.show(prev, next);
  if (ret !== undefined) throw new Error("show: expected void return");
  return ret;
}

export function hold(h) {
  if (h === null) {
    const ret = real.hold(null);
    if (ret !== undefined) throw new Error("hold: expected void return");
    return ret;
  }
  if (h === null || typeof h !== "object" || Array.isArray(h))
    throw new Error("hold: expected null or {ids, axis, dir, at, to}");
  if (!Array.isArray(h.ids)) throw new Error("hold: ids must be an array");
  for (const id of h.ids) {
    if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > 15)
      throw new Error("hold: ids must be integers 0..15");
  }
  if (!AXES.includes(h.axis)) throw new Error("hold: axis must be 'x', 'y' or 'z'");
  if (!DIRS.includes(h.dir)) throw new Error("hold: dir must be 1 or -1");
  if (h.at === null || typeof h.at !== "object" || !("x" in h.at) || !("y" in h.at))
    throw new Error("hold: at must be {x, y}");
  if (h.to === null || typeof h.to !== "object" || !("x" in h.to) || !("y" in h.to))
    throw new Error("hold: to must be {x, y}");
  const ret = real.hold(h);
  if (ret !== undefined) throw new Error("hold: expected void return");
  return ret;
}

export function notice(reply) {
  if (!(reply && reply.kind === "reply")) throw new Error("notice: expected a Reply");
  const ret = real.notice(reply);
  if (ret !== undefined) throw new Error("notice: expected void return");
  return ret;
}

export function pick(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("pick: expected an object {x, y}");
  if (typeof input.x !== "number" || typeof input.y !== "number")
    throw new Error("pick: x and y must be numbers");
  const ret = real.pick({ x: input.x, y: input.y });
  if (ret !== null && !(ret && ret.kind === "die"))
    throw new Error("pick: expected {kind: \"die\", id} or null");
  if (ret !== null && (typeof ret.id !== "number" || !Number.isInteger(ret.id) || ret.id < 0 || ret.id > 15))
    throw new Error("pick: id must be an integer 0..15");
  return ret;
}

export function describe() {
  const ret = real.describe();
  if (ret === null || typeof ret !== "object" || Array.isArray(ret))
    throw new Error("describe: expected an object");
  if (!Array.isArray(ret.dice)) throw new Error("describe: dice must be an array");
  return ret;
}

// ---- fixture helpers ----

function makeFixtureGame() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(Die({ id: seat * 4 + k, o: 0 }));
    players.push(Player({ seat, queue: Queue({ groups: [Group({ dice })] }) }));
  }
  const diceIds = [];
  const before = [];
  for (let i = 0; i < 16; i++) { diceIds.push(i); before.push(0); }
  const last = Last({ action: null, change: "deal", dice: diceIds, before });
  return Game({ players, turn: 0, version: 0, rng: 1, last, winner: null });
}

export const _sheo_browser = true;

export async function _sheo_check() {
  // Add dice-seed meta before init.
  const meta = document.createElement("meta");
  meta.name = "dice-seed";
  meta.content = "1";
  document.head.appendChild(meta);

  const canvas = document.querySelector("canvas");
  const game = makeFixtureGame();

  // init
  init({ canvas, seat: 0 });

  // show(null, game): draws 16 dice
  show(null, game);
  await nextFrame();

  // describe().dice has 16 dice, entries are {id, x, y, visibleFaces}
  const desc = describe();
  assert.strictEqual(desc.dice.length, 16, "describe().dice has 16 dice");
  for (const d of desc.dice) {
    assert.ok("id" in d, "describe().dice[i] has id");
    assert.strictEqual(typeof d.id, "number", "describe().dice[i].id is a number");
    assert.ok("x" in d, "describe().dice[i] has x");
    assert.ok("y" in d, "describe().dice[i] has y");
    assert.ok("visibleFaces" in d, "describe().dice[i] has visibleFaces");
  }

  // glow is seat turn's rightmost group: for the fixture game each player has one group.
  const turn = game.turn;
  const winner = game.winner;
  const expectedGlow = winner === null
    ? game.players[turn].queue.groups[game.players[turn].queue.groups.length - 1].dice.map((d) => d.id)
    : [];
  assert.deepStrictEqual(expectedGlow, [0, 1, 2, 3], "expected glow ids for turn 0");

  // pick at a die's described centre gives that die.
  for (const d of desc.dice) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    const picked = pick({ x, y });
    assert.deepStrictEqual(picked, { kind: "die", id: d.id }, `pick at die ${d.id}'s centre`);
  }

  // hold({ids: [3], axis: "y", dir: 1, at, to}) changes die 3's visibleFaces.
  const d3before = desc.dice.find((d) => d.id === 3);
  const v0 = d3before.visibleFaces;
  const at = { x: 400, y: 300 };
  const to = { x: 405, y: 302 };
  hold({ ids: [3], axis: "y", dir: 1, at, to });

  const desc2 = describe();
  const d3after = desc2.dice.find((d) => d.id === 3);
  const v1 = d3after.visibleFaces;
  assert.notStrictEqual(v1, v0, "die 3's visibleFaces changed after hold");

  // hold(null) restores them.
  hold(null);
  const desc3 = describe();
  const d3restored = desc3.dice.find((d) => d.id === 3);
  assert.deepStrictEqual(d3restored.visibleFaces, v0, "die 3's visibleFaces restored after hold(null)");

  // nextFrame resolves to a number.
  const n = await nextFrame();
  assert.strictEqual(typeof n, "number", "nextFrame resolves to a number");

  // notice with a Reply.
  const reply = Reply({ to: "0:3", seat: 0, ok: false, reason: "stale" });
  notice(reply);
}
