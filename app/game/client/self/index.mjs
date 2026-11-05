import { Message } from "../../../../common/index.mjs";
import * as render from "../../../../edges/client/client_to_render.mjs";
import * as input from "../../../../edges/client/client_to_input.mjs";

let up, seat, game = null, pending = null;

export async function init({ seat: s, canvas }, upArg) {
  seat = s;
  up = upArg;
  render.init({ canvas, seat: s });
  input.init({ canvas });
}

export async function begin() {
  while (true) {
    await render.nextFrame();

    const msgs = await up.poll({ wait: false });
    for (const msg of msgs) {
      if (msg.type === "game") {
        render.show(game, msg.body);
        game = msg.body;
      } else if (msg.type === "reply") {
        render.notice(msg.body);
        if (msg.body.to === pending) pending = null;
      }
    }

    for (const g of input.drain()) {
      if (game === null || pending !== null) continue;
      const hit = render.pick(g.at);
      const a = input.toAction(g, hit, game, seat);
      if (a !== null) {
        pending = a.id;
        up.emit(Message.action(a));
      }
    }

    if (game !== null && game.winner !== null && render.describe().animating === false) {
      return;
    }
  }
}
