import * as real from "../../edges/client/client_to_hud.mjs";
import { Die, Group, Queue, Player, Game, WIN, PLAYERS } from "../../common/index.mjs";
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

function isWindowVisible(text) {
  const el = findElementByText(text);
  if (!el) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function findTurnBanner() {
  const all = document.querySelectorAll("*");
  for (const el of all) {
    if (el === document.body) continue;
    const t = (el.textContent || "").trim();
    if (t === "It's your turn!" && el.children.length === 0) return el;
  }
  return null;
}

function isTurnBannerShown() {
  const el = findTurnBanner();
  if (!el) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  const canvasRect = document.querySelector("canvas").getBoundingClientRect();
  const overlaps = !(rect.right < canvasRect.left || rect.left > canvasRect.right || rect.bottom < canvasRect.top || rect.top > canvasRect.bottom);
  return overlaps;
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
    { groups: [[[2, 0], [3, 20], [0, 0], [1, 0]]], expected: true },
    { groups: [[[0, 0], [1, 0], [2, 9], [3, 0]]], expected: true },
    { groups: [[[0, 0], [1, 0], [2, 9], [3, 9]]], expected: false },
    { groups: [[[0, 0], [1, 0], [2, 0], [3, 0]]], expected: false },
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
    mk(0, [[[0, 0], [1, 0]], [[2, 0], [3, 0]]]),
    mk(1, [[[4, 0], [5, 0]], [[6, 0], [7, 0]]]),
    mk(2, [[[8, 0], [9, 0], [10, 0], [11, 0]]]),
    mk(3, [[[12, 0], [13, 0], [14, 0]], [[15, 0]]]),
  ];
  const tieGame = Game({ players: tieGamePlayers, turn: 0, version: 3, rng: 7, last: null, winner: 2 });
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

  // 5. Turn banner tests
  // right after init: it exists, with the text `It's your turn!`, in PLAYERS[0].colour, and is hidden;
  let tEl = findTurnBanner();
  assert.ok(tEl, "turn banner exists after init");
  assert.strictEqual(tEl.textContent, "It's your turn!");
  assert.strictEqual(getComputedStyle(tEl).color, hexToRgb(PLAYERS[0].colour), "turn banner colour is PLAYERS[0].colour");
  assert.ok(!isTurnBannerShown(), "turn banner hidden right after init");

  // show(null, g) with g.turn === 1: still hidden 500 ms later;
  const gTurn1 = Game({ players: [mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]), ...others], turn: 1, version: 1, rng: 7, last: null, winner: null });
  show(null, gTurn1);
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(!isTurnBannerShown(), "turn banner hidden when g.turn === 1");

  // show(g, g2) with g2.turn === 0 (a higher version): shown 450 ms later, position, hidden 3500 ms after the show;
  const gT = Game({ players: [mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]), ...others], turn: 1, version: 1, rng: 7, last: null, winner: null });
  const gT2 = gT.with({ turn: 0, version: 2 });
  show(gT, gT2);
  await new Promise((r) => setTimeout(r, 450));
  assert.ok(isTurnBannerShown(), "turn banner shown 450 ms after show(g, g2) with g2.turn === 0");
  tEl = findTurnBanner();
  const tRect = tEl.getBoundingClientRect();
  const cRect = document.querySelector("canvas").getBoundingClientRect();
  const expectedTop = 0.22 * cRect.height;
  assert.ok(Math.abs(tRect.top - cRect.top - expectedTop) <= 4, `turn banner top at 0.22*height: ${tRect.top - cRect.top} vs ${expectedTop}`);
  const tCenter = (tRect.left + tRect.right) / 2;
  const cCenter = cRect.left + cRect.width / 2;
  assert.ok(Math.abs(tCenter - cCenter) <= 4, `turn banner centred: ${tCenter} vs ${cCenter}`);
  await new Promise((r) => setTimeout(r, 3050));
  assert.ok(!isTurnBannerShown(), "turn banner hidden 3500 ms after show");

  // show(g2, g3) with g3.turn === 0 again (a higher version): it does not show (check at 450 ms);
  const gT3 = gT2.with({ version: 3 });
  show(gT2, gT3);
  await new Promise((r) => setTimeout(r, 450));
  assert.ok(!isTurnBannerShown(), "turn banner does not show when turn stays 0 across versions");

  // it becomes your turn again (show(<turn 3>, <turn 0>)), and 600 ms later show(<turn 0>, <turn 1>): hidden at once (check after 2 frames);
  const gT3_prev = Game({ players: [mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]), ...others], turn: 3, version: 4, rng: 7, last: null, winner: null });
  const gT3_next = gT3_prev.with({ turn: 0, version: 5 });
  show(gT3_prev, gT3_next);
  await new Promise((r) => setTimeout(r, 600));
  assert.ok(isTurnBannerShown(), "turn banner shows when it becomes your turn (prev.turn 3 -> 0)");
  const gT4_next = gT3_next.with({ turn: 1, version: 6 });
  show(gT3_next, gT4_next);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(!isTurnBannerShown(), "turn banner hidden at once when show(<turn 0>, <turn 1>)");

  // show(null, h) with h.turn === 0 and winner: null (a new game): shown 450 ms later; and a show whose next.winner !== null while it shows hides it at once;
  const h = Game({ players: [mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]), ...others], turn: 0, version: 7, rng: 7, last: null, winner: null });
  show(null, h);
  await new Promise((r) => setTimeout(r, 450));
  assert.ok(isTurnBannerShown(), "turn banner shown 450 ms after show(null, h) with h.turn === 0, winner: null");
  const hWon = h.with({ winner: 0, version: 8 });
  show(h, hWon);
  assert.ok(!isTurnBannerShown(), "turn banner hidden at once when next.winner !== null");

  // 7. Banner non-near test: seat 1 goes from four single dice to [[4,0],[5,9],[6,0]],[[7,7]] (group of 3, not alike) -> no banner
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

  // 8. Banner near test: seat 1 goes from four single dice to [[4,0],[5,0],[6,0]],[[7,7]] (near) -> banner "Player 2 is close to winning!"
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

  // 9. Window test
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

  // 10. Scoreboard closes on a new game
  // Hide the window first (from section 7 the window shows "Player 3 wins!")
  const hideFresh = rankGame.with({ winner: null, version: 9999 });
  show(null, hideFresh);

  // 10a. show(null, won) → after WIN.window ms the window shows (as now)
  const wonGame = rankGame.with({ winner: 2 });
  show(null, wonGame);
  await new Promise((r) => setTimeout(r, WIN.window + 500));
  assert.ok(isWindowVisible("Player 3 wins!"), "scoreboard: window shows after WIN.window ms");

  // 10b. show(null, fresh) with same players, winner: null, higher version → window hidden at once
  const freshGame = wonGame.with({ winner: null, version: wonGame.version + 100 });
  show(null, freshGame);
  // check in the same tick
  assert.ok(!isWindowVisible("Player 3 wins!"), "scoreboard: window hidden at once when show(null, fresh)");

  // check after 2 frames
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(!isWindowVisible("Player 3 wins!"), "scoreboard: window hidden after 2 frames");

  // 10c. show(fresh, won2) with a winner again → after WIN.window ms window shows again, new winner's text
  const won2Game = freshGame.with({ winner: 1 });
  show(freshGame, won2Game);
  await new Promise((r) => setTimeout(r, WIN.window + 500));
  assert.ok(isWindowVisible("Player 2 wins!"), "scoreboard: window shows again after WIN.window ms with new winner");

  // 10d. a show(prev, won) followed within WIN.window ms by show(null, fresh) → window never shows
  // Hide the window first (from section 8c it shows "Player 2 wins!")
  show(null, freshGame.with({ winner: null, version: freshGame.version + 100 }));
  const wonGame3 = at([[[0, 0], [1, 0], [2, 0]], [[3, 7]]]).with({ winner: 0 });
  show(null, wonGame3);
  await new Promise((r) => setTimeout(r, WIN.window - 200));
  const freshGame3 = wonGame3.with({ winner: null, version: wonGame3.version + 1 });
  show(null, freshGame3);
  await new Promise((r) => setTimeout(r, WIN.window + 500));
  assert.ok(!isWindowVisible("Player 1 wins!"), "scoreboard: window never shows when show(null, fresh) called within WIN.window ms");

  // 11. near banner and turn banner together
  // once no near banner is showing or queued (wait 4000 ms after the last one)
  await new Promise((r) => setTimeout(r, 4000));
  const nearTurnPrevPlayers = [
    mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]),
    mk(1, [[[4, 0]], [[5, 0]], [[6, 0]], [[7, 0]]]),
    mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]),
  ];
  const nearTurnPrev = Game({ players: nearTurnPrevPlayers, turn: 3, version: 1, rng: 7, last: null, winner: null });

  const nearTurnNextPlayers = [
    mk(0, [[[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]]]),
    mk(1, [[[4, 0], [5, 0], [6, 0]], [[7, 7]]]),
    mk(2, [[[8, 0]], [[9, 0]], [[10, 0]], [[11, 0]]]),
    mk(3, [[[12, 0]], [[13, 0]], [[14, 0]], [[15, 0]]]),
  ];
  const nearTurnNext = Game({ players: nearTurnNextPlayers, turn: 0, version: 2, rng: 7, last: null, winner: null });

  show(nearTurnPrev, nearTurnNext);
  await new Promise((r) => setTimeout(r, 450));
  assert.ok(isTurnBannerShown(), "turn banner shown with near banner together");
  const nbEl = findElementByText("Player 2 is close to winning!");
  assert.ok(nbEl, "near banner shown with turn banner together");
}
