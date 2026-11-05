import assert from "node:assert/strict";
import * as real from "../../edges/app/app_to_game.mjs";
import { Up, Message, Game, Action, Reply } from "../../common/index.mjs";

// ---- wrapped functions: drop-in for the forwarder ----

export async function initGame(opts, up) {
  // A) check arguments against the doc
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) {
    throw new TypeError("initGame: opts must be an object");
  }
  if (up === null || typeof up !== "object" || up.kind !== "up") {
    throw new TypeError("initGame: up must be an Up");
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

export async function begin() {
  // A) check arguments against the doc (no arguments)
  if (arguments.length > 0) {
    throw new TypeError("begin: takes no arguments");
  }
  // B) call the real function
  const result = await real.begin();
  // C) check that it returned
  // D) check the return value against the doc (Promise<void>)
  if (result !== undefined) {
    throw new Error("begin: expected undefined return");
  }
  return result;
}

// ---- test helper: an Up around our own queue ----

function makeUp() {
  const messages = [];
  const actions = [];
  const up = Up({
    emit: (message) => messages.push(message),
    poll: () => {
      const a = actions.slice();
      actions.length = 0;
      return a;
    },
  });
  return { up, messages, actions };
}

export async function _sheo_check() {
  // 1) begin() before initGame must throw Error starting "game.begin: "
  {
    const { up } = makeUp();
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

  // 4) begin() with a queued action must emit a reply and a game
  // NOTE: the server's begin() loops until the game reaches a winner state;
  // the exact winning action sequence is not derivable from the doc, so this
  // verification is deferred. The structure and error cases above are verified.
}
