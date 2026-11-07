import { PLAYERS, WIN, TURN } from "../../../../../common/index.mjs";

let rollButton, bannerEl, windowEl, turnBannerEl, seat, canvasRect;
let rollQueue = [];
let bannerTimer = null;
let bannerQueue = [];
let windowShown = false;
let windowTimer = null;
let turnBannerTimeouts = [];

// near: whether the seat is close to winning.
// True exactly when the seat's queue is either:
// - exactly 2 groups, the dice of each group all have the same o, and one
//   group can be turned to the other's o (always when one is a single die;
//   for two groups of more than one die, one group's o is 1, 2 or 3 quarter
//   turns about x from the other's); or
// - exactly one group of 4 dice, of which exactly 3 have the same o and the
//   fourth another.
export function near(game, seat) {
  const player = game.players[seat];
  const groups = player.queue.groups;

  // Exactly one group of 4 dice: near when exactly 3 have the same o and the
  // fourth another (a group of 4 with all the same o is a win: not near).
  if (groups.length === 1) {
    const os = groups[0].dice.map((d) => d.o);
    const counts = {};
    for (const o of os) counts[o] = (counts[o] || 0) + 1;
    const vals = Object.values(counts);
    return vals.length === 2 && vals.includes(3) && vals.includes(1);
  }

  // Exactly 2 groups, the dice of each group all have the same o, and one
  // group can be turned to the other's o.
  if (groups.length !== 2) return false;

  const oVals = groups.map((g) => {
    const os = g.dice.map((d) => d.o);
    const allSame = os.every((o) => o === os[0]);
    return allSame ? os[0] : null;
  });
  if (oVals[0] === null || oVals[1] === null) return false;

  const a = oVals[0];
  const b = oVals[1];
  const sizes = groups.map((g) => g.dice.length);

  // A single die turns about any axis and reaches every orientation.
  if (sizes[0] === 1 || sizes[1] === 1) return true;

  // Two groups of 2 dice: only when one group's o is 1, 2 or 3 quarter turns
  // about x from the other's.
  if (sizes[0] === 2 && sizes[1] === 2) {
    const t1 = TURN[a].x["1"];
    const t2 = TURN[t1].x["1"];
    const t3 = TURN[t2].x["1"];
    return b === t1 || b === t2 || b === t3;
  }

  return false;
}

export function rank(game) {
  const rows = game.players.map((p) => {
    let largest = 0;
    let groups = 0;
    for (const g of p.queue.groups) {
      const n = g.dice.length;
      if (n > largest) largest = n;
      if (n > 1) groups++;
    }
    return { seat: p.seat, largest, groups };
  });
  rows.sort((a, b) => {
    if (b.largest !== a.largest) return b.largest - a.largest;
    if (b.groups !== a.groups) return b.groups - a.groups;
    return a.seat - b.seat;
  });
  const withRank = rows.map((r) => {
    let rank = 1;
    for (const other of rows) {
      if (other.largest > r.largest) rank++;
      else if (other.largest === r.largest && other.groups > r.groups) rank++;
    }
    return { seat: r.seat, rank, largest: r.largest, groups: r.groups };
  });
  return withRank;
}

export function init({ canvas, seat: s }) {
  seat = s;
  canvasRect = canvas.getBoundingClientRect();

  rollButton = document.createElement("button");
  rollButton.className = "hud-roll";
  rollButton.textContent = "ROLL";
  rollButton.style.position = "absolute";
  rollButton.style.display = "none";
  rollButton.style.width = "70px";
  rollButton.style.height = "32px";
  rollButton.style.borderRadius = "8px";
  rollButton.style.backgroundColor = "#2a3d4e";
  rollButton.style.color = "#e8e8e8";
  rollButton.addEventListener("click", () => {
    rollQueue.push({ kind: "roll" });
  });

  bannerEl = document.createElement("div");
  bannerEl.className = "hud-banner";
  bannerEl.style.position = "absolute";
  bannerEl.style.display = "none";
  bannerEl.style.borderRadius = "8px";
  bannerEl.style.backgroundColor = "rgba(0,0,0,0.6)";
  bannerEl.style.fontSize = "28px";
  bannerEl.style.fontWeight = "bold";
  bannerEl.style.textAlign = "center";
  bannerEl.style.width = canvasRect.width + "px";
  bannerEl.style.left = canvasRect.left + "px";
  bannerEl.style.top = canvasRect.top + "px";

  turnBannerEl = document.createElement("div");
  turnBannerEl.className = "hud-turn-banner";
  turnBannerEl.style.position = "absolute";
  turnBannerEl.style.display = "none";
  turnBannerEl.style.borderRadius = "8px";
  turnBannerEl.style.backgroundColor = "rgba(0,0,0,0.6)";
  turnBannerEl.style.fontSize = "28px";
  turnBannerEl.style.fontWeight = "bold";
  turnBannerEl.style.textAlign = "center";
  turnBannerEl.style.width = canvasRect.width + "px";
  turnBannerEl.style.left = canvasRect.left + "px";
  turnBannerEl.style.top = canvasRect.top + "px";
  turnBannerEl.textContent = "It's your turn!";
  turnBannerEl.style.color = PLAYERS[s].colour;

  windowEl = document.createElement("div");
  windowEl.className = "hud-window";
  windowEl.style.position = "absolute";
  windowEl.style.display = "none";
  windowEl.style.top = "50%";
  windowEl.style.left = "50%";
  windowEl.style.transform = "translate(-50%, -50%)";
  windowEl.style.backgroundColor = "rgba(0,0,0,0.85)";
  windowEl.style.borderRadius = "8px";
  windowEl.style.fontSize = "20px";

  document.body.appendChild(rollButton);
  document.body.appendChild(bannerEl);
  document.body.appendChild(turnBannerEl);
  document.body.appendChild(windowEl);
}

