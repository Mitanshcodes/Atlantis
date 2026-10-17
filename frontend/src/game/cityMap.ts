/**
 * What stands in the city besides the buildings, and how the player walks between places.
 *
 * Decor is either placed by hand (the Herald's rostrum, lamps along the stair, the kelp farm, the
 * wreck in the sea) or placed by a seeded search that only accepts spots on open ground, so houses
 * and kelp never land on a road, a canal or a building. Walking follows the ring roads, the east
 * and west bridges, and the grand stair.
 */

import { GENERATED, frameRect, type PlacedSprite, type SpriteRef } from "./assets";
import { BUILDINGS, ISLAND_DOOR_Y } from "./buildings";
import {
  ASPECT,
  CANALS,
  CLIFF_H,
  CX,
  CY,
  GATE,
  ISLAND_R,
  OUTER_EDGE,
  RING_ROADS,
  SEA_Y,
  STAIR_HALF,
  WORLD_H,
  WORLD_W,
  angleOf,
  groundAt,
  levelOf,
  northOfRoad,
  polar,
  radiusOf,
  type Ground,
  type Point,
} from "./geometry";
import { seededRandom } from "./random";

export { WORLD_H, WORLD_W };
export const PLAYER_START: Point = { x: CX, y: ISLAND_DOOR_Y + 8 };

/** Decor sprite; ``sway`` ones move in the current (kelp, anemones). */
export type Decor = PlacedSprite & { sway?: boolean };

/** A generated texture placed by its foot, like a sprite (lamps, the kelp farm's beds). */
export interface GeneratedDecor {
  key: string;
  x: number;
  y: number;
}

const AVENUES = [0, 90, 180] as const;

// --- Hand-placed decor ----------------------------------------------------------------------------

const p = (pt: Point) => ({ x: Math.round(pt.x), y: Math.round(pt.y) });

const SEA_MID = Math.round((SEA_Y + WORLD_H) / 2);
/** Just inside the island's south edge, where the stair begins. */
const ISLAND_FRONT_Y = Math.round(CY + ISLAND_R / ASPECT) - 6;

/** The kelp farm: three fenced beds in the south-east corner of the outer ring. */
const FARM = { x: 800, y: 584, rows: 3, rowGap: 14 } as const;

