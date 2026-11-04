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
} from "../../../../../common/index.mjs";

function dieKey(d) {
  return ORIENTATIONS[d.o].key;
}

function groupHasSingleKey(group) {
  const key = dieKey(group.dice[0]);
  return group.dice.every((d) => dieKey(d) === key);
}

function splitIntoGroups(group) {
  // If all dice share the same key, keep the group; otherwise replace with
  // single-die groups, in its order.
  if (groupHasSingleKey(group)) return [group];
  return group.dice.map((d) => Group({ dice: [d] }));
}

function splitAndMerge(groups) {
  // Split: any group whose dice don't all have the same key is replaced,
  // in place, by single-die groups, in its order.
  const afterSplit = groups.flatMap(splitIntoGroups);

  // Merge: go through the groups left to right, building a new list. A group
  // whose key some earlier group in the new list already has is appended to
  // that group's dice (keeping order). Otherwise it is added at the end.
  const newList = []; // each: { key, dice: [] }
  for (const g of afterSplit) {
    const key = dieKey(g.dice[0]);
    const target = newList.find((ng) => ng.key === key);
    if (target) {
      target.dice.push(...g.dice);
    } else {
      newList.push({ key, dice: [...g.dice] });
    }
  }

  const finalGroups = newList.map((ng) => Group({ dice: ng.dice }));
  return Queue({ groups: finalGroups });
}

export function apply(game, seat) {
  const players = [...game.players];
  const src = players[seat];
  const groups = src.queue.groups;

  // 1. Move: the rightmost group goes to the leftmost position; the others
  // keep their order.
  const moved = groups[groups.length - 1];
  const rest = groups.slice(0, groups.length - 1);

  // 2. Break: if game.last.change === "roll", the moved group (now leftmost)
  // is replaced by single-die groups, in its order.
  let afterBreak;
  if (game.last && game.last.change === "roll") {
    afterBreak = [
      ...moved.dice.map((d) => Group({ dice: [d] })),
      ...rest,
    ];
  } else {
    afterBreak = [moved, ...rest];
  }

  const newQueue = splitAndMerge(afterBreak);
  const newPlayer = Player({ seat: src.seat, queue: newQueue });
  players[seat] = newPlayer;

  return game.with({ players });
}

export function regroup(game, seat) {
  const players = [...game.players];
  const src = players[seat];

  const newQueue = splitAndMerge(src.queue.groups);
  const newPlayer = Player({ seat: src.seat, queue: newQueue });
  players[seat] = newPlayer;

  return game.with({ players });
}
