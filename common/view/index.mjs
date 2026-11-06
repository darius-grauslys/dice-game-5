// common/view: the geometry every client part agrees on, as frozen data.
//
// Pure: no imports, no IO, no time, no randomness. Computed once when the
// module loads, then deeply frozen.

function deepFreeze(v) {
  if (v && typeof v === "object") {
    for (const key of Object.getOwnPropertyNames(v)) deepFreeze(v[key]);
    Object.freeze(v);
  }
  return v;
}

export const DIE = deepFreeze(1);
export const GAP = deepFreeze(0.25);
export const GROUP_GAP = deepFreeze(0.5);
export const TABLE_R = deepFreeze(4.6);

export const YAW = deepFreeze([
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
  [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
]);

export const CAMERA = deepFreeze({ eye: [0, 7, 13], target: [0, 0, 2], fov: 45 });

export const ROLL_PAD = deepFreeze({ center: [0, 0.01, 6.5], size: 1.4 });

export const DRAG_MIN = deepFreeze(12);

export const DRAG = deepFreeze({
  "+z": { right: { axis: "y", dir: 1 }, left: { axis: "y", dir: -1 }, up: { axis: "x", dir: -1 }, down: { axis: "x", dir: 1 } },
  "+y": { right: { axis: "z", dir: -1 }, left: { axis: "z", dir: 1 }, up: { axis: "x", dir: -1 }, down: { axis: "x", dir: 1 } },
});

export const MS = deepFreeze({ turn: 250, roll: 600, deal: 600, move: 300 });

// Phase 3 additions (the polish round).

export const PLAYERS = deepFreeze([
  { label: "P1", colour: "#2f7bff", ring: "#9cc2ff" },
  { label: "P2", colour: "#e5322d", ring: "#ff9b98" },
  { label: "P3", colour: "#f2c200", ring: "#fff08a" },
  { label: "P4", colour: "#ff5fae", ring: "#ffc2e0" },
]);

// STACK: a group is a log; each die steps one dx along the row and one dz toward its owner,
// every die (not every second one); cube centres stay at least √2 apart.
export const STACK = deepFreeze({ dx: 1.05, dz: 1.05 });

export const SECTORS = deepFreeze([
  { axis: "y", dir: 1 },
  { axis: "x", dir: -1 },
  { axis: "z", dir: 1 },
  { axis: "y", dir: -1 },
  { axis: "x", dir: 1 },
  { axis: "z", dir: -1 },
]);

export const FOLLOW = deepFreeze({ max: 0.6, lift: 0.3 });

export const GLOW = deepFreeze({ colour: "#ffd84a", periodMs: 2000, min: 0.35, max: 0.9 });

// LABEL.out: how far beyond its row, away from the table's centre, a player's name label
// stands, for the viewer's own row, a row at the side, and the row across; `beyond` is left over.
export const LABEL = deepFreeze({ beyond: 1.4, height: 1.5, size: 0.8, out: { own: 4.1, side: 2.3, far: 4.2 } });

export const WIN = deepFreeze({ label: 2000, labelMs: 1500, window: 5500, restart: 8000 });

// FACE_PERMS: every ordering of [1,2,3,4,5,6]: 720 arrays, lexicographic order.
// Computed once at load; the module still exports only data.
function generatePerms() {
  const arr = [1, 2, 3, 4, 5, 6];
  const perms = [arr.slice()];
  while (true) {
    let i = arr.length - 2;
    while (i >= 0 && arr[i] >= arr[i + 1]) i--;
    if (i === -1) break;
    let j = arr.length - 1;
    while (arr[j] <= arr[i]) j--;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    let l = i + 1, r = arr.length - 1;
    while (l < r) { [arr[l], arr[r]] = [arr[r], arr[l]]; l++; r--; }
    perms.push(arr.slice());
  }
  return perms;
}

export const FACE_PERMS = deepFreeze(generatePerms());
