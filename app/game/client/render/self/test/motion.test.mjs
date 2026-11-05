import test from "node:test";
import assert from "node:assert/strict";

import * as motion from "../../../../../../edges/render/render_to_motion.mjs";
import { Last, Action } from "../../../../../../common/index.mjs";

function pose(id, owner, position, matrix) {
  return { id, owner, group: 0, slot: 0, position, matrix };
}

function frozenPose(id, owner, position, matrix) {
  return Object.freeze({ id, owner, group: 0, slot: 0, position, matrix });
}

function act(move, seat) {
  if (move === "turn") return Action({ id: "a", seat, move, axis: "x", dir: 1, version: 0 });
  return Action({ id: "a", seat, move, axis: null, dir: null, version: 0 });
}

function last(change, dice, seat = 0) {
  const actionObj = change === "deal" ? null : act(change, seat);
  return Last({ action: actionObj, change, dice, before: dice.map(() => 0) });
}

test("motion.tracks: no change when prev and next are identical", () => {
  const p0 = frozenPose(0, 0, [0, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  const prev = Array.from({ length: 16 }, (_, i) => frozenPose(i, i % 4, [0, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
  const next = Array.from({ length: 16 }, (_, i) => frozenPose(i, i % 4, [0, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
  const tracks = motion.tracks(prev, next, null);
  assert.deepEqual(tracks, []);
});

test("motion.tracks: a moved die gets kind 'move', delay 0, ms 300, spin 0", () => {
  const prev = Array.from({ length: 16 }, (_, i) =>
    frozenPose(i, i % 4, [-99, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const next = prev.map((p, i) =>
    frozenPose(p.id, p.owner, [i, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const tracks = motion.tracks(prev, next, null);
  assert.equal(tracks.length, 16);
  for (const t of tracks) {
    assert.equal(t.kind, "move");
    assert.equal(t.delay, 0);
    assert.equal(t.ms, 300);
    assert.equal(t.spin, 0);
    assert.equal(t.from.id, t.id);
    assert.equal(t.to.id, t.id);
  }
});

test("motion.tracks: kind is last.change when last.dice includes id", () => {
  const prev = Array.from({ length: 16 }, (_, i) =>
    frozenPose(i, i % 4, [-99, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const next = prev.map((p, i) =>
    frozenPose(p.id, p.owner, [i, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const l = last("roll", [0, 1], 0);
  const tracks = motion.tracks(prev, next, l);
  const t0 = tracks.find((t) => t.id === 0);
  const t2 = tracks.find((t) => t.id === 2);
  assert.equal(t0.kind, "roll");
  assert.equal(t0.ms, 600);
  assert.equal(t0.spin, 2);
  assert.equal(t2.kind, "move");
  assert.equal(t2.ms, 300);
  assert.equal(t2.spin, 0);
});

test("motion.tracks: delay is MS[last.change] for a 'move' when last.change is turn or roll", () => {
  const prev = Array.from({ length: 16 }, (_, i) =>
    frozenPose(i, i % 4, [-99, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const next = prev.map((p, i) =>
    frozenPose(p.id, p.owner, [i, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  // last.change = "turn", die 5 is a move (not in last.dice)
  const l = last("turn", [0], 0);
  const tracks = motion.tracks(prev, next, l);
  const t5 = tracks.find((t) => t.id === 5);
  assert.equal(t5.kind, "move");
  assert.equal(t5.delay, 250); // MS.turn
});

test("motion.tracks: delay is 0 for a 'move' when last.change is deal", () => {
  const prev = Array.from({ length: 16 }, (_, i) =>
    frozenPose(i, i % 4, [-99, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const next = prev.map((p, i) =>
    frozenPose(p.id, p.owner, [i, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const l = last("deal", [0], 0);
  const tracks = motion.tracks(prev, next, l);
  const t5 = tracks.find((t) => t.id === 5);
  assert.equal(t5.kind, "move");
  assert.equal(t5.delay, 0);
});

test("motion.tracks: skip dice whose position and matrix are unchanged", () => {
  const prev = Array.from({ length: 16 }, (_, i) =>
    frozenPose(i, i % 4, [i, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  );
  const next = prev.map((p, i) =>
    i === 0 ? frozenPose(p.id, p.owner, [99, 0.5, 4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) : p
  );
  const tracks = motion.tracks(prev, next, null);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].id, 0);
});
