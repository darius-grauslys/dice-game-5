import assert from "node:assert/strict";
import { test } from "node:test";

import { initNetwork, close } from "../index.mjs";

test("network.initNetwork: unknown role throws TypeError", async () => {
  await close();
  await assert.rejects(
    () => initNetwork({ role: "bogus" }),
    /^TypeError: network\.initNetwork: /,
  );
});

test("network.initNetwork: second start of same role throws Error", async () => {
  await close();
  const up1 = await initNetwork({ role: "server", port: 0 });
  assert.ok(up1 && up1.kind === "up");
  await assert.rejects(
    () => initNetwork({ role: "server", port: 0 }),
    /^Error: network\.initNetwork: /,
  );
  await close();
});

test("network.initNetwork: server returns Up with poll and emit", async () => {
  await close();
  const up = await initNetwork({ role: "server", port: 0 });
  assert.ok(up && up.kind === "up");
  assert.strictEqual(typeof up.poll, "function");
  assert.strictEqual(typeof up.emit, "function");
  await close();
});

test("network.initNetwork: client returns Up with poll and emit", async () => {
  await close();
  const up = await initNetwork({ role: "client", origin: "http://127.0.0.1:8080" });
  assert.ok(up && up.kind === "up");
  assert.strictEqual(typeof up.poll, "function");
  assert.strictEqual(typeof up.emit, "function");
  await close();
});

test("network: both roles can run in one process", async () => {
  await close();
  const serverUp = await initNetwork({ role: "server", port: 0 });
  assert.ok(serverUp && serverUp.kind === "up");
  const clientUp = await initNetwork({ role: "client", origin: "http://127.0.0.1:8080" });
  assert.ok(clientUp && clientUp.kind === "up");
  await close();
  const serverUp2 = await initNetwork({ role: "server", port: 0 });
  assert.ok(serverUp2 && serverUp2.kind === "up");
  await close();
});

test("network.close: forgets roles so they can be started again", async () => {
  await close();
  await initNetwork({ role: "server", port: 0 });
  await initNetwork({ role: "client", origin: "http://127.0.0.1:8080" });
  await close();
  const serverUp = await initNetwork({ role: "server", port: 0 });
  const clientUp = await initNetwork({ role: "client", origin: "http://127.0.0.1:8080" });
  assert.ok(serverUp && serverUp.kind === "up");
  assert.ok(clientUp && clientUp.kind === "up");
  await close();
});
