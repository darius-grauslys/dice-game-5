import { test } from "node:test";
import assert from "node:assert/strict";
import { Die } from "../index.mjs";
import { die } from "./helpers.mjs";

test("Die builds a valid value", () => {
  const d = Die({ id: 3, o: 22 });
  assert.deepStrictEqual(d, { kind: "die", id: 3, o: 22 });
  assert.deepStrictEqual(Object.keys(d), ["kind", "id", "o"]);
  assert.ok(Object.isFrozen(d));
});

test("Die rejects a bad id", () => {
  for (const id of [16, -1, 1.5, "0", null, true, [0]])
    assert.throws(
      () => Die({ id, o: 0 }),
      /Die\.id: /,
      `id=${JSON.stringify(id)}`,
    );
});

test("Die rejects a bad o", () => {
  for (const o of [24, -1, 0.5, "0", null, true, [0]])
    assert.throws(
      () => Die({ id: 0, o }),
      /Die\.o: /,
      `o=${JSON.stringify(o)}`,
    );
});

test("Die rejects missing and unknown fields", () => {
  assert.throws(() => Die({ o: 0 }), /Die\.id: /);
  assert.throws(() => Die({ id: 0 }), /Die\.o: /);
  assert.throws(() => Die({}), /Die\.id: /);
  assert.throws(
    () => Die({ id: 0, o: 0, colour: "red" }),
    /Die\.colour: unknown field$/,
  );
});

test("Die's value is deeply frozen", () => {
  const d = die(0);
  assert.throws(() => { d.id = 1; }, TypeError);
  assert.throws(() => { d.o = 1; }, TypeError);
  assert.throws(() => { d.kind = "group"; }, TypeError);
});
