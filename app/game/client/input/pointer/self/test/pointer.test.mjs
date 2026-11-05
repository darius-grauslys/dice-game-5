import test from "node:test";
import assert from "node:assert/strict";
import { init, drain, dragging } from "../index.mjs";

function makeCanvas() {
  const listeners = {};
  return {
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event);
    },
    setPointerCapture(id) {
      this._capture = id;
    },
  };
}

test("pointer: short move is a press", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 100, offsetY: 100, pointerId: 1 });
  canvas.dispatch("pointerup", { offsetX: 105, offsetY: 102, pointerId: 1 });
  assert.deepStrictEqual(drain(), [{ kind: "press", at: { x: 100, y: 100 } }]);
});

test("pointer: long move is a drag", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 200, offsetY: 200, pointerId: 1 });
  canvas.dispatch("pointerup", { offsetX: 260, offsetY: 210, pointerId: 1 });
  assert.deepStrictEqual(drain(), [
    { kind: "drag", at: { x: 200, y: 200 }, to: { x: 260, y: 210 } },
  ]);
});

test("pointer: cancel drops the started gesture", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 400, offsetY: 400, pointerId: 1 });
  canvas.dispatch("pointercancel", { offsetX: 400, offsetY: 400, pointerId: 1 });
  assert.deepStrictEqual(drain(), []);
});

test("pointer: second pointerdown before pointerup restarts", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 10, offsetY: 10, pointerId: 1 });
  canvas.dispatch("pointerdown", { offsetX: 500, offsetY: 500, pointerId: 2 });
  canvas.dispatch("pointerup", { offsetX: 560, offsetY: 510, pointerId: 2 });
  assert.deepStrictEqual(drain(), [
    { kind: "drag", at: { x: 500, y: 500 }, to: { x: 560, y: 510 } },
  ]);
});

test("pointer: drain empties the list", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 0, offsetY: 0, pointerId: 1 });
  canvas.dispatch("pointerup", { offsetX: 0, offsetY: 0, pointerId: 1 });
  assert.deepStrictEqual(drain(), [{ kind: "press", at: { x: 0, y: 0 } }]);
  assert.deepStrictEqual(drain(), []);
});

test("pointer: dragging() is null when no pointer is down", () => {
  const canvas = makeCanvas();
  init({ canvas });
  assert.strictEqual(dragging(), null);
});

test("pointer: dragging() tracks start and current position", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 100, offsetY: 100, pointerId: 1 });
  assert.deepStrictEqual(dragging(), { at: { x: 100, y: 100 }, to: { x: 100, y: 100 } });
  canvas.dispatch("pointermove", { offsetX: 150, offsetY: 120, pointerId: 1 });
  assert.deepStrictEqual(dragging(), { at: { x: 100, y: 100 }, to: { x: 150, y: 120 } });
  canvas.dispatch("pointerup", { offsetX: 150, offsetY: 120, pointerId: 1 });
  assert.strictEqual(dragging(), null);
});

test("pointer: pointerdown captures the pointer", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 100, offsetY: 100, pointerId: 1 });
  assert.strictEqual(canvas._capture, 1);
});
