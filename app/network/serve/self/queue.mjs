// queue: the message queue backing serve.poll. Pure state, no IO.

export function createQueue() {
  let queue = [];
  let waitResolve = null;

  function enqueue(msg) {
    queue.push(msg);
    if (waitResolve) {
      const resolve = waitResolve;
      waitResolve = null;
      resolve();
    }
  }

  async function poll({ wait }) {
    if (queue.length === 0 && wait) {
      await new Promise((resolve) => { waitResolve = resolve; });
    }
    const msgs = queue;
    queue = [];
    return msgs;
  }

  return { enqueue, poll };
}
