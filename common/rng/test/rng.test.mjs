import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../index.mjs";

test("Rng is a frozen object with exactly seed, next and int", () => {
  assert.ok(Object.isFrozen(Rng));
  assert.deepStrictEqual(Object.keys(Rng).sort(), ["int", "next", "seed"]);
  for (const key of ["seed", "next", "int"])
    assert.strictEqual(typeof Rng[key], "function");
  assert.throws(() => { Rng.seed = () => 0; }, TypeError);
  assert.throws(() => { Rng.extra = 1; }, TypeError);
  assert.strictEqual(Rng.seed, Rng.seed); // unchanged
});

test("seed: the golden values", () => {
  assert.strictEqual(Rng.seed(1), 1);
  assert.strictEqual(Rng.seed(0), 0);
  assert.strictEqual(Rng.seed(-1), 4294967295);
  assert.strictEqual(Rng.seed(2 ** 32 + 5), 5);
});

test("next: the golden values from seed(1)", () => {
  let s = Rng.seed(1);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const [v, s2] = Rng.next(s);
    out.push(v);
    s = s2;
  }
  assert.deepStrictEqual(out, [2693262067, 11749833, 2265367787]);
  assert.strictEqual(s, 1199730144);
});

test("int: the golden values from seed(42)", () => {
  let s = Rng.seed(42);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const [k, s2] = Rng.int(s, 24);
    out.push(k);
    s = s2;
  }
  assert.deepStrictEqual(out, [12, 10, 0, 5, 18, 3, 4, 17]);
  assert.strictEqual(s, 1767624658);
});

test("next is deterministic and stays in 32 bits", () => {
  assert.deepStrictEqual(Rng.next(Rng.seed(7)), Rng.next(Rng.seed(7)));
  let s = Rng.seed(1234567);
  for (let i = 0; i < 1000; i++) {
    const [v, s2] = Rng.next(s);
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 4294967295, `value ${i}`);
    assert.ok(Number.isInteger(s2) && s2 >= 0 && s2 <= 4294967295, `state ${i}`);
    s = s2;
  }
});

test("int: the endpoints n = 1 and n = 2^32", () => {
  // n = 1: only 0 is possible; one next call is enough.
  let s = Rng.seed(9);
  const [, sNext] = Rng.next(s);
  const [k0, s1] = Rng.int(s, 1);
  assert.strictEqual(k0, 0);
  assert.strictEqual(s1, sNext);
  // n = 2^32: the whole u32 is accepted on the first draw,
  // so int(state, 2^32) is exactly next(state).
  const [v2, s2] = Rng.next(sNext);
  const [k1, s3] = Rng.int(sNext, 4294967296);
  assert.strictEqual(k1, v2);
  assert.strictEqual(s3, s2);
});

test("int: results stay in 0..n-1 for assorted n", () => {
  for (const n of [1, 2, 3, 5, 7, 24, 16, 1000, 4294967293, 4294967296]) {
    let s = Rng.seed(n);
    for (let i = 0; i < 200; i++) {
      const [k, s2] = Rng.int(s, n);
      assert.ok(Number.isInteger(k) && k >= 0 && k < n, `n=${n} i=${i} k=${k}`);
      s = s2;
    }
  }
});

test("int: rejection does not bias n = 24 (sanity spread)", () => {
  // With 50k draws each of 0..23 should come up at least once.
  let s = Rng.seed(42);
  const seen = new Set();
  for (let i = 0; i < 50000 && seen.size < 24; i++) {
    const [k, s2] = Rng.int(s, 24);
    seen.add(k);
    s = s2;
  }
  assert.strictEqual(seen.size, 24);
});

test("seed: rejects a non-safe integer", () => {
  for (const n of [1.5, -1.5, "1", 1n, null, undefined, true, false, NaN, Infinity, -Infinity, 2 ** 53, -(2 ** 53), [], {}])
    assert.throws(
      () => Rng.seed(n),
      /^TypeError: Rng\.seed: /,
      `n=${String(n)}`,
    );
});

test("next: rejects a bad state", () => {
  for (const state of [-1, 4294967296, 1.5, "1", 1n, null, undefined, true, NaN, Infinity, [], {}])
    assert.throws(
      () => Rng.next(state),
      /^TypeError: Rng\.next: /,
      `state=${String(state)}`,
    );
});

test("int: rejects a bad n", () => {
  for (const n of [0, -1, 4294967297, 1.5, "24", 24n, null, undefined, true, NaN, Infinity, [], {}])
    assert.throws(
      () => Rng.int(1, n),
      /^TypeError: Rng\.int: /,
      `n=${String(n)}`,
    );
});

test("int: rejects a bad state", () => {
  for (const state of [-1, 4294967296, 1.5, "1", 1n, null, undefined, true, NaN, [], {}])
    assert.throws(
      () => Rng.int(state, 2),
      /^TypeError: Rng\.int: /,
      `state=${String(state)}`,
    );
});
