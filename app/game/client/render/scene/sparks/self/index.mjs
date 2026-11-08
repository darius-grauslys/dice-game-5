import * as THREE from "three";

let points;
let geometry;
let positionsAttr;
let colorsAttr;
let positions;
let colors;
const MAX = 4000;

let particles = [];
let dustAnchor = null;
let sparklerAnchor = null;
let dustAccum = 0;
let sparklerAccum = 0;
let t = 0;

// Ring state
let ringParticles = []; // 48 ring particles or []
let ringAnchor = null; // [ax, ay, az] when ring exists
let ringTheta = 0;

function anchorsEqual(a, b) {
  if (!a || !b) return a === b;
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;
}

export function init(scene) {
  particles = [];
  ringParticles = [];
  dustAnchor = null;
  sparklerAnchor = null;
  dustAccum = 0;
  sparklerAccum = 0;
  t = 0;
  ringTheta = 0;
  ringAnchor = null;

  positions = new Float32Array(MAX * 3);
  colors = new Float32Array(MAX * 3);
  geometry = new THREE.BufferGeometry();
  positionsAttr = new THREE.BufferAttribute(positions, 3);
  colorsAttr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute("position", positionsAttr);
  geometry.setAttribute("color", colorsAttr);
  geometry.setDrawRange(0, 0);

  const gold = new THREE.Color("#ffd84a");

  const material = new THREE.PointsMaterial({
    size: 0.3,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: gold,
  });

  points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
}

function makeDust(anchor) {
  // random point on ring radius 0.9
  const angle = Math.random() * Math.PI * 2;
  const x = anchor[0] + Math.cos(angle) * 0.9;
  const z = anchor[2] + Math.sin(angle) * 0.9;
  const y = anchor[1];
  const vy = -(0.5 + Math.random() * 0.4);
  const drift = 0.05;
  const vx = (Math.random() - 0.5) * drift;
  const vz = (Math.random() - 0.5) * drift;
  return {
    type: "dust",
    x,
    y,
    z,
    vx,
    vy,
    vz,
    anchorY: anchor[1],
    cr: 1,
    cg: 0.847,
    cb: 0.29,
  };
}

function makeFallingFromRing(p, anchorY) {
  const vy = -(0.5 + Math.random() * 0.4);
  const drift = 0.05;
  const vx = (Math.random() - 0.5) * drift;
  const vz = (Math.random() - 0.5) * drift;
  return {
    type: "dust",
    x: p.x,
    y: p.y,
    z: p.z,
    vx,
    vy,
    vz,
    anchorY,
    cr: 1,
    cg: 0.847,
    cb: 0.29,
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
    cr: 1,
    cg: 0.847,
    cb: 0.29,
  };
}

export function dust(anchor) {
  if (anchor === null) {
    if (ringParticles.length === 48) {
      const anchorY = ringAnchor ? ringAnchor[1] : 1.0;
      for (const p of ringParticles) {
        particles.push(makeFallingFromRing(p, anchorY));
      }
      ringParticles = [];
      ringAnchor = null;
    }
    dustAnchor = null;
    return;
  }

  // anchor is an array
  if (ringAnchor && anchorsEqual(ringAnchor, anchor)) {
    // same anchor, ring already formed, do nothing
    return;
  }

  // new anchor: release old ring as falling particles with new anchor's height
  if (ringParticles.length === 48) {
    for (const p of ringParticles) {
      particles.push(makeFallingFromRing(p, anchor[1]));
    }
    ringParticles = [];
    ringAnchor = null;
  }

  // form new ring
  ringAnchor = [anchor[0], anchor[1], anchor[2]];
  dustAnchor = anchor;
  ringTheta = 0;
  ringParticles = [];
  for (let i = 0; i < 48; i++) {
    const angleForm = ringTheta + 2 * Math.PI * i / 48;
    const x0 = ringAnchor[0] + 2.0 * Math.cos(angleForm);
    const z0 = ringAnchor[2] + 2.0 * Math.sin(angleForm);
    const y0 = ringAnchor[1] + 1.0;
    ringParticles.push({
      slot: i,
      tForm: t,
      ax: ringAnchor[0],
      ay: ringAnchor[1],
      az: ringAnchor[2],
      x0,
      y0,
      z0,
      angleForm,
    });
  }
}

export function ring() {
  if (ringParticles.length !== 48) return [];
  return ringParticles.map((p) => [p.x, p.y, p.z]);
}

export function sparkler(anchor) {
  sparklerAnchor = anchor;
}

export function step(ms) {
  const dtSeconds = ms / 1000;
  t += ms;

  if (ringParticles.length === 48) {
    ringTheta += 0.8 * dtSeconds;
    for (const p of ringParticles) {
      const u = Math.min(1, (t - p.tForm) / 600);
      const ease = 1 - (1 - u) * (1 - u);
      const angleNow = ringTheta + 2 * Math.PI * p.slot / 48;
      const targetX = p.ax + 0.9 * Math.cos(angleNow);
      const targetZ = p.az + 0.9 * Math.sin(angleNow);
      const targetY = p.ay;
      p.x = p.x0 + ease * (targetX - p.x0);
      p.z = p.z0 + ease * (targetZ - p.z0);
      p.y = p.y0 + ease * (targetY - p.y0);
    }
  }

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

  const ringCount = ringParticles.length;
  const partCount = particles.length;
  const liveCount = ringCount + partCount;

  let idx = 0;
  for (let i = 0; i < ringCount; i++) {
    const p = ringParticles[i];
    positions[idx * 3] = p.x;
    positions[idx * 3 + 1] = p.y;
    positions[idx * 3 + 2] = p.z;
    const flicker = 0.85 + Math.random() * 0.15;
    colors[idx * 3] = 1 * flicker;
    colors[idx * 3 + 1] = 0.847 * flicker;
    colors[idx * 3 + 2] = 0.29 * flicker;
    idx++;
  }
  for (let i = 0; i < partCount; i++) {
    const p = particles[i];
    positions[idx * 3] = p.x;
    positions[idx * 3 + 1] = p.y;
    positions[idx * 3 + 2] = p.z;
    const flicker = 0.85 + Math.random() * 0.15;
    const opacity = p.opacity != null ? p.opacity : 1;
    colors[idx * 3] = p.cr * flicker * opacity;
    colors[idx * 3 + 1] = p.cg * flicker * opacity;
    colors[idx * 3 + 2] = p.cb * flicker * opacity;
    idx++;
  }
  for (let i = idx * 3; i < positions.length; i++) positions[i] = 0;
  for (let i = idx * 3; i < colors.length; i++) colors[i] = 0;

  geometry.setDrawRange(0, liveCount);
  positionsAttr.needsUpdate = true;
  colorsAttr.needsUpdate = true;
}

export function count() {
  return ringParticles.length + particles.length;
}
