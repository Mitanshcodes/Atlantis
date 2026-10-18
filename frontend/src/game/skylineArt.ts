/**
 * The skyline: one painting across the top of the map, after the design reference. Above the
 * waterline, a golden sky with clouds and the ships of the harbor, iridescent sails catching the
 * light (one of them is the last ship out). Below it, Atlantis itself: hazy towers far off, then
 * white-marble palaces with arched arcades, pearl and gold domes, spires and blue banners, and in
 * the middle a great domed palace, all down to a quay of lanterns and coral.
 *
 * Painted pixel by pixel from a seeded RNG, so it's the same every load. The crystal that floats
 * over the great dome, and its swirl of light, are animated in the City scene on top of this.
 */

import { seededRandom } from "./random";

/** How far down the painting the sea's surface lies. */
export const SKYLINE_WATERLINE = 46;

export type RGB = readonly [number, number, number];
const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

export const P = {
  sky: [hex(0x8cc4e2), hex(0xa9d6ea), hex(0xcbe6ec), hex(0xeaead6), hex(0xf6e2bc)],
  cloud: hex(0xffffff),
  cloudCream: hex(0xfff1d6),
  cloudShade: hex(0xe3d3b8),
  cloudBlue: hex(0xc4dbe6),
  moon: hex(0xfff8e4),
  moonShade: hex(0xeee0bd),
  surface: hex(0xf4fffd),
  surfaceGlint: hex(0xffffff),
  water: [hex(0x8fe9ea), hex(0x5fd5df), hex(0x3dbcd4), hex(0x2aa0c6), hex(0x2584b4), hex(0x2a6aa2), hex(0x31528f)],
  haze: hex(0x6cc4d6),
  ray: hex(0xe4fff9),

  outline: hex(0x3d5664),
  marbleLight: hex(0xfbf7ec),
  marble: hex(0xece3cd),
  marbleShade: hex(0xcfc3a5),
  marbleDeep: hex(0xb0a283),
  arch: hex(0x2c6b80),
  archDeep: hex(0x1f5066),
  lit: hex(0xffd88a),
  litBright: hex(0xfff2c4),
  gold: hex(0xf2c95c),
  goldLight: hex(0xfff0a8),
  goldDark: hex(0xb08630),
  pearl: hex(0xd2f1f2),
  pearlMid: hex(0x9fdbe2),
  pearlShade: hex(0x6fb9c8),
  banner: hex(0x2f7fc4),
  bannerDark: hex(0x1f5a99),

  hull: hex(0x8a5a2b),
  hullDark: hex(0x5e3a1c),
  mast: hex(0x6a4a2a),
  sail: [hex(0xffe0f2), hex(0xf1c8f6), hex(0xd9c0ff), hex(0xbcd6ff), hex(0xaeeefa)],
  sailEdge: hex(0x8a78b8),

  quay: hex(0xe9dfc6),
  quayShade: hex(0xcdbf9c),
  quayJoint: hex(0xb5a682),
  coralPink: hex(0xff7fb4),
  coralPinkDark: hex(0xd24f8a),
  coralPurple: hex(0xb07ae6),
  coralPurpleDark: hex(0x7b4fc4),
  coralOrange: hex(0xffaa5a),
  coralOrangeDark: hex(0xd9772e),
  kelp: hex(0x4f9a5c),
  kelpDark: hex(0x2f6e45),
  fanTeal: hex(0x6fe0cc),
} as const;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** A banded gradient, dithered between neighbouring bands so it reads as pixel art. */
function band(colors: readonly RGB[], t: number, x: number, y: number): RGB {
  const pos = Math.max(0, Math.min(0.999, t)) * (colors.length - 1);
  const i = Math.floor(pos);
  return pos - i > bayer(x, y) ? colors[Math.min(colors.length - 1, i + 1)] : colors[i];
}

