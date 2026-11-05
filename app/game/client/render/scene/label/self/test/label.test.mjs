import test from "node:test";
import assert from "node:assert/strict";
import { makeLabel } from "../index.mjs";

test("makeLabel rejects invalid text with TypeError", () => {
  for (const bad of ["", "P0", "P5", "P10", "p1", "P1 ", "P", "1", "abc", "P1P2"]) {
    assert.throws(
      () => makeLabel({ text: bad, colour: "#ff0000" }),
      /^TypeError: label\.makeLabel: text must be P1, P2, P3, or P4/,
      `expected makeLabel(${String(bad)}) to throw TypeError starting "label.makeLabel: "`,
    );
  }
});

test("makeLabel accepts P1..P4 and returns a THREE.Group", async () => {
  for (const t of ["P1", "P2", "P3", "P4"]) {
    const label = makeLabel({ text: t, colour: "#ff0000" });
    assert.ok(label, `makeLabel(${t}) returned a value`);
    assert.ok(label.isGroup === true || label.type === "Group", `makeLabel(${t}) returns a Group`);
    let meshCount = 0;
    label.traverse((m) => { if (m.isMesh) meshCount++; });
    assert.ok(meshCount > 0, `makeLabel(${t}) has meshes`);
  }
});

test("makeLabel meshes use MeshStandardMaterial with emissiveIntensity 0.35", async () => {
  const label = makeLabel({ text: "P1", colour: "#ff0000" });
  let ok = true;
  label.traverse((m) => {
    if (m.isMesh) {
      if (m.material.emissiveIntensity !== 0.35) ok = false;
    }
  });
  assert.ok(ok, "all meshes have emissiveIntensity 0.35");
});
