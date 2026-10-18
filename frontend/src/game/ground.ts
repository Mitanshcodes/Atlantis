/**
 * Paints the whole city floor into one texture, pixel by pixel, so the rings, canals and stair get
 * clean pixel-art curves in one hand-picked palette: cream marble on the island, sandstone bricks
 * on the middle ring, mossy grey-green stone on the outer ring, teal canals with marble rims, and
 * the dark sea below the city wall.
 *
 * Also makes a half-size mask of the water, used to clip the moving shimmer to the canals.
 */

import Phaser from "phaser";
import { GENERATED } from "./assets";
import {
  ASPECT,
  AVENUE_HALF,
  CANALS,
  CLIFF_H,
  CX,
  CY,
  GATE,
  ISLAND_R,
  RIM,
  SEA_Y,
  STAIR_HALF,
  TERRACE_WALL,
  TERRACE_Y,
  WORLD_H,
  WORLD_W,
  groundAt,
  type Ground,
} from "./geometry";
import { hash2 } from "./random";

type RGB = readonly [number, number, number];

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

/** One palette for the whole floor. Each surface has a base, a light, a shade and a joint. */
const C = {
  outline: hex(0x1a2a33),

  marble: hex(0xe9dcba),
  marbleLight: hex(0xf6eed8),
  marbleShade: hex(0xd5c49b),
  marbleJoint: hex(0xbfae86),
  inlay: hex(0xd9a84c),
  inlayLight: hex(0xf2cd6e),

  sand: hex(0xd8ac5e),
  sandAlt: hex(0xe0b86c),
  sandLight: hex(0xeccb85),
  sandShade: hex(0xc49650),
  sandJoint: hex(0xa97c3e),

  path: hex(0xeee2c2),
  pathShade: hex(0xd8c9a2),
  pathEdge: hex(0xa88550),

  stone: hex(0x6f8b81),
  stoneAlt: hex(0x77938a),
  stoneLight: hex(0x86a297),
  stoneShade: hex(0x5f7a71),
  stoneJoint: hex(0x4d665f),
  moss: hex(0x67894c),
  mossLight: hex(0x7c9f57),
  mossDark: hex(0x587a47),

  cliff: hex(0x3f5956),
  cliffLight: hex(0x56726c),
  cliffJoint: hex(0x2b3f3e),

  waterDeep: hex(0x115a6c),
  waterShadow: hex(0x15707f),
  water: hex(0x1d8d9b),
  waterBright: hex(0x29a8b0),
  glint: hex(0x9ee8df),

  sea: hex(0x1f6f86),
  seaAlt: hex(0x22778d),
  seaLight: hex(0x2c8799),
  seaSand: hex(0x3a95a0),

  step: hex(0xf1e8d0),
  stepRiser: hex(0xc8b88f),
  rail: hex(0xd3c5a0),

  gate: hex(0x55e0dc),
  gateLight: hex(0xb6fff6),
  gateDeep: hex(0x23b7c0),
} as const;

const MASK_SCALE = 2;


const KIND: Record<Ground, number> = {
  plaza: 0,
  sandstone: 1,
  stone: 2,
  road: 3,
  bridge: 4,
  stair: 5,
  rim: 6,
  water: 7,
  cliff: 8,
  sea: 9,
  gate: 10,
  terrace: 11,
  terraceWall: 12,
};
const LAND = new Set([KIND.plaza, KIND.sandstone, KIND.stone, KIND.road]);

/** Smooth value noise in [0, 1): blobs about ``cell`` pixels across. */
function noise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const v = (i: number, j: number) => (hash2(gx + i, gy + j, seed) & 0xffff) / 0x10000;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

/** Where a pixel falls in a running-bond brick wall of ``w`` x ``h`` bricks. */
function brick(x: number, y: number, w: number, h: number) {
  const row = Math.floor(y / h);
  const shifted = x + (row & 1 ? w >> 1 : 0);
  const col = Math.floor(shifted / w);
  return { lx: ((shifted % w) + w) % w, ly: ((y % h) + h) % h, id: hash2(col, row, 41) };
}

/** A brick surface: joints, a lit top row, a shaded bottom row, and a few odd bricks. */
function brickColor(
  x: number,
  y: number,
  w: number,
  h: number,
  base: RGB,
  alt: RGB,
  light: RGB,
  shade: RGB,
  joint: RGB,
): RGB {
  const b = brick(x, y, w, h);
  if (b.lx === 0 || b.ly === 0) return joint;
  if (b.ly === 1) return light;
  if (b.ly === h - 1 || b.lx === w - 1) return shade;
  return b.id % 5 === 0 ? alt : base;
}