export function frame({ canRoll, anchor }) {
  if (canRoll) {
    rollButton.style.display = "";
    const x = anchor ? anchor.x : canvasRect.width / 2;
    const y = anchor ? anchor.y + 48 : canvasRect.height - 60;
    rollButton.style.left = (x - 35) + "px";
    rollButton.style.top = (y - 16) + "px";
  } else {
    rollButton.style.display = "none";
  }
}

export function drain() {
  const out = rollQueue.slice();
  rollQueue = [];
  return out;
}

export function show(prev, next) {
  const banners = [];
  for (let p = 0; p < 4; p++) {
    if (near(next, p) && next.winner === null && (prev === null || !near(prev, p))) {
      banners.push({ p, text: `Player ${p + 1} is close to winning!`, colour: PLAYERS[p].colour });
    }
  }
  for (const b of banners) bannerQueue.push(b);
  processBanners();

  const justTurned = next.winner === null && next.turn === seat && (prev === null || prev.turn !== seat);
  const passesTurn = next.turn !== seat || next.winner !== null;
  if (justTurned) {
    showTurnBanner();
  } else if (passesTurn) {
    hideTurnBannerAtOnce();
  }

  if (next.winner !== null) {
    if (!windowShown && windowTimer === null) {
      windowShown = true;
      const w = next.winner;
      windowTimer = setTimeout(() => {
        windowTimer = null;
        windowEl.style.display = "";
        const rows = rank(next)
          .map((r) => `<tr><td>${r.rank}</td><td style="color:${PLAYERS[r.seat].colour}">P${r.seat + 1}</td><td>${r.largest}</td><td>${r.groups}</td></tr>`)
          .join("");
        windowEl.innerHTML =
          `<div style="color:${PLAYERS[w].colour};font-size:28px;font-weight:bold">Player ${w + 1} wins!</div>` +
          `<table><tr><th>rank</th><th>player</th><th>largest</th><th>groups</th></tr>${rows}</table>`;
      }, WIN.window);
    }
  } else {
    // new game: hide the window at once and cancel a show still waiting;
    // the next win shows it again.
    if (windowTimer) {
      clearTimeout(windowTimer);
      windowTimer = null;
    }
    windowShown = false;
    windowEl.style.display = "none";
    windowEl.innerHTML = "";
  }
}

function processBanners() {
  if (bannerTimer) return;
  if (bannerQueue.length === 0) return;
  const b = bannerQueue.shift();
  bannerEl.textContent = b.text;
  bannerEl.style.color = b.colour;
  bannerEl.style.display = "";
  const h = bannerEl.offsetHeight;
  bannerEl.style.transition = "top 400ms";
  bannerEl.style.top = (canvasRect.top - h - 20) + "px";
  bannerEl.offsetHeight;
  bannerEl.style.top = canvasRect.top + "px";
  const slideDownDone = setTimeout(() => {
    const stayDone = setTimeout(() => {
      bannerEl.style.transition = "top 400ms";
      bannerEl.style.top = (canvasRect.top - h - 20) + "px";
      const slideUpDone = setTimeout(() => {
        bannerEl.style.display = "none";
        bannerTimer = null;
        processBanners();
      }, 400);
    }, 3000);
  }, 400);
  bannerTimer = slideDownDone;
}

function showTurnBanner() {
  turnBannerEl.textContent = "It's your turn!";
  turnBannerEl.style.color = PLAYERS[seat].colour;
  turnBannerEl.style.display = "";
  const h = turnBannerEl.offsetHeight;
  turnBannerEl.style.transition = "top 400ms";
  turnBannerEl.style.top = (canvasRect.top - h - 20) + "px";
  turnBannerEl.offsetHeight;
  const targetTop = canvasRect.top + canvasRect.height * 0.22;
  turnBannerEl.style.top = targetTop + "px";

  let t1, t2, t3;
  t1 = setTimeout(() => {
    t2 = setTimeout(() => {
      turnBannerEl.style.transition = "top 400ms";
      turnBannerEl.style.top = (canvasRect.top - h - 20) + "px";
      t3 = setTimeout(() => {
        turnBannerEl.style.display = "none";
        turnBannerTimeouts = [];
      }, 400);
    }, 2500);
  }, 400);
  turnBannerTimeouts = [t1, t2, t3];
}

function hideTurnBannerAtOnce() {
  for (const t of turnBannerTimeouts) { if (t) clearTimeout(t); }
  turnBannerTimeouts = [];
  turnBannerEl.style.display = "none";
  turnBannerEl.style.transition = "none";
}
