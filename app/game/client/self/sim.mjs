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

  // Build a dealt Game: four players, seat 0's dice at o: 0
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(common.Die({ id: seat * 4 + k, o: 0 }));
    players.push(common.Player({ seat, queue: common.Queue({ groups: [common.Group({ dice })] }) }));
  }
  const game = common.Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });
  queue.push(common.Message.game(game));

  // Wait for frames
  let frames = 0;
  const preFrames = 60;
  while (frames < preFrames) {
    frames++;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  // Find the pad
  const roll = render.describe().roll;

  // Dispatch pointer press on the roll pad
  const down = new PointerEvent("pointerdown", {
    clientX: roll.x,
    clientY: roll.y,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  const upEvt = new PointerEvent("pointerup", {
    clientX: roll.x,
    clientY: roll.y,
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 0,
  });
  canvas.dispatchEvent(down);
  canvas.dispatchEvent(upEvt);

  // Wait a few frames for the action to be emitted
  const postFrames = 60;
  while (frames < preFrames + postFrames) {
    frames++;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  return {
    emitted: emitted.map((e) => ({ type: e.type, body: e.body })),
    pad: roll,
    frames,
  };
}
