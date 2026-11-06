import test from "node:test";
import assert from "node:assert/strict";

import * as layout from "../../../../../../edges/render/render_to_layout.mjs";
import { Game, Player, Queue, Group, Die } from "../../../../../../common/index.mjs";

function die(id, o) { return Die({ id, o: o ?? 0 }); }
function group(dice) { return Group({ dice }); }
function queue(groups) { return Queue({ groups }); }
function player(seat, queue) { return Player({ seat, queue }); }

function normNum(v) {
  if (typeof v === "number") return Number.isNaN(v) ? v : Math.round(v * 1e10) / 1e10;
  if (Array.isArray(v)) return v.map(normNum);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) o[k] = normNum(v[k]);
    return Object.freeze(o);
  }
  return v;
}

function makeGame() {
  return Game({
    players: [
      player(0, queue([group([die(0), die(1), die(2), die(3)])])),
      player(1, queue([group([die(4), die(5), die(6), die(7)])])),
      player(2, queue([group([die(8), die(9), die(10), die(11)])])),
      player(3, queue([group([die(12), die(13), die(14), die(15)])])),
    ],
    turn: 0,
    version: 0,
    rng: 0,
    last: null,
    winner: null,
  });
}

test("layout.place returns 16 poses", () => {
  const poses = layout.place(makeGame(), 0);
  assert.equal(poses.length, 16);
  const ids = poses.map((p) => p.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
});

test("layout.place: owner, group, slot are correct", () => {
  const g = Game({
    players: [
      player(0, queue([group([die(0), die(1)]), group([die(2)])])),
      player(1, queue([group([die(3), die(4), die(5), die(6)])])),
      player(2, queue([group([die(7), die(8), die(9), die(10)])])),
      player(3, queue([group([die(11), die(12), die(13), die(14), die(15)])])),
    ],
    turn: 0,
    version: 0,
    rng: 0,
    last: null,
    winner: null,
  });
  const poses = layout.place(g, 0);
  const byId = Object.fromEntries(poses.map((p) => [p.id, p]));

  // player 0: group 0 has dice 0,1 (slots 0,1); group 1 has die 2 (slot 2)
  assert.equal(byId[0].owner, 0);
  assert.equal(byId[0].group, 0);
  assert.equal(byId[0].slot, 0);
  assert.equal(byId[1].group, 0);
  assert.equal(byId[1].slot, 1);
  assert.equal(byId[2].group, 1);
  assert.equal(byId[2].slot, 2);

  // player 1: group 0 has dice 3,4,5,6 (slots 0,1,2,3)
  assert.equal(byId[3].owner, 1);
  assert.equal(byId[3].group, 0);
  assert.equal(byId[3].slot, 0);
  assert.equal(byId[6].slot, 3);
});

test("layout.place: row-frame x is centred for player 0 (identity YAW)", () => {
  const g = Game({
    players: [
      player(0, queue([group([die(0), die(1), die(2)]), group([die(3)])])),
      player(1, queue([group([die(4), die(5), die(6), die(7)])])),
      player(2, queue([group([die(8), die(9), die(10), die(11)])])),
      player(3, queue([group([die(12), die(13), die(14), die(15)])])),
    ],
    turn: 0,
    version: 0,
    rng: 0,
    last: null,
    winner: null,
  });
  const poses = layout.place(g, 0);
  const p0 = Object.fromEntries(poses.filter((p) => p.owner === 0).map((p) => [p.id, normNum(p)]));

  // row frame (stacked groups): cursor starts 0; group 0 dice 0,1,2: x=0,1.05,2.1; z=4,5,4
  // after group cursor+=1.25+1+0.5 -> 3.85; die3 x=3.85, z=4
  // first die x=0, last die x=3.85; centre offset = (0+3.85)/2 = 1.925
  // centred x: die0=-1.925, die1=-0.875, die2=0.175, die3=1.925
  assert.equal(p0[0].position[0], -1.925);
  assert.equal(p0[1].position[0], -0.875);
  assert.equal(p0[2].position[0], 0.175);
  assert.equal(p0[3].position[0], 1.925);
  // y is DIE/2, z is row-frame (stacked): die0 z=4, die1 z=5, die2 z=4, die3 z=4
  assert.equal(p0[0].position[1], 0.5);
  assert.equal(p0[0].position[2], 4);
  assert.equal(p0[1].position[2], 5);
  assert.equal(p0[2].position[2], 4);
  assert.equal(p0[3].position[2], 4);
});

test("layout.place: matrix is YAW[owner] · S · ORIENTATIONS[die.o].matrix with no -0", () => {
  const poses = layout.place(makeGame(), 0);
  const p0 = poses.find((p) => p.id === 0);
  // owner 0, viewer 0: S is a +y rotation taking b=[1,1] to v=[0,9]: phi=pi/4
  // S = [[cos, 0, -sin], [0,1,0], [sin, 0, cos]] (takes b's direction to v's)
  const c = Math.cos(Math.PI / 4);
  const s = Math.sin(Math.PI / 4);
  const expected = [
    [c, 0, -s],
    [0, 1, 0],
    [s, 0, c],
  ].map((row) => row.map((v) => v + 0));
  assert.deepEqual(normNum(p0.matrix), normNum(expected));
});
