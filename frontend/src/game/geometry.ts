/**
 * The shape of Atlantis, after Plato, seen from above at a slant: a central island and two rings
 * of land inside rings of water. Every ring is an ellipse ASPECT times wider than it is tall, so
 * "radius" below always means the horizontal half-width. The south avenue is a grand stair that
 * runs from the island down through the rings and over the cliff to the Sea Gate; the east and
 * west avenues bridge the canals.
 *
 *   island            r < 220        the Council and the Bank (cream marble)
 *   inner canal       220 to 244
 *   middle ring       244 to 380     road at r = 312: Market, Exchange, Guild Hall (sandstone)
 *   middle canal      380 to 404
 *   outer ring        r > 404        road at r = 458: tavern, circle, Black Reef (mossy stone)
 *   the cliff         y = SEA_Y      the city wall drops into the open sea
 *
 * Angles are in degrees, screen style: 0 is east, 90 is south, -90 is north.
 */

export const WORLD_W = 1024;
export const WORLD_H = 704;
export const CX = 512;
export const CY = 262;
export const ASPECT = 1.6;

export const ISLAND_R = 220;
export const CANALS: ReadonlyArray<readonly [number, number]> = [
  [220, 244],
  [380, 404],
];
export const RING_ROADS = [312, 458] as const;
/** Nothing past this radius is walkable (the outer ring fades into the edge of the map). */
export const OUTER_EDGE = 500;
export const ROAD_HALF = 9;
/** Half-width of the grand stair (south) and half-height of the east/west avenues. */
export const STAIR_HALF = 18;
export const AVENUE_HALF = 9;
export const RIM = 4;

/** The cliff's top edge and the sea below it. */
export const SEA_Y = 604;
export const CLIFF_H = 14;
/** The Sea Gate: a glowing pool at the foot of the stair. */
export const GATE = { x: CX, y: 662, halfW: 26, halfH: 18 } as const;

export type Ground =
  | "plaza"
  | "sandstone"
  | "stone"
  | "road"
  | "bridge"
  | "stair"
  | "rim"
  | "water"
  | "cliff"
  | "sea"
  | "gate";

export interface Point {
  x: number;
  y: number;
}

export const toRad = (deg: number) => (deg * Math.PI) / 180;

export function polar(r: number, deg: number): Point {
  return { x: CX + r * Math.cos(toRad(deg)), y: CY + (r * Math.sin(toRad(deg))) / ASPECT };
}

export function radiusOf(p: Point): number {
  return Math.hypot(p.x - CX, (p.y - CY) * ASPECT);
}

export function angleOf(p: Point): number {
  return (Math.atan2((p.y - CY) * ASPECT, p.x - CX) * 180) / Math.PI;
}

/** The grand stair: straight down from the island to the Sea Gate. */
export function onStair(x: number, y: number): boolean {
  return Math.abs(x - CX) < STAIR_HALF && y > CY && y < GATE.y - GATE.halfH;
}

/** What lies at a world pixel. Pure and cheap: the ground texture calls it for every pixel. */
export function groundAt(x: number, y: number): Ground {
  const dx = x - CX;
  const dy = y - CY;
  if (Math.abs(dx) < GATE.halfW && Math.abs(y - GATE.y) < GATE.halfH) return "gate";
  if (y >= SEA_Y) return onStair(x, y) ? "stair" : "sea";
  const r = Math.sqrt(dx * dx + dy * dy * ASPECT * ASPECT);
  if (r < ISLAND_R) return "plaza";
  const stair = onStair(x, y);
  const avenue = Math.abs(dy) < AVENUE_HALF && r < OUTER_EDGE;
  for (const [inner, outer] of CANALS) {
    if (r >= inner && r < outer) {
      if (stair || avenue) return "bridge";
      return r < inner + RIM || r >= outer - RIM ? "rim" : "water";
    }
  }
  if (y >= SEA_Y - CLIFF_H) return stair ? "stair" : "cliff";
  if (stair) return "stair";
  if (avenue) return "road";
  for (const road of RING_ROADS) if (Math.abs(r - road) < ROAD_HALF) return "road";
  return r < CANALS[1][0] ? "sandstone" : "stone";
}

/** Half the road's height at a given angle: a ring road looks taller where it runs north-south. */
function roadHalfHeight(deg: number): number {
  return ROAD_HALF / Math.max(0.4, ASPECT * Math.abs(Math.sin(toRad(deg))));
}

/** A foot position just north of a ring road at ``deg`` (sprites extend upward from their foot). */
export function northOfRoad(road: number, deg: number, gap = 2): Point {
  const p = polar(road, deg);
  return { x: Math.round(p.x), y: Math.round(p.y - roadHalfHeight(deg) - gap) };
}

/** A foot position just south of a ring road, for a sprite of the given height. */
export function southOfRoad(road: number, deg: number, height: number, gap = 2): Point {
  const p = polar(road, deg);
  return { x: Math.round(p.x), y: Math.round(p.y + roadHalfHeight(deg) + gap + height) };
}