export const FIXED_DECOR: Decor[] = [
  // The middle ring: the Herald's rostrum, an old temple floor east of the stair.
  { sheet: "temple", frame: "plinth", ...northOfRoad(RING_ROADS[0], 52) },
  { sheet: "greek", frame: "amphora", ...p({ x: 214, y: 214 }) },
  { sheet: "greek", frame: "potSmall", ...p({ x: 226, y: 210 }) },
  // The island: columns at the head of the stair, and pots by the temple steps.
  { sheet: "temple", frame: "pillarTall", x: CX - STAIR_HALF - 12, y: ISLAND_FRONT_Y },
  { sheet: "temple", frame: "pillarTall", x: CX + STAIR_HALF + 12, y: ISLAND_FRONT_Y },
  { sheet: "greek", frame: "amphora", x: CX - 178, y: ISLAND_DOOR_Y - 26 },
  { sheet: "greek", frame: "potFlowers", x: CX - 160, y: ISLAND_DOOR_Y - 14 },
  { sheet: "greek", frame: "potPlant", x: CX + 176, y: ISLAND_DOOR_Y - 24 },
  { sheet: "greek", frame: "amphora", x: CX + 160, y: ISLAND_DOOR_Y - 12 },
  // Old columns where the stair meets the cliff.
  { sheet: "temple", frame: "pillarTall", x: CX - STAIR_HALF - 10, y: SEA_Y - CLIFF_H - 2 },
  { sheet: "temple", frame: "pillarHalf", x: CX + STAIR_HALF + 10, y: SEA_Y - CLIFF_H - 2 },
  // Gargoyles keep watch over the Black Reef.
  { sheet: "temple", frame: "gargoyleMossy", ...p({ x: 18, y: 150 }) },
  { sheet: "temple", frame: "pillarMossy", ...p({ x: 128, y: 160 }) },
  { sheet: "temple", frame: "pillarMossyHalf", ...p({ x: 140, y: 120 }) },
  // Odd stones and cargo about the outer ring, below the road.
  { sheet: "temple", frame: "pillarStump", ...p({ x: 960, y: 420 }) },
  { sheet: "temple", frame: "flowersWhite", ...p({ x: 690, y: 560 }) },
  { sheet: "temple", frame: "pillarMossyHalf", ...p({ x: 380, y: 584 }) },
  { sheet: "temple", frame: "pillarStump", ...p({ x: 404, y: 586 }) },
  { sheet: "treasure", frame: "barrelBig", ...p({ x: 300, y: 582 }) },
  { sheet: "treasure", frame: "barrel", ...p({ x: 324, y: 586 }) },
  { sheet: "greek", frame: "amphora", ...p({ x: 600, y: 580 }) },
  { sheet: "greek", frame: "potSmall", ...p({ x: 614, y: 584 }) },
  // The sea below the city wall: a wreck that never made it out, and lost cargo.
  { sheet: "wreck", frame: "hullBuried", ...p({ x: 170, y: WORLD_H - 4 }) },
  { sheet: "treasure", frame: "chestGold", ...p({ x: 300, y: WORLD_H - 10 }) },
  { sheet: "treasure", frame: "anchorMossy", ...p({ x: 880, y: SEA_MID + 20 }) },
  { sheet: "treasure", frame: "barrel", ...p({ x: 690, y: WORLD_H - 14 }) },
  { sheet: "treasure", frame: "wheel", ...p({ x: 960, y: WORLD_H - 8 }) },
  { sheet: "vegetation", frame: "coralTableBig", ...p({ x: CX - 74, y: WORLD_H - 4 }) },
  { sheet: "vegetation", frame: "coralRed", ...p({ x: CX + 90, y: WORLD_H - 2 }) },
  { sheet: "vegetation", frame: "anemone", ...p({ x: CX + 46, y: SEA_MID + 8 }), sway: true },
  // Kelp growing in rows on the farm's beds.
  ...Array.from({ length: FARM.rows }, (_, row) =>
    Array.from({ length: 9 }, (_, i): Decor => ({
      sheet: "vegetation",
      frame: i % 2 ? "kelpStrand" : "kelpShort",
      x: FARM.x - 56 + i * 14,
      y: FARM.y - (FARM.rows - 1 - row) * FARM.rowGap - 2,
      sway: true,
    })),
  ).flat(),
];

/** Lamps along the stair and the island's front, and the kelp farm's beds. */
export const GENERATED_DECOR: GeneratedDecor[] = [
  ...[CY + 160, CY + 230, CY + 300].flatMap((y) => [
    { key: GENERATED.lamp, x: CX - STAIR_HALF - 6, y },
    { key: GENERATED.lamp, x: CX + STAIR_HALF + 6, y },
  ]),
  { key: GENERATED.lamp, x: CX - GATE.halfW - 8, y: GATE.y + GATE.halfH },
  { key: GENERATED.lamp, x: CX + GATE.halfW + 8, y: GATE.y + GATE.halfH },
  ...Array.from({ length: FARM.rows }, (_, row) => ({
    key: GENERATED.kelpBed,
    x: FARM.x,
    y: FARM.y - (FARM.rows - 1 - row) * FARM.rowGap + 2,
  })),
];

/** Where the lamps glow, for the scene's light pass. */
export const LAMP_LIGHTS: Point[] = GENERATED_DECOR.filter((d) => d.key === GENERATED.lamp).map((d) => ({
  x: d.x,
  y: d.y - 15,
}));

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

/** Every sampled point of the box is one of the allowed grounds, inside the world. */
function onGround(box: Box, allowed: ReadonlySet<Ground>, step = 6): boolean {
  if (box.x1 < 0 || box.y1 < 0 || box.x2 > WORLD_W || box.y2 > WORLD_H) return false;
  for (let y = box.y1; y <= box.y2; y += step) {
    for (let x = box.x1; x <= box.x2; x += step) {
      if (!allowed.has(groundAt(x, y))) return false;
    }
  }
  return allowed.has(groundAt(box.x2, box.y2)) && allowed.has(groundAt(box.x1, box.y2));
}

