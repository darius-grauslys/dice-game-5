import { PLAYERS, WIN } from "../../../../../common/index.mjs";

let rollButton, bannerEl, windowEl, seat, canvasRect;
let rollQueue = [];
let bannerTimer = null;
let bannerQueue = [];
let windowShown = false;

function largest(game, p) {
  let max = 0;
  const player = game.players[p];
  for (const g of player.queue.groups) {
    const n = g.dice.length;
    if (n > max) max = n;
  }
  return max;
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
  bannerEl.style.width = canvasRect.width + "px";
  bannerEl.style.left = "0px";
  bannerEl.style.top = "-" + (canvasRect.height + 60) + "px";

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
  if (prev !== null) {
    const banners = [];
    for (let p = 0; p < 4; p++) {
      if (largest(next, p) >= 3 && next.winner === null && largest(prev, p) < 3) {
        banners.push({ p, text: `Player ${p + 1} is close to winning!`, colour: PLAYERS[p].colour });
      }
    }
    for (const b of banners) bannerQueue.push(b);
    processBanners();
  }

  if (next.winner !== null && !windowShown) {
    windowShown = true;
    const w = next.winner;
    setTimeout(() => {
      windowEl.style.display = "";
      const rows = rank(next)
        .map((r) => `<tr><td>${r.rank}</td><td style="color:${PLAYERS[r.seat].colour}">P${r.seat + 1}</td><td>${r.largest}</td><td>${r.groups}</td></tr>`)
        .join("");
      windowEl.innerHTML =
        `<div style="color:${PLAYERS[w].colour};font-size:28px;font-weight:bold">Player ${w + 1} wins!</div>` +
        `<table><tr><th>rank</th><th>player</th><th>largest</th><th>groups</th></tr>${rows}</table>`;
    }, WIN.window);
  }
}

function processBanners() {
  if (bannerTimer) return;
  if (bannerQueue.length === 0) return;
  const b = bannerQueue.shift();
  bannerEl.textContent = b.text;
  bannerEl.style.color = b.colour;
  bannerEl.style.display = "";
  bannerEl.style.transition = "top 400ms";
  bannerEl.style.top = "-" + (bannerEl.offsetHeight + 20) + "px";
  bannerEl.offsetHeight;
  bannerEl.style.top = "0px";
  bannerTimer = setTimeout(() => {
    bannerTimer = setTimeout(() => {
      bannerEl.style.transition = "top 400ms";
      bannerEl.style.top = "-" + (bannerEl.offsetHeight + 20) + "px";
      setTimeout(() => {
        bannerEl.style.display = "none";
        bannerTimer = null;
        processBanners();
      }, 400);
    }, 3000);
  }, 400);
}
