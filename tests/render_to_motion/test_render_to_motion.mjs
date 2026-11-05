import * as real from "../../edges/render/render_to_motion.mjs";
import { strict as assert } from "node:assert/strict";
import {
  Player, Queue, Group, Die, Game, Last, Action,
  ORIENTATIONS, MS,
} from "../../common/index.mjs";

// ---- wrapped surface: a drop-in for the forwarder ----

function isPose(p) {
  return (
    p && typeof p === "object" && typeof p.id === "number" && p.id >= 0 && p.id <= 15 &&
    Array.isArray(p.position) && p.position.length === 3 &&
    Array.isArray(p.matrix) && p.matrix.length === 3 && p.matrix[0].length === 3
  );
}

export function tracks(prev, next, last) {
  // A) check arguments against the doc, name the function on error.
  if (!Array.isArray(prev)) throw new Error("tracks: prev must be an array of poses");
  if (!Array.isArray(next)) throw new Error("tracks: next must be an array of poses");
  if (prev.length !== 16) throw new Error("tracks: prev must have 16 poses");
  if (next.length !== 16) throw new Error("tracks: next must have 16 poses");
  for (const p of prev) if (!isPose(p)) throw new Error("tracks: prev entries must be poses");
  for (const p of next) if (!isPose(p)) throw new Error("tracks: next entries must be poses");
  if (last !== null && !(last && last.kind === "last")) throw new Error("tracks: last must be a Last or null");

  // B) call through the forwarder.
  const result = real.tracks(prev, next, last);

  // C) check that it returned.
  if (result === undefined) throw new Error("tracks: did not return a value");

  // D) check the return value against the doc.
  if (!Array.isArray(result)) throw new Error("tracks: return must be an array of Tracks");
  for (const t of result) {
    if (!(t && typeof t === "object" && typeof t.id === "number" && t.id >= 0 && t.id <= 15))
      throw new Error("tracks: Track.id must be a die id 0..15");
    if (t.kind !== "turn" && t.kind !== "roll" && t.kind !== "deal" && t.kind !== "move")
      throw new Error("tracks: Track.kind must be turn, roll, deal, or move");
    if (!isPose(t.from)) throw new Error("tracks: Track.from must be a pose");
    if (!isPose(t.to)) throw new Error("tracks: Track.to must be a pose");
    if (typeof t.delay !== "number") throw new Error("tracks: Track.delay must be a number");
    if (typeof t.ms !== "number") throw new Error("tracks: Track.ms must be a number");
    if (t.spin !== 0 && t.spin !== 2) throw new Error("tracks: Track.spin must be 0 or 2");
  }

  return result;
}

// ---- test helper: build a Pose from id, position, orientation ----

function pose(id, position, o) {
  return { id, position: [...position], matrix: ORIENTATIONS[o].matrix, o };
}

