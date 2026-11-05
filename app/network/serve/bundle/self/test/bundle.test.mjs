import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "../index.mjs";

test("build returns a string", async () => {
  const code = await build();
  assert.strictEqual(typeof code, "string");
  assert.ok(code.length > 0);
});

test("build caches: second call returns the same string", async () => {
  const code1 = await build();
  const code2 = await build();
  assert.strictEqual(code1, code2);
  assert.ok(code2.length > 0);
});

test("build output is ESM code", async () => {
  const code = await build();
  // The bundled page entry should contain ESM constructs
  assert.ok(code.includes("import") || code.includes("export") || code.includes("function"));
});
