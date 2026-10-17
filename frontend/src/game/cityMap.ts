/**
 * What stands in the city besides the buildings, and how the player walks between places.
 *
 * Decor is either placed by hand (the island's rostrum, the bridge gates, wrecks in the wilds) or
 * placed by a seeded search that only accepts spots on open sand, so houses and kelp never land
 * on a road, a canal or a building. Walking follows the ring roads and the four avenues.
 */

import { frameRect, type PlacedSprite, type SpriteRef } from "./assets";
import { BUILDINGS } from "./buildings";
import {
  CANALS,
  CX,
  CY,
  ISLAND_R,
  OUTER_EDGE,
  RING_ROADS,
  WORLD,
  angleOf,
  groundAt,
  levelOf,
  northOfRoad,
  polar,
  radiusOf,
  southOfRoad,
  type Point,
} from "./geometry";
import { seededRandom } from "./random";

export const WORLD_W = WORLD;
export const WORLD_H = WORLD;
export const PLAYER_START: Point = { x: CX, y: CY + 120 };

/** Decor sprite; ``sway`` ones move in the current (kelp, anemones). */
export type Decor = PlacedSprite & { sway?: boolean };

const AVENUES = [-90, 0, 90, 180] as const;

// --- Hand-placed decor ----------------------------------------------------------------------------

const p = (pt: Point) => ({ x: Math.round(pt.x), y: Math.round(pt.y) });

/** Columns either side of each avenue where it meets a canal, and where it ends at the moat. */
function gateColumns(): Decor[] {
  const gates: Decor[] = [];
  const radii = [ISLAND_R - 10, CANALS[0][1] + 12, CANALS[1][0] - 10, CANALS[1][1] + 12, OUTER_EDGE - 10];
  for (const deg of AVENUES) {
    const vertical = deg === -90 || deg === 90;
    const offset = (c: Point, side: number) => (vertical ? { x: c.x + side, y: c.y } : { x: c.x, y: c.y + side });
    for (const r of radii) {
      for (const side of [-28, 28]) {
        const at = offset(polar(r, deg), side);
        gates.push({ sheet: "greek", frame: "column", ...p({ x: at.x, y: at.y + 10 }) });
      }
    }
  }
  return gates;
}

export const FIXED_DECOR: Decor[] = [
  // The island: the Herald's rostrum to the south-west, a coral garden to the south-east.
  { sheet: "greek", frame: "platform", x: CX - 120, y: CY + 176 },
  { sheet: "greek", frame: "column", x: CX - 192, y: CY + 150 },
  { sheet: "greek", frame: "column", x: CX - 48, y: CY + 176 },
  { sheet: "vegetation", frame: "coralTableBig", x: CX + 118, y: CY + 186 },
  { sheet: "vegetation", frame: "coralTubes", x: CX + 168, y: CY + 150 },
  { sheet: "vegetation", frame: "coralTubesAlt", x: CX + 64, y: CY + 154 },
  { sheet: "vegetation", frame: "anemone", x: CX + 150, y: CY + 196, sway: true },
  { sheet: "greek", frame: "amphora", x: CX + 196, y: CY + 116 },
  { sheet: "greek", frame: "potFlowers", x: CX - 180, y: CY + 60 },
  { sheet: "greek", frame: "potPlant", x: CX + 180, y: CY + 60 },
  ...gateColumns(),
  // The wilds beyond the moat. North-east: the old city the Black Reef grew out of.
  { sheet: "ruins", frame: "colonnade", ...p(polar(1260, -45)) },
  { sheet: "ruins", frame: "pillarMossy", ...p(polar(1300, -40)) },
  { sheet: "ruins", frame: "columnsFallen", ...p(polar(1200, -30)) },
  { sheet: "ruins", frame: "crackedSlab", ...p(polar(1150, -60)) },
  // North-west wilds: lost treasure.
  { sheet: "treasure", frame: "chestGold", ...p(polar(1300, -135)) },
  { sheet: "ruins", frame: "pillar", ...p(polar(1180, -152)) },
  { sheet: "treasure", frame: "anchor", ...p(polar(1180, -118)) },
  // South-east wilds.
  { sheet: "treasure", frame: "anchorMossy", ...p(polar(1250, 45)) },
  { sheet: "treasure", frame: "barrelBig", ...p(polar(1200, 56)) },
  { sheet: "treasure", frame: "barrel", ...p(polar(1230, 60)) },
  { sheet: "ruins", frame: "columnsFallen", ...p(polar(1200, 35)) },
  // South-west wilds: a wreck that never made it out.
  { sheet: "wreck", frame: "hullBuried", ...p(polar(1300, 135)) },
  { sheet: "treasure", frame: "barrel", ...p(polar(1240, 128)) },
  { sheet: "treasure", frame: "wheel", ...p(polar(1150, 120)) },
  { sheet: "treasure", frame: "chestClosed", ...p(polar(1190, 148)) },
];

