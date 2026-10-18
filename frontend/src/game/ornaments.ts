/**
 * Small pieces of the old city for the sandstone ring, painted in the skyline's style and palette
 * (``skylineArt.ts``) so the whole map reads as one place: a round tholos, a fountain, a statue on
 * its pedestal, a cypress in a planter, and an urn of flowers. Boot turns each into a texture.
 */

import { GENERATED } from "./assets";
import { P, Pixels, type RGB } from "./skylineArt";
import { seededRandom } from "./random";

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

/** Colours the ornaments add to the skyline's palette. */
const LOCAL = {
  cypress: hex(0x3a7a4a),
  cypressDark: hex(0x245535),
  cypressLight: hex(0x5a9a5c),
  blossom: hex(0xff6fb0),
  blossomDark: hex(0xd8458e),
} as const;

/** A gold finial: a short mast with a little cross-piece. */
function finial(px: Pixels, x: number, top: number, h = 6): void {
  for (let y = top - h; y < top; y++) px.set(x, y, P.gold);
  px.set(x - 1, top - h, P.goldLight);
  px.set(x + 1, top - h, P.goldLight);
}

/** Marble steps (a stylobate), each 2px tall and 2px narrower. Returns the top step's y. */
function steps(px: Pixels, x: number, base: number, w: number, n: number): number {
  for (let i = 0; i < n; i++) {
    const y = base - 2 * (i + 1);
    const inset = (n - 1 - i) * -2;
    px.rect(x + inset - 1, y, w - 2 * inset + 2, 2, P.outline);
    px.rect(x + inset, y, w - 2 * inset, 1, P.marbleLight);
    px.rect(x + inset, y + 1, w - 2 * inset, 1, P.marbleShade);
  }
  return base - 2 * n;
}

/** A round tholos: a ring of columns under a dome, pearl or gold. */
function tholos(px: Pixels, cx: number, base: number, r: number, gold: boolean): void {
  const floor = steps(px, cx - r, base, 2 * r, 2);
  const colH = Math.round(r * 1.5);
  const top = floor - colH;
  px.rect(cx - r - 1, top - 4, 2 * r + 2, colH + 4, P.outline);
  px.rect(cx - r, top, 2 * r, colH, P.archDeep);
  // Columns round the ring: closer together toward the edges, as a ring seen from the front.
  const n = Math.max(4, Math.round(r / 3));
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / n;
    const colX = Math.round(cx + Math.sin(a) * (r - 2)) - 1;
    px.rect(colX, top, 3, colH, Math.abs(Math.sin(a)) > 0.8 ? P.marbleShade : P.marbleLight);
  }
  px.rect(cx - r - 1, top - 4, 2 * r + 2, 2, P.marbleLight);
  px.rect(cx - r - 1, top - 2, 2 * r + 2, 1, P.gold);
  px.rect(cx - r - 1, top - 1, 2 * r + 2, 1, P.marble);
  const ry = Math.round(r * 0.75);
  px.dome(cx, top - 5, r + 1, ry, gold ? P.goldLight : P.pearl, gold ? P.gold : P.pearlMid, gold ? P.goldDark : P.pearlShade);
  finial(px, cx, top - 5 - ry, 5);
}

/** A cypress: a dark green flame on a short trunk. */
function cypress(px: Pixels, x: number, base: number, h: number): void {
  px.rect(x, base - 3, 2, 3, P.hullDark);
  for (let j = 3; j < h; j++) {
    const t = (j - 3) / (h - 3);
    const half = Math.max(0, Math.round(3.6 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.85)) * (1 - t * 0.35)));
    for (let i = -half; i <= half + 1; i++) {
      const c = i === -half ? LOCAL.cypressDark : i <= 0 ? LOCAL.cypress : i === half + 1 ? LOCAL.cypressDark : (i + j) % 4 === 0 ? LOCAL.cypressLight : LOCAL.cypress;
      px.set(x + i, base - j, c);
    }
  }
}

/** Bougainvillea: a clump of pink blossom hanging over a wall or a doorway. */
function flowers(px: Pixels, x: number, y: number, w: number, rand: () => number): void {
  for (let i = 0; i < w; i++) {
    const hang = 1 + Math.floor(rand() * 4);
    for (let j = 0; j < hang; j++) {
      const c = rand() < 0.3 ? LOCAL.cypress : (i + j) % 3 === 0 ? LOCAL.blossomDark : LOCAL.blossom;
      px.set(x + i, y + j, c);
    }
  }
}

export interface Ornament {
  key: string;
  w: number;
  h: number;
  paint: (px: Pixels) => void;
}

