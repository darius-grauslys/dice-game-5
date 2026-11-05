import * as pointer from "./index.mjs";

export async function _sheo_sim(canvas, scenario) {
  pointer.init({ canvas });

  function down(x, y, id = 1) {
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: x, clientY: y, bubbles: true, pointerId: id }),
    );
  }
  function up(x, y, id = 1) {
    canvas.dispatchEvent(
      new PointerEvent("pointerup", { clientX: x, clientY: y, bubbles: true, pointerId: id }),
    );
  }
  function cancel(id = 1) {
    canvas.dispatchEvent(
      new PointerEvent("pointercancel", { clientX: 0, clientY: 0, bubbles: true, pointerId: id }),
    );
  }

  // a press at (100, 100)
  down(100, 100);
  up(100, 100);

  // a drag from (200, 200) to (260, 210)
  down(200, 200);
  up(260, 210);

  // a short move from (300, 300) to (305, 302)
  down(300, 300);
  up(305, 302);

  // a cancelled one
  down(400, 400);
  cancel();

  return [pointer.drain(), pointer.drain()];
}