// --- Seeded placement -----------------------------------------------------------------------------

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function spriteBox(ref: SpriteRef, x: number, y: number, margin = 0): Box {
  const [, , w, h] = frameRect(ref);
  return { x1: x - w / 2 - margin, y1: y - h - margin, x2: x + w / 2 + margin, y2: y + margin };
}

const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

/** Every sampled point of the box is open sand inside the world. */
function onOpenSand(box: Box, step = 8): boolean {
  if (box.x1 < 0 || box.y1 < 0 || box.x2 > WORLD || box.y2 > WORLD) return false;
  for (let y = box.y1; y <= box.y2; y += step) {
    for (let x = box.x1; x <= box.x2; x += step) {
      if (groundAt(x, y) !== "sand") return false;
    }
  }
  return groundAt(box.x2, box.y2) === "sand" && groundAt(box.x1, box.y2) === "sand";
}

function initialBlockers(): Box[] {
  return [
    ...BUILDINGS.flatMap((b) => [
      ...b.sprites.map((s) => spriteBox(s, s.x, s.y, 6)),
      { x1: b.door.x - 20, y1: b.door.y - 24, x2: b.door.x + 20, y2: b.door.y + 12 },
    ]),
    ...FIXED_DECOR.map((d) => spriteBox(d, d.x, d.y, 4)),
  ];
}

const HOUSES = (
  [
    "houseSlantBlue",
    "houseSmallRed",
    "houseLGreen",
    "houseBalconyRed",
    "houseTinyRed",
    "houseSlantGreen",
    "houseWideGreen",
    "houseSmallBlue",
    "houseSlantRed",
    "houseLRed",
    "houseLBlue",
  ] as const
).map((frame): SpriteRef => ({ sheet: "greek", frame }));

const HOUSE_GAPS = [4, 10, 18, 28, 40];

/** Homes lining both ring roads, wherever a house fits on open sand. */
function placeHouses(blockers: Box[], seed = 23): Decor[] {
  const rand = seededRandom(seed);
  const placed: Decor[] = [];
  for (const road of RING_ROADS) {
    const step = road === RING_ROADS[0] ? 11 : 7;
    for (let deg = -180; deg < 180; deg += step) {
      for (const side of ["north", "south"] as const) {
        if (rand() < 0.3) continue;
        const ref = HOUSES[Math.floor(rand() * HOUSES.length)];
        const h = frameRect(ref)[3];
        const angle = deg + (rand() - 0.5) * 4;
        // Step away from the road until the curve no longer clips the house's corners.
        const foot = HOUSE_GAPS.map((gap) =>
          side === "north" ? northOfRoad(road, angle, gap) : southOfRoad(road, angle, h, gap),
        ).find((f) => {
          const box = spriteBox(ref, f.x, f.y);
          return onOpenSand(box) && !blockers.some((b) => overlaps(b, box));
        });
        if (!foot) continue;
        placed.push({ ...ref, ...foot });
        blockers.push(spriteBox(ref, foot.x, foot.y, 6));
      }
    }
  }
  return placed;
}

const VEGETATION = (
  [
    ["kelpLeafy", 4, true],
    ["kelpLeafyTall", 4, true],
    ["kelpRibbon", 4, true],
    ["kelpRibbonTall", 4, true],
    ["kelpCurly", 2, true],
    ["kelpStrand", 3, true],
    ["kelpShort", 3, true],
    ["seagrass", 3, true],
    ["coralTubes", 2, false],
    ["coralTubesAlt", 2, false],
    ["coralRed", 2, false],
    ["coralTable", 1, false],
    ["coralTableBig", 1, false],
    ["podsPurple", 2, false],
    ["podsGreen", 2, false],
    ["anemone", 2, true],
  ] as const
).map(([frame, weight, sway]) => ({ ref: { sheet: "vegetation", frame } as SpriteRef, weight, sway }));

