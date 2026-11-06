import * as real from "../../edges/game/game_to_client.mjs";
import assert from "node:assert/strict";
import { Up, Message, Game, Player, Queue, Group, Die, Reply } from "../../common/index.mjs";

// wrapped init: checks args, calls real, checks return is void
export async function init({ seat, canvas }, up) {
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 3) {
    throw new Error("init: seat must be an integer 0..3");
  }
  if (!canvas || typeof canvas.getContext !== "function") {
    throw new Error("init: canvas must have getContext");
  }
  if (!up || typeof up.poll !== "function" || typeof up.emit !== "function") {
    throw new Error("init: up must have poll and emit functions");
  }
  const r = await real.init({ seat, canvas }, up);
  assert.strictEqual(r, undefined, "init returns void");
  return r;
}

// wrapped begin: calls real, checks return is void
export async function begin() {
  const r = await real.begin();
  assert.strictEqual(r, undefined, "begin returns void");
  return r;
}

export const _sheo_browser = true;

export async function _sheo_check() {
  // Add <meta name="dice-seed" content="1"> first
  const meta = document.createElement("meta");
  meta.setAttribute("name", "dice-seed");
  meta.setAttribute("content", "1");
  document.head.insertBefore(meta, document.head.firstChild);

  const canvas = document.querySelector("canvas");

  // Build Up around our own queue
  const pollQueue = [];
  const emittedActions = [];
  const poll = async ({ wait }) => pollQueue.splice(0);
  const emit = (msg) => {
    if (msg && msg.kind === "message" && msg.type === "action") {
      emittedActions.push(msg.body);
    }
  };
  const up = Up({ poll, emit });

  // Build a Game where it is seat 0's turn
  const players = [];
  for (let seat = 0; seat < 4; seat++) {
    const dice = [];
    for (let k = 0; k < 4; k++) dice.push(Die({ id: seat * 4 + k, o: 0 }));
    const queue = Queue({ groups: [Group({ dice })] });
    players.push(Player({ seat, queue }));
  }
  const game0 = Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });

  // Queue the Game
  pollQueue.push(Message.game(game0));

  // init
  await init({ seat: 0, canvas }, up);

  // begin() - run in background
  const beginPromise = begin();

  // Let begin() run frames
  await new Promise((r) => setTimeout(r, 50));

  // Click the <button> with text ROLL
  let btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "ROLL");
  if (!btn) {
    btn = document.createElement("button");
    btn.textContent = "ROLL";
    document.body.appendChild(btn);
  }
  btn.click();

  // one roll Action emitted
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(emittedActions.length, 1, "one roll action emitted");
  const rollAction = emittedActions[0];
  assert.strictEqual(rollAction.kind, "action");
  assert.strictEqual(rollAction.move, "roll");
  assert.strictEqual(rollAction.seat, 0);
  assert.strictEqual(rollAction.axis, null);
  assert.strictEqual(rollAction.dir, null);

  // queue its Reply and the next Game
  const reply1 = Reply({ to: rollAction.id, seat: 0, ok: true, reason: null });
  pollQueue.push(Message.reply(reply1));
  pollQueue.push(Message.game(game0));

  await new Promise((r) => setTimeout(r, 50));

  // drag seat 0's rightmost die right 60 px (PointerEvents)
  const startX = 580, startY = 300;
  canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: startX, clientY: startY, bubbles: true }));
  canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: startX + 60, clientY: startY, bubbles: true }));
  canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: startX + 60, clientY: startY, bubbles: true }));

  // one turn Action about y, dir: 1
  await new Promise((r) => setTimeout(r, 50));
  const turnActions = emittedActions.filter((a) => a.move === "turn");
  assert.strictEqual(turnActions.length, 1, "one turn action emitted");
  const turnAction = turnActions[0];
  assert.strictEqual(turnAction.kind, "action");
  assert.strictEqual(turnAction.move, "turn");
  assert.strictEqual(turnAction.axis, "y");
  assert.strictEqual(turnAction.dir, 1);
  assert.strictEqual(turnAction.seat, 0);

  // queue its Reply and the next Game
  const reply2 = Reply({ to: turnAction.id, seat: 0, ok: true, reason: null });
  pollQueue.push(Message.reply(reply2));
  pollQueue.push(Message.game(game0));

  await new Promise((r) => setTimeout(r, 50));

  // a drag that comes back near its start → nothing
  const beforeDrag = emittedActions.length;
  const ds = 200, dy = 300;
  canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: ds, clientY: dy, bubbles: true }));
  canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: ds + 5, clientY: dy, bubbles: true }));
  canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: ds, clientY: dy, bubbles: true }));
  canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: ds, clientY: dy, bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(emittedActions.length, beforeDrag, "drag back to start emits nothing");

  // To end begin(), queue a Game with a winner and wait for it to return
  const gameWinner = Game({ players, turn: 0, version: 1, rng: 1, last: null, winner: 0 });
  pollQueue.push(Message.game(gameWinner));
  await beginPromise;
}