export class Pixels {
  readonly data: Uint8ClampedArray;
  /** Everything drawn is pulled this far toward the water's haze: 0 near, higher far away. */
  fog = 0;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGB, alpha = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4;
    const col = this.fog ? mix(c, P.haze, this.fog) : c;
    const d = this.data;
    d[o] = d[o] + (col[0] - d[o]) * alpha;
    d[o + 1] = d[o + 1] + (col[1] - d[o + 1]) * alpha;
    d[o + 2] = d[o + 2] + (col[2] - d[o + 2]) * alpha;
    d[o + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** The top half of an ellipse (a dome), shaded from the left. */
  dome(cx: number, base: number, rx: number, ry: number, light: RGB, mid: RGB, shade: RGB): void {
    for (let dy = 0; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
      for (let dx = -half; dx <= half; dx++) {
        const edge = Math.abs(dx) === half || dy === ry;
        const t = (dx + half) / (2 * half + 1);
        const c = edge ? P.outline : t < 0.3 ? light : t < 0.7 ? mid : shade;
        this.set(cx + dx, base - dy, c);
      }
    }
  }

  /** An arched opening: a rectangle with a round top. */
  arch(x: number, top: number, w: number, h: number, c: RGB): void {
    const r = w / 2;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (j < r) {
          const dx = i + 0.5 - r;
          const dy = r - j - 0.5;
          if (dx * dx + dy * dy > r * r) continue;
        }
        this.set(x + i, top + j, c);
      }
    }
  }
}

// --- The sky and the surface ------------------------------------------------------------------------

function sky(px: Pixels, waterline: number, rand: () => number): void {
  for (let y = 0; y < waterline; y++) {
    for (let x = 0; x < px.w; x++) px.set(x, y, band(P.sky, y / waterline, x, y));
  }
  // A pale moon, as in the reference, high on the right.
  const mx = Math.round(px.w * 0.86);
  const my = 13;
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= 8) px.set(mx + dx, my + dy, d < 6 || dx < 0 ? P.moon : P.moonShade);
      else if (d <= 10) px.set(mx + dx, my + dy, P.moon, 0.35);
    }
  }
  // Clouds: clusters of puffs, white on top, cream and shade below.
  for (let c = 0; c < 9; c++) {
    const cx = 30 + rand() * (px.w - 60);
    const cy = 8 + rand() * (waterline - 22);
    const puffs = 4 + Math.floor(rand() * 5);
    for (let p = 0; p < puffs; p++) {
      const ox = cx + (p - puffs / 2) * (6 + rand() * 4);
      const oy = cy + (rand() - 0.5) * 4;
      const r = 4 + rand() * 5;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const y = oy + dy;
          const t = (dy + r) / (2 * r);
          const col = t < 0.45 ? P.cloud : t < 0.75 ? P.cloudCream : t < 0.9 ? P.cloudShade : P.cloudBlue;
          if (y < waterline - 3) px.set(ox + dx, y, col);
        }
      }
    }
  }
}

function water(px: Pixels, waterline: number): void {
  for (let y = waterline; y < px.h; y++) {
    const t = (y - waterline) / (px.h - waterline);
    for (let x = 0; x < px.w; x++) px.set(x, y, band(P.water, t, x, y));
  }
  // The surface seen from just below: a bright line with ripples and glints.
  for (let x = 0; x < px.w; x++) {
    const ripple = Math.round(Math.sin(x / 9) * 0.8 + Math.sin(x / 3.7) * 0.4);
    px.set(x, waterline + ripple, P.surface);
    px.set(x, waterline + 1 + ripple, P.surface, 0.5);
    if ((x * 37) % 23 === 0) px.set(x, waterline + 2 + ripple, P.surfaceGlint, 0.8);
  }
}

/** Shafts of light slanting down from the surface, fading with depth. */
function rays(px: Pixels, waterline: number, rand: () => number): void {
  for (let r = 0; r < 9; r++) {
    const x0 = rand() * px.w;
    const width = 8 + rand() * 22;
    const strength = 0.12 + rand() * 0.12;
    for (let y = waterline + 2; y < px.h; y++) {
      const fade = 1 - (y - waterline) / (px.h - waterline);
      const xs = x0 + (y - waterline) * 0.32;
      for (let i = 0; i < width; i++) {
        const edge = Math.min(i, width - i) / (width / 2);
        px.set(xs + i, y, P.ray, strength * fade * Math.min(1, edge * 1.6));
      }
    }
  }
}

