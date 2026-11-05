// app sim: drive the whole game end to end.
import { ROUTES, decodeEvents } from "../../common/wire/index.mjs";
import { toJSON, Action } from "../../common/index.mjs";

export async function _sheo_drive({ page, origin, scenario }) {
  const versions = [];
  const replies = [];
  const turns = [];
  let winner = null;

  // Open the event stream and follow the Games.
  const eventsRes = await fetch(origin + ROUTES.events);
  const reader = eventsRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentGame = null;

  async function processStream() {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let messages;
      try {
        [messages, buffer] = decodeEvents(buffer);
      } catch (e) {
        continue;
      }
      for (const msg of messages) {
        if (msg.type === "game") currentGame = msg.body;
      }
    }
  }

  processStream();

  // Wait for the initial Game (version 0).
  while (currentGame === null) await new Promise((r) => setTimeout(r, 50));
  versions.push(currentGame.version);

  // Play 12 moves through the API.
  for (let i = 0; i < 12; i++) {
    const seat = currentGame.turn;
    const version = currentGame.version;

    let action;
    if (i % 2 === 0) {
      action = Action({ id: `move-${i}`, seat, move: "roll", axis: null, dir: null, version });
    } else {
      action = Action({ id: `move-${i}`, seat, move: "turn", axis: "x", dir: 1, version });
    }

    const resp = await fetch(origin + ROUTES.action, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: toJSON(action),
    });
    const reply = await resp.json();
    replies.push(reply.ok === true);
    turns.push(seat);

    // Wait for this move's Game before the next.
    const nextVersion = version + 1;
    while (currentGame.version < nextVersion) await new Promise((r) => setTimeout(r, 50));
    versions.push(currentGame.version);
    if (currentGame.winner !== null) winner = currentGame.winner;

    // Wait for the page between moves.
    await page.waitForTimeout(700);
  }

  // Close the stream before returning.
  reader.cancel();

  return { versions, replies, turns, winner };
}
