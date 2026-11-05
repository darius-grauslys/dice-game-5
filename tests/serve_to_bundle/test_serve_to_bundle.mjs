import assert from "node:assert/strict";
import * as real from "../../edges/serve/serve_to_bundle.mjs";

// bundle's surface: build() → Promise<string>
// wraps the real call: checks args, calls real.build(), checks it returned a string.
export async function build(...args) {
  // A) check arguments against the doc: build() takes no arguments.
  if (args.length > 0) {
    throw new Error("build: expected no arguments");
  }
  // B) call the function through the forwarder.
  const r = await real.build();
  // C) it returned; D) check the return value against the doc: a string.
  if (typeof r !== "string") {
    throw new Error(`build: expected a string, got ${typeof r}`);
  }
  return r;
}

export async function _sheo_check() {
  // Rule 1: build() returns the bundled code as a string.
  const code1 = await build();
  assert.strictEqual(typeof code1, "string", "build() returns a string");
  assert.ok(code1.length > 0, "bundle code is non-empty");

  // Rule 2: the first successful result is kept; later calls return the same string.
  const code2 = await build();
  assert.strictEqual(code2, code1, "later build() calls return the same string");

  // Argument check: build() takes no arguments; wrong args reject with an Error naming the function.
  await assert.rejects(() => build(1), /build: expected no arguments/);
  await assert.rejects(() => build({}), /build: expected no arguments/);
}
