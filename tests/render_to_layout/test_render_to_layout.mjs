import assert from "node:assert/strict";
import { Game, Player, Queue, Group, Die } from "../../common/index.mjs";
import * as real from "../../edges/render/render_to_layout.mjs";

// place: render calls layout. Wrap layout's place to validate per the doc.
export function place(game) {
  // A) check args against the doc
  if (!(game && typeof game === "object" && game.kind === "game")) {
    throw new TypeError("place: expected a Game");
  }
  // B) call through the forwarder
  const res = real.place(game);
  // C) check it returned
  if (res === undefined) {
    throw new Error("place: did not return");
  }
  // D) check the return value against the doc
  if (!Array.isArray(res) || res.length !== 16) {
    throw new Error("place: expected 16 poses");
  }
  for (let i = 0; i < 16; i++) {
    const p = res[i];
    if (p === null || typeof p !== "object" || Array.isArray(p)) {
      throw new Error("place: pose not a plain object");
    }
    const keys = Object.keys(p).sort().join(",");
    if (keys !== "group,id,matrix,owner,position,slot") {
      throw new Error("place: pose has wrong keys");
    }
    if (typeof p.id !== "number" || typeof p.owner !== "number" || typeof p.group !== "number" || typeof p.slot !== "number") {
      throw new Error("place: pose numeric fields wrong");
    }
    if (!Array.isArray(p.position) || p.position.length !== 3 || p.position.some((v) => typeof v !== "number")) {
      throw new Error("place: position not [x,y,z] numbers");
    }
    if (!Array.isArray(p.matrix) || p.matrix.length !== 3) {
      throw new Error("place: matrix not 3x3");
    }
    for (let r = 0; r < 3; r++) {
      if (!Array.isArray(p.matrix[r]) || p.matrix[r].length !== 3) {
        throw new Error("place: matrix rows wrong");
      }
      for (let c = 0; c < 3; c++) {
        if (typeof p.matrix[r][c] !== "number" || !Number.isInteger(p.matrix[r][c])) {
          throw new Error("place: matrix not integers");
        }
      }
    }
    // players 0..3 in order, each player's dice in queue order (slot 0..n-1)
    if (p.owner !== Math.floor(i / 4)) {
      throw new Error("place: poses not in player order 0..3");
    }
    if (p.slot !== i % 4) {
      throw new Error("place: poses not in queue order");
    }
  }
  return res;
}

const mk = (seat, groups) => Player({ seat, queue: Queue({ groups: groups.map((g) => Group({ dice: g.map(([id, o]) => Die({ id, o })) })) }) });

export async function _sheo_check() {
  const game = Game({ players: [
    mk(0, [[[0, 0], [1, 0]], [[2, 5]], [[3, 1]]]),
    mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
    mk(2, [[[8, 0], [9, 0], [10, 0], [11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 2]]]),
  ], turn: 0, version: 3, rng: 7, last: null, winner: null });

  const poses = place(game);
  assert.strictEqual(poses.length, 16);

  // seat 0's, in order
  assert.deepStrictEqual(poses[0], {id: 0, owner: 0, group: 0, slot: 0, position: [-2.375, 0.5, 4], matrix: [[1,0,0],[0,1,0],[0,0,1]]});
  assert.deepStrictEqual(poses[1], {id: 1, owner: 0, group: 0, slot: 1, position: [-1.125, 0.5, 4], matrix: [[1,0,0],[0,1,0],[0,0,1]]});
  assert.deepStrictEqual(poses[2], {id: 2, owner: 0, group: 1, slot: 2, position: [0.625, 0.5, 4], matrix: [[0,1,0],[0,0,1],[1,0,0]]});
  assert.deepStrictEqual(poses[3], {id: 3, owner: 0, group: 2, slot: 3, position: [2.375, 0.5, 4], matrix: [[1,0,0],[0,0,1],[0,-1,0]]});

  // die 4: position [4, 0.5, 2.625], matrix [[0,0,1],[0,1,0],[-1,0,0]]
  assert.deepStrictEqual(poses[4], {id: 4, owner: 1, group: 0, slot: 0, position: [4, 0.5, 2.625], matrix: [[0,0,1],[0,1,0],[-1,0,0]]});

  // die 8: [1.875, 0.5, -4], [[-1,0,0],[0,1,0],[0,0,-1]]
  assert.deepStrictEqual(poses[8], {id: 8, owner: 2, group: 0, slot: 0, position: [1.875, 0.5, -4], matrix: [[-1,0,0],[0,1,0],[0,0,-1]]});

  // die 12: [-4, 0.5, -2.625], [[0,0,-1],[0,1,0],[1,0,0]]
  assert.deepStrictEqual(poses[12], {id: 12, owner: 3, group: 0, slot: 0, position: [-4, 0.5, -2.625], matrix: [[0,0,-1],[0,1,0],[1,0,0]]});

  // die 15: [-4, 0.5, 2.625], [[0,-1,0],[0,0,-1],[1,0,0]]
  assert.deepStrictEqual(poses[15], {id: 15, owner: 3, group: 3, slot: 3, position: [-4, 0.5, 2.625], matrix: [[0,-1,0],[0,0,-1],[1,0,0]]});

  // error on non-game args
  assert.throws(() => place({}), /^TypeError: place: expected a Game/);
  assert.throws(() => place("not a game"), /^TypeError: place: expected a Game/);
}
