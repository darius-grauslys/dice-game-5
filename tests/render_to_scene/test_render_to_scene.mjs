import * as real from "../../edges/render/render_to_scene.mjs";
import assert from "node:assert/strict";

export const _sheo_browser = true;

function show(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return "an array";
  if (v && typeof v === "object") return "an object";
  return typeof v;
}

export function init(arg) {
  if (arg === null || typeof arg !== "object" || Array.isArray(arg))
    throw new TypeError("init: expected an object, got " + show(arg));
  if (!("canvas" in arg)) throw new TypeError("init: missing canvas");
  if (!("seat" in arg)) throw new TypeError("init: missing seat");
  const canvas = arg.canvas;
  if (canvas === null || typeof canvas !== "object")
    throw new TypeError("init.canvas: expected an object, got " + show(canvas));
  if (typeof canvas.width !== "number" || typeof canvas.height !== "number")
    throw new TypeError("init.canvas: expected numeric width and height");
  const seat = arg.seat;
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 3)
    throw new TypeError("init.seat: expected an integer 0..3, got " + show(seat));
  const res = real.init(arg);
  if (res !== undefined) throw new TypeError("init: expected void, got " + show(res));
  return res;
}

export function nextFrame() {
  const res = real.nextFrame();
  if (!(res instanceof Promise)) throw new TypeError("nextFrame: expected a Promise");
  return Promise.resolve(res).then((t) => {
    if (typeof t !== "number") throw new TypeError("nextFrame: expected a number timestamp, got " + show(t));
    return t;
  });
}

export function play(tracks, poses) {
  if (!Array.isArray(tracks)) throw new TypeError("play: expected tracks array, got " + show(tracks));
  if (!Array.isArray(poses)) throw new TypeError("play: expected poses array, got " + show(poses));
  const res = real.play(tracks, poses);
  if (res !== undefined) throw new TypeError("play: expected void, got " + show(res));
  return res;
}

export function notice(reply) {
  if (reply === null || typeof reply !== "object" || Array.isArray(reply))
    throw new TypeError("notice: expected an object, got " + show(reply));
  if (!("ok" in reply)) throw new TypeError("notice: missing ok");
  if (typeof reply.ok !== "boolean") throw new TypeError("notice.ok: expected a boolean, got " + show(reply.ok));
  if (!reply.ok) {
    if (!("reason" in reply)) throw new TypeError("notice: missing reason");
    if (typeof reply.reason !== "string") throw new TypeError("notice.reason: expected a string, got " + show(reply.reason));
  }
  const res = real.notice(reply);
  if (res !== undefined) throw new TypeError("notice: expected void, got " + show(res));
  return res;
}

export function pick(arg) {
  if (arg === null || typeof arg !== "object" || Array.isArray(arg))
    throw new TypeError("pick: expected an object, got " + show(arg));
  if (!("x" in arg)) throw new TypeError("pick: missing x");
  if (!("y" in arg)) throw new TypeError("pick: missing y");
  if (typeof arg.x !== "number" || typeof arg.y !== "number")
    throw new TypeError("pick: expected numeric x and y");
  const res = real.pick(arg);
  if (res !== null) {
    if (res.kind === "die") {
      if (typeof res.id !== "number" || !Number.isInteger(res.id) || res.id < 0 || res.id > 15)
        throw new TypeError("pick: die id out of range");
      if (!["+x", "-x", "+y", "-y", "+z", "-z"].includes(res.normal))
        throw new TypeError("pick: invalid normal " + show(res.normal));
    } else if (res.kind === "roll") {
      // ok
    } else {
      throw new TypeError("pick: unexpected kind " + show(res.kind));
    }
  }
  return res;
}

