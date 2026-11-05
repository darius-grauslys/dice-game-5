import { Action, DRAG_MIN, SECTORS } from "../../../../../../common/index.mjs";

function atan2deg(y, x) {
  let a = (Math.atan2(y, x) * 180) / Math.PI;
  if (a < 0) a += 360;
  return a % 360;
}

export function preview(drag, hit, game, seat) {
  // 1. null if game is null, game.winner !== null, or game.turn !== seat.
  if (game === null || game.winner !== null || game.turn !== seat) return null;

  // 2. null unless hit is {kind: "die", id} with id one of the dice of the rightmost group.
  if (hit === null || hit.kind !== "die") return null;
  const groups = game.players[seat].queue.groups;
  const rightmost = groups[groups.length - 1];
  const dieIds = rightmost.dice.map((d) => d.id);
  if (!dieIds.includes(hit.id)) return null;
  const ids = rightmost.dice.map((d) => d.id);

  // 3. dx, dy, DRAG_MIN
  const dx = drag.to.x - drag.at.x;
  const dy = drag.to.y - drag.at.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_MIN) return null;

  // 4. screen angle a = atan2(-dy, dx) in degrees, in [0, 360); sector k.
  const a = atan2deg(-dy, dx);
  const k = Math.floor(((a + 30) % 360) / 60);
  const { axis, dir } = SECTORS[k];

  // 5. If the group has more than one die and axis !== "x": null.
  if (rightmost.dice.length > 1 && axis !== "x") return null;

  return { ids, axis, dir };
}

export function toAction(gesture, hit, game, seat) {
  // 1. null if game is null, game.winner !== null, or game.turn !== seat.
  if (game === null || game.winner !== null || game.turn !== seat) return null;

  const id = `${seat}:${game.version}`;
  const version = game.version;

  // 3. {kind: "roll"} (from the ROLL button; hit is ignored)
  if (gesture.kind === "roll") {
    return Action({ id, seat, move: "roll", axis: null, dir: null, version });
  }

  // 4. {kind: "drag", at, to}
  if (gesture.kind === "drag") {
    const p = preview({ at: gesture.at, to: gesture.to }, hit, game, seat);
    if (p === null) return null;
    return Action({ id, seat, move: "turn", axis: p.axis, dir: p.dir, version });
  }

  // 5. Anything else (a "press"): null.
  return null;
}
