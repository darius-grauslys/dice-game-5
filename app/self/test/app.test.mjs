import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../index.mjs";

test("start rejects an unknown role", async () => {
  await assert.rejects(
    () => start({ role: "unknown" }),
    /^TypeError: network\.initNetwork: /,
    "start should reject an unknown role via network.initNetwork",
  );
});

test("start rejects missing role", async () => {
  await assert.rejects(
    () => start({}),
    /^TypeError: network\.initNetwork: /,
    "start should reject a missing role via network.initNetwork",
  );
});