// Layout order: seat 0's dice in group order [3, 0, 1, 2], then seats 1..3.
const layoutOrder = [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function buildPoses(posMap) {
  return layoutOrder.map((id) => posMap[id]);
}

// ---- _sheo_check: exercise every rule in motion's doc ----

export async function _sheo_check() {
  const mk = (seat, groups) => Player({ seat, queue: Queue({ groups: groups.map((g) => Group({ dice: g.map(([id, o]) => Die({ id, o })) })) }) });
  const game = Game({ players: [
    mk(0, [[[0, 0], [1, 0]], [[2, 5]], [[3, 1]]]),
    mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
    mk(2, [[[8, 0], [9, 0], [10, 0], [11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 2]]]),
  ], turn: 0, version: 3, rng: 7, last: null, winner: null });

  const prevPoses = {
    0: pose(0, [-2.375, 0.5, 4], 0),
    1: pose(1, [-1.125, 0.5, 4], 0),
    2: pose(2, [0.625, 0.5, 4], 5),
    3: pose(3, [2.375, 0.5, 4], 1),
    4: pose(4, [-2.375, 0.5, -4], 0),
    5: pose(5, [-1.125, 0.5, -4], 0),
    6: pose(6, [0.625, 0.5, -4], 0),
    7: pose(7, [2.375, 0.5, -4], 0),
    8: pose(8, [-2.375, 0.5, 0], 0),
    9: pose(9, [-1.125, 0.5, 0], 0),
    10: pose(10, [0.625, 0.5, 0], 0),
    11: pose(11, [2.375, 0.5, 0], 0),
    12: pose(12, [0, 0.5, -4], 0),
    13: pose(13, [0, 0.5, -2], 0),
    14: pose(14, [0, 0.5, 2], 0),
    15: pose(15, [0, 0.5, 0], 2),
  };

  const nextTurnPoses = {
    0: pose(0, [-0.625, 0.5, 4], 0),
    1: pose(1, [0.625, 0.5, 4], 0),
    2: pose(2, [2.375, 0.5, 4], 5),
    3: pose(3, [-2.375, 0.5, 4], 0),
    4: pose(4, [-2.375, 0.5, -4], 0),
    5: pose(5, [-1.125, 0.5, -4], 0),
    6: pose(6, [0.625, 0.5, -4], 0),
    7: pose(7, [2.375, 0.5, -4], 0),
    8: pose(8, [-2.375, 0.5, 0], 0),
    9: pose(9, [-1.125, 0.5, 0], 0),
    10: pose(10, [0.625, 0.5, 0], 0),
    11: pose(11, [2.375, 0.5, 0], 0),
    12: pose(12, [0, 0.5, -4], 0),
    13: pose(13, [0, 0.5, -2], 0),
    14: pose(14, [0, 0.5, 2], 0),
    15: pose(15, [0, 0.5, 0], 2),
  };

  const prev = buildPoses(prevPoses);
  const nextTurn = buildPoses(nextTurnPoses);

  const lastTurn = Last({
    action: Action({ id: "0:3", seat: 0, move: "turn", axis: "x", dir: 1, version: 3 }),
    change: "turn",
    dice: [3],
    before: [1],
  });

  // Golden case: seat 0 turned die 3, settled moved it leftmost.
  const tracksTurn = tracks(prev, nextTurn, lastTurn);
  assert.deepStrictEqual(tracksTurn, [
    { id: 3, kind: "turn", delay: 0, ms: MS.turn, spin: 0, from: prevPoses[3], to: nextTurnPoses[3] },
    { id: 0, kind: "move", delay: MS.turn, ms: MS.move, spin: 0, from: prevPoses[0], to: nextTurnPoses[0] },
    { id: 1, kind: "move", delay: MS.turn, ms: MS.move, spin: 0, from: prevPoses[1], to: nextTurnPoses[1] },
    { id: 2, kind: "move", delay: MS.turn, ms: MS.move, spin: 0, from: prevPoses[2], to: nextTurnPoses[2] },
  ]);

  // Roll case: last.change === "roll", die 3 in last.dice, matrix changed (same position).
  const prevRoll = buildPoses(prevPoses);
  const nextRollPoses = {};
  for (const id of layoutOrder) nextRollPoses[id] = (id === 3 ? pose(3, [2.375, 0.5, 4], 5) : prevPoses[id]);
  const nextRoll = buildPoses(nextRollPoses);
  const lastRoll = Last({
    action: Action({ id: "0:3", seat: 0, move: "roll", version: 4 }),
    change: "roll",
    dice: [3],
    before: [1],
  });
  const tracksRoll = tracks(prevRoll, nextRoll, lastRoll);
  assert.deepStrictEqual(tracksRoll, [
    { id: 3, kind: "roll", delay: 0, ms: MS.roll, spin: 2, from: prevPoses[3], to: nextRollPoses[3] },
  ]);

  // Deal case: last.change === "deal", die 3 in last.dice, position changed.
  const prevDeal = buildPoses(prevPoses);
  const nextDealPoses = {};
  for (const id of layoutOrder) nextDealPoses[id] = (id === 3 ? pose(3, [-2.375, 0.5, 4], 0) : prevPoses[id]);
  const nextDeal = buildPoses(nextDealPoses);
  const lastDeal = Last({ action: null, change: "deal", dice: [3], before: [1] });
  const tracksDeal = tracks(prevDeal, nextDeal, lastDeal);
  assert.deepStrictEqual(tracksDeal, [
    { id: 3, kind: "deal", delay: 0, ms: MS.deal, spin: 2, from: prevPoses[3], to: nextDealPoses[3] },
  ]);

  // Move with last.change === "deal": a die not in last.dice moves, delay must be 0.
  const prevMoveDeal = buildPoses(prevPoses);
  const nextMoveDealPoses = {};
  for (const id of layoutOrder) nextMoveDealPoses[id] = (id === 0 ? pose(0, [-0.625, 0.5, 4], 0) : prevPoses[id]);
  const nextMoveDeal = buildPoses(nextMoveDealPoses);
  const lastMoveDeal = Last({ action: null, change: "deal", dice: [3], before: [1] });
  const tracksMoveDeal = tracks(prevMoveDeal, nextMoveDeal, lastMoveDeal);
  assert.deepStrictEqual(tracksMoveDeal, [
    { id: 0, kind: "move", delay: 0, ms: MS.move, spin: 0, from: prevPoses[0], to: nextMoveDealPoses[0] },
  ]);

  // Move with last === null: delay must be 0, kind "move".
  const prevNull = buildPoses(prevPoses);
  const nextNullPoses = {};
  for (const id of layoutOrder) nextNullPoses[id] = (id === 1 ? pose(1, [0.625, 0.5, 4], 0) : prevPoses[id]);
  const nextNull = buildPoses(nextNullPoses);
  const tracksNull = tracks(prevNull, nextNull, null);
  assert.deepStrictEqual(tracksNull, [
    { id: 1, kind: "move", delay: 0, ms: MS.move, spin: 0, from: prevPoses[1], to: nextNullPoses[1] },
  ]);

  // Wrapper argument validation throws naming the function.
  assert.throws(() => tracks("not-array", nextTurn, lastTurn), /^Error: tracks: prev must be an array of poses/);
  assert.throws(() => tracks(prev.slice(0, 15), nextTurn, lastTurn), /^Error: tracks: prev must have 16 poses/);
  assert.throws(() => tracks(prev, nextTurn, {}), /^Error: tracks: last must be a Last or null/);
}
