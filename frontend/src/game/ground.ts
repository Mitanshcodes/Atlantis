/**
 * Paints the whole seabed into one texture, pixel by pixel, so the rings, roads and canals get
 * clean pixel-art curves instead of 16px staircases. Sand, pavers and the plaza are sampled from
 * the Greek terrain tiles; the canals are glowing turquoise water with marble rims.
 *
 * Also makes a half-size mask of the water, used to clip the moving shimmer to the canals.
 */

import Phaser from "phaser";
import { GENERATED, TERRAIN, TILE } from "./assets";
import { AVENUE_HALF, CANALS, CX, CY, RIM, WORLD, groundAt, type Ground } from "./geometry";
import { hash2 } from "./random";

type RGB = readonly [number, number, number];

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

const COLORS = {
  outline: hex(0x23324a),
  marble: hex(0xeae2c9),
  marbleShade: hex(0xc9bfa2),
  waterDeep: hex(0x0f6f9a),
  waterShadow: hex(0x158aa8),
  water: hex(0x2ec6cc),
  waterBright: hex(0x4fe0d6),
  glint: hex(0xc4fff6),
} as const;

const MASK_SCALE = 2;

/** Read the terrain sheet's pixels so we can sample tiles from it. */
function terrainPixels(scene: Phaser.Scene): { data: Uint8ClampedArray; width: number } {
  const source = scene.textures.get("terrain").getSourceImage() as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  return { data: ctx.getImageData(0, 0, source.width, source.height).data, width: source.width };
}

export function drawGround(scene: Phaser.Scene): void {
  const terrain = terrainPixels(scene);
  const columns = terrain.width / TILE;
  const texture = scene.textures.createCanvas(GENERATED.ground, WORLD, WORLD)!;
  const ctx = texture.getContext();
  const image = ctx.createImageData(WORLD, WORLD);
  const out = image.data;

  const maskSize = WORLD / MASK_SCALE;
  const maskTexture = scene.textures.createCanvas(GENERATED.waterMask, maskSize, maskSize)!;
  const maskCtx = maskTexture.getContext();
  const mask = maskCtx.createImageData(maskSize, maskSize);

  const sample = (tile: number, x: number, y: number, o: number) => {
    const sx = (tile % columns) * TILE + (x & 15);
    const sy = Math.floor(tile / columns) * TILE + (y & 15);
    const i = (sy * terrain.width + sx) * 4;
    out[o] = terrain.data[i];
    out[o + 1] = terrain.data[i + 1];
    out[o + 2] = terrain.data[i + 2];
    out[o + 3] = 255;
  };
  const paint = (c: RGB, o: number) => {
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = 255;
  };

  const sandTile = (cx: number, cy: number) => {
    const h = hash2(cx, cy, 7);
    return h % 100 < 9 ? TERRAIN.sandVariants[h % TERRAIN.sandVariants.length] : TERRAIN.sand;
  };

  // Pass 1: classify every pixel (kept for the outline pass).
  const kinds = new Uint8Array(WORLD * WORLD);
  const KIND: Record<Ground, number> = { sand: 0, road: 1, bridge: 2, plaza: 3, rim: 4, water: 5 };
  for (let y = 0; y < WORLD; y++) {
    for (let x = 0; x < WORLD; x++) kinds[y * WORLD + x] = KIND[groundAt(x, y)];
  }
  const kindAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= WORLD || y >= WORLD ? KIND.sand : kinds[y * WORLD + x];
  const edgeOf = (x: number, y: number, k: number, against: (n: number) => boolean) =>
    k !== kindAt(x, y) ? false : against(kindAt(x - 1, y)) || against(kindAt(x + 1, y)) || against(kindAt(x, y - 1)) || against(kindAt(x, y + 1));

  // Pass 2: colour.
  for (let y = 0; y < WORLD; y++) {
    for (let x = 0; x < WORLD; x++) {
      const o = (y * WORLD + x) * 4;
      const k = kinds[y * WORLD + x];
      const cellX = x >> 4;
      const cellY = y >> 4;
      if (k === KIND.sand) {
        sample(sandTile(cellX, cellY), x, y, o);
      } else if (k === KIND.road || k === KIND.bridge) {
        if (edgeOf(x, y, k, (n) => n === KIND.sand)) {
          paint(COLORS.outline, o);
          continue;
        }
        if (k === KIND.bridge) {
          // Marble railings along the bridge's sides.
          const vertical = Math.abs(x - CX) < AVENUE_HALF;
          const toSide = AVENUE_HALF - Math.abs(vertical ? x - CX : y - CY);
          if (toSide <= 1) {
            paint(COLORS.outline, o);
            continue;
          }
          if (toSide <= 4) {
            paint(toSide === 2 ? COLORS.marbleShade : COLORS.marble, o);
            continue;
          }
        }
        sample(TERRAIN.paverLight, x, y, o);
      } else if (k === KIND.plaza) {
        const r = Math.hypot(x - CX, y - CY);
        const ring = (r > 196 && r < 214) || r < 40;
        const tile = ring
          ? TERRAIN.paverLight
          : hash2(cellX, cellY, 3) % 7 === 0
            ? TERRAIN.paverOrangeAlt
            : TERRAIN.paverOrange;
        sample(tile, x, y, o);
      } else if (k === KIND.rim) {
        const edge = edgeOf(x, y, k, (n) => n !== KIND.rim && n !== KIND.bridge);
        paint(edge ? COLORS.outline : hash2(x >> 2, y >> 2, 9) % 9 === 0 ? COLORS.marbleShade : COLORS.marble, o);
      } else {
        const r = Math.hypot(x - CX, y - CY);
        const [inner, outer] = CANALS.find(([i, o2]) => r >= i && r < o2)!;
        const depth = r - inner - RIM; // distance from the inner (shaded) bank
        const t = depth / (outer - inner - 2 * RIM);
        let c: RGB = COLORS.water;
        if (depth < 3) c = COLORS.waterShadow;
        else if (t < 0.12 || t > 0.9) c = COLORS.waterDeep;
        else if (t > 0.32 && t < 0.68) c = COLORS.waterBright;
        if (hash2(x >> 3, y, 5) % 29 === 0 && (x & 7) < 4) c = COLORS.glint;
        paint(c, o);
        if ((x & 1) === 0 && (y & 1) === 0) mask.data[((y >> 1) * maskSize + (x >> 1)) * 4 + 3] = 255;
      }
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
