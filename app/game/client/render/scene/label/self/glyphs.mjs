// Glyph segments on a 0..1 grid per character, per the label doc.
// Each glyph sits in a box 0.6 wide and 1 tall; a point is [x, y] with
// x to the right and y up (as seen from +z). Each segment is [x1, y1, x2, y2].
export const GLYPHS = {
  "P": [
    [0, 0, 0, 1],
    [0, 1, 0.6, 1],
    [0.6, 1, 0.6, 0.5],
    [0.6, 0.5, 0, 0.5],
  ],
  "1": [
    [0.3, 0, 0.3, 1],
    [0.3, 1, 0.1, 0.8],
    [0.1, 0, 0.5, 0],
  ],
  "2": [
    [0, 1, 0.6, 1],
    [0.6, 1, 0.6, 0.5],
    [0.6, 0.5, 0, 0.5],
    [0, 0.5, 0, 0],
    [0, 0, 0.6, 0],
  ],
  "3": [
    [0, 1, 0.6, 1],
    [0.6, 1, 0.6, 0],
    [0, 0.5, 0.6, 0.5],
    [0, 0, 0.6, 0],
  ],
  "4": [
    [0, 1, 0, 0.5],
    [0, 0.5, 0.6, 0.5],
    [0.5, 1, 0.5, 0],
  ],
};
