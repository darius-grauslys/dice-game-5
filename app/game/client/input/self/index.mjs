import * as pointer from "../../../../../edges/input/input_to_pointer.mjs";
import * as intent from "../../../../../edges/input/input_to_intent.mjs";

export function init({ canvas }) {
  pointer.init({ canvas });
}

export function drain() {
  return pointer.drain();
}

export function dragging() {
  return pointer.dragging();
}

export function preview(drag, hit, game, seat) {
  return intent.preview(drag, hit, game, seat);
}

export function toAction(gesture, hit, game, seat) {
  return intent.toAction(gesture, hit, game, seat);
}
