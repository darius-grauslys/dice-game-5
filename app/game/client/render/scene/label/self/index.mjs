import { PLAYERS, LABEL } from "../../../../../../../common/index.mjs";
import * as THREE from "three";
import { GLYPHS } from "./glyphs.mjs";

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

// Build a mesh for one stroke segment (on the 0..0.6 x, 0..1 y grid),
// scaled to char dimensions. Diagonal strokes are bars turned to the
// segment's angle.
function makeStrokeMesh(seg, charW, charH, thickness, colour) {
  const [x1, y1, x2, y2] = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Scale grid coords to real coords: x grid 0..0.6 -> box width charW;
  // y grid 0..1 -> box height charH.
  const realDx = dx * (charW / 0.6);
  const realDy = dy * charH;
  const barLen = Math.sqrt(realDx * realDx + realDy * realDy);
  if (barLen === 0) return null;

  // Bar shape: long axis barLen, cross-section thickness.
  const shape = rectShape(barLen, thickness);

  const geom = new THREE.ExtrudeGeometry(shape, undefined, true, 0.02);
  const mat = new THREE.MeshStandardMaterial({ color: colour, emissiveIntensity: 0.35 });
  const mesh = new THREE.Mesh(geom, mat);

  // Depth along z, scaled to 0.2.
  mesh.scale.z = 0.2 / 1.4;

  // Rotate so long axis aligns with segment angle (in real coords).
  const angle = Math.atan2(realDy, realDx);
  mesh.rotation.z = angle;

  // Center in char-local coords (box 0.6 wide, 1 tall, centred on origin).
  const cx = ((x1 + x2) / 2) * (charW / 0.6) - charW / 2;
  const cy = ((y1 + y2) / 2) * charH - charH / 2;
  mesh.position.x = cx;
  mesh.position.y = cy;
  mesh.position.z = 0;

  return mesh;
}

export function makeLabel({ text, colour }) {
  if (!VALID_TEXTS.has(text)) {
    throw new TypeError(`label.makeLabel: text must be P1, P2, P3, or P4, got ${String(text)}`);
  }

  const group = new THREE.Group();
  const charH = LABEL.size; // 0.8
  const charW = 0.6;
  const gap = 0.12; // 0.2 boxes (box is 0.6 wide)
  const thickness = 0.13;

  const chars = text.split("");
  const totalW = chars.length * charW + (chars.length - 1) * gap;

  let ci = 0;
  for (const c of chars) {
    const segs = GLYPHS[c];
    if (!segs) throw new TypeError(`label.makeLabel: no glyph for ${String(c)}`);
    const cellCenterX = -totalW / 2 + ci * (charW + gap) + charW / 2;
    for (const seg of segs) {
      const mesh = makeStrokeMesh(seg, charW, charH, thickness, colour);
      if (mesh) {
        mesh.position.x += cellCenterX;
        group.add(mesh);
      }
    }
    ci++;
  }

  return group;
}