/** A pixel map: one string per row, one palette letter per pixel, "." for transparent. */
function rows(px: Pixels, map: string[], palette: Record<string, RGB>, ox = 0, oy = 0): void {
  map.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".") px.set(ox + x, oy + y, palette[ch]);
    }),
  );
}

/** A robed figure holding a gold trident, on a marble pedestal with a gold band. 16 x 38. */
function statue(px: Pixels): void {
  rows(
    px,
    [
      "..........g.g.g.",
      "..........ggggg.",
      "............g...",
      ".....kkk....g...",
      "....kLLLk...g...",
      "....kLLMk...g...",
      ".....kMk...kg...",
      "....kLLLk.kLg...",
      "...kLLLMMkLLk...",
      "...kLLLLMMLk....",
      "...kLkLLMMk.....",
      "...kLkLLMMk.....",
      "...kk.kLLMk.....",
      "......kLLMMk....",
      "......kLLMMk....",
      ".....kLLLMMk....",
      ".....kLLLMMMk...",
      ".....kLLLMMMk...",
      "....kLLLLMMMMk..",
      "....kkkkkkkkkk..",
    ],
    { k: P.outline, L: P.marbleLight, M: P.marbleShade, g: P.gold },
  );
  // The pedestal.
  px.rect(3, 20, 11, 1, P.outline);
  px.rect(4, 21, 9, 12, P.marble);
  px.rect(11, 21, 2, 12, P.marbleShade);
  px.rect(4, 21, 9, 1, P.marbleLight);
  px.rect(4, 25, 9, 1, P.gold);
  px.rect(2, 33, 13, 2, P.marbleLight);
  px.rect(2, 35, 13, 2, P.marbleShade);
  px.rect(1, 37, 15, 1, P.outline);
  for (const x of [3, 13]) px.rect(x, 21, 1, 12, P.outline);
}

/** A round fountain: a marble basin of bright water, a column and a bowl, and its jets. 44 x 30. */
function fountain(px: Pixels): void {
  const cx = 22;
  const cy = 22;
  for (let y = 12; y < 30; y++) {
    for (let x = 0; x < 44; x++) {
      const d = ((x - cx) / 21.5) ** 2 + ((y - cy) / 7.5) ** 2;
      if (d > 1) continue;
      const rim = d > 0.62;
      const lip = rim && y < cy;
      const c = rim ? (lip ? P.marbleLight : y > cy + 4 ? P.marbleShade : P.marble) : d < 0.12 ? P.water[0] : (x + y) % 5 === 0 ? P.surfaceGlint : P.water[2];
      px.set(x, y, c);
    }
  }
  for (let x = 0; x < 44; x++) {
    for (let y = 12; y < 30; y++) {
      const d = ((x - cx) / 21.5) ** 2 + ((y - cy) / 7.5) ** 2;
      if (d <= 1 && d > 0.9) px.set(x, y, P.outline);
    }
  }
  // The column and its bowl.
  px.rect(cx - 2, 10, 4, 12, P.marbleLight);
  px.rect(cx + 1, 10, 1, 12, P.marbleShade);
  px.rect(cx - 7, 8, 14, 2, P.marble);
  px.rect(cx - 6, 10, 12, 1, P.marbleShade);
  px.rect(cx - 7, 7, 14, 1, P.gold);
  // Jets arcing up and out, and spray falling back into the basin.
  for (let i = 0; i < 6; i++) px.set(cx, 6 - i, P.surfaceGlint);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const x = cx + side * (1 + i);
      const y = Math.round(2 + (i - 3) ** 2 * 0.35);
      px.set(x, y, i % 2 ? P.water[0] : P.surfaceGlint);
    }
  }
}

/** A cypress in a square marble planter. 12 x 40. */
function planterCypress(px: Pixels): void {
  cypress(px, 5, 32, 32);
  px.rect(1, 32, 10, 1, P.outline);
  px.rect(1, 33, 10, 6, P.marble);
  px.rect(8, 33, 3, 6, P.marbleShade);
  px.rect(1, 35, 10, 1, P.gold);
  px.rect(0, 39, 12, 1, P.outline);
}

