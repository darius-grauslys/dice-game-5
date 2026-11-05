import { Up, Message, toJSON, fromJSON, ROUTES, PAGE, encodeEvent } from "../../../../common/index.mjs";
import * as http from "../../../../edges/serve/serve_to_http.mjs";
import * as hold from "../../../../edges/serve/serve_to_hold.mjs";
import * as fanout from "../../../../edges/serve/serve_to_fanout.mjs";
import * as bundle from "../../../../edges/serve/serve_to_bundle.mjs";
import { createQueue } from "./queue.mjs";

const { enqueue, poll } = createQueue();

export function emit(message) {
  if (!(message && message.kind === "message")) return;
  if (message.type === "reply") {
    hold.settle(message.body);
  } else if (message.type === "game") {
    fanout.publish(encodeEvent(message));
  }
}

export async function start({ host, port }) {
  const js = await bundle.build();

  const routes = {
    [`GET ${ROUTES.page}`]: async () => ({ status: 200, type: "text/html", body: PAGE }),
    [`GET ${ROUTES.client}`]: async () => ({ status: 200, type: "text/javascript", body: js }),
    [`POST ${ROUTES.action}`]: async ({ body }) => {
      let action;
      try {
        action = fromJSON(body);
      } catch (e) {
        return { status: 400, type: "text/plain", body: e.message };
      }
      if (action.kind !== "action") {
        return { status: 400, type: "text/plain", body: `expected an Action, got ${action.kind}` };
      }
      let p;
      try {
        p = hold.wait(action.id);
      } catch (e) {
        return { status: 409, type: "text/plain", body: e.message };
      }
      enqueue(Message.action(action));
      const reply = await p;
      return { status: 200, type: "application/json", body: toJSON(reply) };
    },
    [`GET ${ROUTES.events}`]: () => ({
      status: 200,
      type: "text/event-stream",
      stream(send, closed) {
        const t = fanout.join(send);
        closed.then(() => fanout.leave(t));
      },
    }),
  };

  await http.listen({ host, port, routes });

  return Up({ poll, emit });
}

export async function close() {
  await http.close();
}
