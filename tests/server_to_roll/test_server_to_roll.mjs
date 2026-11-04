import assert from "node:assert/strict";
import * as real from "../../edges/server/server_to_roll.mjs";
import { Game, Player, Queue, Group, Die, Action, Last, Rng } from "../../common/index.mjs";

function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(Die({ id: seat * 4 + k, o: 0 }));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
  }
  return players;
}

function makeGame(patch = {}) {
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

// ---- wrapped deal ----

export function deal(game) {
  if (!(game && typeof game === "object" && game.kind === "game" && Array.isArray(game.players))) {
    throw new Error("deal: expected a Game");
  }
  const result = real.deal(game);
  if (result === undefined) throw new Error("deal: did not return");
  if (!(result && result.kind === "game")) throw new Error("deal: returned non-Game");
  if (!(result.last && result.last.kind === "last")) throw new Error("deal: returned game without last");
  if (result.last.change !== "deal") throw new Error("deal: last.change not deal");
  if (result.last.action !== null) throw new Error("deal: last.action not null");
  return result;
}

// ---- wrapped apply ----

export function apply(game, action) {
  if (!(game && typeof game === "object" && game.kind === "game" && Array.isArray(game.players))) {
    throw new Error("apply: expected a Game");
  }
  if (!(action && typeof action === "object" && action.kind === "action")) {
    throw new Error("apply: expected an Action");
  }
  if (action.move !== "roll") {
    throw new Error("apply: action.move must be roll");
  }
  const result = real.apply(game, action);
  if (result === undefined) throw new Error("apply: did not return");
  if (!(result && result.kind === "game")) throw new Error("apply: returned non-Game");
  if (!(result.last && result.last.kind === "last")) throw new Error("apply: returned game without last");
  if (result.last.change !== "roll") throw new Error("apply: last.change not roll");
  if (!(result.last.action && result.last.action.kind === "action")) throw new Error("apply: last.action not an Action");
  if (result.last.action.move !== "roll") throw new Error("apply: last.action.move not roll");
  return result;
}

// ---- _sheo_check ----

export async function _sheo_check() {
  // ---- deal: all 16 dice, seat order, groups' structure unchanged ----
  const g = makeGame({ rng: 1, turn: 0, version: 0, last: null, winner: null });
  let rng = g.rng;
  const diceIds = [];
  const oldOs = [];
  const newPlayers = [];
  for (const p of g.players) {
    const newGroups = [];
    for (const grp of p.queue.groups) {
      const newDice = [];
      for (const d of grp.dice) {
        diceIds.push(d.id);
        oldOs.push(d.o);
        const [k, nr] = Rng.int(rng, 24);
        rng = nr;
        newDice.push(Die({ id: d.id, o: k }));
      }
      newGroups.push(Group({ dice: newDice }));
    }
    newPlayers.push(Player({ seat: p.seat, queue: Queue({ groups: newGroups }) }));
  }
  const dealResult = deal(g);
  assert.deepStrictEqual(dealResult.players, newPlayers);
  assert.strictEqual(dealResult.rng, rng);
  assert.deepStrictEqual(dealResult.last, Last({ action: null, change: "deal", dice: diceIds, before: oldOs }));

  // ---- apply: only the actor's rightmost group, in order ----
  const g2 = makeGame({ rng: 1, turn: 1, version: 0, last: null, winner: null });
  const action = Action({ id: "a1", seat: 1, move: "roll", axis: null, dir: null, version: 0 });
  let rng2 = g2.rng;
  const applyDiceIds = [];
  const applyOldOs = [];
  const newPlayers2 = [];
  for (const p of g2.players) {
    const newGroups = [];
    const groups = p.queue.groups;
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];
      const isActorRightmost = p.seat === action.seat && gi === groups.length - 1;
      const newDice = [];
      for (const d of grp.dice) {
        let o = d.o;
        if (isActorRightmost) {
          applyDiceIds.push(d.id);
          applyOldOs.push(d.o);
          const [k, nr] = Rng.int(rng2, 24);
          rng2 = nr;
          o = k;
        }
        newDice.push(Die({ id: d.id, o }));
      }
      newGroups.push(Group({ dice: newDice }));
    }
    newPlayers2.push(Player({ seat: p.seat, queue: Queue({ groups: newGroups }) }));
  }
  const applyResult = apply(g2, action);
  assert.deepStrictEqual(applyResult.players, newPlayers2);
  assert.strictEqual(applyResult.rng, rng2);
  assert.deepStrictEqual(applyResult.last, Last({ action, change: "roll", dice: applyDiceIds, before: applyOldOs }));

  // ---- argument validation: deal ----
  assert.throws(() => deal({}), /^Error: deal: expected a Game/);
  assert.throws(() => deal(null), /^Error: deal: expected a Game/);
  assert.throws(() => deal({ kind: "game" }), /^Error: deal: expected a Game/);

  // ---- argument validation: apply ----
  assert.throws(() => apply({}, action), /^Error: apply: expected a Game/);
  assert.throws(() => apply(g2, {}), /^Error: apply: expected an Action/);
  const turnAction = Action({ id: "t1", seat: 1, move: "turn", axis: "x", dir: 1, version: 0 });
  assert.throws(() => apply(g2, turnAction), /^Error: apply: action.move must be roll/);
}
