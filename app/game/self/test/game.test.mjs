import test from "node:test";
import assert from "node:assert/strict";
import { initGame, begin } from "../index.mjs";
import { Action, Reply, Message } from "../../../../common/index.mjs";

test("initGame rejects bad role", async () => {
  await assert.rejects(
    () => initGame({ role: "bad" }, {}),
    /^TypeError: game\.initGame: /,
  );
});

test("initGame rejects missing role", async () => {
  await assert.rejects(
    () => initGame({}, {}),
    /^TypeError: game\.initGame: /,
  );
});

test("initGame rejects undefined opts", async () => {
  await assert.rejects(
    () => initGame(undefined, {}),
    /^TypeError: game\.initGame: /,
  );
});

test("begin before initGame throws", async () => {
  await assert.rejects(
    () => begin(),
    /^Error: game\.begin: /,
  );
});

test("game loops: server restarts after a win (golden values)", async () => {
  const actions = [
    Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: -1, version: 0 }),
    Action({ id: "a2", seat: 1, move: "turn", axis: "z", dir: 1, version: 1 }),
    Action({ id: "a3", seat: 2, move: "turn", axis: "z", dir: 1, version: 2 }),
    Action({ id: "a4", seat: 3, move: "turn", axis: "x", dir: 1, version: 3 }),
  ];
  let i = 0;
  const emitted = [];
  const up = {
    poll: async ({ wait }) => {
      if (i < actions.length) {
        return [Message.action(actions[i++])];
      }
      return new Promise(() => {});
    },
    emit: (msg) => { emitted.push(msg); },
  };

  await initGame({ role: "server", seed: 9, restartMs: 200 }, up);

  const p = begin();
  let rejected = false;
  p.catch(() => { rejected = true; });

  let winMsg = null;
  let winTime = null;
  const start = Date.now();
  for (let t = 0; t < 5000; t += 10) {
    const msgs = emitted.filter((m) => m.type === "game");
    const winner3 = msgs.find((m) => m.body.winner === 3);
    if (winner3) { winMsg = winner3; winTime = Date.now() - start; break; }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(winMsg, "game message with winner 3");

  // wait for the next game message (version 5)
  let nextMsg = null;
  let nextTime = null;
  for (let t = 0; t < 5000; t += 10) {
    const msgs = emitted.filter((m) => m.type === "game");
    const afterWin = msgs.filter((m) => m.body.winner === null && m.body.version >= 5);
    if (afterWin.length) { nextMsg = afterWin[afterWin.length - 1]; nextTime = Date.now() - start; break; }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(nextMsg, "next game message");

  assert.ok(nextTime - (winTime || 0) >= 180, `restart no sooner than 180ms, was ${nextTime - (winTime || 0)}`);

  const nextGame = nextMsg.body;
  assert.strictEqual(nextGame.version, 5);
  assert.strictEqual(nextGame.winner, null);
  assert.strictEqual(nextGame.turn, 0);
  assert.strictEqual(nextGame.rng, 3535249242);
  assert.deepStrictEqual(nextGame.faces, [[2, 1, 3, 6, 4, 5], [2, 1, 5, 3, 4, 6], [5, 4, 1, 2, 3, 6], [5, 2, 3, 6, 1, 4]]);
  const groupsOf = (p) => p.queue.groups.map((g) => g.dice.map((d) => [d.id, d.o]));
  assert.deepStrictEqual(groupsOf(nextGame.players[0]), [[[0, 17]], [[1, 6]], [[2, 3]], [[3, 4]]]);
  assert.deepStrictEqual(groupsOf(nextGame.players[1]), [[[4, 20]], [[5, 18], [6, 6]], [[7, 21]]]);
  assert.deepStrictEqual(groupsOf(nextGame.players[2]), [[[8, 11]], [[9, 6]], [[10, 0]], [[11, 2]]]);
  assert.deepStrictEqual(groupsOf(nextGame.players[3]), [[[12, 10], [13, 14]], [[14, 18]], [[15, 13]]]);

  const replies = emitted.filter((m) => m.type === "reply");
  assert.strictEqual(replies.length, 4);
  assert.strictEqual(replies[0].body.to, "a1");
  assert.strictEqual(replies[1].body.to, "a2");
  assert.strictEqual(replies[2].body.to, "a3");
  assert.strictEqual(replies[3].body.to, "a4");
  for (const r of replies) assert.strictEqual(r.body.ok, true);

  assert.strictEqual(rejected, false, "begin() should not reject");
});
