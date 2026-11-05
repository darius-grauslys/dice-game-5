// hold: POST requests waiting for their Reply, keyed by the action's id.
// Pure state, no IO.

// Map of id -> resolve function for promises returned by wait().
const waiting = new Map();

/**
 * wait(id) -> Promise<Reply>
 * id must be a non-empty string, else TypeError starting "hold.wait: ".
 * If something already waits for id, throw Error starting "hold.wait: ".
 */
export function wait(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("hold.wait: id must be a non-empty string");
  }
  if (waiting.has(id)) {
    throw new Error(`hold.wait: something already waits for ${id}`);
  }
  return new Promise((resolve) => {
    waiting.set(id, resolve);
  });
}

export function settle(reply) {
  if (reply === null || typeof reply !== "object" || reply.kind !== "reply") {
    throw new TypeError("hold.settle: reply must be a Reply (kind === \"reply\")");
  }
  const resolve = waiting.get(reply.to);
  if (resolve) {
    waiting.delete(reply.to);
    resolve(reply);
    return true;
  }
  return false;
}

export function pending() {
  return waiting.size;
}
