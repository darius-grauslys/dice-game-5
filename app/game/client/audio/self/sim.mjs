import { init, state } from "./index.mjs";

export async function _sheo_sim(canvas, scenario) {
  const originalFetch = window.fetch;
  window.fetch = async () => ({ json: async () => ["music/trackA.mp3", "music/trackB.mp3"] });

  let rejectPlay = true; // refused until allowed (autoplay rule)
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (rejectPlay) {
      const e = new Error("autoplay rejected");
      e.name = "NotAllowedError";
      return Promise.reject(e);
    }
    return Promise.resolve();
  };

  const out = [];

  // init with play refused -> playing false
  init({ canvas });
  await new Promise((r) => setTimeout(r, 50));
  out.push({ phase: "init", track: state().track, playing: state().playing });

  // keydown on document -> playing true, starts music
  rejectPlay = false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  await new Promise((r) => setTimeout(r, 50));
  out.push({ phase: "keydown", track: state().track, playing: state().playing });

  // simulate 3 ended events, waiting 1.7s each
  for (let i = 0; i < 3; i++) {
    const audioEl = document.querySelector("audio");
    audioEl.dispatchEvent(new Event("ended"));
    await new Promise((r) => setTimeout(r, 1700));
    out.push({ phase: `ended${i + 1}`, track: state().track, playing: state().playing });
  }

  window.fetch = originalFetch;
  HTMLMediaElement.prototype.play = origPlay;

  return { results: out };
}
