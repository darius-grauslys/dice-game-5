export function legal(game, action) {
  // 1. game.winner !== null → "over"
  if (game.winner !== null) {
    return { ok: false, reason: "over" };
  }
  // 2. action.seat !== game.turn → "not-your-turn"
  if (action.seat !== game.turn) {
    return { ok: false, reason: "not-your-turn" };
  }
  // 3. action.version !== game.version → "stale"
  if (action.version !== game.version) {
    return { ok: false, reason: "stale" };
  }
  // 4. action.move === "turn", the actor's rightmost group has more than one die, and action.axis !== "x" → "illegal"
  if (action.move === "turn" && action.axis !== "x") {
    const player = game.players[action.seat];
    const groups = player.queue.groups;
    if (groups.length > 0) {
      const rightmost = groups[groups.length - 1];
      if (rightmost.dice.length > 1) {
        return { ok: false, reason: "illegal" };
      }
    }
  }
  return { ok: true, reason: null };
}

export function after(game, seat) {
  const player = game.players[seat];
  const groups = player.queue.groups;
  if (groups.length === 1) {
    const group = groups[0];
    if (group.dice.length === 4) {
      const o0 = group.dice[0].o;
      const allSame = group.dice.every((d) => d.o === o0);
      if (allSame) {
        return game.with({ winner: seat });
      }
    }
  }
  return game.with({ turn: (seat + 1) % 4 });
}
