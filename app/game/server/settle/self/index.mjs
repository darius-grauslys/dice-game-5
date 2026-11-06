import { Die, Group, Queue, Player, look } from "../../../../../common/index.mjs";

function dieLook(perm, d) {
  return look(perm, d.o);
}

function groupHasSingleLook(group, perm) {
  const key = dieLook(perm, group.dice[0]);
  return group.dice.every((d) => dieLook(perm, d) === key);
}

function splitIntoGroups(group, perm) {
  // If all dice share the same look, keep the group; otherwise replace with
  // single-die groups, in its order.
  if (groupHasSingleLook(group, perm)) return [group];
  return group.dice.map((d) => Group({ dice: [d] }));
}

function splitAndMerge(groups, perm) {
  // Split: any group whose dice don't all have the same look is replaced,
  // in place, by single-die groups, in its order.
  const afterSplit = groups.flatMap((g) => splitIntoGroups(g, perm));

  // Merge: go through the groups left to right, building a new list. A group
  // whose look some earlier group in the new list already has is appended to
  // that group's dice (keeping order). Otherwise it is added at the end.
  const newList = []; // each: { look, dice: [] }
  for (const g of afterSplit) {
    const key = dieLook(perm, g.dice[0]);
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

function permFor(game, seat) {
  return game.faces === null ? null : game.faces[seat];
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

  const perm = permFor(game, seat);
  const newQueue = splitAndMerge(afterBreak, perm);
  const newPlayer = Player({ seat: src.seat, queue: newQueue });
  players[seat] = newPlayer;

  return game.with({ players });
}

export function regroup(game, seat) {
  const players = [...game.players];
  const src = players[seat];

  const perm = permFor(game, seat);
  const newQueue = splitAndMerge(src.queue.groups, perm);
  const newPlayer = Player({ seat: src.seat, queue: newQueue });
  players[seat] = newPlayer;

  return game.with({ players });
}