/** A ship on the surface: hull on the waterline, iridescent sails rising into the sky. */
function ship(px: Pixels, x: number, waterline: number, scale: number): void {
  const len = Math.round(30 * scale);
  const depth = Math.round(5 * scale);
  // Hull: a long curve, the prow rising at the right.
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const top = waterline - depth + Math.round((t > 0.8 ? -(t - 0.8) * 10 : 0) * scale);
    const bottom = waterline + Math.round(2 * scale * Math.sin(Math.PI * t));
    for (let y = top; y <= bottom; y++) {
      const c = y === top ? P.goldDark : y === top + 1 ? P.gold : y > waterline ? P.hullDark : P.hull;
      px.set(x + i, y, y > waterline ? mix(c, P.water[1], 0.45) : c);
    }
  }
  // Oars along the side.
  for (let i = 4; i < len - 6; i += 3) px.set(x + i, waterline - Math.round(1.5 * scale), P.hullDark);
  // Two masts with curved sails.
  for (const [mx, mh] of [
    [0.38, 1],
    [0.7, 0.8],
  ] as const) {
    const sx = Math.round(x + len * mx);
    const top = waterline - depth - Math.round(26 * scale * mh);
    for (let y = top; y < waterline - depth; y++) px.set(sx, y, P.mast);
    const sailH = Math.round(20 * scale * mh);
    for (let j = 0; j < sailH; j++) {
      const t = j / sailH;
      const reach = Math.round((6 + Math.sin(Math.PI * t) * 5) * scale * mh);
      for (let i = 1; i <= reach; i++) {
        const c = i === reach || j === 0 ? P.sailEdge : band(P.sail, (i / reach) * 0.6 + t * 0.4, sx + i, top + 2 + j);
        px.set(sx - i + 1 - Math.round(reach * 0.35), top + 2 + j, c);
      }
    }
    px.set(sx, top - 1, P.gold);
    px.set(sx + 1, top, P.banner);
    px.set(sx + 2, top, P.banner);
  }
}

// --- Buildings ------------------------------------------------------------------------------------

/** Window in a facade: an arched slit, lit warm now and then. */
function slit(px: Pixels, x: number, y: number, rand: () => number, w = 2, h = 4): void {
  const lit = rand() < 0.22;
  px.arch(x, y, w, h, lit ? P.lit : P.archDeep);
  if (lit) px.set(x, y + 1, P.litBright);
}

function banner(px: Pixels, x: number, y: number, h: number): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < 4; i++) {
      if (j === h - 1 && (i === 1 || i === 2)) continue; // a swallowtail
      px.set(x + i, y + j, j === 0 ? P.goldDark : i === 3 ? P.bannerDark : P.banner);
    }
  }
  px.set(x + 1, y + Math.floor(h / 2), P.gold);
  px.set(x + 2, y + Math.floor(h / 2), P.gold);
}

type Crown = "dome" | "goldDome" | "spire" | "onion";

function crown(px: Pixels, kind: Crown, cx: number, top: number, w: number): void {
  if (kind === "dome" || kind === "goldDome") {
    const gold = kind === "goldDome";
    const r = Math.ceil(w / 2) + 1;
    px.dome(cx, top, r, Math.round(r * 0.9), gold ? P.goldLight : P.pearl, gold ? P.gold : P.pearlMid, gold ? P.goldDark : P.pearlShade);
    const tip = top - Math.round(r * 0.9);
    for (let y = tip - 7; y < tip; y++) px.set(cx, y, P.gold);
    px.set(cx - 1, tip - 7, P.goldLight);
    px.set(cx + 1, tip - 7, P.goldLight);
  } else if (kind === "spire") {
    const h = Math.round(w * 2.2);
    for (let j = 0; j < h; j++) {
      const half = Math.round((w / 2 + 1) * (1 - j / h));
      for (let i = -half; i <= half; i++) {
        const edge = Math.abs(i) === half;
        px.set(cx + i, top - j, edge ? P.outline : j % 5 < 2 ? P.gold : i < 0 ? P.pearl : P.pearlMid);
      }
    }
    for (let y = top - h - 5; y < top - h; y++) px.set(cx, y, P.goldDark);
  } else {
    // An onion dome: swelling out, then drawn to a point.
    const r = Math.ceil(w / 2) + 2;
    for (let j = 0; j < r * 2; j++) {
      const t = j / (r * 2);
      const half = Math.round(r * Math.sin(Math.PI * Math.min(1, t * 1.35)) * (1 - t * 0.6));
      for (let i = -half; i <= half; i++) {
        const edge = Math.abs(i) === half;
        px.set(cx + i, top - j, edge ? P.outline : i < -half / 3 ? P.pearl : i < half / 3 ? P.pearlMid : P.pearlShade);
      }
    }
    for (let y = top - r * 2 - 5; y < top - r * 2; y++) px.set(cx, y, P.gold);
  }
}

