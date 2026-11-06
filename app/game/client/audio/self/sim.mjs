import { init, state } from "./index.mjs";

export async function _sheo_sim(canvas, scenario) {
  const originalFetch = window.fetch;
  window.fetch = async () => ({ json: async () => ["music/track1.mp3", "music/track2.mp3"] });

  let rejectPlay = false;
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (rejectPlay) {
      const e = new Error("autoplay rejected");
      e.name = "NotAllowedError";
      return Promise.reject(e);
    }
    return Promise.resolve();
  };

  const results = {};

  // Scenario 1: fetch returns two tracks, play resolves -> playing true after init, no gesture.
  rejectPlay = false;
  init({ canvas });
  await new Promise((r) => setTimeout(r, 50));
  results.scenario1 = { playing: state().playing, expected: true };

  // Scenario 2: play rejects (NotAllowedError) -> playing false until keydown, then true.
  rejectPlay = true;
  init({ canvas });
  await new Promise((r) => setTimeout(r, 50));
  results.scenario2_before = { playing: state().playing, expected: false };

  rejectPlay = false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  await new Promise((r) => setTimeout(r, 50));
  results.scenario2_after = { playing: state().playing, expected: true };

  window.fetch = originalFetch;
  HTMLMediaElement.prototype.play = origPlay;

  const allOk =
    results.scenario1.playing === true &&
    results.scenario2_before.playing === false &&
    results.scenario2_after.playing === true;

  return { allOk, results };
}
