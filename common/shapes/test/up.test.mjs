import { test } from "node:test";
import assert from "node:assert/strict";
import { Up } from "../index.mjs";

test("Up builds a valid value", () => {
  const poll = () => 1;
  const emit = () => 2;
  const u = Up({ poll, emit });
  assert.deepStrictEqual(Object.keys(u), ["kind", "poll", "emit"]);
  assert.strictEqual(u.kind, "up");
  // Rule 5: the functions are passed through, not wrapped.
  assert.strictEqual(u.poll, poll);
  assert.strictEqual(u.emit, emit);
  // The object is frozen...
  assert.ok(Object.isFrozen(u));
  // ...but the functions inside it are not.
  assert.ok(!Object.isFrozen(poll));
  assert.ok(!Object.isFrozen(emit));
});

test("Up's value is frozen", () => {
  const u = Up({ poll: () => {}, emit: () => {} });
  assert.throws(() => { u.poll = () => {}; }, TypeError);
  assert.throws(() => { u.emit = () => {}; }, TypeError);
});

test("Up rejects a non-function poll", () => {
  for (const poll of [null, undefined, 5, "poll", {}, []])
    assert.throws(
      () => Up({ poll, emit: () => {} }),
      /Up\.poll: /,
      `poll=${JSON.stringify(poll)}`,
    );
});

test("Up rejects a non-function emit", () => {
  for (const emit of [null, undefined, 5, "emit", {}, []])
    assert.throws(
      () => Up({ poll: () => {}, emit }),
      /Up\.emit: /,
      `emit=${JSON.stringify(emit)}`,
    );
});

test("Up rejects missing and unknown fields", () => {
  assert.throws(() => Up({ emit: () => {} }), /Up\.poll: /);
  assert.throws(() => Up({ poll: () => {} }), /Up\.emit: /);
  assert.throws(
    () => Up({ poll: () => {}, emit: () => {}, on: () => {} }),
    /Up\.on: unknown field$/,
  );
});