export function describe() {
  const res = real.describe();
  if (res === null || typeof res !== "object")
    throw new TypeError("describe: expected an object, got " + show(res));
  if (!("dice" in res)) throw new TypeError("describe: missing dice");
  if (!("roll" in res)) throw new TypeError("describe: missing roll");
  if (!("animating" in res)) throw new TypeError("describe: missing animating");
  if (!("notice" in res)) throw new TypeError("describe: missing notice");
  if (!Array.isArray(res.dice)) throw new TypeError("describe.dice: expected array");
  if (res.roll !== null && (typeof res.roll.x !== "number" || typeof res.roll.y !== "number"))
    throw new TypeError("describe.roll: expected {x, y} numbers or null");
  if (typeof res.animating !== "boolean") throw new TypeError("describe.animating: expected boolean");
  if (res.notice !== null && typeof res.notice !== "string")
    throw new TypeError("describe.notice: expected string or null");
  return res;
}

export async function _sheo_check() {
  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "canvas element exists");
  assert.strictEqual(canvas.width, 800);
  assert.strictEqual(canvas.height, 600);

  // init argument validation
  assert.throws(() => init({}), /^TypeError: init: missing canvas/);
  assert.throws(() => init({ seat: 0 }), /^TypeError: init: missing canvas/);
  assert.throws(() => init({ canvas: {} }), /^TypeError: init: missing seat/);
  assert.throws(() => init({ canvas: { width: 800, height: 600 }, seat: 4 }), /^TypeError: init\.seat: expected an integer 0..3/);
  assert.throws(() => init({ canvas: { width: "800", height: 600 }, seat: 0 }), /^TypeError: init\.canvas: expected numeric/);

  // init valid
  init({ canvas, seat: 0 });

  // nextFrame first so describe can project positions
  const t = await nextFrame();
  assert.strictEqual(typeof t, "number");

  // describe before first play: dice is [], roll is null
  const d0 = describe();
  assert.deepStrictEqual(d0.dice, []);
  assert.strictEqual(d0.roll, null);
  assert.strictEqual(d0.animating, false);
  assert.strictEqual(d0.notice, null);

  // build poses for all 16 dice
  const poses = Array.from({ length: 16 }, (_, id) => ({
    id,
    position: [0, 1, 0],
    matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  }));
  const tracks = [];

  // play argument validation
  assert.throws(() => play([], "bad"), /^TypeError: play: expected poses array/);

  // play
  play(tracks, poses);

  // describe after play
  const d1 = describe();
  assert.strictEqual(d1.dice.length, 16);
  for (const d of d1.dice) {
    assert.strictEqual(typeof d.id, "number");
    assert.ok(d.id >= 0 && d.id <= 15);
    assert.strictEqual(typeof d.x, "number");
    assert.strictEqual(typeof d.y, "number");
    assert.ok(Array.isArray(d.visibleFaces));
  }
  assert.strictEqual(d1.animating, false);
  assert.strictEqual(typeof d1.roll.x, "number");
  assert.strictEqual(typeof d1.roll.y, "number");

  // notice ok true: shows nothing
  notice({ ok: true });
  const d2 = describe();
  assert.strictEqual(d2.notice, null);

  // notice ok false: shows reason
  notice({ ok: false, reason: "test reason" });
  const d3 = describe();
  assert.strictEqual(d3.notice, "test reason");

  // notice argument validation
  assert.throws(() => notice({ ok: false }), /^TypeError: notice: missing reason/);
  assert.throws(() => notice({ ok: false, reason: 5 }), /^TypeError: notice\.reason: expected a string/);

  // pick argument validation
  assert.throws(() => pick({ x: 1 }), /^TypeError: pick: missing y/);
  assert.throws(() => pick({ x: "1", y: 1 }), /^TypeError: pick: expected numeric/);

  // pick returns a valid shape
  const p = pick({ x: 400, y: 300 });
  assert.ok(p === null || p.kind === "die" || p.kind === "roll");
  if (p && p.kind === "die") {
    assert.ok(p.id >= 0 && p.id <= 15);
    assert.ok(["+x", "-x", "+y", "-y", "+z", "-z"].includes(p.normal));
  } else if (p && p.kind === "roll") {
    // ok
  }
}
