import assert from "node:assert/strict";
import * as real from "../../edges/client/client_to_audio.mjs";

// wrapped fade: (currentTime, duration) -> number
export function fade(currentTime, duration) {
  if (typeof currentTime !== "number") throw new Error("fade: currentTime must be a number");
  if (typeof duration !== "number") throw new Error("fade: duration must be a number");
  const r = real.fade(currentTime, duration);
  if (typeof r !== "number") throw new Error("fade: expected number return");
  return r;
}

// wrapped next: (list, current, rand) -> string
export function next(list, current, rand) {
  if (!Array.isArray(list)) throw new Error("next: list must be an array");
  if (!list.every((t) => typeof t === "string")) throw new Error("next: list must be strings");
  if (typeof current !== "string") throw new Error("next: current must be a string");
  if (!list.includes(current)) throw new Error("next: current must be in list");
  if (typeof rand !== "number" || Number.isNaN(rand)) throw new Error("next: rand must be a number");
  const r = real.next(list, current, rand);
  if (typeof r !== "string") throw new Error("next: expected string return");
  if (!list.includes(r)) throw new Error("next: return must be in list");
  if (list.length > 1 && r === current) throw new Error("next: return must not be current");
  return r;
}

// wrapped init: ({canvas}) -> void
export function init(opts) {
  if (typeof opts !== "object" || opts === null || typeof opts.canvas === "undefined") throw new Error("init: missing canvas");
  const r = real.init(opts);
  if (r !== undefined) throw new Error("init: expected void return");
  return r;
}

// wrapped state: () -> {track, playing, muted, volume}
export function state() {
  const r = real.state();
  if (typeof r !== "object" || r === null) throw new Error("state: expected object return");
  if (r.track !== null && typeof r.track !== "string") throw new Error("state: track must be string or null");
  if (typeof r.playing !== "boolean") throw new Error("state: playing must be boolean");
  if (typeof r.muted !== "boolean") throw new Error("state: muted must be boolean");
  if (typeof r.volume !== "number") throw new Error("state: volume must be number");
  return r;
}

export const _sheo_browser = true;

export async function _sheo_check() {
  // fade golden values
  assert.strictEqual(fade(0, 180), 1);
  assert.strictEqual(fade(170, 180), 1);
  assert.strictEqual(fade(175, 180), 0.5);
  assert.strictEqual(fade(180, 180), 0);
  assert.strictEqual(fade(181, 180), 0);
  assert.strictEqual(fade(3, NaN), 1);

  // next golden values
  assert.strictEqual(next(["a", "b", "c"], "b", 0), "a");
  assert.strictEqual(next(["a", "b", "c"], "b", 0.99), "c");
  assert.strictEqual(next(["a"], "a", 0.5), "a");
  assert.strictEqual(next(["a", "b"], "a", 0.7), "b");

  // init + state + mute button
  const canvas = document.querySelector("canvas");

  // stub fetch for ROUTES.music: first [] (no music), then a two-track list
  let fetchCount = 0;
  window.fetch = (url) => {
    fetchCount++;
    if (typeof url === "string" && url.includes("music")) {
      return Promise.resolve({
        json: () => Promise.resolve(fetchCount === 1 ? [] : ["https://music/t1.mp3", "https://music/t2.mp3"])
      });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  };

  init({ canvas });

  // state shape
  const s = state();
  assert(s.track === null || typeof s.track === "string", "track is string or null");
  assert.strictEqual(typeof s.playing, "boolean");
  assert.strictEqual(typeof s.muted, "boolean");
  assert.strictEqual(typeof s.volume, "number");

  // mute button exists at bottom-left with unmute.png
  const button = document.querySelector("button");
  assert(button, "mute button should exist");
  const img = button.querySelector("img");
  assert(img, "button should hold img");
  assert.strictEqual(img.width, 40, "img width 40");
  assert.strictEqual(img.height, 40, "img height 40");
  assert(img.src.includes("unmute.png"), "should start with unmute.png");

  // button style: transparent
  const style = getComputedStyle(button);
  assert(style.backgroundColor === "transparent" || style.backgroundColor === "rgba(0, 0, 0, 0)", "button should be transparent");

  // button position: 12px in from left and bottom edges of 800x600 canvas
  const rect = button.getBoundingClientRect();
  assert(Math.abs(rect.left - 12) <= 2, "button left should be ~12");
  assert(Math.abs(rect.bottom - (600 - 12)) <= 2, "button bottom should be ~588");

  // click toggles to muted
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.strictEqual(state().muted, true, "after first click muted should be true");
  assert(img.src.includes("mute.png"), "after click should be mute.png");

  // click again toggles back
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.strictEqual(state().muted, false, "after second click muted should be false");
  assert(img.src.includes("unmute.png"), "after second click should be unmute.png");
}