/** A slender tower: shaded marble, gold bands, arched windows, and a crown. */
function tower(px: Pixels, x: number, base: number, w: number, h: number, kind: Crown, rand: () => number): void {
  const top = base - h;
  px.rect(x - 1, top, w + 2, h, P.outline);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const t = i / w;
      px.set(x + i, top + j, t < 0.2 ? P.marbleLight : t < 0.65 ? P.marble : P.marbleShade);
    }
  }
  for (let y = top + 6; y < base - 4; y += 22) {
    px.rect(x - 1, y, w + 2, 1, P.goldDark);
    px.rect(x - 1, y + 1, w + 2, 1, P.gold);
  }
  const cols = w >= 14 ? [Math.round(w * 0.28), Math.round(w * 0.62)] : [Math.round(w / 2) - 1];
  for (let y = top + 10; y < base - 8; y += 12) for (const c of cols) slit(px, x + c, y, rand);
  // A balcony ledge near the top.
  px.rect(x - 2, top + 3, w + 4, 2, P.marbleDeep);
  crown(px, kind, x + Math.floor(w / 2), top, w);
  if (rand() < 0.4) banner(px, x + (rand() < 0.5 ? 1 : w - 5), top + 8, 10 + Math.floor(rand() * 6));
}

/** A palace block: a facade of stacked arcades under a balustraded roof with small domes. */
function palace(px: Pixels, x: number, base: number, w: number, h: number, rand: () => number): void {
  const top = base - h;
  px.rect(x - 1, top - 1, w + 2, h + 1, P.outline);
  px.rect(x, top, w, h, P.marble);
  px.rect(x + w - Math.round(w * 0.18), top, Math.round(w * 0.18), h, P.marbleShade);
  px.rect(x, base - 4, w, 4, P.marbleDeep);
  px.rect(x, base - 5, w, 1, P.gold);
  // Arcades: rows of arches between columns, a cornice over each row.
  const rowH = 18;
  for (let y = top + 6; y + rowH <= base - 4; y += rowH) {
    px.rect(x, y - 2, w, 1, P.goldDark);
    px.rect(x, y - 1, w, 1, P.marbleLight);
    for (let ax = x + 3; ax + 7 <= x + w - 2; ax += 11) {
      const lit = rand() < 0.18;
      px.arch(ax, y + 2, 7, 13, lit ? P.lit : P.arch);
      px.arch(ax + 1, y + 6, 5, 9, lit ? P.litBright : P.archDeep);
      px.set(ax + 3, y + 1, P.gold); // keystone
    }
  }
  // Roof: a balustrade, and a little dome at each end.
  px.rect(x - 2, top - 3, w + 4, 2, P.marbleDeep);
  for (let bx = x - 1; bx < x + w + 1; bx += 3) px.rect(bx, top - 6, 1, 3, P.marbleLight);
  px.rect(x - 2, top - 7, w + 4, 1, P.marbleDeep);
  crown(px, "dome", x + 6, top - 7, 8);
  crown(px, rand() < 0.5 ? "goldDome" : "dome", x + w - 7, top - 7, 8);
}