export function drawGround(scene: Phaser.Scene): void {
  const texture = scene.textures.createCanvas(GENERATED.ground, WORLD_W, WORLD_H)!;
  const ctx = texture.getContext();
  const image = ctx.createImageData(WORLD_W, WORLD_H);
  const out = image.data;

  const maskW = WORLD_W / MASK_SCALE;
  const maskH = WORLD_H / MASK_SCALE;
  const maskTexture = scene.textures.createCanvas(GENERATED.waterMask, maskW, maskH)!;
  const maskCtx = maskTexture.getContext();
  const mask = maskCtx.createImageData(maskW, maskH);

  // Pass 1: classify every pixel (kept for the outline pass).
  const kinds = new Uint8Array(WORLD_W * WORLD_H);
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) kinds[y * WORLD_W + x] = KIND[groundAt(x, y)];
  }
  const kindAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H ? KIND.stone : kinds[y * WORLD_W + x];
  const touches = (x: number, y: number, test: (k: number) => boolean) =>
    test(kindAt(x - 1, y)) || test(kindAt(x + 1, y)) || test(kindAt(x, y - 1)) || test(kindAt(x, y + 1));

  const plazaColor = (x: number, y: number): RGB => {
    const r = Math.hypot(x - CX, (y - CY) * ASPECT);
    // A gold inlay ring and a lighter band inside it, like the reference's mosaic plaza.
    if (r > ISLAND_R - 46 && r < ISLAND_R - 40) return (x + y) & 2 ? C.inlay : C.inlayLight;
    if (r > ISLAND_R - 40 && r < ISLAND_R - 37) return C.marbleShade;
    const c = brickColor(x, y, 16, 8, C.marble, C.marbleLight, C.marbleLight, C.marbleShade, C.marbleJoint);
    if (c === C.marble && hash2(x, y, 3) % 61 === 0) return C.marbleShade;
    return c;
  };

  const sandColor = (x: number, y: number): RGB => {
    const c = brickColor(x, y, 12, 6, C.sand, C.sandAlt, C.sandLight, C.sandShade, C.sandJoint);
    // Worn patches where the bricks are paler.
    if (c === C.sand && noise(x, y, 24, 5) > 0.68) return C.sandAlt;
    return c;
  };

  const stoneColor = (x: number, y: number): RGB => {
    // Moss creeps along the joints first, then over whole bricks in small dithered patches.
    const m = noise(x, y, 16, 9) * 0.75 + noise(x, y, 5, 19) * 0.25;
    const c = brickColor(x, y, 14, 7, C.stone, C.stoneAlt, C.stoneLight, C.stoneShade, C.stoneJoint);
    if (m > 0.74) return m > 0.8 && (x + y) % 3 !== 0 ? C.mossLight : C.moss;
    if (m > 0.69 && (x + y) % 2 === 0) return C.mossDark;
    if (m > 0.58 && c === C.stoneJoint) return C.mossDark;
    return c;
  };

  const pathColor = (x: number, y: number, k: number): RGB => {
    if (touches(x, y, (n) => n === KIND.sandstone || n === KIND.stone || n === KIND.plaza)) return C.pathEdge;
    if (k === KIND.bridge) {
      // The grand stair carries on over its bridges; the east and west bridges get railings.
      if (Math.abs(x - CX) < STAIR_HALF) return stairColor(x, y);
      const toSide = AVENUE_HALF - Math.abs(y - CY);
      if (toSide <= 1) return C.outline;
      if (toSide <= 3) return toSide === 2 ? C.rail : C.marbleLight;
    }
    const b = brick(x, y, 8, 4);
    if (b.lx === 0 || b.ly === 0) return C.pathShade;
    return C.path;
  };

  const stairColor = (x: number, y: number): RGB => {
    const side = STAIR_HALF - Math.abs(x - CX);
    if (side <= 1) return C.outline;
    if (side <= 4) return side === 2 ? C.stepRiser : C.rail;
    const t = (y - CY) % 5;
    if (t === 4) return C.stepRiser;
    if (t === 0) return C.marbleLight;
    return C.step;
  };

  const waterColor = (x: number, y: number): RGB => {
    const r = Math.hypot(x - CX, (y - CY) * ASPECT);
    const [inner, outer] = CANALS.find(([i, o]) => r >= i && r < o)!;
    // In this slanted view the far bank's wall shades the water on its north side.
    const north = y < CY;
    const fromBank = north ? outer - RIM - r : r - inner - RIM;
    const t = (r - inner - RIM) / (outer - inner - 2 * RIM);
    let c: RGB = C.water;
    if (fromBank < 3) c = C.waterDeep;
    else if (fromBank < 5) c = C.waterShadow;
    else if (t > 0.4 && t < 0.62) c = C.waterBright;
    if (hash2(x >> 3, y, 5) % 23 === 0 && (x & 7) < 4) c = C.glint;
    return c;
  };

  const seaColor = (x: number, y: number): RGB => {
    const d = y - SEA_Y;
    if (d < 3) return C.cliffJoint; // the wall's shadow on the water
    const n = noise(x, y, 18, 17);
    if (n > 0.7) return C.seaSand;
    if (n > 0.6 && (x + y) % 2 === 0) return C.seaLight;
    return (x >> 1) % 2 === (y >> 1) % 2 && d < 14 ? C.seaAlt : C.sea;
  };

  /** The skyline terrace (the painting in skylineArt.ts covers it): pale flagstones, a gold inlay. */
  const terraceColor = (x: number, y: number): RGB => {
    const fromEdge = TERRACE_Y - TERRACE_WALL - y;
    if (fromEdge === 9 || fromEdge === 10) return (x >> 1) % 3 === 0 ? C.inlayLight : C.inlay;
    const c = brickColor(x, y, 20, 10, C.marble, C.marbleLight, C.marbleLight, C.marbleShade, C.marbleJoint);
    if (c === C.marble && hash2(x, y, 23) % 47 === 0) return C.marbleShade;
    return c;
  };

  /** The terrace's retaining wall: a lit coping, then courses of stone down to its shadow. */
  const terraceWallColor = (x: number, y: number): RGB => {
    const d = y - (TERRACE_Y - TERRACE_WALL);
    if (d === 0) return C.outline;
    if (d < 3) return C.marbleLight;
    if (d === 3) return C.marbleJoint;
    if (d === TERRACE_WALL - 1) return C.outline;
    return brickColor(x, y, 12, 4, C.marbleShade, C.marble, C.marble, C.marbleJoint, C.marbleJoint);
  };

  const cliffColor = (x: number, y: number): RGB => {
    const d = y - (SEA_Y - CLIFF_H);
    if (d === 0) return C.outline;
    if (d < 3) return C.stoneLight; // the coping along the top of the wall
    if (d === 3) return C.cliffJoint;
    return brickColor(x, y, 10, 5, C.cliff, C.cliffLight, C.cliffLight, C.cliffJoint, C.cliffJoint);
  };

  const gateColor = (x: number, y: number): RGB => {
    const dx = Math.abs(x - GATE.x);
    const dy = Math.abs(y - GATE.y);
    if (GATE.halfW - dx <= 1 || GATE.halfH - dy <= 1) return C.outline;
    if (GATE.halfW - dx <= 4 || GATE.halfH - dy <= 4) return C.marble;
    const ripple = (Math.hypot(dx, dy * 1.4) + 0.5) % 7;
    if (ripple < 1) return C.gateLight;
    return dy < 6 && dx < 10 ? C.gateLight : ripple < 3 ? C.gate : C.gateDeep;
  };

  // Pass 2: colour.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const k = kinds[y * WORLD_W + x];
      let c: RGB;
      switch (k) {
        case KIND.plaza:
          c = touches(x, y, (n) => n === KIND.rim) ? C.outline : plazaColor(x, y);
          break;
        case KIND.sandstone:
          c = sandColor(x, y);
          break;
        case KIND.stone:
          c = stoneColor(x, y);
          break;
        case KIND.road:
        case KIND.bridge:
          c = touches(x, y, (n) => n === KIND.rim || n === KIND.water) ? C.outline : pathColor(x, y, k);
          break;
        case KIND.stair:
          c = stairColor(x, y);
          break;
        case KIND.rim:
          c = touches(x, y, (n) => LAND.has(n) || n === KIND.cliff)
            ? C.outline
            : hash2(x >> 2, y >> 2, 9) % 7 === 0
              ? C.marbleShade
              : C.marbleLight;
          break;
        case KIND.water:
          c = touches(x, y, (n) => n === KIND.rim) && y > CY ? C.waterDeep : waterColor(x, y);
          break;
        case KIND.cliff:
          c = cliffColor(x, y);
          break;
        case KIND.terrace:
          c = terraceColor(x, y);
          break;
        case KIND.terraceWall:
          c = terraceWallColor(x, y);
          break;
        case KIND.gate:
          c = gateColor(x, y);
          break;
        default:
          c = seaColor(x, y);
      }
      const o = (y * WORLD_W + x) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
      const wet = k === KIND.water || k === KIND.gate;
      if (wet && (x & 1) === 0 && (y & 1) === 0) mask.data[((y >> 1) * maskW + (x >> 1)) * 4 + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  texture.refresh();
  maskCtx.putImageData(mask, 0, 0);
  maskTexture.refresh();
}

/** Sparse light dashes that scroll over the canals, clipped by the water mask. */
export function drawGlints(scene: Phaser.Scene): void {
  const size = 64;
  const texture = scene.textures.createCanvas(GENERATED.glints, size, size)!;
  const ctx = texture.getContext();
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 14; i++) {
    const h = hash2(i, 0, 31);
    ctx.fillRect(h % size, (h >> 8) % size, 2 + ((h >> 16) % 4), 1);
  }
  texture.refresh();
}

export const WATER_MASK_SCALE = MASK_SCALE;
