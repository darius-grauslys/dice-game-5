import { Rng, FACES, FACE_PERMS, DIE } from "../../../../../../../common/index.mjs";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// pip positions for values 1-6 on a 128x128 canvas
const PIP_POS = {
  1: [[64, 64]],
  2: [[36, 36], [92, 92]],
  3: [[36, 36], [64, 64], [92, 92]],
  4: [[36, 36], [92, 36], [36, 92], [92, 92]],
  5: [[36, 36], [92, 36], [36, 92], [92, 92], [64, 64]],
  6: [[36, 28], [92, 28], [36, 64], [92, 64], [36, 100], [92, 100]],
};

function isHexColor(s) {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

function isPermutationOf1to6(perm) {
  if (!Array.isArray(perm) || perm.length !== 6) return false;
  const seen = new Array(7).fill(false);
  for (const v of perm) {
    if (!Number.isInteger(v) || v < 1 || v > 6) return false;
    if (seen[v]) return false;
    seen[v] = true;
  }
  return true;
}

export function facesFor(seed) {
  let r = Rng.seed(seed);
  const used = new Set();
  const result = [];
  for (let seat = 0; seat < 4; seat++) {
    let k;
    do {
      [k, r] = Rng.int(r, 720);
    } while (used.has(k));
    used.add(k);
    result.push(FACE_PERMS[k].slice());
  }
  return result;
}

function makeFaceTexture(value, colour, ring) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // body
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, size, size);

  const positions = PIP_POS[value];
  const rPip = 12;
  const rRing = rPip + 5;

  for (const [px, py] of positions) {
    // ring in ring color
    ctx.beginPath();
    ctx.arc(px, py, rRing, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();

    // black disc
    ctx.beginPath();
    ctx.arc(px, py, rPip, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // soft dark inner edge so it reads as sunk into the face
    const grad = ctx.createRadialGradient(px, py, rPip - 3, px, py, rPip);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.beginPath();
    ctx.arc(px, py, rPip, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = "srgb";
  return texture;
}

function makeBumpTexture(value) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // light body
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const positions = PIP_POS[value];
  const rPip = 12;

  for (const [px, py] of positions) {
    // dark pips
    ctx.beginPath();
    ctx.arc(px, py, rPip, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function makeDie({colour, ring, perm}) {
  if (!isPermutationOf1to6(perm)) {
    throw new TypeError("dice.makeDie: perm must be a permutation of 1..6");
  }
  if (!isHexColor(colour)) {
    throw new TypeError("dice.makeDie: colour must be a #rrggbb string");
  }
  if (!isHexColor(ring)) {
    throw new TypeError("dice.makeDie: ring must be a #rrggbb string");
  }

  const geometry = new RoundedBoxGeometry(DIE, DIE, DIE, 4, 0.08);

  const materials = [];
  const faceOrder = ["+x", "-x", "+y", "-y", "+z", "-z"];
  for (const face of faceOrder) {
    const value = perm[FACES[face] - 1];
    const map = makeFaceTexture(value, colour, ring);
    const bumpMap = makeBumpTexture(value);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      map,
      bumpMap,
      bumpScale: 0.05,
    });
    materials.push(mat);
  }

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.userData = { kind: "die" };
  return mesh;
}
