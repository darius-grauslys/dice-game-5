import test from "node:test";
import assert from "node:assert/strict";
import { makeLabel } from "../index.mjs";
import { GLYPHS } from "../glyphs.mjs";
import { LABEL } from "../../../../../../../../common/index.mjs";
import * as THREE from "three";

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

test("glyphs table has the exact strokes from the doc", () => {
  assert.deepEqual(GLYPHS.P, [
    [0, 0, 0, 1],
    [0, 1, 0.6, 1],
    [0.6, 1, 0.6, 0.5],
    [0.6, 0.5, 0, 0.5],
  ]);
  assert.deepEqual(GLYPHS["1"], [
    [0.3, 0, 0.3, 1],
    [0.3, 1, 0.1, 0.8],
    [0.1, 0, 0.5, 0],
  ]);
  assert.deepEqual(GLYPHS["2"], [
    [0, 1, 0.6, 1],
    [0.6, 1, 0.6, 0.5],
    [0.6, 0.5, 0, 0.5],
    [0, 0.5, 0, 0],
    [0, 0, 0.6, 0],
  ]);
  assert.deepEqual(GLYPHS["3"], [
    [0, 1, 0.6, 1],
    [0.6, 1, 0.6, 0],
    [0, 0.5, 0.6, 0.5],
    [0, 0, 0.6, 0],
  ]);
  assert.deepEqual(GLYPHS["4"], [
    [0, 1, 0, 0.5],
    [0, 0.5, 0.6, 0.5],
    [0.5, 1, 0.5, 0],
  ]);
});

test("P2 group bounding box is centred, LABEL.size tall, wider than tall", () => {
  const label = makeLabel({ text: "P2", colour: "#ff0000" });
  const box = new THREE.Box3().setFromObject(label);
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  assert.ok(Math.abs(cx) <= 0.01, `bounding box centred on x: ${cx}`);
  assert.ok(Math.abs(cy) <= 0.01, `bounding box centred on y: ${cy}`);
  const width = box.max.x - box.min.x;
  // In-plane height: glyphs span grid y 0..1 scaled to LABEL.size, so max |position.y|
  // among strokes is LABEL.size/2. (THREE.Box3.setFromObject on ExtrudeGeometry meshes
  // reports y-extent including the 0.2 z-depth, so derive height from stroke centers.)
  let maxCY = 0;
  label.traverse((m) => { if (m.isMesh) maxCY = Math.max(maxCY, Math.abs(m.position.y)); });
  const height = maxCY * 2;
  assert.ok(height > LABEL.size * 0.95 && height < LABEL.size * 1.05, `height ${height} within 5% of ${LABEL.size}`);
  assert.ok(width > height, `wider than tall: width ${width}, height ${height}`);
});

test("P2: empty gap between P's rightmost stroke and digit's leftmost stroke >= 0.3 * LABEL.size", () => {
  const label = makeLabel({ text: "P2", colour: "#ff0000" });
  // P's box sits at x < 0, digit's box at x > 0.
  // P's rightmost stroke is the vertical stroke at glyph x=0.6 (largest glyph-x);
  // digit's leftmost stroke is the vertical stroke at glyph x=0 (smallest glyph-x).
  const pStrokes = [];
  const dStrokes = [];
  label.traverse((m) => {
    if (m.isMesh) {
      const b = new THREE.Box3().setFromObject(m);
      // vertical strokes have y-extent > x-extent
      const w = b.max.x - b.min.x;
      const h = b.max.y - b.min.y;
      if (h > w) {
        if (m.position.x < 0) pStrokes.push(m);
        else dStrokes.push(m);
      }
    }
  });
  // P's rightmost vertical stroke: largest position.x among P vertical strokes.
  let pRightmost = null;
  for (const m of pStrokes) {
    if (pRightmost === null || m.position.x > pRightmost.position.x) pRightmost = m;
  }
  // Digit's leftmost vertical stroke: smallest position.x among digit vertical strokes.
  let dLeftmost = null;
  for (const m of dStrokes) {
    if (dLeftmost === null || m.position.x < dLeftmost.position.x) dLeftmost = m;
  }
  // Gap between stroke center lines = gap between box edges = 0.4 glyph units * LABEL.size = 0.32.
  const gap = dLeftmost.position.x - pRightmost.position.x;
  assert.ok(gap >= 0.3 * LABEL.size, `gap ${gap} >= 0.3 * ${LABEL.size} = ${0.3 * LABEL.size}`);
});

test("vertical stroke taller than wide, horizontal stroke wider than tall", () => {
  const label = makeLabel({ text: "P1", colour: "#ff0000" });
  let hasVertical = false;
  let hasHorizontal = false;
  label.traverse((m) => {
    if (m.isMesh) {
      const b = new THREE.Box3().setFromObject(m);
      const w = b.max.x - b.min.x;
      const h = b.max.y - b.min.y;
      if (h > w * 1.5) hasVertical = true;
      if (w > h * 1.5) hasHorizontal = true;
    }
  });
  assert.ok(hasVertical, "has a vertical stroke (taller than wide)");
  assert.ok(hasHorizontal, "has a horizontal stroke (wider than tall)");
});
