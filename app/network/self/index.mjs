import * as serve from "../../../edges/network/network_to_serve.mjs";
import * as link from "../../../edges/network/network_to_link.mjs";

const started = { server: false, client: false };

export async function initNetwork(opts) {
  const role = opts?.role;
  if (role === "server") {
    if (started.server) throw new Error("network.initNetwork: server already started");
    const up = await serve.start({ host: opts.host ?? "127.0.0.1", port: opts.port });
    started.server = true;
    return up;
  } else if (role === "client") {
    if (started.client) throw new Error("network.initNetwork: client already started");
    const up = await link.start({ origin: opts.origin });
    started.client = true;
    return up;
  } else {
    throw new TypeError("network.initNetwork: unknown role");
  }
}

export async function close() {
  const tasks = [];
  if (started.server) { tasks.push(serve.close()); started.server = false; }
  if (started.client) { tasks.push(link.close()); started.client = false; }
  await Promise.all(tasks);
}
