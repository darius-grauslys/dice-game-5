import { Game, Player, Queue, Group, Die, Last, TURN } from "../../../../../common/index.mjs";

export function apply(game, action) {
  const seat = action.seat;
  const player = game.players[seat];
  const groups = player.queue.groups;
  const piece = groups[groups.length - 1]; // last (rightmost) group
  const dice = piece.dice;

  const before = dice.map((d) => d.o);
  const newDice = dice.map((d) => {
    const no = TURN[d.o][action.axis][String(action.dir)];
    return Die({ id: d.id, o: no });
  });
  const newPiece = Group({ dice: newDice });
  const newGroups = groups.slice(0, -1).concat(newPiece);
  const newQueue = Queue({ groups: newGroups });
  const newPlayer = Player({ seat, queue: newQueue });

  const newPlayers = game.players.map((p) => (p.seat === seat ? newPlayer : p));

  const last = Last({
    action,
    change: "turn",
    dice: dice.map((d) => d.id),
    before,
  });

  return game.with({ players: newPlayers, last });
}
