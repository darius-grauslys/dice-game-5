import * as real from "../../edges/client/client_to_hud.mjs";
import { Die, Group, Queue, Player, Game, WIN } from "../../common/index.mjs";
import assert from "node:assert/strict";

function die(id, o = 0) { return Die({ id, o }); }

function makeFixtureGame() {
  // seat 0: [[0,1], [2], [3]] -> largest 2, groups 1
  // seat 1: [[4], [5], [6], [7]] -> largest 1, groups 0
  // seat 2: [[8,9,10,11]] -> largest 4, groups 1
  // seat 3: [[12], [13], [14], [15]] -> largest 1, groups 0
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0), die(1)] }), Group({ dice: [die(2)] }), Group({ dice: [die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4)] }), Group({ dice: [die(5)] }), Group({ dice: [die(6)] }), Group({ dice: [die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12)] }), Group({ dice: [die(13)] }), Group({ dice: [die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  return Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });
}

function makeTieGame() {
  // seat 0: [[0,1], [2,3]] largest 2, groups 2
  // seat 1: [[4,5], [6,7]] largest 2, groups 2
  // seat 2: [[8,9,10,11]] largest 4, groups 1
  // seat 3: [[12,13,14], [15]] largest 3, groups 1
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0), die(1)] }), Group({ dice: [die(2), die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4), die(5)] }), Group({ dice: [die(6), die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12), die(13), die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  return Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });
}

function makeBannerPrevGame() {
  // seat 1's largest group is 2: [[4,5], [6], [7]]
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0)] }), Group({ dice: [die(1)] }), Group({ dice: [die(2)] }), Group({ dice: [die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4), die(5)] }), Group({ dice: [die(6)] }), Group({ dice: [die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12)] }), Group({ dice: [die(13)] }), Group({ dice: [die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  return Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });
}

function makeBannerNextGame() {
  // seat 1's largest group is 3: [[4,5,6], [7]]
  const players = [
    Player({ seat: 0, queue: Queue({ groups: [Group({ dice: [die(0)] }), Group({ dice: [die(1)] }), Group({ dice: [die(2)] }), Group({ dice: [die(3)] })] }) }),
    Player({ seat: 1, queue: Queue({ groups: [Group({ dice: [die(4), die(5), die(6)] }), Group({ dice: [die(7)] })] }) }),
    Player({ seat: 2, queue: Queue({ groups: [Group({ dice: [die(8), die(9), die(10), die(11)] })] }) }),
    Player({ seat: 3, queue: Queue({ groups: [Group({ dice: [die(12)] }), Group({ dice: [die(13)] }), Group({ dice: [die(14)] }), Group({ dice: [die(15)] })] }) }),
  ];
  return Game({ players, turn: 0, version: 0, rng: 1, last: null, winner: null });
}

function isGame(v) {
  return v && typeof v === "object" && v.kind === "game";
}

function isAnchor(v) {
  return v === null || (v && typeof v === "object" && typeof v.x === "number" && typeof v.y === "number");
}

export function init(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("init: expected {canvas, seat}");
  if (!("canvas" in input)) throw new Error("init: missing canvas");
  if (!("seat" in input)) throw new Error("init: missing seat");
  const seat = input.seat;
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 3)
    throw new Error("init: seat must be an integer 0..3");
  const result = real.init(input);
  if (result !== undefined) throw new Error("init: expected void");
}

export function frame(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error("frame: expected {canRoll, anchor}");
  if (!("canRoll" in input)) throw new Error("frame: missing canRoll");
  if (!("anchor" in input)) throw new Error("frame: missing anchor");
  const canRoll = input.canRoll;
  const anchor = input.anchor;
  if (typeof canRoll !== "boolean") throw new Error("frame: canRoll must be a boolean");
  if (!isAnchor(anchor)) throw new Error("frame: anchor must be {x, y} or null");
  const result = real.frame(input);
  if (result !== undefined) throw new Error("frame: expected void");
}

export function drain() {
  const result = real.drain();
  if (!Array.isArray(result)) throw new Error("drain: expected an array");
  for (const e of result) {
    if (!(e && typeof e === "object" && e.kind === "roll"))
      throw new Error("drain: expected entries of kind 'roll'");
  }
  return result;
}

