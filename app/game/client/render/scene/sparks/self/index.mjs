import * as THREE from "three";

let points;
let geometry;
let positions;
let sizes;
let colors;
const MAX = 4096;

let particles = [];
let dustAnchor = null;
let sparklerAnchor = null;
let dustAccum = 0;
let sparklerAccum = 0;
let t = 0;

export function init(scene) {
  positions = new Float32Array(MAX * 3);
  sizes = new Float32Array(MAX);
  colors = new Float32Array(MAX * 4);
  geometry = {
    isBufferGeometry: true,
    type: "BufferGeometry",
    positions,
    sizes,
    colors,
    morphTargets: [],
    morphAttributes: {},
    bounds: new THREE.Box3(
      new THREE.Vector3(-10, -10, -10),
      new THREE.Vector3(10, 10, 10),
    ),
    boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), 17.32),
    getPositions: function () {
      return positions;
    },
    getSizes: function () {
      return sizes;
    },
    getColors: function () {
      return colors;
    },
    addEventListener: function () {},
    removeEventListener: function () {},
  };
  const material = new THREE.PointsMaterial({
    color: "#ffd84a",
    size: 1,
    opacity: 1,
    depthWrite: false,
  });
  material.tangent = new THREE.Vector3(0, 0, 0);
  material.uniforms = { tangent: new THREE.Vector3(0, 0, 0) };
  points = new THREE.Points(geometry, material);
  points.intersectsFrustum = function () {
    return true;
  };
  scene.add(points);
}

function makeDust(anchor) {
  const angle = Math.random() * Math.PI * 2;
  const x = anchor[0] + Math.cos(angle) * 0.6;
  const z = anchor[2] + Math.sin(angle) * 0.6;
  const y = anchor[1];
  const vy = -(0.5 + Math.random() * 0.4);
  const drift = 0.05;
  const vx = (Math.random() - 0.5) * drift;
  const vz = (Math.random() - 0.5) * drift;
  const isGold = Math.random() < 0.7;
  const size = 10 + Math.random() * 10;
  return {
    type: "dust",
    x,
    y,
    z,
    vx,
    vy,
    vz,
    anchorY: anchor[1],
    cr: isGold ? 1 : 1,
    cg: isGold ? 0.847 : 1,
    cb: isGold ? 0.29 : 1,
    size,
  };
}

function makeSparkler(anchor) {
  const speed = 2 + Math.random() * 3;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const vx = speed * Math.sin(phi) * Math.cos(theta);
  const vy = speed * Math.sin(phi) * Math.sin(theta);
  const vz = speed * Math.sin(phi) * Math.cos(phi);
  const life = 600 + Math.random() * 600;
  const isGold = Math.random() < 0.7;
  const size = 12 + Math.random() * 8;
  return {
    type: "sparkler",
    x: anchor[0],
    y: anchor[1],
    z: anchor[2],
    vx,
    vy,
    vz,
    born: t,
    life,
    cr: isGold ? 1 : 1,
    cg: isGold ? 0.847 : 1,
    cb: isGold ? 0.29 : 1,
    size,
  };
}

export function dust(anchor) {
  dustAnchor = anchor;
}

export function sparkler(anchor) {
  sparklerAnchor = anchor;
}

export function step(ms) {
  const dtSeconds = ms / 1000;
  t += ms;

  if (dustAnchor) {
    dustAccum += 40 * dtSeconds;
    while (dustAccum >= 1) {
      dustAccum -= 1;
      particles.push(makeDust(dustAnchor));
    }
  }
  if (sparklerAnchor) {
    sparklerAccum += 300 * dtSeconds;
    while (sparklerAccum >= 1) {
      sparklerAccum -= 1;
      particles.push(makeSparkler(sparklerAnchor));
    }
  }

  const updated = [];
  for (const p of particles) {
    if (p.type === "dust") {
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.z += p.vz * dtSeconds;
      if (p.y <= 0) continue;
      p.opacity = p.y / p.anchorY;
      if (p.opacity < 0) p.opacity = 0;
    } else if (p.type === "sparkler") {
      p.vy -= 6 * dtSeconds;
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.z += p.vz * dtSeconds;
      const age = t - p.born;
      if (age >= p.life) continue;
      p.opacity = 1 - age / p.life;
    }
    updated.push(p);
  }
  particles = updated;

  const n = particles.length;
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    const flicker = 0.7 + Math.random() * 0.6;
    sizes[i] = p.size * flicker;
    colors[i * 4] = p.cr;
    colors[i * 4 + 1] = p.cg;
    colors[i * 4 + 2] = p.cb;
    colors[i * 4 + 3] = p.opacity != null ? p.opacity : 1;
  }
  for (let i = n * 3; i < positions.length; i++) positions[i] = 0;
  for (let i = n; i < sizes.length; i++) sizes[i] = 0;
  for (let i = n * 4; i < colors.length; i++) colors[i] = 0;
  geometry.needsUpdate = true;
}

export function count() {
  return particles.length;
}
