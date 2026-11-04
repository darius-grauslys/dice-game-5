import { test } from "node:test";
import assert from "node:assert/strict";
import { Reply, REASONS } from "../index.mjs";

test("Reply builds a successful reply", () => {
  const r = Reply({ to: "a1", seat: 1, ok: true, reason: null });
  assert.deepStrictEqual(r, { kind: "reply", to: "a1", seat: 1, ok: true, reason: null });
  assert.deepStrictEqual(Object.keys(r), ["kind", "to", "seat", "ok", "reason"]);
  assert.ok(Object.isFrozen(r));
});

test("Reply builds a failed reply for every reason", () => {
  for (const reason of REASONS) {
    const r = Reply({ to: "a1", seat: 0, ok: false, reason });
    assert.deepStrictEqual(r, {
      kind: "reply",
      to: "a1",
      seat: 0,
      ok: false,
      reason,
    });
  }
});

test("Reply rejects a bad to", () => {
  for (const to of ["", 5, null, undefined, true])
    assert.throws(
      () => Reply({ to, seat: 0, ok: true, reason: null }),
      /Reply\.to: /,
      `to=${JSON.stringify(to)}`,
    );
});

test("Reply rejects a bad seat", () => {
  for (const seat of [4, -1, 1.5, "0", null])
    assert.throws(
      () => Reply({ to: "a1", seat, ok: true, reason: null }),
      /Reply\.seat: /,
      `seat=${JSON.stringify(seat)}`,
    );
});

test("Reply rejects a bad ok", () => {
  for (const ok of [1, 0, "true", null, undefined])
    assert.throws(
      () => Reply({ to: "a1", seat: 0, ok, reason: null }),
      /Reply\.ok: /,
      `ok=${JSON.stringify(ok)}`,
    );
});

test("Reply rejects a non-null reason when ok is true", () => {
  for (const reason of REASONS)
    assert.throws(
      () => Reply({ to: "a1", seat: 0, ok: true, reason }),
      /Reply\.reason: /,
    );
});

test("Reply rejects a null reason when ok is false", () => {
  assert.throws(
    () => Reply({ to: "a1", seat: 0, ok: false, reason: null }),
    /Reply\.reason: /,
  );
});

test("Reply rejects a reason that is not one of REASONS", () => {
  for (const reason of ["nope", "Not-Your-Turn", "", 5, true])
    assert.throws(
      () => Reply({ to: "a1", seat: 0, ok: false, reason }),
      /Reply\.reason: /,
      `reason=${JSON.stringify(reason)}`,
    );
});

test("Reply rejects missing and unknown fields", () => {
  assert.throws(() => Reply({ seat: 0, ok: true, reason: null }), /Reply\.to: /);
  assert.throws(() => Reply({ to: "a1", ok: true, reason: null }), /Reply\.seat: /);
  assert.throws(() => Reply({ to: "a1", seat: 0, reason: null }), /Reply\.ok: /);
  assert.throws(() => Reply({ to: "a1", seat: 0, ok: true }), /Reply\.reason: /);
  assert.throws(
    () => Reply({ to: "a1", seat: 0, ok: true, reason: null, extra: 1 }),
    /Reply\.extra: unknown field$/,
  );
});

test("Reply's value is deeply frozen", () => {
  const r = Reply({ to: "a1", seat: 0, ok: false, reason: "stale" });
  assert.throws(() => { r.ok = true; }, TypeError);
  assert.throws(() => { r.reason = "illegal"; }, TypeError);
});
