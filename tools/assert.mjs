// assert: node:assert/strict's common subset, for edge tests that run in the page
// (tools/browser.mjs maps `node:assert/strict` here). Fixed by the plan: don't edit.
export class AssertionError extends Error {
  constructor(message) { super(message); this.name = "AssertionError"; }
}
const show = (v) => { try { return typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); } catch { return String(v); } };
function deepEq(a, b, seen = new Map()) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (seen.get(a) === b) return true;
  seen.set(a, b);
  if (a instanceof Map) return a.size === b.size && [...a].every(([k, v]) => b.has(k) && deepEq(v, b.get(k), seen));
  if (a instanceof Set) return a.size === b.size && [...a].every((v) => b.has(v));
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp) return String(a) === String(b);
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k], seen));
}
const fail1 = (message, dflt) => { throw message instanceof Error ? message : new AssertionError(message ?? dflt); };
function matches(err, expected) {
  if (expected === undefined) return true;
  if (expected instanceof RegExp) return expected.test(String(err));
  if (typeof expected === "function") return expected.prototype !== undefined && err instanceof expected ? true : expected(err) === true;
  if (typeof expected === "object") return Object.keys(expected).every((k) => expected[k] instanceof RegExp ? expected[k].test(err[k]) : deepEq(err[k], expected[k]));
  return false;
}
export function ok(v, message) { if (!v) fail1(message, `expected a truthy value, got ${show(v)}`); }
export function equal(a, b, message) { if (!Object.is(a, b)) fail1(message, `expected ${show(a)} to equal ${show(b)}`); }
export function notEqual(a, b, message) { if (Object.is(a, b)) fail1(message, `expected ${show(a)} not to equal ${show(b)}`); }
export const strictEqual = equal, notStrictEqual = notEqual;
export function deepEqual(a, b, message) { if (!deepEq(a, b)) fail1(message, `expected deep equality:\n  actual:   ${show(a)}\n  expected: ${show(b)}`); }
export function notDeepEqual(a, b, message) { if (deepEq(a, b)) fail1(message, `expected deep inequality: ${show(a)}`); }
export const deepStrictEqual = deepEqual, notDeepStrictEqual = notDeepEqual;
export function match(s, re, message) { if (!re.test(s)) fail1(message, `expected ${show(s)} to match ${re}`); }
export function doesNotMatch(s, re, message) { if (re.test(s)) fail1(message, `expected ${show(s)} not to match ${re}`); }
export function fail(message) { fail1(message, "failed"); }
export function throws(fn, expected, message) {
  if (typeof expected === "string") { message = expected; expected = undefined; }
  try { fn(); } catch (e) { if (!matches(e, expected)) fail1(message, `the error didn't match: ${String(e)}`); return; }
  fail1(message, "expected the function to throw");
}
export function doesNotThrow(fn, message) { try { fn(); } catch (e) { fail1(message, `expected no throw, got ${String(e)}`); } }
export async function rejects(p, expected, message) {
  if (typeof expected === "string") { message = expected; expected = undefined; }
  try { await (typeof p === "function" ? p() : p); } catch (e) { if (!matches(e, expected)) fail1(message, `the rejection didn't match: ${String(e)}`); return; }
  fail1(message, "expected a rejection");
}
export async function doesNotReject(p, message) { try { await (typeof p === "function" ? p() : p); } catch (e) { fail1(message, `expected no rejection, got ${String(e)}`); } }
const assert = Object.assign((v, m) => ok(v, m), { ok, equal, notEqual, strictEqual, notStrictEqual, deepEqual, notDeepEqual, deepStrictEqual, notDeepStrictEqual, match, doesNotMatch, fail, throws, doesNotThrow, rejects, doesNotReject, AssertionError, strict: null });
assert.strict = assert;
export default assert;
