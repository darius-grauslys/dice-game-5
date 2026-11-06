import assert from "node:assert/strict";
import * as real from "../../edges/render/render_to_layout.mjs";
import { Player, Queue, Group, Die, Game } from "../../common/index.mjs";
import { YAW, CAMERA } from "../../common/index.mjs";

// ---- wrappers: drop-in for the forwarder ----

export function place(game, viewer) {
  // A) check args against the doc
  if (!(game && typeof game === "object" && game.kind === "game")) {
    throw new Error("place: game must be a Game");
  }
  if (!Number.isInteger(viewer) || viewer < 0 || viewer > 3) {
    throw new Error("place: viewer must be an integer 0..3");
  }
  // B) call through the forwarder
  const result = real.place(game, viewer);
  // C) check it returned
  if (!Array.isArray(result)) {
    throw new Error("place: did not return an array");
  }
  // D) check the return value against the doc
  if (result.length !== 16) {
    throw new Error("place: expected 16 poses");
  }
  let globalSlot = 0;
  for (let owner = 0; owner < 4; owner++) {
    const player = game.players[owner];
    let playerSlot = 0;
    for (let group = 0; group < player.queue.groups.length; group++) {
      const g = player.queue.groups[group];
      for (let k = 0; k < g.dice.length; k++) {
        const p = result[globalSlot];
        if (!(p && typeof p === "object" && !Array.isArray(p) && Object.isFrozen(p))) {
          throw new Error(`place: pose ${globalSlot} is not a frozen object`);
        }
        const keys = Object.keys(p).sort();
        assert.deepStrictEqual(keys, ["group", "id", "matrix", "owner", "position", "slot"]);
        if (typeof p.id !== "number" || !Number.isInteger(p.id)) throw new Error(`place: pose ${globalSlot} id not int`);
        if (p.owner !== owner) throw new Error(`place: pose ${globalSlot} owner mismatch`);
        if (p.group !== group) throw new Error(`place: pose ${globalSlot} group mismatch`);
        if (p.slot !== playerSlot) throw new Error(`place: pose ${globalSlot} slot mismatch`);
        if (!Array.isArray(p.position) || p.position.length !== 3) throw new Error(`place: pose ${globalSlot} position not [x,y,z]`);
        if (!Array.isArray(p.matrix) || p.matrix.length !== 3) throw new Error(`place: pose ${globalSlot} matrix not 3x3`);
        for (let r = 0; r < 3; r++) {
          if (!Array.isArray(p.matrix[r]) || p.matrix[r].length !== 3) throw new Error(`place: pose ${globalSlot} matrix row ${r} not length 3`);
        }
        playerSlot++;
        globalSlot++;
      }
    }
  }
  return result;
}

export function labels(viewer) {
  // A) check args against the doc
  if (!Number.isInteger(viewer) || viewer < 0 || viewer > 3) {
    throw new Error("labels: viewer must be an integer 0..3");
  }
  // B) call through the forwarder
  const result = real.labels(viewer);
  // C) check it returned
  if (!Array.isArray(result)) {
    throw new Error("labels: did not return an array");
  }
  // D) check the return value against the doc
  if (result.length !== 4) {
    throw new Error("labels: expected 4 entries");
  }
  for (let i = 0; i < 4; i++) {
    const l = result[i];
    if (!(l && typeof l === "object" && !Array.isArray(l) && Object.isFrozen(l))) {
      throw new Error(`labels: entry ${i} is not a frozen object`);
    }
    const keys = Object.keys(l).sort();
    assert.deepStrictEqual(keys, ["owner", "position"]);
    if (typeof l.owner !== "number" || !Number.isInteger(l.owner) || l.owner < 0 || l.owner > 3) throw new Error(`labels: entry ${i} owner not int 0..3`);
    if (!Array.isArray(l.position) || l.position.length !== 3) throw new Error(`labels: entry ${i} position not [x,y,z]`);
  }
  return result;
}

// ---- comparison helpers (within 1e-6) ----

function matEq(a, b) {
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (Math.abs(a[i][j] - b[i][j]) > 1e-6) return false;
  return true;
}
function vecEq(a, b) {
  for (let i = 0; i < 3; i++)
    if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  return true;
}

