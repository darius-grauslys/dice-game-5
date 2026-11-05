import assert from "node:assert/strict";
import { PLAYERS } from "../../common/index.mjs";
import * as real from "../../edges/scene/scene_to_label.mjs";

export function makeLabel(input) {
  // A) check its arguments against the doc, and throw an Error naming the function if they're wrong;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`makeLabel: expected an object, got ${input === null ? "null" : typeof input}`);
  }
  if (!("text" in input) || !("colour" in input)) {
    throw new Error("makeLabel: missing text or colour");
  }
  const { text, colour } = input;
  if (typeof text !== "string") {
    throw new Error("makeLabel: text must be a string");
  }
  if (typeof colour !== "string") {
    throw new Error("makeLabel: colour must be a string");
  }
  // B) call the function through the forwarder
  const result = real.makeLabel({ text, colour });
  // C) check that it returned;
  if (result === undefined) {
    throw new Error("makeLabel: did not return");
  }
  // D) check the return value against the doc (shape and content, as far as the doc says)
  if (!(result.isMesh || result.isGroup)) {
    throw new Error("makeLabel: expected a THREE.Mesh or THREE.Group");
  }
  return result;
}

export const _sheo_browser = true;

function emissiveIntensityOf(node) {
  if (node.isMesh) return node.material.emissiveIntensity;
  if (node.isGroup && node.children.length > 0) {
    const c = node.children[0];
    if (c.isMesh) return c.material.emissiveIntensity;
  }
  return undefined;
}

export async function _sheo_check() {
  // Every player label: valid text, mesh or group, emissiveIntensity 0.35, centred on origin.
  for (const p of PLAYERS) {
    const label = makeLabel({ text: p.label, colour: p.colour });
    assert.ok(label.isMesh || label.isGroup, `${p.label}: mesh or group`);
    assert.strictEqual(emissiveIntensityOf(label), 0.35, `${p.label}: emissiveIntensity 0.35`);
    assert.strictEqual(label.position.x, 0, `${p.label}: position.x 0`);
    assert.strictEqual(label.position.y, 0, `${p.label}: position.y 0`);
    assert.strictEqual(label.position.z, 0, `${p.label}: position.z 0`);
  }

  // Invalid text: TypeError starting "label.makeLabel: "
  assert.throws(() => makeLabel({ text: "P5", colour: "#fff" }), /^TypeError: label\.makeLabel:/);
  assert.throws(() => makeLabel({ text: "X", colour: "#fff" }), /^TypeError: label\.makeLabel:/);
  assert.throws(() => makeLabel({ text: "p1", colour: "#fff" }), /^TypeError: label\.makeLabel:/);

  // Missing/wrong args: Error naming makeLabel
  assert.throws(() => makeLabel({ text: "P1" }), /^Error: makeLabel:/);
  assert.throws(() => makeLabel({ colour: "#fff" }), /^Error: makeLabel:/);
  assert.throws(() => makeLabel("P1"), /^Error: makeLabel:/);
  assert.throws(() => makeLabel(), /^Error: makeLabel:/);
}
