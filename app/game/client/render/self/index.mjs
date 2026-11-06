import * as layout from "../../../../../edges/render/render_to_layout.mjs";
import * as motion from "../../../../../edges/render/render_to_motion.mjs";
import * as scene from "../../../../../edges/render/render_to_scene.mjs";
import { TURN, Die, Group, Queue, Player } from "../../../../../common/index.mjs";

let seat = 0;
let lastGame = null;

export function init({canvas, seat: s}) {
  seat = s;
  scene.init({canvas, seat: s});
}

export async function nextFrame() { return scene.nextFrame(); }

export function show(prev, next) {
  lastGame = next;
  const to = layout.place(next, seat);
  const tracks = prev === null ? [] : motion.tracks(layout.place(prev, seat), to, next.last);
  const rightmost = next.players[next.turn].queue.groups[next.players[next.turn].queue.groups.length - 1];
  const glow = next.winner === null ? rightmost.dice.map((d) => d.id) : [];
  const state = {
    turn: next.turn,
    glow,
    winner: next.winner,
    labels: layout.labels(seat),
  };
  scene.play(tracks, to, state);
}

export function hold(h) {
  if (lastGame === null) return;
  if (h === null) { scene.hold(null); return; }
  const { ids, axis, dir, at, to } = h;
  const next = lastGame.with({
    players: lastGame.players.map((p) => {
      const groups = p.queue.groups.map((g) => {
        const dice = g.dice.map((d) =>
          ids.includes(d.id) ? Die({ id: d.id, o: TURN[d.o][axis][dir] }) : d
        );
        return Group({ dice });
      });
      return Player({ seat: p.seat, queue: Queue({ groups }) });
    }),
  });
  const poses = layout.place(next, seat).filter((p) => ids.includes(p.id));
  scene.hold({ poses, at, to });
}

export function notice(reply) { scene.notice(reply); }
export function pick({x, y}) { return scene.pick({x, y}); }
export function describe() { return scene.describe(); }