function facesSeen(poses, viewer) {
  const eye = CAMERA.eye;
  const rowFrameNormals = {
    "+x": [1, 0, 0], "-x": [-1, 0, 0],
    "+y": [0, 1, 0], "-y": [0, -1, 0],
    "+z": [0, 0, 1], "-z": [0, 0, -1],
  };
  const seen = {};
  for (const p of poses) {
    const owner = p.owner;
    const worldNormal = (nf) => {
      const m = p.matrix;
      return [
        m[0][0]*nf[0] + m[0][1]*nf[1] + m[0][2]*nf[2],
        m[1][0]*nf[0] + m[1][1]*nf[1] + m[1][2]*nf[2],
        m[2][0]*nf[0] + m[2][1]*nf[1] + m[2][2]*nf[2],
      ];
    };
    const pos = p.position;
    const diff = [eye[0]-pos[0], eye[1]-pos[1], eye[2]-pos[2]];
    const names = [];
    for (const name of Object.keys(rowFrameNormals)) {
      const n = worldNormal(rowFrameNormals[name]);
      if (n[0]*diff[0] + n[1]*diff[1] + n[2]*diff[2] > 0) names.push(name);
    }
    seen[p.id] = names;
  }
  return seen;
}

function minRowDist(poses) {
  let min = Infinity;
  for (let i = 0; i < poses.length; i++) {
    for (let j = i + 1; j < poses.length; j++) {
      const a = poses[i], b = poses[j];
      if (a.owner !== b.owner) continue;
      const dx = a.position[0] - b.position[0];
      const dz = a.position[2] - b.position[2];
      const d = Math.sqrt(dx*dx + dz*dz);
      if (d < min) min = d;
    }
  }
  return min;
}

