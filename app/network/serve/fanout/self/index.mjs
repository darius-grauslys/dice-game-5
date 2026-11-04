// fanout: the event-stream subscribers, and catch-up for late joiners.
// Pure state, no IO.

const subs = new Map(); // token -> send function
const order = []; // tokens in join order
let nextToken = 1;
let lastText = undefined;
let hasPublished = false;

export function join(send) {
  if (typeof send !== "function") {
    throw new TypeError(`fanout.join: expected a function, got ${typeof send}`);
  }
  const token = nextToken++;
  subs.set(token, send);
  order.push(token);
  // catch-up: if something was published before, send it at once
  if (hasPublished) {
    send(lastText);
  }
  return token;
}

export function leave(token) {
  if (subs.has(token)) {
    subs.delete(token);
    const idx = order.indexOf(token);
    if (idx !== -1) order.splice(idx, 1);
  }
}

export function publish(text) {
  lastText = text;
  hasPublished = true;
  let succeeded = 0;
  const toRemove = [];
  for (const token of order) {
    const send = subs.get(token);
    if (!send) continue;
    try {
      send(text);
      succeeded++;
    } catch (e) {
      toRemove.push(token);
    }
  }
  for (const token of toRemove) {
    subs.delete(token);
    const idx = order.indexOf(token);
    if (idx !== -1) order.splice(idx, 1);
  }
  return succeeded;
}

export function reset() {
  subs.clear();
  order.length = 0;
  nextToken = 1;
  lastText = undefined;
  hasPublished = false;
}