/** An arched bridge between two buildings. */
function bridge(px: Pixels, x1: number, x2: number, y: number): void {
  px.rect(x1, y - 1, x2 - x1, 7, P.outline);
  px.rect(x1, y, x2 - x1, 5, P.marble);
  px.rect(x1, y, x2 - x1, 1, P.gold);
  for (let ax = x1 + 2; ax + 6 < x2; ax += 9) px.arch(ax, y + 5, 6, 9, P.arch);
  for (let ax = x1 + 1; ax < x2; ax += 9) px.rect(ax, y + 5, 2, 9, P.marbleShade);
}

/** The great palace: a colonnaded hall under a pediment, a drum and a great pearl dome. */
function greatPalace(px: Pixels, cx: number, base: number, rand: () => number): void {
  const w = 190;
  const h = 58;
  const x = cx - w / 2;
  const top = base - h;
  px.rect(x - 1, top - 1, w + 2, h + 1, P.outline);
  px.rect(x, top, w, h, P.marble);
  px.rect(x, base - 6, w, 6, P.marbleDeep);
  for (let s = 0; s < 3; s++) px.rect(x + 20 + s * 3, base - 6 + s * 2, w - 40 - s * 6, 2, P.marbleLight);
  // A deep portico with tall columns, lit from inside.
  px.rect(x + 8, top + 10, w - 16, h - 18, P.archDeep);
  for (let i = 0; i < 9; i++) slit(px, x + 16 + i * 19, top + 22, rand, 4, 10);
  for (let colX = x + 10; colX < x + w - 10; colX += 12) {
    px.rect(colX, top + 10, 5, h - 18, P.marbleLight);
    px.rect(colX + 3, top + 10, 2, h - 18, P.marbleShade);
    px.rect(colX - 1, top + 8, 7, 2, P.gold);
  }
  px.rect(x, top, w, 3, P.goldDark);
  px.rect(x, top + 3, w, 2, P.gold);
  // The pediment.
  const ph = 18;
  for (let j = 0; j < ph; j++) {
    const half = Math.round((w / 2 + 4) * (1 - j / ph));
    for (let i = -half; i <= half; i++) {
      const edge = Math.abs(i) === half || j === 0;
      px.set(cx + i, top - j, edge ? P.goldDark : j < 3 ? P.gold : P.marbleLight);
    }
  }
  for (let i = -5; i <= 5; i++) px.set(cx + i, top - 7, P.goldLight); // a trident-gold emblem
  for (let j = 5; j <= 10; j++) px.set(cx, top - j, P.goldLight);
  // The drum and the great dome.
  const drumTop = top - ph - 14;
  px.rect(cx - 42, drumTop - 1, 84, 16, P.outline);
  px.rect(cx - 41, drumTop, 82, 14, P.marble);
  for (let wx = cx - 36; wx < cx + 36; wx += 8) px.arch(wx, drumTop + 3, 4, 9, rand() < 0.4 ? P.lit : P.arch);
  px.rect(cx - 43, drumTop, 86, 2, P.gold);
  px.dome(cx, drumTop, 46, 34, P.pearl, P.pearlMid, P.pearlShade);
  // Gold ribs on the dome.
  for (const rib of [-0.55, 0, 0.55]) {
    for (let dy = 0; dy < 34; dy++) {
      const half = 46 * Math.sqrt(1 - (dy / 34) ** 2);
      px.set(cx + Math.round(rib * half), drumTop - dy, P.gold);
    }
  }
  px.rect(cx - 4, drumTop - 40, 9, 6, P.marbleLight); // the lantern the crystal floats above
  px.rect(cx - 5, drumTop - 41, 11, 1, P.gold);
}

// --- The quay and its reef ----------------------------------------------------------------------------

function quay(px: Pixels, top: number): void {
  for (let y = top; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const row = Math.floor((y - top) / 5);
      const lx = (x + (row % 2) * 8) % 16;
      const c = y === top ? P.marbleLight : (y - top) % 5 === 0 || lx === 0 ? P.quayJoint : y - top < 2 ? P.quay : P.quayShade;
      px.set(x, y, c);
    }
  }
  // A balustrade along the back of the quay.
  for (let x = 0; x < px.w; x += 4) px.rect(x, top - 4, 2, 4, P.marbleLight);
  px.rect(0, top - 5, px.w, 1, P.marbleDeep);
}

