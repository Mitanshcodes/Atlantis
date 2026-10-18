/**
 * What stands in the city besides the buildings, and how the player walks between places.
 *
 * Decor is either placed by hand (the Herald's rostrum, lamps along the stair, the kelp farm, the
 * wreck in the sea) or placed by a seeded search that only accepts spots on open ground, so houses
 * and kelp never land on a road, a canal or a building. Also: where the player may pop up after a
 * click, and where the little creatures live.
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
  RING_ROADS,
  ROAD_HALF,
  SEA_Y,
  SKYLINE_H,
  STAIR_HALF,
  TERRACE_Y,
  WORLD_H,
  WORLD_W,
  angleOf,
  groundAt,
  polar,
  radiusOf,
  type Ground,
  type Point,
} from "./geometry";
import { seededRandom } from "./random";
import { ORNAMENT_SIZE } from "./ornaments";

export { WORLD_H, WORLD_W };
export const PLAYER_START: Point = { x: CX, y: ISLAND_DOOR_Y + 8 };

/** Decor sprite; ``sway`` ones move in the current (kelp, anemones). */
export type Decor = PlacedSprite & { sway?: boolean };

/** A generated texture placed by its foot, like a sprite (lamps, the kelp farm's beds). */
export interface GeneratedDecor {
  key: string;
  x: number;
  y: number;
  /** Mirror it left to right. */
  flip?: boolean;
}

// --- Hand-placed decor ----------------------------------------------------------------------------

const p = (pt: Point) => ({ x: Math.round(pt.x), y: Math.round(pt.y) });

const SEA_MID = Math.round((SEA_Y + WORLD_H) / 2);
/** Just inside the island's south edge, where the stair begins. */
const ISLAND_FRONT_Y = Math.round(CY + ISLAND_R / ASPECT) - 6;

/** The kelp farm: three fenced beds in the south-east corner of the outer ring. */
const FARM = { x: 800, y: SKYLINE_H + 584, rows: 3, rowGap: 14 } as const;

/**
 * Where the orichalcum crystal floats: over the great dome in the skyline painting (see
 * ``skylineArt.ts``), under the sea's surface.
 */
export const SKYLINE_CRYSTAL: Point = { x: CX, y: 76 };

