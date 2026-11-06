import { Message } from "../../../../common/index.mjs";
import * as render from "../../../../edges/client/client_to_render.mjs";
import * as input from "../../../../edges/client/client_to_input.mjs";
import * as hud from "../../../../edges/client/client_to_hud.mjs";
import * as audio from "../../../../edges/client/client_to_audio.mjs";

let up, seat, game = null, pending = null, drag = null;

export async function init({ seat: s, canvas }, upArg) {
  seat = s;
  up = upArg;
  render.init({ canvas, seat: s });
  input.init({ canvas });
  hud.init({ canvas, seat: s });
  audio.init({ canvas });
}

export async function begin() {
  const startGame = game;
  while (true) {
    // 1.
    await render.nextFrame();

    // 2.
    const msgs = await up.poll({ wait: false });
    for (const msg of msgs) {
      if (msg.type === "game") {
        if (game !== null && game.winner !== null && msg.body.winner === null) {
          render.hold(null);
          render.show(null, msg.body);
          hud.show(null, msg.body);
          pending = null;
          drag = null;
        } else {
          render.show(game, msg.body);
          hud.show(game, msg.body);
        }
        game = msg.body;
      } else if (msg.type === "reply") {
        render.notice(msg.body);
        if (msg.body.to === pending) {
          pending = null;
          if (msg.body.ok === false) {
            render.hold(null);
          }
        }
      }
    }

    // 3. The live drag.
    const d = input.dragging();
    if (d !== null && game !== null && pending === null) {
      if (drag === null || drag.at !== d.at) {
        drag = { at: d.at, hit: render.pick(d.at) };
      }
      const p = input.preview(d, drag.hit, game, seat);
      render.hold(p === null ? null : { ...p, at: d.at, to: d.to });
    }

    // 4.
    const gestures = [...input.drain(), ...hud.drain()];
    for (const g of gestures) {
      if (game === null || pending !== null) continue;
      let hit;
      if (g.kind === "roll") {
        hit = null;
      } else if (g.kind === "drag" && drag !== null && samePoint(g.at, drag.at)) {
        hit = drag.hit;
      } else {
        hit = render.pick(g.at);
      }
      const a = input.toAction(g, hit, game, seat);
      if (a !== null) {
        pending = a.id;
        up.emit(Message.action(a));
      } else {
        if (g.kind === "drag") render.hold(null);
      }
      if (g.kind === "drag" || g.kind === "press") drag = null;
    }

    // 5.
    const desc = render.describe();
    let canRoll = game !== null && game.winner === null && game.turn === seat && pending === null && desc.animating === false;
    let anchor = null;
    if (canRoll) {
      anchor = computeAnchor(desc, game);
    }
    hud.frame({ canRoll, anchor });

    // 6.
    if (game !== null && game.winner !== null && game !== startGame && render.describe().animating === false) {
      return;
    }
  }
}

function computeAnchor(desc, game) {
  const dice = desc.dice;
  const groups = game.players[seat].queue.groups;
  if (!groups || groups.length === 0) return null;

  // Find the rightmost group by max x among its dice.
  let bestGroup = null;
  let bestMaxX = -Infinity;
  for (const g of groups) {
    let groupMaxX = -Infinity;
    for (const d of g.dice) {
      const entry = dice.find((ed) => ed.id === d.id);
      if (entry && entry.x !== undefined) {
        groupMaxX = Math.max(groupMaxX, entry.x);
      }
    }
    if (groupMaxX > bestMaxX) {
      bestMaxX = groupMaxX;
      bestGroup = g;
    }
  }

  if (!bestGroup) return null;

  const lastDie = bestGroup.dice[bestGroup.dice.length - 1];
  const entry = dice.find((ed) => ed.id === lastDie.id);
  if (entry) return { x: entry.x, y: entry.y };
  return null;
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}