const STONE = new Set<Ground>(["stone"]);
const SEA = new Set<Ground>(["sea"]);

function initialBlockers(): Box[] {
  return [
    ...BUILDINGS.flatMap((b) => [
      ...b.sprites.map((s) => spriteBox(s, s.x, s.y, 6)),
      { x1: b.door.x - 20, y1: b.door.y - 24, x2: b.door.x + 20, y2: b.door.y + 12 },
    ]),
    ...FIXED_DECOR.map((d) => spriteBox(d, d.x, d.y, 4)),
    ...GENERATED_DECOR.map((d) => ({ x1: d.x - 70, y1: d.y - 30, x2: d.x + 70, y2: d.y + 4 })),
  ];
}

const HOUSES = (
  [
    "houseSmallRed",
    "houseTinyRed",
    "houseSlantRed",
    "houseSmallRed",
    "houseBalconyRed",
    "houseSlantBlue",
    "houseSmallBlue",
    "houseSlantGreen",
  ] as const
).map((frame): SpriteRef => ({ sheet: "greek", frame }));

/** Everything but the paths: what a house's roof may stand over. */
const NOT_PATH = new Set<Ground>(["plaza", "sandstone", "stone", "rim", "water", "cliff", "sea", "gate"]);
/** How much of a house's height is its footprint on the ground; the rest may stand over things behind it. */
const FOOTPRINT = 0.35;

/**
 * Homes on the open stone of the outer ring, found by a seeded search. A house only needs its
 * footprint on stone (in this slanted view its roof may rise over a canal behind it), but it may
 * never hide a road, a bridge or the stair.
 */
function placeHouses(blockers: Box[], seed = 23, attempts = 900, max = 18): Decor[] {
  const rand = seededRandom(seed);
  const placed: Decor[] = [];
  for (let i = 0; i < attempts && placed.length < max; i++) {
    const ref = HOUSES[Math.floor(rand() * HOUSES.length)];
    const x = Math.round(40 + rand() * (WORLD_W - 80));
    const y = Math.round(60 + rand() * (SEA_Y - CLIFF_H - 64));
    const box = spriteBox(ref, x, y);
    const foot = { ...box, y1: box.y2 - (box.y2 - box.y1) * FOOTPRINT };
    if (!onGround(foot, STONE) || blockers.some((b) => overlaps(b, box))) continue;
    if (!onGround(box, NOT_PATH)) continue;
    placed.push({ ...ref, x, y });
    blockers.push(spriteBox(ref, x, y, 6));
  }
  return placed;
}

const VEGETATION = (
  [
    ["kelpLeafy", 4, true],
    ["kelpLeafyTall", 3, true],
    ["kelpRibbon", 3, true],
    ["kelpRibbonTall", 3, true],
    ["kelpCurly", 2, true],
    ["kelpStrand", 3, true],
    ["seagrass", 3, true],
    ["coralTubes", 2, false],
    ["coralTubesAlt", 2, false],
    ["coralRed", 2, false],
    ["coralTable", 1, false],
    ["podsPurple", 2, false],
    ["podsGreen", 2, false],
    ["anemone", 3, true],
  ] as const
).map(([frame, weight, sway]) => ({ ref: { sheet: "vegetation", frame } as SpriteRef, weight, sway }));

/** Kelp and coral in small clumps on open ground, and thicker gardens in the sea. */
function scatterVegetation(blockers: Box[], allowed: ReadonlySet<Ground>, area: Box, clusters: number, seed: number): Decor[] {
  const rand = seededRandom(seed);
  const total = VEGETATION.reduce((sum, v) => sum + v.weight, 0);
  const pick = () => {
    let roll = rand() * total;
    for (const v of VEGETATION) if ((roll -= v.weight) < 0) return v;
    return VEGETATION[0];
  };
  const placed: Decor[] = [];
  for (let c = 0; c < clusters; c++) {
    const cx = area.x1 + rand() * (area.x2 - area.x1);
    const cy = area.y1 + rand() * (area.y2 - area.y1);
    const count = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const v = pick();
      const x = Math.round(cx + (rand() - 0.5) * 50);
      const y = Math.round(cy + (rand() - 0.5) * 20);
      const box = spriteBox(v.ref, x, y);
      if (!onGround(box, allowed, 4) || blockers.some((b) => overlaps(b, box))) continue;
      placed.push({ ...v.ref, x, y, sway: v.sway });
      blockers.push(spriteBox(v.ref, x, y, -3)); // neighbours may overlap a little
    }
  }
  return placed;
}