export function show(prev, next) {
  if (prev !== null && !isGame(prev)) throw new Error("show: prev must be null or a Game");
  if (!isGame(next)) throw new Error("show: next must be a Game");
  const result = real.show(prev, next);
  if (result !== undefined) throw new Error("show: expected void");
}

export function rank(game) {
  if (!isGame(game)) throw new Error("rank: expected a Game");
  const result = real.rank(game);
  if (!Array.isArray(result)) throw new Error("rank: expected an array");
  for (const r of result) {
    if (!(r && typeof r === "object")) throw new Error("rank: expected objects");
    if (!("seat" in r) || !("rank" in r) || !("largest" in r) || !("groups" in r))
      throw new Error("rank: expected {seat, rank, largest, groups}");
  }
  return result;
}

export const _sheo_browser = true;

function findElementByText(text) {
  const all = document.querySelectorAll("*");
  for (const el of all) {
    if (el === document.body) continue;
    const t = el.textContent || "";
    if (t.includes(text) && el.children.length === 0) return el;
  }
  return null;
}

export async function _sheo_check() {
  // 1. rank with fixture game
  const fixtureGame = makeFixtureGame();
  const rFixture = rank(fixtureGame);
  assert.deepStrictEqual(rFixture, [
    { "seat": 2, "rank": 1, "largest": 4, "groups": 1 },
    { "seat": 0, "rank": 2, "largest": 2, "groups": 1 },
    { "seat": 1, "rank": 3, "largest": 1, "groups": 0 },
    { "seat": 3, "rank": 3, "largest": 1, "groups": 0 },
  ]);

  // 2. rank with tie game
  const tieGame = makeTieGame();
  const rTie = rank(tieGame);
  assert.deepStrictEqual(rTie, [
    { "seat": 2, "rank": 1, "largest": 4, "groups": 1 },
    { "seat": 3, "rank": 2, "largest": 3, "groups": 1 },
    { "seat": 0, "rank": 3, "largest": 2, "groups": 2 },
    { "seat": 1, "rank": 3, "largest": 2, "groups": 2 },
  ]);

  // 3. DOM setup: init, frame, drain
  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "canvas exists");

  init({ canvas, seat: 0 });

  frame({ canRoll: true, anchor: { x: 400, y: 300 } });

  const rollBtn = document.querySelector("button");
  assert.ok(rollBtn, "ROLL button exists");
  assert.strictEqual(rollBtn.textContent, "ROLL");

  const rect = rollBtn.getBoundingClientRect();
  assert.ok(Math.abs((rect.left + rect.right) / 2 - 400) < 10, "button x centered at 400");
  assert.ok(Math.abs((rect.top + rect.bottom) / 2 - 348) < 10, "button y centered at 348");

  rollBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  rollBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  const d1 = drain();
  assert.deepStrictEqual(d1, [{ kind: "roll" }, { kind: "roll" }]);
  const d2 = drain();
  assert.deepStrictEqual(d2, []);

  frame({ canRoll: false, anchor: { x: 400, y: 300 } });
  assert.strictEqual(getComputedStyle(rollBtn).display, "none", "button should be hidden when canRoll is false");

  // 4. Banner test
  const bannerPrev = makeBannerPrevGame();
  const bannerNext = makeBannerNextGame();
  show(bannerPrev, bannerNext);

  await new Promise((r) => setTimeout(r, 600));

  const bannerEl = findElementByText("Player 2 is close to winning!");
  assert.ok(bannerEl, "banner exists");
  assert.ok(bannerEl.textContent.includes("Player 2 is close to winning!"), "banner text correct");

  // 5. Window test
  const winNext = fixtureGame.with({ winner: 2 });
  show(null, winNext);

  await new Promise((r) => setTimeout(r, WIN.window + 500));

  const winEl = findElementByText("Player 3 wins!");
  assert.ok(winEl, "window exists");
  assert.ok(winEl.textContent.includes("Player 3 wins!"), "window text correct");

  // four ranked rows: rank, P<seat+1>, largest group, groups of more than one die
  const pLabels = [];
  for (let s = 0; s < 4; s++) {
    const label = `P${s + 1}`;
    const found = findElementByText(label);
    assert.ok(found, `window has P${s + 1} label`);
    pLabels.push(label);
  }
  assert.deepStrictEqual(pLabels, ["P1", "P2", "P3", "P4"]);
}
