import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Die, Group, Queue, Player, Last, Game, Action,
} from "../../../../../../common/index.mjs";
import { Rng } from "../../../../../../common/index.mjs";
import { deal, apply } from "../index.mjs";

function die(id, o = 0) {
  return Die({ id, o });
}

function makePlayersWithGroups(groupsPerSeat) {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const groups = [];
    let nextId = seat * 4;
    // distribute 4 dice per player across the given number of groups
    const dicePerGroup = 4 / groupsPerSeat.length;
    let idx = 0;
    for (const count of groupsPerSeat) {
      const dice = [];
      for (let k = 0; k < count; k++) dice.push(die(nextId++));
      groups.push(Group({ dice }));
      idx++;
    }
    players.push(Player({ seat, queue: Queue({ groups }) }));
  }
  return players;
}

function makeGame(patch = {}) {
  return Game({
    players: makePlayersWithGroups([[4]]),
    turn: 0,
    version: 0,
    rng: 12345,
    last: null,
    winner: null,
    ...patch,
  });
}

test("deal re-rolls every die and preserves group structure", () => {
  const g = makeGame();
  const before = [];
  const ids = [];
  for (const p of g.players)
    for (const grp of p.queue.groups)
      for (const d of grp.dice) { ids.push(d.id); before.push(d.o); }

  const out = deal(g);

  // rng advanced: Rng.int changes it.
  assert.notStrictEqual(out.rng, 12345);

  // structure preserved: 4 players, 1 group each, 4 dice each
  assert.strictEqual(out.players.length, 4);
  for (let i = 0; i < 4; i++) {
    const p = out.players[i];
    assert.strictEqual(p.seat, i);
    assert.strictEqual(p.queue.groups.length, 1);
    assert.strictEqual(p.queue.groups[0].dice.length, 4);
  }

  // all 16 dice present, each with a valid orientation
  const seen = new Array(16).fill(false);
  for (const p of out.players)
    for (const grp of p.queue.groups)
      for (const d of grp.dice) {
        assert.ok(seen[d.id] === false, `die ${d.id} duplicated`);
        seen[d.id] = true;
        assert.ok(d.o >= 0 && d.o <= 23);
      }
  for (let id = 0; id < 16; id++) assert.ok(seen[id], `die ${id} missing`);

  // last is a deal last with all ids and before
  assert.strictEqual(out.last.kind, "last");
  assert.strictEqual(out.last.action, null);
  assert.strictEqual(out.last.change, "deal");
  assert.deepStrictEqual(out.last.dice, ids);
  assert.deepStrictEqual(out.last.before, before);
});

test("deal rng sequence matches Rng.int calls", () => {
  const g = makeGame();
  let rng = g.rng;
  const expectedIds = [];
  const expectedBefore = [];
  for (const p of g.players)
    for (const grp of p.queue.groups)
      for (const d of grp.dice) {
        expectedIds.push(d.id);
        expectedBefore.push(d.o);
        const [k, nr] = Rng.int(rng, 24);
        rng = nr;
      }

  const out = deal(g);
  assert.strictEqual(out.rng, rng);
  assert.deepStrictEqual(out.last.dice, expectedIds);
  assert.deepStrictEqual(out.last.before, expectedBefore);
});

test("apply re-rolls only the actor's rightmost group, in order", () => {
  // build a game where seat 2 has two groups: [die8, die9] and [die10, die11]
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
    if (seat === 2) {
      players.push(Player({
        seat,
        queue: Queue({ groups: [Group({ dice: [dice[0], dice[1]] }), Group({ dice: [dice[2], dice[3]] })] }),
      }));
    } else {
      players.push(Player({ seat, queue: Queue({ groups: [Group({ dice })] }) }));
    }
  }
  const g = makeGame({ players });

  const actor = 2;
  const action = Action({ id: "a1", seat: actor, move: "roll", axis: null, dir: null, version: 0 });

  // record old orientations of seat 2's dice
  const oldOs = {};
  for (const p of g.players)
    for (const grp of p.queue.groups)
      for (const d of grp.dice) oldOs[d.id] = d.o;

  const out = apply(g, action);

  // structure preserved: seat 2 still has 2 groups
  const p2 = out.players[2];
  assert.strictEqual(p2.queue.groups.length, 2);
  assert.deepStrictEqual(p2.queue.groups[0].dice.map((d) => d.id), [8, 9]);
  assert.deepStrictEqual(p2.queue.groups[1].dice.map((d) => d.id), [10, 11]);

  // dice 8,9 (group 0) unchanged
  assert.strictEqual(out.players[2].queue.groups[0].dice[0].o, oldOs[8]);
  assert.strictEqual(out.players[2].queue.groups[0].dice[1].o, oldOs[9]);

  // dice 10,11 (group 1, rightmost) re-rolled (should differ from old, or at least be valid)
  const g10 = out.players[2].queue.groups[1].dice[0];
  const g11 = out.players[2].queue.groups[1].dice[1];
  assert.ok(g10.o >= 0 && g10.o <= 23);
  assert.ok(g11.o >= 0 && g11.o <= 23);

  // other players unchanged
  for (let seat = 0; seat < 4; seat++) {
    if (seat === 2) continue;
    const p = out.players[seat];
    for (const grp of p.queue.groups)
      for (const d of grp.dice) {
        assert.strictEqual(d.o, oldOs[d.id]);
        assert.strictEqual(d.id, seat * 4 + (d.id - seat * 4));
      }
  }

  // last is a roll last with dice 10,11 and their before values
  assert.strictEqual(out.last.kind, "last");
  assert.strictEqual(out.last.change, "roll");
  assert.strictEqual(out.last.action.id, "a1");
  assert.deepStrictEqual(out.last.dice, [10, 11]);
  assert.deepStrictEqual(out.last.before, [oldOs[10], oldOs[11]]);
});

test("apply rng sequence for roll matches Rng.int calls", () => {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
    if (seat === 2) {
      players.push(Player({
        seat,
        queue: Queue({ groups: [Group({ dice: [dice[0], dice[1]] }), Group({ dice: [dice[2], dice[3]] })] }),
      }));
    } else {
      players.push(Player({ seat, queue: Queue({ groups: [Group({ dice })] }) }));
    }
  }
  const g = makeGame({ players });
  const action = Action({ id: "a2", seat: 2, move: "roll", axis: null, dir: null, version: 0 });

  let rng = g.rng;
  const [k1, r1] = Rng.int(rng, 24);
  rng = r1;
  const [k2, r2] = Rng.int(rng, 24);
  rng = r2;

  const out = apply(g, action);
  assert.strictEqual(out.rng, rng);
  assert.strictEqual(out.players[2].queue.groups[1].dice[0].o, k1);
  assert.strictEqual(out.players[2].queue.groups[1].dice[1].o, k2);
});

test("apply rejects a non-roll move", () => {
  const g = makeGame();
  const action = Action({ id: "a3", seat: 0, move: "turn", axis: "x", dir: 1, version: 0 });
  assert.throws(
    () => apply(g, action),
    /^TypeError: roll\.apply: expected action\.move === "roll", got turn/,
  );
});

test("deal and apply return frozen games", () => {
  const g = makeGame();
  assert.ok(Object.isFrozen(deal(g)));
  const action = Action({ id: "a4", seat: 0, move: "roll", axis: null, dir: null, version: 0 });
  assert.ok(Object.isFrozen(apply(g, action)));
});
