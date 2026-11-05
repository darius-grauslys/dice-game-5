import test from "node:test";
import assert from "node:assert/strict";
import { init, drain } from "../index.mjs";

function makeCanvas() {
  const listeners = {};
  return {
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event);
    },
  };
}

test("pointer: short move is a press", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 100, offsetY: 100 });
  canvas.dispatch("pointerup", { offsetX: 105, offsetY: 102 });
  assert.deepStrictEqual(drain(), [{ kind: "press", at: { x: 100, y: 100 } }]);
});

test("pointer: long move is a drag", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 200, offsetY: 200 });
  canvas.dispatch("pointerup", { offsetX: 260, offsetY: 210 });
  assert.deepStrictEqual(drain(), [
    { kind: "drag", at: { x: 200, y: 200 }, to: { x: 260, y: 210 } },
  ]);
});

test("pointer: cancel drops the started gesture", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 400, offsetY: 400 });
  canvas.dispatch("pointercancel", { offsetX: 400, offsetY: 400 });
  assert.deepStrictEqual(drain(), []);
});

test("pointer: second pointerdown before pointerup restarts", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 10, offsetY: 10 });
  canvas.dispatch("pointerdown", { offsetX: 500, offsetY: 500 });
  canvas.dispatch("pointerup", { offsetX: 560, offsetY: 510 });
  assert.deepStrictEqual(drain(), [
    { kind: "drag", at: { x: 500, y: 500 }, to: { x: 560, y: 510 } },
  ]);
});

test("pointer: drain empties the list", () => {
  const canvas = makeCanvas();
  init({ canvas });
  canvas.dispatch("pointerdown", { offsetX: 0, offsetY: 0 });
  canvas.dispatch("pointerup", { offsetX: 0, offsetY: 0 });
  assert.deepStrictEqual(drain(), [{ kind: "press", at: { x: 0, y: 0 } }]);
  assert.deepStrictEqual(drain(), []);
});
