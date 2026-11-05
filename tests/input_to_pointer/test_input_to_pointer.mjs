import * as real from "../../edges/input/input_to_pointer.mjs";
import assert from "node:assert/strict";
import { DRAG_MIN } from "../../common/index.mjs";

function show(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "an array";
  if (v && typeof v === "object") return "an object";
  return typeof v;
}

// init wrapper: checks args, calls real, checks it returned void.
export function init(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("init: expected an object, got " + show(input));
  }
  if (!("canvas" in input)) {
    throw new Error("init: missing canvas");
  }
  const canvas = input.canvas;
  if (!(canvas && typeof canvas.addEventListener === "function")) {
    throw new Error("init: canvas must be an element with addEventListener");
  }
  const result = real.init({ canvas });
  if (result !== undefined) {
    throw new Error("init: expected void, got " + show(result));
  }
  return result;
}

// drain wrapper: checks args, calls real, checks it returned an array.
export function drain() {
  if (arguments.length > 0) {
    throw new Error("drain: expected no arguments");
  }
  const result = real.drain();
  if (!Array.isArray(result)) {
    throw new Error("drain: expected an array, got " + show(result));
  }
  return result;
}

export const _sheo_browser = true;

function makeEvent(type, x, y) {
  const ev = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(ev, "offsetX", { value: x, configurable: true, writable: true });
  Object.defineProperty(ev, "offsetY", { value: y, configurable: true, writable: true });
  return ev;
}

export async function _sheo_check() {
  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "canvas exists");

  // init
  init({ canvas });

  // Test 1: press (no drag) - max(|dx|,|dy|) < DRAG_MIN
  drain();
  canvas.dispatchEvent(makeEvent("pointerdown", 0, 0));
  canvas.dispatchEvent(makeEvent("pointerup", 3, 2)); // max(3,2)=3 < 12
  let g = drain();
  assert.deepStrictEqual(g, [{ kind: "press", at: { x: 0, y: 0 } }]);

  // Test 2: drag - max(|dx|,|dy|) >= DRAG_MIN, exact DRAG_MIN boundary
  drain();
  canvas.dispatchEvent(makeEvent("pointerdown", 0, 0));
  canvas.dispatchEvent(makeEvent("pointerup", DRAG_MIN, 0)); // max(12,0)=12 >= 12
  g = drain();
  assert.deepStrictEqual(g, [{ kind: "drag", at: { x: 0, y: 0 }, to: { x: DRAG_MIN, y: 0 } }]);

  // Test 3: pointercancel drops the started gesture
  drain();
  canvas.dispatchEvent(makeEvent("pointerdown", 5, 5));
  canvas.dispatchEvent(makeEvent("pointercancel", 5, 5));
  g = drain();
  assert.deepStrictEqual(g, []);

  // Test 4: second pointerdown before pointerup restarts it
  drain();
  canvas.dispatchEvent(makeEvent("pointerdown", 0, 0));
  canvas.dispatchEvent(makeEvent("pointerdown", 5, 5)); // restart
  canvas.dispatchEvent(makeEvent("pointerup", 7, 7)); // max(2,2)=2 < 12, press from restart
  g = drain();
  assert.deepStrictEqual(g, [{ kind: "press", at: { x: 5, y: 5 } }]);

  // Test 5: drain empties the list; second drain returns empty
  drain();
  canvas.dispatchEvent(makeEvent("pointerdown", 100, 100));
  canvas.dispatchEvent(makeEvent("pointerup", 120, 100)); // drag
  g = drain();
  assert.deepStrictEqual(g, [{ kind: "drag", at: { x: 100, y: 100 }, to: { x: 120, y: 100 } }]);
  g = drain();
  assert.deepStrictEqual(g, []);
}
