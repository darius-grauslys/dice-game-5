import test from "node:test";
import assert from "node:assert/strict";

import * as layout from "../../../../../../edges/render/render_to_layout.mjs";
import { Game, Player, Queue, Group, Die } from "../../../../../../common/index.mjs";

function die(id, o) { return Die({ id, o: o ?? 0 }); }
function group(dice) { return Group({ dice }); }
function queue(groups) { return Queue({ groups }); }
function player(seat, queue) { return Player({ seat, queue }); }

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
  const poses = layout.place(makeGame());
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
  const poses = layout.place(g);
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
  const poses = layout.place(g);
  const p0 = Object.fromEntries(poses.filter((p) => p.owner === 0).map((p) => [p.id, p]));

  // row frame: cursor starts 0; die0 x=0, cursor+=1.25; die1 x=1.25, cursor+=1.25; die2 x=2.5, cursor+=1.25 -> 3.75
  // after group cursor+=GROUP_GAP(0.5) -> 4.25; die3 x=4.25
  // first die x=0, last die x=4.25; centre offset = (0+4.25)/2 = 2.125
  // centred x: die0=-2.125, die1=-0.875, die2=0.375, die3=2.125
  assert.equal(p0[0].position[0], -2.125);
  assert.equal(p0[1].position[0], -0.875);
  assert.equal(p0[2].position[0], 0.375);
  assert.equal(p0[3].position[0], 2.125);
  // y and z are DIE/2, TABLE_R
  assert.equal(p0[0].position[1], 0.5);
  assert.equal(p0[0].position[2], 4);
});

test("layout.place: matrix is YAW[owner] · ORIENTATIONS[die.o].matrix with no -0", () => {
  const poses = layout.place(makeGame());
  const p0 = poses.find((p) => p.id === 0);
  // o=0 orientation matrix is identity; YAW[0] is identity
  assert.deepEqual(p0.matrix, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
});
