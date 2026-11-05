import assert from "node:assert/strict";
import * as real from "../../edges/game/game_to_client.mjs";
import { Up, Game, Player, Queue, Group, Die, Message, Last, Reply } from "../../common/index.mjs";

// ---- drop-in wrapper for the client's surface ----

export function init(args, up) {
  // A) check args against the doc: init({seat, canvas}, up)
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("init: expected an object {seat, canvas}, got " + typeof args);
  }
  if (!("seat" in args)) throw new Error("init: missing seat");
  if (!("canvas" in args)) throw new Error("init: missing canvas");
  if (!args.canvas) throw new Error("init: canvas must be provided");
  if (!(up && typeof up === "object" && typeof up.poll === "function" && typeof up.emit === "function")) {
    throw new Error("init: up must have poll and emit");
  }
  // B) call through the forwarder
  const r = real.init(args, up);
  // C) check that it returned
  if (!(r instanceof Promise)) throw new Error("init: didn't return a Promise");
  // D) check the return value against the doc: Promise<void>
  return r.then((v) => {
    if (v !== undefined) throw new Error("init: expected void");
    return v;
  });
}

export function begin() {
  const r = real.begin();
  if (!(r instanceof Promise)) throw new Error("begin: didn't return a Promise");
  return r.then((v) => {
    if (v !== undefined) throw new Error("begin: expected void");
    return v;
  });
}

export const _sheo_browser = true;

// ---- helpers ----

function makeGame(winner = null) {
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(Die({ id: seat * 4 + k, o: 0 }));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
  }
  const last = Last({
    action: null,
    change: "deal",
    dice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    before: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  return Game({ players, turn: 0, version: 0, rng: 1, last, winner });
}

function makeUp() {
  const incoming = [];
  const outgoing = [];
  return {
    poll({ wait }) {
      if (incoming.length > 0) return Promise.resolve(incoming.splice(0));
      return Promise.resolve([]);
    },
    emit(msg) {
      outgoing.push(msg);
    },
    queueGame(game) {
      incoming.push(Message.game(game));
    },
    queueReply(reply) {
      incoming.push(Message.reply(Reply(reply)));
    },
    takeActions() {
      return outgoing.splice(0);
    },
  };
}

async function frames(n) {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
}

// ---- the test ----

export async function _sheo_check() {
  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "canvas exists");

  // init argument validation: each wrong argument throws an Error naming init.
  assert.throws(
    () => init(null, Up({ poll: () => Promise.resolve([]), emit: () => {} })),
    /^Error: init:/,
  );
  assert.throws(
    () => init({ seat: 0 }, Up({ poll: () => Promise.resolve([]), emit: () => {} })),
    /^Error: init:/,
  );
  assert.throws(
    () =>
      init(
        { seat: 0, canvas: null },
        Up({ poll: () => Promise.resolve([]), emit: () => {} }),
      ),
    /^Error: init:/,
  );
  assert.throws(
    () => init({ seat: 0, canvas }, null),
    /^Error: init:/,
  );

  // begin(): it takes no arguments and resolves to void.
  {
    const b = begin().catch(() => {});
    assert.ok(b instanceof Promise);
  }

  // begin skips pointer events when game === null, and ends when a winner arrives.
  {
    const up = makeUp();
    await init({ seat: 0, canvas }, up);
    const bp = begin();
    await frames(5);
    // no game queued: game stays null, pointer events are skipped.
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 400,
        clientY: 300,
        pointerId: 1,
        pointerType: "pointer",
        buttons: 1,
        bubbles: true,
      }),
    );
    await frames(5);
    assert.strictEqual(up.takeActions().length, 0, "no action while game is null");
    // end begin with a winner.
    up.queueGame(makeGame(0));
    await bp;
  }

  // begin processes a "game" message, handles pointer events (emitting an action
  // when game !== null and pending === null), handles a "reply" message, and ends
  // when the winner arrives.
  {
    const up = makeUp();
    up.queueGame(makeGame(null));
    await init({ seat: 0, canvas }, up);
    const bp = begin();
    await frames(30);
    // dispatch a drag: pointerdown, pointermove, pointerup
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 400, clientY: 300, pointerId: 1, pointerType: "pointer", buttons: 1, bubbles: true }),
    );
    await frames(3);
    canvas.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 430, clientY: 330, pointerId: 1, pointerType: "pointer", buttons: 1, bubbles: true }),
    );
    await frames(3);
    canvas.dispatchEvent(
      new PointerEvent("pointerup", { clientX: 430, clientY: 330, pointerId: 1, pointerType: "pointer", buttons: 0, bubbles: true }),
    );
    await frames(30);
    const actions = up.takeActions();
    // if an action was emitted, it must be a Message.action wrapping an Action.
    for (const a of actions) {
      assert.strictEqual(a.kind, "message");
      assert.strictEqual(a.type, "action");
      assert.strictEqual(a.body.kind, "action");
    }
    // queue a reply: begin must process it (render.notice, clear pending if to===pending).
    up.queueReply({ to: "x1", seat: 0, ok: true, reason: null });
    await frames(10);
    // end begin with a winner.
    up.queueGame(makeGame(1));
    await bp;
  }
}
