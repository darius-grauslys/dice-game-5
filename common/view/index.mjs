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
export const TABLE_R = deepFreeze(4);

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