/** All decor, deterministic: hand-placed, then houses, then plants in what's left. */
export function buildDecor(): Decor[] {
  const blockers = initialBlockers();
  const houses = placeHouses(blockers);
  const world = { x1: 0, y1: 0, x2: WORLD_W, y2: WORLD_H };
  return [
    ...FIXED_DECOR,
    ...houses,
    ...scatterVegetation(blockers, STONE, world, 140, 11),
    ...scatterVegetation(blockers, SEA, { ...world, y1: SEA_Y + 20 }, 40, 12),
  ];
}

// --- Walking routes -------------------------------------------------------------------------------

/** The row in front of the island temples that every island trip passes through. */
const HUB_Y = ISLAND_DOOR_Y;
const ROAD_FOR_LEVEL = [0, RING_ROADS[0], RING_ROADS[1]] as const;
/** Where walkers turn off the hub row toward the east and west bridges. */
const ISLAND_SIDE = ISLAND_R - 50;

const signedDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/**
 * Degrees to walk around a ring from one angle to another. The shortest way, except that the
 * outer ring road never goes over the top: its north side runs off the edge of the map.
 */
function ringDelta(r: number, from: number, to: number): number {
  const d = signedDelta(from, to);
  if (r < RING_ROADS[1] || d === 0) return d;
  const toTop = d > 0 ? (((-90 - from) % 360) + 360) % 360 : (((from + 90) % 360) + 360) % 360;
  return toTop > 0 && toTop < Math.abs(d) ? d - Math.sign(d) * 360 : d;
}

function arc(r: number, from: number, to: number): Point[] {
  const d = ringDelta(r, from, to);
  const steps = Math.max(1, Math.ceil(Math.abs(d) / 5));
  return Array.from({ length: steps }, (_, i) => polar(r, from + (d * (i + 1)) / steps));
}

const arcLength = (r: number, from: number, to: number) => (Math.abs(ringDelta(r, from, to)) * Math.PI * r) / 180;

/** The island path between the hub row and the edge where an avenue leaves. */
function islandExit(deg: number): Point[] {
  const edge = polar(ISLAND_R, deg);
  if (deg === 90) return [{ x: CX, y: HUB_Y }, edge];
  const side = Math.sign(edge.x - CX);
  return [{ x: CX + side * ISLAND_SIDE, y: HUB_Y }, { x: CX + side * (ISLAND_R - 16), y: CY }, edge];
}

/** Move a point onto walkable ground: off the water, off the sea, inside the city's edge. */
function onLand(pt: Point): Point {
  const x = Math.min(WORLD_W - 8, Math.max(8, pt.x));
  let y = Math.min(WORLD_H - 4, Math.max(16, pt.y));
  // The grand stair is walkable all the way down to the Sea Gate; elsewhere the cliff stops you.
  if (Math.abs(x - CX) < STAIR_HALF - 4 && y > CY) return { x, y: Math.min(y, GATE.y - GATE.halfH - 2) };
  if (y >= SEA_Y - CLIFF_H) y = SEA_Y - CLIFF_H - 4;
  const r = radiusOf({ x, y });
  if (r >= OUTER_EDGE) return polar(OUTER_EDGE - 12, angleOf({ x, y }));
  const ground = groundAt(x, y);
  if (ground !== "water" && ground !== "rim") return { x, y };
  const [inner, outer] = CANALS.find(([i, o]) => r >= i && r < o)!;
  return polar(r < (inner + outer) / 2 ? inner - 8 : outer + 8, angleOf({ x, y }));
}

/**
 * Waypoints from ``from`` to ``to``: onto the nearest ring road, around it to the best avenue,
 * along the avenue to the destination's ring, around that ring, and off to the destination.
 * Trips on the island cut across the row in front of the temples.
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
