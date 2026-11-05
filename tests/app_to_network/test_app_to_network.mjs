import assert from "node:assert/strict";
import * as real from "../../edges/app/app_to_network.mjs";
import { Message, pageFor, Die, Group, Queue, Player, Game } from "../../common/index.mjs";

// ---- helpers to build a valid game for messages ----

function die(id, o = 0) {
  return Die({ id, o });
}

function makePlayers() {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(die(seat * 4 + k));
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

// ---- wrapped surface: drop-in for the forwarder ----

export async function initNetwork(opts) {
  // A) check args against the doc, throw Error naming the function if wrong
  if (typeof opts !== "object" || opts === null) {
    throw new TypeError("initNetwork: opts must be an object");
  }
  if (typeof opts.role !== "string") {
    throw new TypeError("initNetwork: opts.role must be a string");
  }
  if (opts.role === "client" && typeof opts.origin !== "string") {
    throw new TypeError("initNetwork: opts.origin must be a string");
  }
  // B) call through the real edge
  const up = await real.initNetwork(opts);
  // C) check that it returned
  if (!up) {
    throw new TypeError("initNetwork: did not return a value");
  }
  // D) check the return value shape against the doc: Up({poll, emit})
  if (typeof up.poll !== "function" || typeof up.emit !== "function") {
    throw new TypeError("initNetwork: return value must have poll and emit functions");
  }
  return up;
}

export async function close(...args) {
  if (args.length > 0) {
    throw new TypeError("close: takes no arguments");
  }
  const r = await real.close();
  if (r !== undefined) {
    throw new TypeError("close: expected to resolve to undefined");
  }
  return r;
}

// ---- the check ----

export async function _sheo_check() {
  // invalid role: real network throws TypeError starting network.initNetwork: 
  await assert.rejects(
    () => initNetwork({ role: "bad" }),
    /^TypeError: network\.initNetwork: /
  );

  // client without origin: wrapped function checks and names initNetwork: 
  await assert.rejects(
    () => initNetwork({ role: "client" }),
    /^TypeError: initNetwork: opts\.origin must be a string/
  );

  // build a valid game and a game message
  const game = makeGame();
  const msg = Message.game(game);

  // pick a random port in 20000..59999
  const port = 20000 + Math.floor(Math.random() * 40000);

  // start server role with seed: 7
  const serverUp = await initNetwork({ role: "server", host: "127.0.0.1", port, seed: 7 });

  // second start of the same role: Error starting network.initNetwork: 
  await assert.rejects(
    () => initNetwork({ role: "server", host: "127.0.0.1", port: port + 100, seed: 1 }),
    /^Error: network\.initNetwork: /
  );

  // start client role, looping back in the same process
  const clientUp = await initNetwork({ role: "client", origin: `http://127.0.0.1:${port}` });

  // poll with no wait returns [] when there are no queued messages
  assert.deepStrictEqual(await clientUp.poll({ wait: false }), []);

  // server emits a message; client poll with wait: true returns it
  serverUp.emit(msg);
  const clientMsgs = await clientUp.poll({ wait: true });
  assert.deepStrictEqual(clientMsgs, [msg]);

  // a subsequent poll with wait: false returns []
  assert.deepStrictEqual(await clientUp.poll({ wait: false }), []);

  // the server role with seed: 7 answers GET / with pageFor(7)
  const resp = await fetch(`http://127.0.0.1:${port}/`);
  const html = await resp.text();
  assert.strictEqual(html, pageFor(7));

  // close closes every role and forgets them
  await close();

  // roles can be started again after close
  const serverUp2 = await initNetwork({ role: "server", host: "127.0.0.1", port: port + 200, seed: 1 });
  const clientUp2 = await initNetwork({ role: "client", origin: `http://127.0.0.1:${port + 200}` });
  assert.deepStrictEqual(await clientUp2.poll({ wait: false }), []);
  await close();
}
