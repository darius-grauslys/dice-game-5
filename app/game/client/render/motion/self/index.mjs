import { MS } from "../../../../../../common/index.mjs";

function freezeDeep(v) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const key of Object.getOwnPropertyNames(v)) freezeDeep(v[key]);
    Object.freeze(v);
    return v;
  }
  if (Array.isArray(v)) {
    for (const e of v) freezeDeep(e);
    Object.freeze(v);
    return v;
  }
  return v;
}

export function tracks(prev, next, last) {
  const out = [];
  for (const p of next) {
    const q = prev.find((q) => q.id === p.id);
    const posEqual =
      q.position[0] === p.position[0] &&
      q.position[1] === p.position[1] &&
      q.position[2] === p.position[2];
    const matEqual =
      q.matrix[0][0] === p.matrix[0][0] &&
      q.matrix[0][1] === p.matrix[0][1] &&
      q.matrix[0][2] === p.matrix[0][2] &&
      q.matrix[1][0] === p.matrix[1][0] &&
      q.matrix[1][1] === p.matrix[1][1] &&
      q.matrix[1][2] === p.matrix[1][2] &&
      q.matrix[2][0] === p.matrix[2][0] &&
      q.matrix[2][1] === p.matrix[2][1] &&
      q.matrix[2][2] === p.matrix[2][2];
    if (posEqual && matEqual) continue;

    let kind;
    if (last !== null && last.dice.includes(p.id)) {
      kind = last.change;
    } else {
      kind = "move";
    }

    let delay;
    if (
      kind === "move" &&
      last !== null &&
      (last.change === "turn" || last.change === "roll")
    ) {
      delay = MS[last.change];
    } else {
      delay = 0;
    }

    const ms = MS[kind];
    const spin = kind === "roll" || kind === "deal" ? 2 : 0;

    out.push(
      freezeDeep({
        id: p.id,
        kind,
        from: q,
        to: p,
        delay,
        ms,
        spin,
      }),
    );
  }
  return out;
}
