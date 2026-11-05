import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { init, dust, sparkler, step, count } from "../index.mjs";

function makeScene() {
  const scene = new THREE.Scene();
  return scene;
}

test("sparks: init adds one Points with additive material", () => {
  const scene = makeScene();
  init(scene);
  const points = scene.children.find((c) => c && c.isPoints);
  if (!points) throw new Error("no Points added");
  if (scene.children.filter((c) => c && c.isPoints).length !== 1) {
    throw new Error("expected exactly one Points");
  }
  const mat = points.material;
  if (!mat) throw new Error("no material");
});

test("sparks: count starts at zero", () => {
  const scene = makeScene();
  init(scene);
  assert.strictEqual(count(), 0);
});

test("sparks: dust adds particles over time", () => {
  const scene = makeScene();
  init(scene);
  dust([0, 1, 0]);
  let prev = count();
  for (let i = 0; i < 10; i++) {
    step(16);
    assert.ok(count() >= prev);
    prev = count();
  }
  assert.ok(count() > 0, "dust added no particles");
});

test("sparks: sparkler adds a burst of particles", () => {
  const scene = makeScene();
  init(scene);
  sparkler([0, 1, 0]);
  const before = count();
  step(16);
  assert.ok(count() > before, "sparkler added no particles");
});

test("sparks: sparkler and dust counts grow and level off", () => {
  const scene = makeScene();
  init(scene);
  dust([-1, 1.5, 0]);
  sparkler([1, 1.5, 0]);
  const c30 = countAfter(30);
  const c60 = countAfter(60);
  const c120 = countAfter(120);
  assert.ok(c60 >= c30, "counts did not grow at 60");
  assert.ok(c120 >= c60, "counts did not grow at 120");
  function countAfter(steps) {
    for (let i = 0; i < steps; i++) step(16);
    return count();
  }
});
