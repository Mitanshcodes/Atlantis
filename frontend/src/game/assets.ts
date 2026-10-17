/**
 * Every texture the city uses, and the named frames cut from each sheet.
 *
 * Sheets live in public/assets/city/. Rects are [x, y, width, height] in sheet pixels, measured
 * from the packs (credits in CREDITS.md). Generated textures (fish, light, lamps) are drawn in
 * Boot and listed under GENERATED.
 */

export type Rect = readonly [number, number, number, number];

export const SHEETS = {
  temple: "assets/city/craftpix/exterior_objects.png",
  greek: "assets/city/greek/buildings.png",
  vegetation: "assets/city/underwater/vegetation.png",
  ruins: "assets/city/underwater/temple_ruins.png",
  treasure: "assets/city/underwater/sunken_treasures.png",
  wreck: "assets/city/underwater/shipwreck.png",
  bubbles: "assets/city/underwater/air_bubbles.png",
} as const;

export type SheetKey = keyof typeof SHEETS;

/**
 * The player: a hooded walker from the craftpix ruined-temple pack. Each sheet is 32 x 32 frames
 * in four rows (facing down, left, right, up); the walk has 6 frames a row, the idle 12.
 */
export const PLAYER = {
  walk: { key: "player-walk", url: "assets/sprites/player_walk.png", frames: 6 },
  idle: { key: "player-idle", url: "assets/sprites/player_idle.png", frames: 12 },
  frame: 32,
  /** The row of the frame where the feet (and the baked-in shadow) end. */
  footY: 29,
  facings: ["down", "left", "right", "up"],
} as const;

export type Facing = (typeof PLAYER.facings)[number];

export const FRAMES = {
  temple: {
    templeMossy: [3, 1, 157, 143],
    templeClean: [179, 1, 154, 140],
    templeDark: [5, 226, 104, 121],
    gargoyle: [12, 360, 43, 93],
    gargoyleMossy: [9, 472, 46, 95],
    pillarTall: [232, 224, 16, 31],
    pillarHalf: [264, 232, 16, 23],
    pillarStump: [296, 238, 16, 17],
    pillarMossy: [230, 336, 19, 33],
    pillarMossyHalf: [263, 344, 19, 25],
    flowersWhite: [151, 6, 20, 20],
    plinth: [179, 158, 154, 63],
  },
  greek: {
    templeGreenBig: [99, 32, 138, 224],
    templeBlueBig: [355, 0, 138, 224],
    templeRedBig: [355, 224, 138, 224],
    templeGreenSmall: [249, 35, 94, 173],
    templeBlueSmall: [505, 3, 94, 173],
    templeRedSmall: [505, 227, 94, 173],
    platform: [618, 17, 124, 79],
    column: [624, 107, 15, 53],
    columnBroken: [705, 124, 13, 36],
    columnShort: [625, 177, 13, 31],
    stallPots: [21, 10, 63, 54],
    stallWheel: [12, 74, 56, 54],
    stallAmphora: [16, 138, 76, 54],
    stallEmpty: [12, 202, 56, 54],
    houseLGreen: [16, 266, 115, 134],
    houseLRed: [16, 410, 115, 134],
    houseLBlue: [16, 698, 115, 134],
    houseSmallRed: [160, 258, 80, 94],
    houseSmallGreen: [160, 594, 80, 94],
    houseSmallBlue: [720, 706, 80, 94],
    houseSlantRed: [256, 235, 78, 101],
    houseSlantBlue: [160, 363, 78, 101],
    houseSlantGreen: [144, 699, 78, 101],
    houseWideRed: [642, 277, 171, 123],
    houseWideBlue: [546, 517, 171, 123],
    houseWideGreen: [530, 645, 171, 123],
    houseBalconyRed: [336, 738, 96, 94],
    houseTinyRed: [571, 402, 69, 94],
    potPlant: [785, 497, 14, 14],
    potFlowers: [801, 497, 15, 15],
    amphora: [753, 523, 14, 21],
    potSmall: [805, 530, 8, 13],
  },
  vegetation: {
    kelpLeafy: [16, 27, 16, 37],
    kelpLeafyTall: [33, 19, 14, 45],
    kelpRibbon: [82, 20, 12, 44],
    kelpRibbonTall: [96, 16, 15, 48],
    kelpCurly: [144, 16, 32, 48],
    kelpStrand: [19, 92, 11, 28],
    kelpShort: [32, 92, 16, 36],
    seagrass: [64, 80, 32, 48],
    coralTubes: [128, 76, 32, 52],
    coralTubesAlt: [160, 76, 32, 52],
    coralRed: [16, 176, 64, 48],
    coralTable: [96, 184, 32, 40],
    coralTableBig: [144, 180, 48, 44],
    podsPurple: [16, 144, 32, 16],
    podsGreen: [112, 144, 32, 16],
    anemone: [149, 262, 22, 20],
  },
  ruins: {
    colonnade: [16, 16, 288, 96],
    pillar: [16, 16, 64, 96],
    pillarMossy: [240, 16, 64, 96],
    columnsFallen: [85, 120, 112, 88],
    darkRuin: [128, 215, 96, 121],
    crackedSlab: [241, 215, 62, 66],
    doorLocked: [16, 128, 48, 48],
    doorMossy: [16, 192, 48, 48],
  },
  treasure: {
    wheel: [20, 21, 38, 27],
    anchor: [17, 64, 28, 32],
    anchorMossy: [49, 64, 28, 32],
    barrel: [21, 123, 22, 21],
    barrelBig: [16, 163, 30, 29],
    chestClosed: [16, 240, 48, 32],
    chestGold: [16, 304, 48, 32],
  },
  wreck: {
    hullBuried: [26, 192, 175, 64],
  },
  bubbles: {
    tiny: [21, 43, 3, 3],
    small: [24, 37, 4, 4],
    medium: [18, 33, 5, 5],
    large: [36, 35, 9, 9],
    bubble: [32, 16, 16, 16],
  },
} as const satisfies Partial<Record<SheetKey, Record<string, Rect>>>;

export type FrameSheet = keyof typeof FRAMES;
export type FrameName<S extends FrameSheet> = keyof (typeof FRAMES)[S] & string;

/** A sprite reference: which sheet, and a frame that exists on that sheet. */
export type SpriteRef = { [S in FrameSheet]: { sheet: S; frame: FrameName<S> } }[FrameSheet];

/** A sprite placed in the world by its foot: bottom centre, where it meets the ground. */
export type PlacedSprite = SpriteRef & { x: number; y: number };

export function frameRect(ref: SpriteRef): Rect {
  return (FRAMES[ref.sheet] as Record<string, Rect>)[ref.frame];
}

/** Textures drawn at runtime in Boot (no art yet, or simple enough to generate). */
export const GENERATED = {
  fish: ["gen-fish-gold", "gen-fish-teal", "gen-fish-coral"],
  beam: "gen-light-beam",
  mote: "gen-mote",
  glow: "gen-glow",
  caustics: "gen-caustics",
  ground: "gen-ground",
  waterMask: "gen-water-mask",
  glints: "gen-glints",
  depth: "gen-depth",
  lamp: "gen-lamp",
  kelpBed: "gen-kelp-bed",
} as const;
