import { test } from "node:test";
import assert from "node:assert/strict";
import { Group, Queue } from "../index.mjs";
import { die } from "./helpers.mjs";

const group = (ids) => Group({ dice: ids.map((id) => die(id)) });

test("Queue builds a valid value", () => {
  const g1 = group([0]);
  const g2 = group([1, 2]);
  const q = Queue({ groups: [g1, g2] });
  assert.deepStrictEqual(q, { kind: "queue", groups: [g1, g2] });
  assert.deepStrictEqual(Object.keys(q), ["kind", "groups"]);
  assert.ok(Object.isFrozen(q));
  assert.ok(Object.isFrozen(q.groups));
  // Rule 5: shared values are passed through, not copied.
  assert.strictEqual(q.groups[0], g1);
  assert.strictEqual(q.groups[1], g2);
});

test("Queue accepts an empty groups", () => {
  const q = Queue({ groups: [] });
  assert.deepStrictEqual(q, { kind: "queue", groups: [] });
  assert.ok(Object.isFrozen(q.groups));
});

test("Queue rejects a bad groups", () => {
  for (const groups of [null, 5, "groups", {}, group([0]), [group([0]), null], [group([0]), die(0)]])
    assert.throws(
      () => Queue({ groups }),
      /Queue\.groups: /,
      `groups=${JSON.stringify(groups)}`,
    );
});

test("Queue rejects missing and unknown fields", () => {
  assert.throws(() => Queue({}), /Queue\.groups: /);
  assert.throws(
    () => Queue({ groups: [group([0])], head: group([1]) }),
    /Queue\.head: unknown field$/,
  );
});

test("Queue's value is deeply frozen", () => {
  const q = Queue({ groups: [group([0])] });
  assert.throws(() => { q.groups = []; }, TypeError);
  assert.throws(() => { q.groups.push(group([1])); }, TypeError);
});
