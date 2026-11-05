import test from "node:test";
import assert from "node:assert/strict";
import { initGame, begin } from "../index.mjs";

test("initGame rejects bad role", async () => {
  await assert.rejects(
    () => initGame({ role: "bad" }, {}),
    /^TypeError: game\.initGame: /,
  );
});

test("initGame rejects missing role", async () => {
  await assert.rejects(
    () => initGame({}, {}),
    /^TypeError: game\.initGame: /,
  );
});

test("initGame rejects undefined opts", async () => {
  await assert.rejects(
    () => initGame(undefined, {}),
    /^TypeError: game\.initGame: /,
  );
});

test("begin before initGame throws", async () => {
  await assert.rejects(
    () => begin(),
    /^Error: game\.begin: /,
  );
});
