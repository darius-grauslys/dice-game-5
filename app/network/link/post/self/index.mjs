import { toJSON, fromJSON, ROUTES } from "../../../../../common/index.mjs";

export async function send(origin, action) {
  const res = await fetch(origin + ROUTES.action, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: toJSON(action),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`post.send: HTTP ${res.status}: ${text}`);
  }
  const reply = fromJSON(await res.text());
  if (!(reply && reply.kind === "reply")) {
    throw new TypeError("post.send: expected a Reply");
  }
  return reply;
}
