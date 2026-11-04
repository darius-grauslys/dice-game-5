// common/rng: the game's seeded random generator, pure functions over a
// 32-bit state.
//
// Pure: no imports, no IO, no time, no Math.random. The same inputs always
// give the same outputs. The browser loads this too.
//
// A state is an integer 0..4294967295. `Rng.seed` builds one from a safe
// integer, `Rng.next` advances it once (exactly mulberry32), and `Rng.int`
// draws a uniform integer in 0..n-1 by rejection sampling. Every bad input
// is a TypeError whose message starts `Rng.<fn>: `.

function show(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "bigint") return `${v}n`;
  if (typeof v === "function") return "a function";
  if (Array.isArray(v)) return "an array";
  if (typeof v === "object") return "an object";
  return typeof v;
}

// An integer 0..4294967295, inclusive.
function isU32(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 4294967295;
}

function seed(n) {
  if (!Number.isSafeInteger(n))
    throw new TypeError(`Rng.seed: expected a safe integer, got ${show(n)}`);
  return n >>> 0;
}

function next(state) {
  if (!isU32(state))
    throw new TypeError(`Rng.next: expected an integer 0..4294967295, got ${show(state)}`);
  const s = (state + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [(t ^ (t >>> 14)) >>> 0, s];
}

function int(state, n) {
  if (!isU32(state))
    throw new TypeError(`Rng.int: expected an integer 0..4294967295 state, got ${show(state)}`);
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 4294967296)
    throw new TypeError(`Rng.int: expected an integer 1..4294967296, got ${show(n)}`);
  const limit = Math.floor(4294967296 / n) * n;
  let value;
  let s = state;
  for (;;) {
    [value, s] = next(s);
    if (value < limit) return [value % n, s];
  }
}

export const Rng = Object.freeze({ seed, next, int });
