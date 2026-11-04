import { test } from "node:test";
import assert from "node:assert/strict";
import { Action } from "../index.mjs";

const roll = (patch) =>
  Action({ id: "r1", seat: 0, move: "roll", axis: null, dir: null, version: 0, ...patch });
const turn = (patch) =>
  Action({ id: "t1", seat: 1, move: "turn", axis: "x", dir: 1, version: 2, ...patch });

test("Action builds a turn", () => {
  const a = turn();
  assert.deepStrictEqual(a, {
    kind: "action",
    id: "t1",
    seat: 1,
    move: "turn",
    axis: "x",
    dir: 1,
    version: 2,
  });
  assert.deepStrictEqual(
    Object.keys(a),
    ["kind", "id", "seat", "move", "axis", "dir", "version"],
  );
  assert.ok(Object.isFrozen(a));
});

test("Action builds a roll", () => {
  const a = roll();
  assert.deepStrictEqual(a, {
    kind: "action",
    id: "r1",
    seat: 0,
    move: "roll",
    axis: null,
    dir: null,
    version: 0,
  });
});

test("Action accepts every axis and dir for a turn", () => {
  for (const axis of ["x", "y", "z"])
    for (const dir of [1, -1])
      assert.deepStrictEqual(
        turn({ axis, dir }),
        { kind: "action", id: "t1", seat: 1, move: "turn", axis, dir, version: 2 },
      );
});

test("Action rejects a bad id", () => {
  for (const id of ["", 5, null, undefined, []])
    assert.throws(
      () => roll({ id }),
      /Action\.id: /,
      `id=${JSON.stringify(id)}`,
    );
});

test("Action rejects a bad seat", () => {
  for (const seat of [4, -1, 1.5, "1", null, true])
    assert.throws(
      () => roll({ seat }),
      /Action\.seat: /,
      `seat=${JSON.stringify(seat)}`,
    );
});

test("Action rejects a bad move", () => {
  for (const move of ["deal", "move", "", "turns", null, 5, true])
    assert.throws(
      () => roll({ move }),
      /Action\.move: /,
      `move=${JSON.stringify(move)}`,
    );
});

test("Action rejects a bad axis for a turn", () => {
  for (const axis of [null, "w", "X", 1, []])
    assert.throws(
      () => turn({ axis }),
      /Action\.axis: /,
      `axis=${JSON.stringify(axis)}`,
    );
});

test("Action rejects a bad dir for a turn", () => {
  for (const dir of [null, 0, 2, -2, "1", 1.5])
    assert.throws(
      () => turn({ dir }),
      /Action\.dir: /,
      `dir=${JSON.stringify(dir)}`,
    );
});

test("Action rejects a non-null axis or dir for a roll", () => {
  assert.throws(() => roll({ axis: "x" }), /Action\.axis: /);
  assert.throws(() => roll({ dir: 1 }), /Action\.dir: /);
});

test("Action rejects a bad version", () => {
  for (const version of [-1, 0.5, "3", null, true])
    assert.throws(
      () => roll({ version }),
      /Action\.version: /,
      `version=${JSON.stringify(version)}`,
    );
});

test("Action rejects missing and unknown fields", () => {
  assert.throws(() => roll({ id: undefined }), /Action\.id: /);
  assert.throws(() => roll({ seat: undefined }), /Action\.seat: /);
  assert.throws(() => roll({ move: undefined }), /Action\.move: /);
  assert.throws(() => turn({ axis: undefined }), /Action\.axis: /);
  assert.throws(() => turn({ dir: undefined }), /Action\.dir: /);
  assert.throws(() => roll({ version: undefined }), /Action\.version: /);
  assert.throws(
    () => roll({ colour: "red" }),
    /Action\.colour: unknown field$/,
  );
});

test("Action's value is deeply frozen", () => {
  const a = turn();
  assert.throws(() => { a.move = "roll"; }, TypeError);
  assert.throws(() => { a.axis = "y"; }, TypeError);
  assert.throws(() => { a.dir = -1; }, TypeError);
});
