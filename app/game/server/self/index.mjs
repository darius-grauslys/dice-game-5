import {
  Die,
  Group,
  Queue,
  Player,
  Last,
  Game,
  Action,
  Reply,
  Up,
  Message,
  AXES,
  DIRS,
  REASONS,
  Rng,
  FACES,
  ORIENTATIONS,
  TURN,
} from "../../../../common/index.mjs";
import * as turn from "../../../../edges/server/server_to_turn.mjs";
import * as roll from "../../../../edges/server/server_to_roll.mjs";
import * as settle from "../../../../edges/server/server_to_settle.mjs";
import * as judge from "../../../../edges/server/server_to_judge.mjs";

let keptUp;
let keptGame;

function buildBlankGame(seed) {
  const players = [];
  for (let s = 0; s < 4; s++) {
    const groups = [];
    for (let i = 0; i < 4; i++) {
      const die = Die({ id: 4 * s + i, o: 0 });
      groups.push(Group({ dice: [die] }));
    }
    const queue = Queue({ groups });
    players.push(Player({ seat: s, queue }));
  }
  return Game({ players, turn: 0, version: 0, rng: Rng.seed(seed), last: null, winner: null });
}

export async function init({ seed }, up) {
  let game = buildBlankGame(seed);
  game = roll.deal(game);
  for (let s = 0; s < 4; s++) {
    game = settle.regroup(game, s);
  }
  keptUp = up;
  keptGame = game;
  up.emit(Message.game(game));
}

export function step(game, action) {
  const r = judge.legal(game, action);
  if (!r.ok) {
    return [
      game,
      Reply({ to: action.id, seat: action.seat, ok: false, reason: r.reason }),
    ];
  }
  let g =
    action.move === "turn"
      ? turn.apply(game, action)
      : roll.apply(game, action);
  g = settle.apply(g, action.seat);
  g = judge.after(g, action.seat);
  g = g.with({ version: game.version + 1 });
  return [
    g,
    Reply({ to: action.id, seat: action.seat, ok: true, reason: null }),
  ];
}

export async function begin() {
  while (keptGame.winner === null) {
    const msgs = await keptUp.poll({ wait: true });
    for (const msg of msgs) {
      if (msg.type === "action") {
        const [next, reply] = step(keptGame, msg.body);
        keptUp.emit(Message.reply(reply));
        if (next.version !== keptGame.version) {
          keptGame = next;
          keptUp.emit(Message.game(next));
        }
      }
    }
  }
}
