// edge test: input_to_pointer. Wraps pointer's surface and tests the doc's contract.
import * as real from "../../edges/input/input_to_pointer.mjs";

// --- wrapped surface functions ---

export function init(args) {
  // A) check args against the doc
  if (args === undefined || typeof args !== "object" || args === null || !("canvas" in args)) {
    throw new Error("init: expected {canvas}");
  }
  const { canvas } = args;
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("init: canvas must be an HTMLCanvasElement");
  }
  // B) call through the forwarder
  const r = real.init({ canvas });
  // C) check it returned
  // D) check return value against the doc: void
  if (r !== undefined) throw new Error("init: expected void return");
  return r;
}

export function drain() {
  // A) check args against the doc: none
  if (arguments.length > 0) throw new Error("drain: expected no arguments");
  // B) call through the forwarder
  const r = real.drain();
  // C) check it returned
  // D) check return value against the doc: Array<gesture>
  if (!Array.isArray(r)) throw new Error("drain: expected Array<gesture>");
  for (const g of r) {
    if (g.kind !== "press" && g.kind !== "drag") throw new Error("drain: gesture must have kind 'press' or 'drag'");
    if (g.at === undefined || typeof g.at.x !== "number" || typeof g.at.y !== "number") throw new Error("drain: gesture.at must be {x,y}");
    if (g.kind === "drag") {
      if (g.to === undefined || typeof g.to.x !== "number" || typeof g.to.y !== "number") throw new Error("drain: drag gesture.to must be {x,y}");
    }
  }
  return r;
}

export function dragging() {
  // A) check args against the doc: none
  if (arguments.length > 0) throw new Error("dragging: expected no arguments");
  // B) call through the forwarder
  const r = real.dragging();
  // C) check it returned
  // D) check return value against the doc: {at, to} | null
  if (r === null) return r;
  if (r === undefined || typeof r !== "object") throw new Error("dragging: expected {at,to} or null");
  if (typeof r.at.x !== "number" || typeof r.at.y !== "number" || typeof r.to.x !== "number" || typeof r.to.y !== "number") {
    throw new Error("dragging: expected {at:{x,y}, to:{x,y}}");
  }
  return r;
}

export const _sheo_browser = true;

export async function _sheo_check() {
  const assert = (await import("node:assert/strict")).default;

  const canvas = document.querySelector("canvas");

  // init
  init({ canvas });

  // dragging() null at first, drain() empty at first
  assert.strictEqual(dragging(), null);
  assert.deepStrictEqual(drain(), []);

  // === press: pointerdown + short move + pointerup (max(|dx|,|dy|) < DRAG_MIN=12) ===
  canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 50, clientY: 50, bubbles: true, pointerId: 1 }));
  canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: 55, clientY: 55, bubbles: true, pointerId: 1 }));
  canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: 55, clientY: 55, bubbles: true, pointerId: 1 }));

  assert.strictEqual(dragging(), null);
  assert.deepStrictEqual(drain(), [{ kind: "press", at: { x: 50, y: 50 } }]);

  // === drag: pointerdown + pointermove (max(|dx|,|dy|) >= DRAG_MIN=12) + pointerup ===
  canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true, pointerId: 1 }));
  assert.deepStrictEqual(dragging(), { at: { x: 100, y: 100 }, to: { x: 100, y: 100 } });

  canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: 120, clientY: 120, bubbles: true, pointerId: 1 }));
  assert.deepStrictEqual(dragging(), { at: { x: 100, y: 100 }, to: { x: 120, y: 120 } });

  canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: 120, clientY: 120, bubbles: true, pointerId: 1 }));
  assert.strictEqual(dragging(), null);
  assert.deepStrictEqual(drain(), [{ kind: "drag", at: { x: 100, y: 100 }, to: { x: 120, y: 120 } }]);

  // === dragging() null after pointerup, drain() empty again ===
  assert.strictEqual(dragging(), null);
  assert.deepStrictEqual(drain(), []);

  // === cancelled: pointerdown + pointercancel (drops the started gesture) ===
  canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 200, clientY: 200, bubbles: true, pointerId: 1 }));
  assert.deepStrictEqual(dragging(), { at: { x: 200, y: 200 }, to: { x: 200, y: 200 } });

  canvas.dispatchEvent(new PointerEvent("pointercancel", { clientX: 200, clientY: 200, bubbles: true, pointerId: 1 }));
  assert.strictEqual(dragging(), null);
  assert.deepStrictEqual(drain(), []);

  // === second pointerdown before pointerup restarts the pointer ===
  canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 300, clientY: 300, bubbles: true, pointerId: 1 }));
  assert.deepStrictEqual(dragging(), { at: { x: 300, y: 300 }, to: { x: 300, y: 300 } });

  canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: 340, clientY: 310, bubbles: true, pointerId: 1 }));
  assert.deepStrictEqual(dragging(), { at: { x: 300, y: 300 }, to: { x: 340, y: 310 } });

  canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: 340, clientY: 310, bubbles: true, pointerId: 1 }));
  assert.strictEqual(dragging(), null);
  assert.deepStrictEqual(drain(), [{ kind: "drag", at: { x: 300, y: 300 }, to: { x: 340, y: 310 } }]);
}
