import { Up, Message, toJSON, fromJSON, ROUTES, pageFor, encodeEvent } from "../../../../common/index.mjs";
import * as http from "../../../../edges/serve/serve_to_http.mjs";
import * as hold from "../../../../edges/serve/serve_to_hold.mjs";
import * as fanout from "../../../../edges/serve/serve_to_fanout.mjs";
import * as bundle from "../../../../edges/serve/serve_to_bundle.mjs";
import { readdir, readFile } from "node:fs/promises";
import { createQueue } from "./queue.mjs";

const ASSETS_BASE_URL = new URL("../../../../assets/", import.meta.url);

const { enqueue, poll } = createQueue();

export function typeFor(ext) {
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

async function collectAssets(dirUrl, prefix) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childRel = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      const childUrl = new URL(entry.name + "/", dirUrl);
      files.push(...(await collectAssets(childUrl, childRel)));
    } else if (entry.isFile()) {
      const childUrl = new URL(entry.name, dirUrl);
      files.push({ rel: childRel, url: childUrl });
    }
  }
  return files;
}

export function emit(message) {
  if (!(message && message.kind === "message")) return;
  if (message.type === "reply") {
    hold.settle(message.body);
  } else if (message.type === "game") {
    fanout.publish(encodeEvent(message));
  }
}

export async function start({ host, port, seed }) {
  const js = await bundle.build();

  let assetFiles = [];
  try {
    assetFiles = await collectAssets(ASSETS_BASE_URL, "");
  } catch (e) {
    assetFiles = [];
  }

  const assetDefs = [];
  const musicRoutes = [];
  for (const f of assetFiles) {
    const bytes = await readFile(f.url);
    const ext = "." + f.rel.split(".").pop().toLowerCase();
    const type = typeFor(ext);
    const routePath = ROUTES.assets + f.rel.replace(/\\/g, "/");
    assetDefs.push({ routePath, type, bytes });
    if (f.rel.startsWith("music/") && f.rel.endsWith(".mp3")) {
      musicRoutes.push(routePath);
    }
  }
  musicRoutes.sort();

  const routes = {
    [`GET ${ROUTES.page}`]: async () => ({ status: 200, type: "text/html", body: pageFor(seed ?? 0) }),
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
    [`GET ${ROUTES.music}`]: async () => ({
      status: 200,
      type: "application/json",
      body: JSON.stringify(musicRoutes),
    }),
  };

  for (const def of assetDefs) {
    routes[`GET ${def.routePath}`] = async () => ({ status: 200, type: def.type, body: def.bytes });
  }

  await http.listen({ host, port, routes });

  return Up({ poll, emit });
}

export async function close() {
  await http.close();
}
