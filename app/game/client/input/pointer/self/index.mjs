import { DRAG_MIN } from "../../../../../../common/index.mjs";

let gestures = [];
let pointerState = null;

export function init({canvas}) {
  canvas.addEventListener("pointerdown", (event) => {
    pointerState = {
      at: { x: event.offsetX, y: event.offsetY },
      now: { x: event.offsetX, y: event.offsetY },
    };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {}
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointerState) return;
    pointerState.now = { x: event.offsetX, y: event.offsetY };
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!pointerState) return;
    const start = pointerState.at;
    const end = { x: event.offsetX, y: event.offsetY };
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (Math.max(dx, dy) >= DRAG_MIN) {
      gestures.push({ kind: "drag", at: start, to: end });
    } else {
      gestures.push({ kind: "press", at: start });
    }
    pointerState = null;
  });

  canvas.addEventListener("pointercancel", (event) => {
    pointerState = null;
  });
}

export function drain() {
  const g = gestures;
  gestures = [];
  return g;
}

export function dragging() {
  if (!pointerState) return null;
  return { at: pointerState.at, to: pointerState.now };
}
