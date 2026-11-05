import { test } from "node:test";
import assert from "node:assert/strict";
import * as client from "../index.mjs";

test("client exports init and begin", () => {
  assert.strictEqual(typeof client.init, "function");
  assert.strictEqual(typeof client.begin, "function");
});

test("client has no _sheo_stub marker", () => {
  assert.strictEqual(client._sheo_stub, undefined);
});