/** A tall urn spilling flowers. 14 x 18. */
function urn(px: Pixels): void {
  rows(
    px,
    [
      "...kkkkkkkk...",
      "..kLLLLLLMMk..",
      "...kLLLLLMk...",
      "...kLgggggk...",
      "..kLLLLLLMMk..",
      ".kLLLLLLLMMMk.",
      ".kLLLLLLLMMMk.",
      "..kLLLLLLMMk..",
      "...kLLLLLMk...",
      "....kLLLMk....",
      "...kLLLLLMk...",
      "...kkkkkkkk...",
    ],
    { k: P.outline, L: P.marbleLight, M: P.marbleShade, g: P.gold },
    0,
    6,
  );
  flowers(px, 2, 3, 10, seededRandom(5));
  px.rect(3, 1, 8, 3, LOCAL.cypress);
  px.set(4, 0, LOCAL.blossom);
  px.set(7, 0, LOCAL.blossom);
  px.set(9, 1, LOCAL.blossom);
}

/** One fluted column standing on the steps, from ``top`` down to ``floor``, with a capital if whole. */
function column(px: Pixels, x: number, top: number, floor: number, whole: boolean): void {
  px.rect(x - 1, top, 7, floor - top, P.outline);
  px.rect(x, top, 5, floor - top, P.marbleLight);
  px.rect(x + 2, top, 1, floor - top, P.marble); // fluting
  px.rect(x + 4, top, 1, floor - top, P.marbleShade);
  px.rect(x - 1, floor - 2, 7, 2, P.marbleShade); // base
  if (whole) {
    px.rect(x - 2, top - 3, 9, 3, P.outline);
    px.rect(x - 1, top - 2, 7, 2, P.marble);
  } else {
    // A jagged break.
    for (const [dx, dy] of [[0, 0], [1, 1], [2, -1], [3, 2], [4, 0]]) px.set(x + dx, top + dy, P.outline);
    px.rect(x, top + 1, 5, 2, P.marbleShade);
  }
}

/**
 * A ruined colonnade, 56 x 44: three columns on their steps, two still carrying a gold-banded
 * lintel and the third snapped halfway, with its fallen drum lying round and fluted in front.
 */
function ruin(px: Pixels): void {
  const floor = steps(px, 6, 38, 40, 2);
  column(px, 8, floor - 26, floor, true);
  column(px, 21, floor - 26, floor, true);
  column(px, 36, floor - 13, floor, false);
  // The lintel over the two whole columns, with a gold band and a broken end.
  px.rect(5, floor - 33, 26, 5, P.outline);
  px.rect(6, floor - 32, 24, 3, P.marbleLight);
  px.rect(6, floor - 30, 24, 1, P.gold);
  px.rect(29, floor - 33, 3, 2, P.marbleShade);
  // The fallen drum: a round shaft lying on the ground, its end cap facing us.
  const gy = 42;
  px.rect(30, gy - 7, 22, 7, P.outline);
  for (let i = 0; i < 20; i++) {
    px.set(31 + i, gy - 6, P.marbleLight);
    px.set(31 + i, gy - 5, P.marbleLight);
    px.set(31 + i, gy - 4, i % 3 === 0 ? P.marbleShade : P.marble);
    px.set(31 + i, gy - 3, P.marble);
    px.set(31 + i, gy - 2, P.marbleShade);
  }
  for (let dy = -3; dy <= 3; dy++) {
    const half = Math.round(2.4 * Math.sqrt(1 - (dy / 3.6) ** 2));
    for (let dx = -half; dx <= half; dx++) {
      const edge = Math.abs(dx) === half || Math.abs(dy) === 3;
      px.set(51 + dx, gy - 4 + dy, edge ? P.outline : dx < 0 ? P.marbleLight : P.marble);
    }
  }
  px.set(51, gy - 4, P.marbleShade);
  // A broken capital and a few chips of stone.
  px.rect(1, gy - 4, 6, 4, P.outline);
  px.rect(2, gy - 3, 4, 2, P.marble);
  px.set(27, gy - 1, P.marbleShade);
  px.set(25, gy - 2, P.marbleShade);
}

export const ORNAMENTS: Ornament[] = [
  { key: GENERATED.tholos, w: 30, h: 44, paint: (px) => tholos(px, 15, 43, 11, true) },
  { key: GENERATED.fountain, w: 44, h: 30, paint: fountain },
  { key: GENERATED.statue, w: 16, h: 38, paint: statue },
  { key: GENERATED.planterCypress, w: 12, h: 40, paint: planterCypress },
  { key: GENERATED.urn, w: 14, h: 18, paint: urn },
  { key: GENERATED.ruin, w: 56, h: 44, paint: ruin },
];

/** Each ornament's size, by texture key, for placing and keeping clear of other decor. */
export const ORNAMENT_SIZE: Record<string, { w: number; h: number }> = Object.fromEntries(
  ORNAMENTS.map((o) => [o.key, { w: o.w, h: o.h }]),
);