function lantern(px: Pixels, x: number, base: number): void {
  px.rect(x, base - 14, 1, 14, P.marbleDeep);
  px.rect(x - 2, base - 19, 5, 5, P.outline);
  px.rect(x - 1, base - 18, 3, 3, P.litBright);
  px.set(x, base - 20, P.gold);
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 2 && d < 5.5) px.set(x + dx, base - 17 + dy, P.lit, 0.18);
    }
  }
}

function kelp(px: Pixels, x: number, base: number, h: number, rand: () => number): void {
  const phase = rand() * 6;
  for (let j = 0; j < h; j++) {
    const sx = x + Math.round(Math.sin(j / 5 + phase) * 1.5);
    px.set(sx, base - j, j % 3 === 0 ? P.kelpDark : P.kelp);
    if (j % 6 === 3) {
      const side = (j / 6) % 2 < 1 ? 1 : -1;
      px.set(sx + side, base - j, P.kelp);
      px.set(sx + side * 2, base - j - 1, P.kelp);
    }
  }
}

/** A branching coral, drawn as a little tree of thick twigs. */
function coral(px: Pixels, x: number, base: number, size: number, light: RGB, dark: RGB, rand: () => number): void {
  const branch = (bx: number, by: number, angle: number, len: number, depth: number) => {
    for (let i = 0; i < len; i++) {
      const cx = bx + Math.sin(angle) * i;
      const cy = by - Math.cos(angle) * i;
      px.set(cx, cy, dark);
      px.set(cx - 1, cy, light);
    }
    if (depth <= 0) {
      px.set(bx + Math.sin(angle) * len - 1, by - Math.cos(angle) * len - 1, light);
      return;
    }
    const ex = bx + Math.sin(angle) * len;
    const ey = by - Math.cos(angle) * len;
    branch(ex, ey, angle - 0.45 - rand() * 0.3, len * 0.72, depth - 1);
    branch(ex, ey, angle + 0.45 + rand() * 0.3, len * 0.72, depth - 1);
  };
  branch(x, base, (rand() - 0.5) * 0.3, size, 3);
}

function tubes(px: Pixels, x: number, base: number, rand: () => number): void {
  const colors: Array<[RGB, RGB]> = [
    [P.coralPurple, P.coralPurpleDark],
    [P.coralOrange, P.coralOrangeDark],
    [P.coralPink, P.coralPinkDark],
  ];
  for (let t = 0; t < 4; t++) {
    const [light, dark] = colors[Math.floor(rand() * colors.length)];
    const tx = x + t * 3 - 4;
    const th = 4 + Math.floor(rand() * 6);
    px.rect(tx, base - th, 3, th, light);
    px.rect(tx + 2, base - th, 1, th, dark);
    px.rect(tx, base - th, 3, 1, P.goldLight);
  }
}

/** A sea fan: a flat lattice of fine branches spreading up from one stem. */
function seaFan(px: Pixels, x: number, base: number, size: number, light: RGB, dark: RGB): void {
  for (let j = 0; j < size; j++) {
    const half = Math.round(Math.sin((j / size) * Math.PI * 0.9) * size * 0.7);
    for (let i = -half; i <= half; i++) {
      const lattice = (i + j) % 3 === 0 || (i - j) % 3 === 0;
      if (!lattice && Math.abs(i) !== half) continue;
      px.set(x + i, base - j, Math.abs(i) === half || j === size - 1 ? dark : light);
    }
  }
  px.rect(x, base - 2, 1, 3, dark);
}

function fish(px: Pixels, x: number, y: number, c: RGB, flip: boolean): void {
  const s = flip ? -1 : 1;
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, -1],
    [1, 1],
    [-1, -1],
    [-1, 1],
  ]) {
    px.set(x + dx * s, y + dy, c);
  }
}

// --- The painting -----------------------------------------------------------------------------------

