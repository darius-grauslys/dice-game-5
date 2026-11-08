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

// wav(seconds): 8000 Hz, mono, 8-bit PCM, n = 8000*seconds samples all 128
function wav(seconds) {
  const n = 8000 * seconds;
  const bytes = new Uint8Array(44 + n);
  // "RIFF"
  bytes[0] = 0x52; bytes[1] = 0x49; bytes[2] = 0x46; bytes[3] = 0x46;
  // 36+n uint32 LE at 4
  bytes[4] = (36 + n) & 0xff; bytes[5] = ((36 + n) >> 8) & 0xff; bytes[6] = ((36 + n) >> 16) & 0xff; bytes[7] = ((36 + n) >> 24) & 0xff;
  // "WAVE"
  bytes[8] = 0x57; bytes[9] = 0x41; bytes[10] = 0x56; bytes[11] = 0x45;
  // "fmt "
  bytes[12] = 0x66; bytes[13] = 0x6d; bytes[14] = 0x74; bytes[15] = 0x20;
  // 16 uint32 LE at 16
  bytes[16] = 16 & 0xff; bytes[17] = (16 >> 8) & 0xff; bytes[18] = (16 >> 16) & 0xff; bytes[19] = (16 >> 24) & 0xff;
  // format 1 uint16 LE at 20
  bytes[20] = 1 & 0xff; bytes[21] = (1 >> 8) & 0xff;
  // channels 1 uint16 LE at 22
  bytes[22] = 1 & 0xff; bytes[23] = (1 >> 8) & 0xff;
  // rate 8000 uint32 LE at 24
  bytes[24] = 8000 & 0xff; bytes[25] = (8000 >> 8) & 0xff; bytes[26] = (8000 >> 16) & 0xff; bytes[27] = (8000 >> 24) & 0xff;
  // byte rate 8000 uint32 LE at 28
  bytes[28] = 8000 & 0xff; bytes[29] = (8000 >> 8) & 0xff; bytes[30] = (8000 >> 16) & 0xff; bytes[31] = (8000 >> 24) & 0xff;
  // block align 1 uint16 LE at 32
  bytes[32] = 1 & 0xff; bytes[33] = (1 >> 8) & 0xff;
  // bits 8 uint16 LE at 34
  bytes[34] = 8 & 0xff; bytes[35] = (8 >> 8) & 0xff;
  // "data"
  bytes[36] = 0x64; bytes[37] = 0x61; bytes[38] = 0x74; bytes[39] = 0x61;
  // n uint32 LE at 40
  bytes[40] = n & 0xff; bytes[41] = (n >> 8) & 0xff; bytes[42] = (n >> 16) & 0xff; bytes[43] = (n >> 24) & 0xff;
  // samples all 128
  for (let i = 0; i < n; i++) bytes[44 + i] = 128;
  // binary string
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
}

const T1 = wav(1);
const T2 = wav(2);

function waitFor(pred, ms, what) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (pred()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > ms) {
        clearInterval(interval);
        reject(new Error(`waitFor timed out after ${ms}ms waiting for: ${what}, plays.length=${plays.length}`));
      }
    }, 50);
  });
}

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

  // stub fetch for ROUTES.music: always the two-track list [T1, T2]
  window.fetch = (url) => {
    if (typeof url === "string" && url.includes("music")) {
      return Promise.resolve({
        json: () => Promise.resolve([T1, T2])
      });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  };

  // play stub: records each call; refuses until allowed
  const plays = []; let allowed = false;
  HTMLMediaElement.prototype.play = function () {
    plays.push({ el: this, src: this.getAttribute("src") ?? this.src, ok: allowed });
    return allowed ? Promise.resolve() : Promise.reject(new DOMException("autoplay refused", "NotAllowedError"));
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

  // --- playback block ---

  // 1. Refused start: waitFor(plays.length >= 1, 3000)
  await waitFor(() => plays.length >= 1, 3000, "step 1: a play call (refused start)");
  assert(plays[0].src === T1 || plays[0].src === T2, "step 1: plays[0].src is T1 or T2");
  assert.strictEqual(state().track, plays[0].src, "step 1: state().track === plays[0].src");
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(state().playing, false, "step 1: after macrotask, state().playing === false");

  // 2. Gesture start: allowed = true; keydown; waitFor(a play with ok after keydown, 2000)
  allowed = true;
  document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
  await waitFor(() => { for (let i = plays.length - 1; i >= 0; i--) if (plays[i].ok) return true; return false; }, 2000, "step 2: a play with ok after keydown");
  let playOk;
  for (let i = plays.length - 1; i >= 0; i--) { if (plays[i].ok) { playOk = plays[i]; break; } }
  assert.strictEqual(playOk.src, state().track, "step 2: play src === state().track");
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(state().playing, true, "step 2: after macrotask, state().playing === true");
  const E = playOk.el;
  const A = playOk.src;
  const B = (A === T1 ? T2 : T1);

  // 3. Ended -> next: E.dispatchEvent(ended); wait 1000ms: no new play; waitFor(a new play, 3000)
  E.dispatchEvent(new Event("ended"));
  await new Promise(r => setTimeout(r, 1000));
  assert.strictEqual(plays.length, 2, "step 3: no new play during the 1500 ms silence");
  await waitFor(() => plays.length >= 3, 3000, "step 3: next track after ended");
  const newPlay = plays[plays.length - 1];
  assert.strictEqual(newPlay.el, E, "step 3: new play el === E");
  assert.strictEqual(newPlay.src, B, "step 3: new play src === B");
  assert.strictEqual(state().track, B, "step 3: state().track === B");
  await new Promise(r => setTimeout(r, 0));
  assert.strictEqual(state().playing, true, "step 3: after macrotask, state().playing === true");

  // 4. Mute carries over: click mute button; state().muted === true; ended on E; waitFor(a new play, 4000): src === A, state().muted === true, E.muted === true; click again: state().muted === false, img back to unmute.png
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.strictEqual(state().muted, true, "step 4: after mute click, muted === true");
  E.dispatchEvent(new Event("ended"));
  await waitFor(() => plays.length >= 4, 4000, "step 4: a new play after ended while muted");
  const mutePlay = plays[plays.length - 1];
  assert.strictEqual(mutePlay.src, A, "step 4: muted new play src === A");
  assert.strictEqual(state().muted, true, "step 4: state().muted === true");
  assert.strictEqual(E.muted, true, "step 4: E.muted === true");
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.strictEqual(state().muted, false, "step 4: after second mute click, muted === false");
  assert(img.src.includes("unmute.png"), "step 4: img back to unmute.png");

  // 5. And again (it keeps going): dispatch ended on E; waitFor(a new play, 4000): src === B, state().track === B
  E.dispatchEvent(new Event("ended"));
  await waitFor(() => plays.length >= 5, 4000, "step 5: a new play keeps going");
  const againPlay = plays[plays.length - 1];
  assert.strictEqual(againPlay.src, B, "step 5: again play src === B");
  assert.strictEqual(state().track, B, "step 5: state().track === B");
}