export const FIXED_DECOR: Decor[] = [
  // The island: pots by the temple steps (statues guard the head of the stair, in ORNAMENT_DECOR).
  { sheet: "greek", frame: "amphora", x: CX - 178, y: ISLAND_DOOR_Y - 26 },
  { sheet: "greek", frame: "potFlowers", x: CX - 160, y: ISLAND_DOOR_Y - 14 },
  { sheet: "greek", frame: "potPlant", x: CX + 176, y: ISLAND_DOOR_Y - 24 },
  { sheet: "greek", frame: "amphora", x: CX + 160, y: ISLAND_DOOR_Y - 12 },
  // Old columns where the stair meets the cliff.
  { sheet: "temple", frame: "pillarTall", x: CX - STAIR_HALF - 10, y: SEA_Y - CLIFF_H - 2 },
  { sheet: "temple", frame: "pillarHalf", x: CX + STAIR_HALF + 10, y: SEA_Y - CLIFF_H - 2 },
  // Gargoyles keep watch over the Black Reef.
  { sheet: "temple", frame: "gargoyleMossy", ...p({ x: 18, y: SKYLINE_H + 150 }) },
  { sheet: "temple", frame: "pillarMossy", ...p({ x: 128, y: SKYLINE_H + 160 }) },
  { sheet: "temple", frame: "pillarMossyHalf", ...p({ x: 140, y: SKYLINE_H + 120 }) },
  // Odd stones and cargo about the outer ring, below the road.
  { sheet: "temple", frame: "pillarStump", ...p({ x: 960, y: SKYLINE_H + 420 }) },
  { sheet: "temple", frame: "flowersWhite", ...p({ x: 690, y: SKYLINE_H + 560 }) },
  { sheet: "temple", frame: "pillarMossyHalf", ...p({ x: 380, y: SKYLINE_H + 584 }) },
  { sheet: "temple", frame: "pillarStump", ...p({ x: 404, y: SKYLINE_H + 586 }) },
  { sheet: "treasure", frame: "barrelBig", ...p({ x: 300, y: SKYLINE_H + 582 }) },
  { sheet: "treasure", frame: "barrel", ...p({ x: 324, y: SKYLINE_H + 586 }) },
  { sheet: "greek", frame: "amphora", ...p({ x: 600, y: SKYLINE_H + 580 }) },
  { sheet: "greek", frame: "potSmall", ...p({ x: 614, y: SKYLINE_H + 584 }) },
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

const at = (pt: Point, dx = 0, dy = 0) => ({ x: Math.round(pt.x + dx), y: Math.round(pt.y + dy) });
/** Middle of the sandstone ring's inner band (island side of the road) and outer band. */
const INNER_BAND = (CANALS[0][1] + RING_ROADS[0] - ROAD_HALF) / 2;
const OUTER_BAND = (RING_ROADS[0] + ROAD_HALF + CANALS[1][0]) / 2;
/** Where the stair crosses the sandstone ring, just past each canal. */
const STAIR_IN = Math.round(CY + CANALS[0][1] / ASPECT) + 14;
const STAIR_OUT = Math.round(CY + CANALS[1][0] / ASPECT) - 4;

/**
 * The sandstone ring, laid out like the gardens of a temple district and mirrored about the stair:
 * tholoi with urns and two fountains either side of the stair, statues guarding the stair and the
 * east and west bridges, cypresses in planters along the stair, and an old ruined colonnade across
 * the island to the north. Everything is painted in the skyline's style (ornaments.ts).
 */
const ORNAMENT_DECOR: GeneratedDecor[] = [
  ...[50, 130].flatMap((deg) => {
    const spot = polar(OUTER_BAND, deg);
    return [
      { key: GENERATED.tholos, ...at(spot, 0, 8) },
      { key: GENERATED.urn, ...at(spot, -24, 8) },
      { key: GENERATED.urn, ...at(spot, 24, 8) },
    ];
  }),
  { key: GENERATED.fountain, ...at(polar(INNER_BAND, 60), 0, 10) },
  { key: GENERATED.fountain, ...at(polar(INNER_BAND, 120), 0, 10) },
  // Across the island to the north: the old colonnade, half fallen, mirrored either side.
  { key: GENERATED.ruin, ...at(polar(OUTER_BAND, -74), 0, 10), flip: true },
  { key: GENERATED.ruin, ...at(polar(OUTER_BAND, -106), 0, 10) },
  ...[-1, 1].flatMap((side) => [
    // The head of the stair on the island, and where it enters the sandstone ring.
    { key: GENERATED.statue, x: CX + side * (STAIR_HALF + 12), y: ISLAND_FRONT_Y },
    { key: GENERATED.statue, x: CX + side * (STAIR_HALF + 12), y: STAIR_IN },
    { key: GENERATED.planterCypress, x: CX + side * (STAIR_HALF + 12), y: STAIR_OUT },
    { key: GENERATED.urn, x: CX + side * (STAIR_HALF + 30), y: STAIR_OUT },
    // Either side of the east and west bridges.
    { key: GENERATED.statue, ...at(polar(CANALS[0][1] + 14, side < 0 ? 180 : 0), 0, -14) },
    { key: GENERATED.statue, ...at(polar(CANALS[0][1] + 14, side < 0 ? 180 : 0), 0, 34) },
  ]),
];

/** Fountains, for their spray. */
export const FOUNTAINS: Point[] = ORNAMENT_DECOR.filter((d) => d.key === GENERATED.fountain).map((d) => ({
  x: d.x,
  y: d.y - 24,
}));

/** Lamps along the stair and the island's front, the kelp farm's beds, and the ring's ornaments. */
export const GENERATED_DECOR: GeneratedDecor[] = [
  ...ORNAMENT_DECOR,
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
const SANDSTONE = new Set<Ground>(["sandstone"]);

function initialBlockers(): Box[] {
  return [
    ...BUILDINGS.flatMap((b) => [
      ...b.sprites.map((s) => spriteBox(s, s.x, s.y, 6)),
      { x1: b.door.x - 20, y1: b.door.y - 24, x2: b.door.x + 20, y2: b.door.y + 12 },
    ]),
    ...FIXED_DECOR.map((d) => spriteBox(d, d.x, d.y, 4)),
    ...GENERATED_DECOR.map((d) => {
      const half = d.key === GENERATED.lamp ? 6 : d.key === GENERATED.kelpBed ? 66 : (ORNAMENT_SIZE[d.key]?.w ?? 12) / 2 + 4;
      return { x1: d.x - half, y1: d.y - 30, x2: d.x + half, y2: d.y + 4 };
    }),
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
    const y = Math.round(TERRACE_Y + 40 + rand() * (SEA_Y - CLIFF_H - TERRACE_Y - 44));
    const box = spriteBox(ref, x, y);
    const foot = { ...box, y1: box.y2 - (box.y2 - box.y1) * FOOTPRINT };
    if (!onGround(foot, STONE) || blockers.some((b) => overlaps(b, box))) continue;
    if (!onGround(box, NOT_PATH)) continue;
    placed.push({ ...ref, x, y });
    blockers.push(spriteBox(ref, x, y, 6));
  }
  return placed;
}

type Plant = { ref: SpriteRef; weight: number; sway: boolean };

const plants = (sheet: "vegetation" | "rocks", list: ReadonlyArray<readonly [string, number, boolean]>): Plant[] =>
  list.map(([frame, weight, sway]) => ({ ref: { sheet, frame } as SpriteRef, weight, sway }));

/** Tall kelp, coral and anemones: the gardens on the outer stone and the seabed. */
const GARDEN = plants("vegetation", [
  ["kelpLeafy", 4, true],
  ["kelpLeafyTall", 4, true],
  ["kelpRibbon", 3, true],
  ["kelpRibbonTall", 3, true],
  ["kelpCurly", 3, true],
  ["kelpCurlySmall", 3, true],
  ["kelpStrand", 3, true],
  ["seagrass", 3, true],
  ["coralTubes", 2, false],
  ["coralTubesAlt", 2, false],
  ["tubeBunch", 3, false],
  ["tubePile", 2, false],
  ["tubePileAlt", 2, false],
  ["coralRed", 1, false],
  ["coralBranch", 2, true],
  ["coralBranchThin", 2, true],
  ["coralBranchSmall", 2, true],
  ["coralTable", 1, false],
  ["podsPurpleCluster", 2, false],
  ["podsOrangeCluster", 2, false],
  ["anemone", 3, true],
  ["anemoneFringe", 1, true],
]);

/** Low things that don't hide the paving: small tube corals, sea pods and anemones. */
const BORDER = plants("vegetation", [
  ["tubeSmall", 3, false],
  ["tubeTrio", 3, false],
  ["podPurple", 3, false],
  ["podPurpleMid", 2, false],
  ["podOrange", 3, false],
  ["podOrangeMid", 2, false],
  ["anemone", 2, true],
  ["kelpCurlySmall", 2, true],
  ["coralBranchSmall", 1, true],
]);

const ROCKS = plants("rocks", [
  ["rockMossyBig", 1, false],
  ["rockMossyTall", 2, false],
  ["rockMossyLow", 2, false],
  ["rockMossyLowAlt", 2, false],
]);

/** Plants in small seeded clumps on the allowed ground, never on a path or a building. */
function scatterVegetation(
  blockers: Box[],
  allowed: ReadonlySet<Ground>,
  area: Box,
  clusters: number,
  seed: number,
  kinds: Plant[] = GARDEN,
  spread = 50,
): Decor[] {
  const rand = seededRandom(seed);
  const total = kinds.reduce((sum, v) => sum + v.weight, 0);
  const pick = () => {
    let roll = rand() * total;
    for (const v of kinds) if ((roll -= v.weight) < 0) return v;
    return kinds[0];
  };
  const placed: Decor[] = [];
  for (let c = 0; c < clusters; c++) {
    // Look for a clump's centre on the allowed ground, so no clump is wasted on the wrong ring.
    let cx = 0;
    let cy = 0;
    for (let tries = 0; tries < 20; tries++) {
      cx = area.x1 + rand() * (area.x2 - area.x1);
      cy = area.y1 + rand() * (area.y2 - area.y1);
      if (allowed.has(groundAt(cx, cy))) break;
    }
    const count = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const v = pick();
      const x = Math.round(cx + (rand() - 0.5) * spread);
      const y = Math.round(cy + (rand() - 0.5) * spread * 0.4);
      // Like houses, a plant only needs its footprint on the ground; the rest may stand over
      // anything but a path.
      const box = spriteBox(v.ref, x, y);
      const foot = { ...box, y1: box.y2 - Math.max(4, (box.y2 - box.y1) * FOOTPRINT) };
      if (!onGround(foot, allowed, 3) || !onGround(box, NOT_PATH, 4)) continue;
      if (blockers.some((b) => overlaps(b, box))) continue;
      placed.push({ ...v.ref, x, y, sway: v.sway });
      blockers.push(spriteBox(v.ref, x, y, -3)); // neighbours may overlap a little
    }
  }
  return placed;
}

const FRINGE = GARDEN.filter((p) => p.ref.frame.startsWith("kelp") || p.ref.frame === "seagrass");

/** A swaying fringe of kelp along the top of the city wall, with gaps, leaving the stair clear. */
function kelpFringe(blockers: Box[], seed = 16): Decor[] {
  const rand = seededRandom(seed);
  const placed: Decor[] = [];
  const y = SEA_Y - CLIFF_H - 1;
  for (let x = 6; x < WORLD_W - 6; x += 7 + Math.floor(rand() * 6)) {
    if (Math.abs(x - CX) < STAIR_HALF + 24 || rand() < 0.25) continue;
    const { ref } = FRINGE[Math.floor(rand() * FRINGE.length)];
    const box = spriteBox(ref, x, y);
    if (blockers.some((b) => overlaps(b, { ...box, y1: box.y2 - 6 }))) continue;
    placed.push({ ...ref, x, y, sway: true });
  }
  return placed;
}

/** All decor, deterministic: hand-placed, then houses, then plants in what's left. */
export function buildDecor(): Decor[] {
  const blockers = initialBlockers();
  const houses = placeHouses(blockers);
  const world = { x1: 0, y1: 0, x2: WORLD_W, y2: WORLD_H };
  const seabed = { ...world, y1: SEA_Y + 16 };
  return [
    ...FIXED_DECOR,
    ...houses,
    ...scatterVegetation(blockers, STONE, world, 12, 13, ROCKS, 10),
    ...scatterVegetation(blockers, SEA, seabed, 8, 14, ROCKS, 10),
    ...kelpFringe(blockers),
    ...scatterVegetation(blockers, STONE, world, 240, 11),
    ...scatterVegetation(blockers, SEA, seabed, 90, 12),
    ...scatterVegetation(blockers, SANDSTONE, world, 22, 15, BORDER, 24),
  ];
}

// --- Where the player can appear ------------------------------------------------------------------

/**
 * The spot nearest a click where the player can stand: anywhere on the city floor or the seabed,
 * but never in a canal (they pop out on the nearer bank) or off the edge of the world.
 */
export function nearestWalkable(pt: Point): Point {
  const x = Math.round(Math.min(WORLD_W - 10, Math.max(10, pt.x)));
  // The skyline terrace is scenery: the player stays in the city below its wall.
  const y = Math.round(Math.min(WORLD_H - 6, Math.max(TERRACE_Y + 8, pt.y)));
  const ground = groundAt(x, y);
  if (ground !== "water" && ground !== "rim") return { x, y };
  const r = radiusOf({ x, y });
  const [inner, outer] = CANALS.find(([i, o]) => r >= i && r < o)!;
  const bank = polar(r < (inner + outer) / 2 ? inner - 8 : outer + 8, angleOf({ x, y }));
  return { x: Math.round(bank.x), y: Math.round(bank.y) };
}

// --- Homes for the creatures ----------------------------------------------------------------------

const BUILDING_BOXES = BUILDINGS.flatMap((b) => b.sprites.map((s) => spriteBox(s, s.x, s.y, 4)));

/** Seeded points on the given grounds, clear of the buildings, at least ``gap`` apart. */
function groundSpots(allowed: ReadonlySet<Ground>, count: number, seed: number, gap = 24): Point[] {
  const rand = seededRandom(seed);
  const spots: Point[] = [];
  for (let i = 0; i < count * 40 && spots.length < count; i++) {
    const pt = { x: Math.round(16 + rand() * (WORLD_W - 32)), y: Math.round(24 + rand() * (WORLD_H - 32)) };
    const box = { x1: pt.x - 6, y1: pt.y - 6, x2: pt.x + 6, y2: pt.y + 2 };
    if (!onGround(box, allowed, 4) || BUILDING_BOXES.some((b) => overlaps(b, box))) continue;
    if (spots.some((s) => Math.hypot(s.x - pt.x, s.y - pt.y) < gap)) continue;
    spots.push(pt);
  }
  return spots;
}

const SEABED = new Set<Ground>(["sea"]);
const SHORE = new Set<Ground>(["stone", "sea"]);

/** Where each kind of ground-dwelling creature lives. Swimmers roam the whole map instead. */
export const CRITTER_HOMES = {
  crabs: groundSpots(SHORE, 9, 41, 40).filter((p) => p.y > CY),
  clams: groundSpots(SEABED, 5, 42, 60).concat(groundSpots(STONE, 3, 43, 80)),
  starfish: groundSpots(SEABED, 8, 44, 30).concat(groundSpots(STONE, 6, 45, 60)),
  seahorses: groundSpots(SEABED, 4, 46, 80).map((p) => ({ x: p.x, y: p.y - 14 })),
  octopuses: [...groundSpots(SEABED, 1, 47), { x: 150, y: SKYLINE_H + 214 }],
} as const;

/** Spots on the seabed and the outer stone where streams of bubbles rise from the coral. */
export const BUBBLE_VENTS: Point[] = groundSpots(SEABED, 5, 48, 120).concat(groundSpots(STONE, 4, 49, 160));
