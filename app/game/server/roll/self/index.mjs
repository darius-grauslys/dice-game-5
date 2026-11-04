import {
  Die, Group, Queue, Player, Last, Game, Action, Reply, Up, Message,
  AXES, DIRS, REASONS, Rng, FACES, ORIENTATIONS, TURN,
} from "../../../../../common/index.mjs";

// roll: orientations from the game's random generator. Pure.

export function deal(game) {
  let rng = game.rng;
  const players = [];
  const allIds = [];
  const allBefore = [];
  for (const p of game.players) {
    const groups = [];
    for (const g of p.queue.groups) {
      const dice = [];
      for (const d of g.dice) {
        const [k, newRng] = Rng.int(rng, 24);
        rng = newRng;
        dice.push(Die({ id: d.id, o: k }));
        allIds.push(d.id);
        allBefore.push(d.o);
      }
      groups.push(Group({ dice }));
    }
    players.push(Player({ seat: p.seat, queue: Queue({ groups }) }));
  }
  return game.with({
    players,
    rng,
    last: Last({ action: null, change: "deal", dice: allIds, before: allBefore }),
  });
}

export function apply(game, action) {
  if (action.move !== "roll") {
    throw new TypeError(`roll.apply: expected action.move === "roll", got ${action.move}`);
  }
  let rng = game.rng;
  const actorSeat = action.seat;
  const rightmostIndex = game.players[actorSeat].queue.groups.length - 1;

  const players = [];
  const diceIds = [];
  const diceBefore = [];

  for (let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    const groupsOut = [];
    for (let j = 0; j < p.queue.groups.length; j++) {
      const g = p.queue.groups[j];
      const isRightmost = i === actorSeat && j === rightmostIndex;
      const dice = [];
      for (const d of g.dice) {
        if (isRightmost) {
          const [k, newRng] = Rng.int(rng, 24);
          rng = newRng;
          dice.push(Die({ id: d.id, o: k }));
          diceIds.push(d.id);
          diceBefore.push(d.o);
        } else {
          dice.push(d);
        }
      }
      groupsOut.push(Group({ dice }));
    }
    players.push(Player({ seat: p.seat, queue: Queue({ groups: groupsOut }) }));
  }

  return game.with({
    players,
    rng,
    last: Last({ action, change: "roll", dice: diceIds, before: diceBefore }),
  });
}
