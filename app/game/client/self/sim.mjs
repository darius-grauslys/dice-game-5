import * as common from "../../../../common/index.mjs";
import * as client from "./index.mjs";
import * as render from "../../../../edges/client/client_to_render.mjs";

export async function _sheo_sim(canvas, scenario) {
  const queue = [];
  const emitted = [];
  const up = common.Up({
    poll: async () => queue.splice(0),
    emit: (msg) => { emitted.push(msg); },
  });

  client.init({ seat: 0, canvas }, up);
  client.begin();

  // Build a dealt Game: four players, seat 0's dice at o: 0, one die per group.
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(common.Die({ id: seat * 4 + k, o: 0 }));
    players.push(common.Player({ seat, queue: common.Queue({ groups: dice.map((d) => common.Group({ dice: [d] })) }) }));
  }
  const game = common.Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });
  queue.push(common.Message.game(game));

  // Wait for frames.
  let frames = 0;
  const preFrames = 60;
  while (frames < preFrames) {
    frames++;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  // (1) Click the ROLL button.
  let rollButton = null;
  for (const b of document.querySelectorAll("button")) {
    if (b.textContent === "ROLL") { rollButton = b; break; }
  }
  const rollShownBefore = rollButton ? isShown(rollButton) : false;
  rollButton.click();

  // wait frames
  for (let i = 0; i < preFrames; i++) {
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  // (2) Queue the Reply (ok) and a new Game (version 1, still seat 0's turn).
  const reply = common.Reply({ to: "0:0", seat: 0, ok: true, reason: null });
  const game1 = game.with({ version: 1 });
  queue.push(common.Message.reply(reply));
  queue.push(common.Message.game(game1));

  // Drag die 3: find it with render.describe().
  const desc = render.describe();
  let die3 = null;
  for (const d of desc.dice) {
    if (d.id === 3) { die3 = d; break; }
  }
  const startX = die3.x;
  const startY = die3.y;

  const down = new PointerEvent("pointerdown", {
    clientX: startX,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  canvas.dispatchEvent(down);
  const move1 = new PointerEvent("pointermove", {
    clientX: startX + 60,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  canvas.dispatchEvent(move1);
  const move2 = new PointerEvent("pointermove", {
    clientX: startX + 60,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  canvas.dispatchEvent(move2);
  const upEvt = new PointerEvent("pointerup", {
    clientX: startX + 60,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 0,
  });
  canvas.dispatchEvent(upEvt);

  // wait frames
  for (let i = 0; i < preFrames; i++) {
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  // (3) A drag that goes 60 px right and comes back to 3 px from its start before pointerup.
  const down2 = new PointerEvent("pointerdown", {
    clientX: startX,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  canvas.dispatchEvent(down2);
  const move3 = new PointerEvent("pointermove", {
    clientX: startX + 60,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  canvas.dispatchEvent(move3);
  const move4 = new PointerEvent("pointermove", {
    clientX: startX + 3,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  canvas.dispatchEvent(move4);
  const upEvt2 = new PointerEvent("pointerup", {
    clientX: startX + 3,
    clientY: startY,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 0,
  });
  canvas.dispatchEvent(upEvt2);

  // wait frames
  for (let i = 0; i < preFrames; i++) {
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  return {
    emitted: emitted.map((e) => ({ type: e.type, body: e.body })),
    rollShownBefore,
    frames,
  };
}

function isShown(el) {
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}