/** Kelp forests and coral gardens in the open ground, thickest out in the wilds. */
function scatterVegetation(blockers: Box[], seed = 11, clusters = 260): Decor[] {
  const rand = seededRandom(seed);
  const total = VEGETATION.reduce((sum, v) => sum + v.weight, 0);
  const pick = () => {
    let roll = rand() * total;
    for (const v of VEGETATION) if ((roll -= v.weight) < 0) return v;
    return VEGETATION[0];
  };
  const placed: Decor[] = [];
  for (let c = 0; c < clusters; c++) {
    const cx = rand() * WORLD;
    const cy = rand() * WORLD;
    const wild = radiusOf({ x: cx, y: cy }) > OUTER_EDGE;
    const count = wild ? 6 + Math.floor(rand() * 8) : 3 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const v = pick();
      const x = Math.round(cx + (rand() - 0.5) * (wild ? 110 : 70));
      const y = Math.round(cy + (rand() - 0.5) * (wild ? 60 : 36));
      const box = spriteBox(v.ref, x, y);
      if (!onOpenSand(box, 6) || blockers.some((b) => overlaps(b, box))) continue;
      placed.push({ ...v.ref, x, y, sway: v.sway });
      blockers.push(spriteBox(v.ref, x, y, -3)); // neighbours may overlap a little
    }
  }
  return placed;
}

/** All decor, deterministic: hand-placed, then houses, then vegetation in what's left. */
export function buildDecor(): Decor[] {
  const blockers = initialBlockers();
  const houses = placeHouses(blockers);
  return [...FIXED_DECOR, ...houses, ...scatterVegetation(blockers)];
}

// --- Walking routes -------------------------------------------------------------------------------

/** The row in front of the island temples that every island trip passes through. */
const HUB_Y = CY + 44;
const ROAD_FOR_LEVEL = [0, RING_ROADS[0], RING_ROADS[1]] as const;

const signedDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

function arc(r: number, from: number, to: number): Point[] {
  const d = signedDelta(from, to);
  const steps = Math.max(1, Math.ceil(Math.abs(d) / 5));
  return Array.from({ length: steps }, (_, i) => polar(r, from + (d * (i + 1)) / steps));
}

const arcLength = (r: number, from: number, to: number) =>
  (Math.abs(signedDelta(from, to)) * Math.PI * r) / 180;

/** The island path between the hub row and the edge where an avenue leaves. */
function islandExit(deg: number): Point[] {
  const edge = polar(ISLAND_R, deg);
  if (deg === -90 || deg === 90) return [{ x: CX, y: HUB_Y }, edge];
  return [{ x: CX + Math.sign(edge.x - CX) * 200, y: HUB_Y }, edge];
}

/** Move a point off the water onto the nearest bank; nothing past the moat is walkable. */
function onLand(pt: Point): Point {
  const x = Math.min(WORLD - 8, Math.max(8, pt.x));
  const y = Math.min(WORLD - 4, Math.max(24, pt.y));
  const r = radiusOf({ x, y });
  if (r >= OUTER_EDGE) return polar(OUTER_EDGE - 12, angleOf({ x, y }));
  const ground = groundAt(x, y);
  if (ground !== "water" && ground !== "rim") return { x, y };
  const [inner, outer] = CANALS.find(([i, o]) => r >= i && r < o)!;
  return polar(r < (inner + outer) / 2 ? inner - 10 : outer + 10, angleOf({ x, y }));
}

/**
 * Waypoints from ``from`` to ``to``: onto the nearest ring road, around it to the best avenue,
 * along the avenue to the destination's ring, around that ring, and off to the destination.
 * Trips on the island cut across the plaza by the row in front of the temples.
 */
export function route(from: Point, rawTo: Point): Point[] {
  const to = onLand(rawTo);
  const lf = levelOf(radiusOf(from));
  const lt = levelOf(radiusOf(to));
  const af = angleOf(from);
  const at = angleOf(to);
  const points: Point[] = [];

  if (lf === lt && Math.hypot(to.x - from.x, to.y - from.y) < 40) {
    points.push(to);
  } else if (lf === lt && lf === 0) {
    points.push({ x: from.x, y: HUB_Y }, { x: to.x, y: HUB_Y }, to);
  } else if (lf === lt) {
    const r = ROAD_FOR_LEVEL[lf];
    points.push(polar(r, af), ...arc(r, af, at), to);
  } else {
    const rf = ROAD_FOR_LEVEL[lf];
    const rt = ROAD_FOR_LEVEL[lt];
    const cost = (a: number) => arcLength(rf, af, a) + arcLength(rt, a, at);
    const avenue = AVENUES.reduce((best, a) => (cost(a) < cost(best) ? a : best));
    if (lf === 0) points.push({ x: from.x, y: HUB_Y }, ...islandExit(avenue));
    else points.push(polar(rf, af), ...arc(rf, af, avenue));
    if (lt === 0) points.push(...islandExit(avenue).reverse(), { x: to.x, y: HUB_Y }, to);
    else points.push(polar(rt, avenue), ...arc(rt, avenue, at), to);
  }

  // Drop points that barely move.
  const out: Point[] = [];
  let last = from;
  for (const pt of points) {
    if (Math.abs(pt.x - last.x) + Math.abs(pt.y - last.y) >= 2) {
      out.push(pt);
      last = pt;
    }
  }
  return out;
}
