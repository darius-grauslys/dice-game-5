import http from "node:http";
import { URL } from "node:url";

let server = null;
const sockets = new Set();

export async function listen({ host, port, routes }) {
  if (server) {
    throw new Error("http.listen: already listening");
  }

  server = http.createServer((req, res) => {
    handleRequest(req, res, routes);
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.on("error", (err) => reject(err));
    server.listen(port, host, () => {
      const addr = server.address();
      resolve({ port: addr.port });
    });
  });
}

async function handleRequest(req, res, routes) {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = u.pathname;
  const query = Object.fromEntries(u.searchParams.entries());
  const method = req.method;
  const key = `${method} ${pathname}`;

  if (!routes[key]) {
    res.writeHead(404, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end("not found");
    return;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = chunks.length === 0 ? "" : Buffer.concat(chunks).toString("utf8");

  try {
    const r = await routes[key]({ method, path: pathname, query, body });
    if (typeof r.stream === "function") {
      res.writeHead(r.status, {
        "content-type": r.type,
        "cache-control": "no-store",
        "connection": "keep-alive",
      });
      const sock = req.socket || req.connection;
      const closed = new Promise((resolve) => {
        if (sock) sock.on("close", resolve);
        else resolve();
      });
      r.stream((text) => res.write(text), closed);
    } else {
      res.writeHead(r.status, { "content-type": r.type, "cache-control": "no-store" });
      res.end(r.body);
    }
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end(String(e.message));
  }
}

export function close() {
  if (!server) return Promise.resolve();
  const srv = server;
  server = null;
  for (const socket of sockets) {
    sockets.delete(socket);
    socket.destroy();
  }
  return new Promise((resolve) => {
    srv.close(() => resolve());
  });
}
