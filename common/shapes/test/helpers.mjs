// Shared builders for the shapes tests. Not a test file itself.
import { Die, Group, Queue, Player, Game } from "../index.mjs";

export function die(id, o = 0) {
  return Die({ id, o });
}

// 16 dice, 4 per player; the player at seat i owns dice 4i..4i+3.
export function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
  }
  return players;
}

export function makeGame(patch = {}) {
  return Game({
    players: makePlayers(),
    turn: 0,
    version: 0,
    rng: 1,
    last: null,
    winner: null,
    ...patch,
  });
}