export async function _sheo_check() {
  const mk = (seat, groups) => Player({ seat, queue: Queue({ groups: groups.map((g) => Group({ dice: g.map(([id, o]) => Die({ id, o })) })) }) });
  const game = Game({ players: [
    mk(0, [[[0, 0], [1, 0]], [[2, 5]], [[3, 1]]]),
    mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
    mk(2, [[[8, 0], [9, 0], [10, 0], [11, 0]]]),
    mk(3, [[[12, 0], [13, 0], [14, 0]], [[15, 2]]]),
  ], turn: 0, version: 3, rng: 7, last: null, winner: null });

  // place(game, 0): 16 poses, players 0..3 in order, dice in queue order.
  const poses0 = place(game, 0);
  assert.strictEqual(poses0.length, 16);

  // Seat 0's, in order:
  const s0 = [
    {id: 0, owner: 0, group: 0, slot: 0, position: [-2.275, 0.5, 4.6], matrix: [[0.707107, 0, -0.707107], [0, 1, 0], [0.707107, 0, 0.707107]]},
    {id: 1, owner: 0, group: 0, slot: 1, position: [-1.225, 0.5, 5.65], matrix: [[0.707107, 0, -0.707107], [0, 1, 0], [0.707107, 0, 0.707107]]},
    {id: 2, owner: 0, group: 1, slot: 2, position: [0.525, 0.5, 4.6], matrix: [[-0.707107, 0.707107, 0], [0, 0, 1], [0.707107, 0.707107, 0]]},
    {id: 3, owner: 0, group: 2, slot: 3, position: [2.275, 0.5, 4.6], matrix: [[0.707107, 0.707107, 0], [0, 0, 1], [0.707107, -0.707107, 0]]},
  ];
  for (let i = 0; i < 4; i++) {
    const p = poses0[i];
    assert.strictEqual(p.id, s0[i].id);
    assert.strictEqual(p.owner, s0[i].owner);
    assert.strictEqual(p.group, s0[i].group);
    assert.strictEqual(p.slot, s0[i].slot);
    assert.ok(vecEq(p.position, s0[i].position), `pose ${i} position mismatch`);
    assert.ok(matEq(p.matrix, s0[i].matrix), `pose ${i} matrix mismatch`);
  }

  // Others, seen by seat 0:
  const others0 = {
    4: {pos: [4.6, 0.5, 2.625], mat: [[-0.43073, 0, 0.902481], [0, 1, 0], [-0.902481, 0, -0.43073]]},
    8: {pos: [1.575, 0.5, -4.6], mat: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]]},
    9: {pos: [0.525, 0.5, -5.65], mat: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]]},
    10: {pos: [-0.525, 0.5, -6.7], mat: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]]},
    11: {pos: [-1.575, 0.5, -7.75], mat: [[-0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, -0.707107]]},
    12: {pos: [-4.6, 0.5, -1.925], mat: [[-0.902481, 0, 0.43073], [0, 1, 0], [-0.43073, 0, -0.902481]]},
    13: {pos: [-5.65, 0.5, -0.875], mat: [[-0.902481, 0, 0.43073], [0, 1, 0], [-0.43073, 0, -0.902481]]},
    14: {pos: [-6.7, 0.5, 0.175], mat: [[-0.902481, 0, 0.43073], [0, 1, 0], [-0.43073, 0, -0.902481]]},
    15: {pos: [-4.6, 0.5, 1.925], mat: [[-0.902481, 0.43073, 0], [0, 0, -1], [-0.43073, -0.902481, 0]]},
  };
  for (const id of [4, 8, 9, 10, 11, 12, 13, 14, 15]) {
    const p = poses0.find(q => q.id === id);
    assert.ok(p, `pose ${id} missing`);
    assert.ok(vecEq(p.position, others0[id].pos), `pose ${id} position mismatch`);
    assert.ok(matEq(p.matrix, others0[id].mat), `pose ${id} matrix mismatch`);
  }

  // place(game, 1): seat 1's own dice turn the other way: die 4
  const poses1 = place(game, 1);
  const die4 = poses1.find(q => q.id === 4);
  assert.ok(die4, "die 4 missing in place(game,1)");
  assert.ok(vecEq(die4.position, [4.6, 0.5, 2.625]), "die 4 position mismatch");
  assert.ok(matEq(die4.matrix, [[0.707107, 0, 0.707107], [0, 1, 0], [-0.707107, 0, 0.707107]]), "die 4 matrix mismatch");

  // Faces each viewer sees:
  const seen0 = facesSeen(poses0, 0);
  assert.deepStrictEqual(seen0[0].sort(), ["+x", "+y", "+z"].sort());
  assert.deepStrictEqual(seen0[4].sort(), ["-x", "-z", "+y"].sort());
  assert.deepStrictEqual(seen0[8].sort(), ["-x", "-z", "+y"].sort());
  assert.deepStrictEqual(seen0[12].sort(), ["-x", "-z", "+y"].sort());

  const posesOwn1 = place(game, 1);
  const seen1 = facesSeen(posesOwn1, 1);
  assert.deepStrictEqual(seen1[4].sort(), ["+x", "+y", "+z"].sort());
  assert.deepStrictEqual(seen1[0].sort(), ["-x", "-z", "+y"].sort());
  assert.deepStrictEqual(seen1[8].sort(), ["-x", "-z", "+y"].sort());
  assert.deepStrictEqual(seen1[12].sort(), ["-x", "-z", "+y"].sort());

  // No two dice of one row are closer than √2: closest pair is 1.484924 apart.
  const minD = minRowDist(poses0);
  assert.ok(Math.abs(minD - 1.484924) <= 1e-6, `closest pair distance ${minD}, expected 1.484924`);

  // labels(0)
  const lbs0 = labels(0);
  assert.strictEqual(lbs0.length, 4);
  const lbs0Exp = [
    {owner: 0, position: [0, 1.5, 8.7]},
    {owner: 1, position: [6.9, 1.5, 0]},
    {owner: 2, position: [0, 1.5, -8.8]},
    {owner: 3, position: [-6.9, 1.5, 0]},
  ];
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(lbs0[i].owner, i);
    assert.ok(vecEq(lbs0[i].position, lbs0Exp[i].position), `labels(0) entry ${i} position mismatch`);
  }

  // labels(1)
  const lbs1 = labels(1);
  assert.strictEqual(lbs1.length, 4);
  const lbs1Exp = [
    {owner: 0, position: [0, 1.5, 6.9]},
    {owner: 1, position: [8.7, 1.5, 0]},
    {owner: 2, position: [0, 1.5, -6.9]},
    {owner: 3, position: [-8.8, 1.5, 0]},
  ];
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(lbs1[i].owner, i);
    assert.ok(vecEq(lbs1[i].position, lbs1Exp[i].position), `labels(1) entry ${i} position mismatch`);
  }
}
