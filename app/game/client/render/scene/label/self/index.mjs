import { PLAYERS, LABEL } from "../../../../../../../common/index.mjs";
import * as THREE from "three";

// Glyph segments on a 0..1 grid per character. Each segment is [x1, y1, x2, y2].
// Horizontal or vertical strokes only.
const GLYPHS = {
  "P": [
    [0.2, 0.2, 0.2, 0.8],   // vertical (left)
    [0.2, 0.8, 0.8, 0.8],   // top horizontal
    [0.2, 0.2, 0.8, 0.2],   // bottom horizontal
  ],
  "1": [
    [0.5, 0.2, 0.5, 0.8],
  ],
  "2": [
    [0.2, 0.8, 0.8, 0.8],   // top
    [0.8, 0.8, 0.8, 0.2],   // right down
    [0.8, 0.2, 0.2, 0.2],   // bottom
  ],
  "3": [
    [0.2, 0.8, 0.8, 0.8],   // top
    [0.8, 0.8, 0.8, 0.2],   // right
    [0.2, 0.2, 0.8, 0.2],   // bottom
  ],
  "4": [
    [0.2, 0.8, 0.2, 0.2],   // left vertical
    [0.2, 0.5, 0.8, 0.5],   // middle horizontal
    [0.8, 0.5, 0.8, 0.2],   // right vertical
  ],
};

const VALID_TEXTS = new Set(["P1", "P2", "P3", "P4"]);

// Create a rectangle shape centered at origin. ExtrudeGeometry's bevel rounds it.
function rectShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  return s;
}

// Build a mesh for one stroke segment (on 0..1 grid), scaled to char dimensions.
function makeStrokeMesh(seg, charW, charH, thickness, colour) {
  const [x1, y1, x2, y2] = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  // Shape dimensions: horizontal strokes are wide (charW), vertical are tall (charH).
  // The cross-section thickness is `thickness` in the perpendicular direction.
  let sw, sh;
  if (Math.abs(dx) >= Math.abs(dy)) {
    sw = len * charW;
    sh = thickness;
  } else {
    sw = thickness;
    sh = len * charH;
  }

  const shape = rectShape(sw, sh);

  const geom = new THREE.ExtrudeGeometry(shape, undefined, 4, true, 0.02);
  const mat = new THREE.MeshStandardMaterial({ color: colour, emissiveIntensity: 0.35 });
  const mesh = new THREE.Mesh(geom, mat);

  // ExtrudeGeometry gives z-depth 1.4; scale to 0.2 deep and center at z=0.
  mesh.scale.z = 0.2 / 1.4;
  // Center of this stroke in char-local coords (0..1 grid -> scaled, centered at 0).
  const strokeCenterX = ((x1 + x2) / 2 - 0.5) * charW;
  const strokeCenterY = ((y1 + y2) / 2 - 0.5) * charH;
  mesh.position.x = strokeCenterX;
  mesh.position.y = strokeCenterY;
  mesh.position.z = 0; // ExtrudeGeometry centers z after scale

  return mesh;
}

export function makeLabel({ text, colour }) {
  if (!VALID_TEXTS.has(text)) {
    throw new TypeError(`label.makeLabel: text must be P1, P2, P3, or P4, got ${String(text)}`);
  }

  const group = new THREE.Group();
  const charH = LABEL.size; // 0.8
  const charW = 0.6;
  const gap = 0.12;
  const thickness = 0.13;

  const chars = text.split("");
  const totalW = chars.length * charW + (chars.length - 1) * gap;

  let ci = 0;
  for (const c of chars) {
    const segs = GLYPHS[c];
    if (!segs) throw new TypeError(`label.makeLabel: no glyph for ${String(c)}`);
    const cellX = -totalW / 2 + ci * (charW + gap);
    for (const seg of segs) {
      const mesh = makeStrokeMesh(seg, charW, charH, thickness, colour);
      if (mesh) {
        mesh.position.x += cellX;
        group.add(mesh);
      }
    }
    ci++;
  }

  return group;
}