/** Paint the skyline, ``w`` x ``h``, with the sea's surface ``waterline`` pixels from the top. */
export function paintSkyline(w: number, h: number, waterline: number, cx: number): Uint8ClampedArray {
  const px = new Pixels(w, h);
  const rand = seededRandom(91);
  const quayTop = h - 18;
  const base = quayTop - 5;

  sky(px, waterline, rand);
  water(px, waterline);
  rays(px, waterline, rand);
  ship(px, Math.round(w * 0.1), waterline, 0.9);
  ship(px, Math.round(w * 0.27), waterline, 0.7);
  ship(px, Math.round(w * 0.78), waterline, 1.25); // the last ship

  // Far off: a haze of towers across the whole width.
  px.fog = 0.58;
  for (let x = -6; x < w; ) {
    const tw = 9 + Math.floor(rand() * 9);
    const centre = 1 - (Math.abs(x - cx) / (w / 2)) * 0.35;
    const th = Math.round((70 + rand() * 70) * centre);
    const kinds: Crown[] = ["dome", "spire", "onion", "goldDome"];
    tower(px, x, base - 10, tw, th, kinds[Math.floor(rand() * kinds.length)], rand);
    x += tw + 3 + Math.floor(rand() * 10);
  }
  for (let i = 0; i < 6; i++) fish(px, rand() * w, waterline + 20 + rand() * 60, P.marbleLight, rand() < 0.5);

  // Nearer: palaces either side, towers between them, bridges to the great palace.
  px.fog = 0.22;
  const left = [
    [18, 96, 74],
    [128, 84, 58],
    [226, 92, 86],
  ] as const;
  const right = [
    [w - 18 - 96, 96, 80],
    [w - 128 - 84, 84, 60],
    [w - 226 - 92, 92, 88],
  ] as const;
  for (const [x, pw, ph] of [...left, ...right]) palace(px, x, base, pw, ph, rand);
  for (const [x, th, kind] of [
    [112, 118, "spire"],
    [214, 104, "onion"],
    [322, 132, "goldDome"],
    [w - 112 - 14, 118, "spire"],
    [w - 214 - 14, 104, "onion"],
    [w - 322 - 14, 132, "goldDome"],
  ] as const) {
    tower(px, x, base, 14, th, kind, rand);
  }
  bridge(px, 336, cx - 98, base - 46);
  bridge(px, cx + 98, w - 336, base - 46);

  // The great palace in the middle, and two tall towers guarding it.
  px.fog = 0;
  tower(px, cx - 124, base, 18, 130, "spire", rand);
  tower(px, cx + 106, base, 18, 130, "spire", rand);
  greatPalace(px, cx, base, rand);

  // The quay: paving, a balustrade, lanterns, and reef along its edge.
  quay(px, quayTop);
  for (const lx of [60, 180, 300, cx - 70, cx + 70, w - 300, w - 180, w - 60]) lantern(px, lx, quayTop + 4);
  // A lush reef along the front of the quay, kept clear in front of the great palace's steps.
  for (let i = 0; i < 70; i++) {
    const x = Math.round(rand() * w);
    if (Math.abs(x - cx) < 70) continue;
    const kind = rand();
    if (kind < 0.25) kelp(px, x, h - 1, 16 + Math.floor(rand() * 22), rand);
    else if (kind < 0.42) coral(px, x, h - 1, 6 + rand() * 5, P.coralPink, P.coralPinkDark, rand);
    else if (kind < 0.54) coral(px, x, h - 1, 5 + rand() * 4, P.coralOrange, P.coralOrangeDark, rand);
    else if (kind < 0.64) coral(px, x, h - 1, 5 + rand() * 4, P.fanTeal, P.pearlShade, rand);
    else if (kind < 0.8) seaFan(px, x, h - 1, 9 + Math.floor(rand() * 7), rand() < 0.5 ? P.coralPurple : P.coralPink, rand() < 0.5 ? P.coralPurpleDark : P.coralPinkDark);
    else tubes(px, x, h - 1, rand);
  }
  for (let i = 0; i < 14; i++) {
    const colors = [P.coralOrange, P.goldLight, P.pearl, P.coralPink];
    fish(px, rand() * w, waterline + 12 + rand() * (base - waterline - 60), colors[i % colors.length], rand() < 0.5);
  }
  return px.data;
}
