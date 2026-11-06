import assert from "node:assert/strict";
import * as real from "../../edges/app/app_to_game.mjs";
import { Up, Message, Game, Player, Queue, Group, Die, Action, Last } from "../../common/index.mjs";

// ---- wrapped functions: drop-in for the forwarder ----

export async function initGame(opts, up) {
  // A) check arguments against the doc
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) {
    throw new Error("initGame: opts must be an object");
  }
  if (up === null || typeof up !== "object" || up.kind !== "up") {
    throw new Error("initGame: up must be an Up");
  }
  // B) call the real function (role validation is delegated to the game)
  const result = await real.initGame(opts, up);
  // C) check that it returned
  // D) check the return value against the doc (Promise<void>)
  if (result !== undefined) {
    throw new Error("initGame: expected undefined return");
  }
  return result;
}

export function begin() {
  // A) check arguments against the doc (no arguments)
  if (arguments.length > 0) {
    throw new Error("begin: takes no arguments");
  }
  // B) call the real function
  const result = real.begin();
  // C) check that it returned
  if (!(result instanceof Promise)) {
    throw new Error("begin: expected a Promise");
  }
  // D) check the return value against the doc (a Promise that never resolves once started)
  return result;
}

// ---- test helper: an Up around our own queue ----

function makeUp() {
  const messages = [];
  const actions = [];
  let actionIndex = 0;
  const up = Up({
    emit: (message) => messages.push(message),
    poll: () => {
      if (actionIndex < actions.length) {
        const a = actions[actionIndex];
        actionIndex++;
        return [Message.action(a)];
      }
      return new Promise(() => {}); // never resolves; server just waits
    },
  });
  return { up, messages, actions };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGameWithWinner(messages, winner, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const msg = messages.find((m) => m.type === "game" && m.body.winner === winner);
    if (msg) return msg;
    await sleep(10);
  }
  throw new Error(`no game message with winner ${winner} after ${timeoutMs} ms`);
}

async function waitForNextGame(messages, afterMsg, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const idx = messages.indexOf(afterMsg);
    for (let i = idx + 1; i < messages.length; i++) {
      if (messages[i].type === "game") return messages[i];
    }
    await sleep(10);
  }
  throw new Error("no next game message after 5000 ms");
}

