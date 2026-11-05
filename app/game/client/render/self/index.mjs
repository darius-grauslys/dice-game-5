import * as layout from "../../../../../edges/render/render_to_layout.mjs";
import * as motion from "../../../../../edges/render/render_to_motion.mjs";
import * as scene from "../../../../../edges/render/render_to_scene.mjs";

export function init({canvas, seat}) { scene.init({canvas, seat}); }
export async function nextFrame() { return scene.nextFrame(); }
export function show(prev, next) {
  const to = layout.place(next);
  const tracks = prev === null ? [] : motion.tracks(layout.place(prev), to, next.last);
  scene.play(tracks, to);
}
export function notice(reply) { scene.notice(reply); }
export function pick({x, y}) { return scene.pick({x, y}); }
export function describe() { return scene.describe(); }
