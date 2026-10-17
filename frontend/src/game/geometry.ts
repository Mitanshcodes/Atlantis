/**
 * The shape of Atlantis, after Plato: a central island and two rings of land inside three rings
 * of water, joined by four avenues (north, east, south, west) that bridge the inner two canals.
 * A ring road runs around the middle of each land ring. The outer canal is the city's moat.
 *
 *   island            r < 250        the Council and the Bank
 *   inner canal       250 to 306
 *   middle ring       306 to 660     road at r = 470: Market, Exchange, Guild Hall
 *   middle canal      660 to 716
 *   outer ring        716 to 1040    road at r = 878: tavern, circle, Black Reef
 *   the moat          1040 to 1096
 *   the wilds         r > 1096       kelp forests and wrecks; scenery only
 *
 * Angles are in degrees, screen style: 0 is east, 90 is south, -90 is north.
 */

export const WORLD = 2240;
export const CX = WORLD / 2;
export const CY = WORLD / 2;

export const ISLAND_R = 250;
export const CANALS: ReadonlyArray<readonly [number, number]> = [
  [250, 306],
  [660, 716],
  [1040, 1096],
];
export const RING_ROADS = [470, 878] as const;
export const OUTER_EDGE = 1040;
export const ROAD_HALF = 16;
export const AVENUE_HALF = 16;
export const RIM = 6;

export type Ground = "plaza" | "road" | "bridge" | "rim" | "water" | "sand";

export interface Point {
  x: number;
  y: number;
}

export const toRad = (deg: number) => (deg * Math.PI) / 180;

export function polar(r: number, deg: number): Point {
  return { x: CX + r * Math.cos(toRad(deg)), y: CY + r * Math.sin(toRad(deg)) };
}

export function radiusOf(p: Point): number {
  return Math.hypot(p.x - CX, p.y - CY);
}

export function angleOf(p: Point): number {
  return (Math.atan2(p.y - CY, p.x - CX) * 180) / Math.PI;
}

/** What lies at a world pixel. Pure and cheap: the ground texture calls it for every pixel. */
export function groundAt(x: number, y: number): Ground {
  const dx = x - CX;
  const dy = y - CY;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r < ISLAND_R) return "plaza";
  const onAvenue = (Math.abs(dx) < AVENUE_HALF || Math.abs(dy) < AVENUE_HALF) && r < OUTER_EDGE;
  for (const [inner, outer] of CANALS) {
    if (r >= inner && r < outer) {
      if (onAvenue) return "bridge";
      return r < inner + RIM || r >= outer - RIM ? "rim" : "water";
    }
  }
  if (onAvenue) return "road";
  for (const road of RING_ROADS) if (Math.abs(r - road) < ROAD_HALF) return "road";
  return "sand";
}

/** Which walkable level a point belongs to: 0 the island, 1 the middle ring, 2 the outer ring and beyond. */
export function levelOf(r: number): 0 | 1 | 2 {
  if (r < (CANALS[0][0] + CANALS[0][1]) / 2) return 0;
  if (r < (CANALS[1][0] + CANALS[1][1]) / 2) return 1;
  return 2;
}

/** Half the road's height at a given angle: a ring road looks taller where it runs east-west. */
function roadHalfHeight(deg: number): number {
  return ROAD_HALF / Math.max(0.5, Math.abs(Math.sin(toRad(deg))));
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