export async function _sheo_check() {
  // 1) begin() before initGame must throw Error starting "game.begin: "
  {
    await assert.rejects(
      () => begin(),
      /^Error: game\.begin: /,
      "begin() before initGame throws Error starting game.begin: ",
    );
  }

  // 2) initGame with a wrong role must throw TypeError starting "game.initGame: "
  {
    const { up } = makeUp();
    await assert.rejects(
      () => initGame({ role: "bad", seed: 1 }, up),
      /^TypeError: game\.initGame: /,
      "initGame with wrong role throws TypeError starting game.initGame: ",
    );
  }

  // 3) initGame({role: "server", seed: 1}, up) must emit one "game" Message
  {
    const { up, messages } = makeUp();
    await initGame({ role: "server", seed: 1 }, up);
    assert.strictEqual(messages.length, 1, "initGame emits exactly one message");
    assert.strictEqual(messages[0].kind, "message");
    assert.strictEqual(messages[0].type, "game");
    const g = messages[0].body;
    assert.strictEqual(g.kind, "game");
    assert.strictEqual(g.turn, 0);
    assert.strictEqual(g.version, 0);
    assert.ok(Number.isInteger(g.rng) && g.rng >= 0 && g.rng <= 4294967295, "rng in range");
    assert.strictEqual(g.last.kind, "last");
    assert.strictEqual(g.last.change, "deal");
    assert.strictEqual(g.last.action, null);
    assert.strictEqual(g.last.dice.length, 16);
    assert.strictEqual(g.winner, null);
    assert.strictEqual(g.players.length, 4);
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(g.players[i].seat, i);
    }
  }

  // 4) The loop scenario: server role, seed 9, restartMs 200.
  // begin() loops: it never returns; never await it.
  {
    const { up, messages, actions } = makeUp();
    actions.push(Action({ id: "a1", seat: 0, move: "turn", axis: "x", dir: -1, version: 0 }));
    actions.push(Action({ id: "a2", seat: 1, move: "turn", axis: "z", dir: 1, version: 1 }));
    actions.push(Action({ id: "a3", seat: 2, move: "turn", axis: "z", dir: 1, version: 2 }));
    actions.push(Action({ id: "a4", seat: 3, move: "turn", axis: "x", dir: 1, version: 3 }));

    await initGame({ role: "server", seed: 9, restartMs: 200 }, up);

    // start begin() without awaiting it; keep its promise, fail if it rejects
    const beginPromise = begin();
    let rejected = null;
    beginPromise.catch((e) => { rejected = e; });

    // wait until a game Message with winner: 3 has been emitted
    const winMsg = await waitForGameWithWinner(messages, 3);
    const winTime = Date.now();

    // wait for the next game Message
    const nextMsg = await waitForNextGame(messages, winMsg);
    const nextTime = Date.now();

    // It arrives no sooner than 200 ms after the win (allow 20 ms timer slack: >= 180 ms)
    assert.ok(nextTime - winTime >= 180, `next game arrived too soon: ${nextTime - winTime} ms`);

    // the next game: version 5, winner null, turn 0, rng 3535249242, faces, groups
    const expectedGame = Game({
      players: [
        Player({ seat: 0, queue: Queue({ groups: [
          Group({ dice: [Die({ id: 0, o: 17 })] }),
          Group({ dice: [Die({ id: 1, o: 6 })] }),
          Group({ dice: [Die({ id: 2, o: 3 })] }),
          Group({ dice: [Die({ id: 3, o: 4 })] }),
        ]}) }),
        Player({ seat: 1, queue: Queue({ groups: [
          Group({ dice: [Die({ id: 4, o: 20 })] }),
          Group({ dice: [Die({ id: 5, o: 18 }), Die({ id: 6, o: 6 })] }),
          Group({ dice: [Die({ id: 7, o: 21 })] }),
        ]}) }),
        Player({ seat: 2, queue: Queue({ groups: [
          Group({ dice: [Die({ id: 8, o: 11 })] }),
          Group({ dice: [Die({ id: 9, o: 6 })] }),
          Group({ dice: [Die({ id: 10, o: 0 })] }),
          Group({ dice: [Die({ id: 11, o: 2 })] }),
        ]}) }),
        Player({ seat: 3, queue: Queue({ groups: [
          Group({ dice: [Die({ id: 12, o: 10 }), Die({ id: 13, o: 14 })] }),
          Group({ dice: [Die({ id: 14, o: 18 })] }),
          Group({ dice: [Die({ id: 15, o: 13 })] }),
        ]}) }),
      ],
      turn: 0,
      version: 5,
      rng: 3535249242,
      last: Last({ action: null, change: "deal", dice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], before: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }),
      winner: null,
      faces: [
        [2, 1, 3, 6, 4, 5],
        [2, 1, 5, 3, 4, 6],
        [5, 4, 1, 2, 3, 6],
        [5, 2, 3, 6, 1, 4],
      ],
    });
    assert.deepStrictEqual(nextMsg.body, expectedGame);

    // exactly 4 reply Messages, to a1..a4, all ok: true
    const replies = messages.filter((m) => m.type === "reply");
    assert.strictEqual(replies.length, 4);
    for (let i = 0; i < 4; i++) {
      const r = replies[i].body;
      assert.strictEqual(r.kind, "reply");
      assert.strictEqual(r.to, `a${i + 1}`);
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.reason, null);
    }

    // fail the test if begin() rejected
    if (rejected) throw rejected;
  }
}
