import { test } from "node:test";
import assert from "node:assert/strict";
import { typeFor } from "../index.mjs";

test("typeFor maps asset extensions", () => {
  assert.equal(typeFor(".mp3"), "audio/mpeg");
  assert.equal(typeFor(".png"), "image/png");
  assert.equal(typeFor(".json"), "application/json");
  assert.equal(typeFor(".txt"), "application/octet-stream");
  assert.equal(typeFor(""), "application/octet-stream");
});
