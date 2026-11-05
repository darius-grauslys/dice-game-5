import { Action, DRAG, DRAG_MIN } from "../../../../../../common/index.mjs";

export function toAction(gesture, hit, game, seat) {
  // 1. null if game is null, game.winner !== null, or game.turn !== seat.
  if (game === null || game.winner !== null || game.turn !== seat) return null;

  const id = `${seat}:${game.version}`;
  const version = game.version;

  if (gesture.type === "press") {
    if (hit.kind === "roll") {
      return Action({ id, seat, move: "roll", axis: null, dir: null, version });
    }
    return null;
  }

  if (gesture.type === "drag") {
    if (hit.kind !== "die") return null;
    const groups = game.players[seat].queue.groups;
    const rightmost = groups[groups.length - 1];
    const dieIds = rightmost.dice.map((d) => d.id);
    if (!dieIds.includes(hit.id)) return null;
    const dx = hit.to.x - hit.at.x;
    const dy = hit.to.y - hit.at.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_MIN) return null;
    let direction;
    if (Math.abs(dx) >= Math.abs(dy)) {
      direction = dx > 0 ? "right" : "left";
    } else {
      direction = dy < 0 ? "up" : "down";
    }
    const entry = DRAG[hit.normal]?.[direction];
    if (entry === undefined) return null;
    return Action({ id, seat, move: "turn", axis: entry.axis, dir: entry.dir, version });
  }

  return null;
}
