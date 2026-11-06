import * as real from "../../edges/client/client_to_hud.mjs";
import { Die, Group, Queue, Player, Game, WIN } from "../../common/index.mjs";
import assert from "node:assert/strict";

// --- golden helpers ---

const mk = (seat, groups) => Player({ seat, queue: Queue({ groups: groups.map((g) => Group({ dice: g.map(([id, o]) => Die({ id, o })) })) }) });
const others = [mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]), mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]), mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]])];
const at = (groups) => Game({ players: [mk(0, groups), ...others], turn: 0, version: 1, rng: 7, last: null, winner: null });

function isGame(v) {
  return v && typeof v === "object" && v.kind === "game";
}

function isAnchor(v) {
  return v === null || (v && typeof v === "object" && typeof v.x === "number" && typeof v.y === "number");
}

// --- wrapped functions ---

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

export function near(game, seat) {
  if (!isGame(game)) throw new Error("near: expected a Game");
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 3)
    throw new Error("near: seat must be an integer 0..3");
  const result = real.near(game, seat);
  if (typeof result !== "boolean") throw new Error("near: expected a boolean");
  return result;
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

// --- DOM helpers ---

function findElementByText(text) {
  const all = document.querySelectorAll("*");
  for (const el of all) {
    if (el === document.body) continue;
    const t = el.textContent || "";
    if (t.includes(text) && el.children.length === 0) return el;
  }
  return null;
}

function isBannerVisible() {
  const el = findElementByText("Player 2 is close to winning!");
  if (!el) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

// --- _sheo_check ---

export async function _sheo_check() {
  // 1. near golden values
  const nearCases = [
    { groups: [[[0, 0], [1, 0], [2, 0]], [[3, 7]]], expected: true },
    { groups: [[[3, 7]], [[0, 0], [1, 0], [2, 0]]], expected: true },
    { groups: [[[0, 0], [1, 9], [2, 0]], [[3, 7]]], expected: false },
    { groups: [[[0, 0], [1, 0]], [[2, 2], [3, 2]]], expected: true },
    { groups: [[[0, 0], [1, 0]], [[2, 3], [3, 3]]], expected: true },
    { groups: [[[0, 0], [1, 0]], [[2, 4], [3, 4]]], expected: false },
    { groups: [[[0, 0], [1, 0]], [[2, 0]], [[3, 0]]], expected: false },
    { groups: [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]], expected: false },
  ];
  for (const { groups, expected } of nearCases) {
    const g = at(groups);
    assert.strictEqual(near(g, 0), expected, `near at(${JSON.stringify(groups)}, 0)`);
    assert.strictEqual(near(g, 1), false, `near at(${JSON.stringify(groups)}, 1)`);
    assert.strictEqual(near(g, 2), false, `near at(${JSON.stringify(groups)}, 2)`);
    assert.strictEqual(near(g, 3), false, `near at(${JSON.stringify(groups)}, 3)`);
  }

  // 2. rank golden value: this game
  const rankGamePlayers = [
    mk(0, [[[0, 0], [1, 0]], [[2, 5]], [[3, 1]]]),
    mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
    mk(2, [[[8, 0], [9, 0], [10, 0], [11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 2]]]),
  ];
  const rankGame = Game({ players: rankGamePlayers, turn: 2, version: 3, rng: 7, last: null, winner: 2 });
  assert.deepStrictEqual(rank(rankGame), [
    { "seat": 2, "rank": 1, "largest": 4, "groups": 1 },
    { "seat": 0, "rank": 2, "largest": 2, "groups": 1 },
    { "seat": 1, "rank": 3, "largest": 1, "groups": 0 },
    { "seat": 3, "rank": 3, "largest": 1, "groups": 0 },
  ]);

  // 3. tie rank golden value
  const tieGamePlayers = [
    mk(0, [[[0, 1], [2, 3]]]),
    mk(1, [[[4, 5], [6, 7]]]),
    mk(2, [[[8, 0], [9, 0], [10, 0], [11, 0]]]),
    mk(3, [[[12, 0], [13, 0], [14, 0]], [[15, 0]]]),
  ];
  const tieGame = Game({ players: tieGamePlayers, turn: 0, version: 1, rng: 7, last: null, winner: null });
  assert.deepStrictEqual(rank(tieGame), [
    { "seat": 2, "rank": 1, "largest": 4, "groups": 1 },
    { "seat": 3, "rank": 2, "largest": 3, "groups": 1 },
    { "seat": 0, "rank": 3, "largest": 2, "groups": 2 },
    { "seat": 1, "rank": 3, "largest": 2, "groups": 2 },
  ]);

  // 4. DOM setup: init, frame, drain
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

  // 5. Banner non-near test: seat 1 goes from four single dice to [[4,0],[5,9],[6,0]],[[7,7]] (group of 3, not alike) -> no banner
  const bannerPrevPlayers = [
    mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]),
    mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
    mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]),
  ];
  const bannerPrev = Game({ players: bannerPrevPlayers, turn: 0, version: 1, rng: 7, last: null, winner: null });

  const bannerNextNearlessPlayers = [
    mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]),
    mk(1, [[[4, 0], [5, 9], [6, 0]], [[7, 7]]]),
    mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]),
  ];
  const bannerNextNearless = Game({ players: bannerNextNearlessPlayers, turn: 0, version: 2, rng: 7, last: null, winner: null });

  show(bannerPrev, bannerNextNearless);

  await new Promise((r) => setTimeout(r, 600));

  assert.ok(!isBannerVisible(), "no banner for non-near transition (group of 3, not alike)");

  // 6. Banner near test: seat 1 goes from four single dice to [[4,0],[5,0],[6,0]],[[7,7]] (near) -> banner "Player 2 is close to winning!"
  const bannerNextNearPlayers = [
    mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]),
    mk(1, [[[4, 0], [5, 0], [6, 0]], [[7, 7]]]),
    mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]),
  ];
  const bannerNextNear = Game({ players: bannerNextNearPlayers, turn: 0, version: 3, rng: 7, last: null, winner: null });

  show(bannerPrev, bannerNextNear);

  await new Promise((r) => setTimeout(r, 600));

  const bannerEl = findElementByText("Player 2 is close to winning!");
  assert.ok(bannerEl, "banner exists");
  assert.ok(bannerEl.textContent.includes("Player 2 is close to winning!"), "banner text correct");

  // 7. Window test
  const winNext = rankGame.with({ winner: 2 });
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
