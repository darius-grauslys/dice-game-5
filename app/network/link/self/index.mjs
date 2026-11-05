import { Message, ROUTES, Up } from "../../../../common/index.mjs";
import * as post from "../../../../edges/link/link_to_post.mjs";
import * as stream from "../../../../edges/link/link_to_stream.mjs";

let h;

export function start({origin}) {
  if (typeof origin !== "string" || !origin.startsWith("http")) {
    throw new TypeError("link.start: origin must be a string starting with http");
  }

  let queue = [];
  let waiters = [];

  function poll({wait} = {}) {
    return new Promise((resolve) => {
      if (queue.length > 0) {
        const msgs = queue;
        queue = [];
        resolve(msgs);
      } else if (wait) {
        waiters.push(resolve);
      } else {
        resolve([]);
      }
    });
  }

  function enqueue(message) {
    queue.push(message);
    if (waiters.length > 0) {
      const resolve = waiters.shift();
      const msgs = queue;
      queue = [];
      resolve(msgs);
    }
  }

  h = stream.open(origin + ROUTES.events, (message) => {
    enqueue(message);
  });

  function emit(message) {
    if (message.type === "action") {
      post.send(origin, message.body)
        .then((reply) => {
          enqueue(Message.reply(reply));
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }

  return Promise.resolve(Up({ poll: ({wait} = {}) => poll({wait}), emit }));
}

export function close() {
  h.close();
  return Promise.resolve();
}
