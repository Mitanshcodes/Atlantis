/**
 * The buildings you can walk into, where they stand, and who keeps them.
 *
 * Importance decides the ring: the Council and the Bank are the two great temples on the central
 * island, the Market and the Exchange stand on the middle ring, and the Guild Hall, the tavern,
 * the lending circle and the Black Reef on the outer ring. A sprite's (x, y) is its foot (bottom
 * centre). ``door`` is where the player stops to go in: on the road in front of the building.
 * Ids match the engine's Place values where one exists (bank, market, harbor, drowned_bell,
 * black_reef).
 */

import type { PlacedSprite } from "./assets";
import { CX, CY, RING_ROADS, northOfRoad, polar, type Point } from "./geometry";

export type BuildingId =
  | "bank"
  | "market"
  | "harbor"
  | "drowned_bell"
  | "black_reef"
  | "council"
  | "circle"
  | "guild_hall";

export type Ring = 0 | 1 | 2;

export interface Building {
  id: BuildingId;
  name: string;
  keeper: string;
  /** One line shown when you walk in, until the real panels exist. */
  greeting: string;
  /** Whether what you come here to do spends a tide (a shift, a market trip, an Exchange visit). */
  costsTide: boolean;
  ring: Ring;
  sprites: PlacedSprite[];
  door: Point;
}

const [MIDDLE_ROAD, OUTER_ROAD] = RING_ROADS;

const at = (p: Point) => ({ x: p.x, y: p.y });
const door = (road: number, deg: number) => {
  const p = polar(road, deg);
  return { x: Math.round(p.x), y: Math.round(p.y) };
};

/** The island temples stand side by side; their doors open onto the row in front of them. */
const TEMPLE_FOOT_Y = CY + 70;
export const ISLAND_DOOR_Y = TEMPLE_FOOT_Y + 32;

export const BUILDINGS: Building[] = [
  // --- The island ---------------------------------------------------------------------------------
  {
    id: "council",
    name: "Council of Ten",
    keeper: "Herald Kaito",
    greeting: "Hear the Council's word: what is announced here is always true.",
    costsTide: false,
    ring: 0,
    sprites: [{ sheet: "temple", frame: "templeMossy", x: CX - 92, y: TEMPLE_FOOT_Y }],
    door: { x: CX - 92, y: ISLAND_DOOR_Y },
  },
  {
    id: "bank",
    name: "Bank of the Tides",
    keeper: "Ione",
    greeting: "Coin in the Vault is safe from thieves. Everything here is free and costs no tide.",
    costsTide: false,
    ring: 0,
    sprites: [{ sheet: "temple", frame: "templeClean", x: CX + 92, y: TEMPLE_FOOT_Y }],
    door: { x: CX + 92, y: ISLAND_DOOR_Y },
  },
  // --- The middle ring ----------------------------------------------------------------------------
  {
    id: "market",
    name: "Grand Market",
    keeper: "the stallholders",
    greeting: "Kelp to eat, pearls to keep. Buy cheap, sell dear, and mind the cellar.",
    costsTide: true,
    ring: 1,
    sprites: [
      { sheet: "greek", frame: "stallPots", ...at(northOfRoad(MIDDLE_ROAD, -156)) },
      { sheet: "greek", frame: "stallAmphora", ...at(northOfRoad(MIDDLE_ROAD, -141)) },
      { sheet: "greek", frame: "stallWheel", ...at(northOfRoad(MIDDLE_ROAD, -126)) },
    ],
    door: door(MIDDLE_ROAD, -141),
  },
  {
    id: "harbor",
    name: "Harbor Exchange",
    keeper: "Captain Oro & Dax",
    greeting: "Shares in the shipping houses, and Passage on the last ship out.",
    costsTide: true,
    ring: 1,
    sprites: [{ sheet: "temple", frame: "templeDark", ...at(northOfRoad(MIDDLE_ROAD, -34)) }],
    door: door(MIDDLE_ROAD, -34),
  },
  {
    id: "guild_hall",
    name: "The Guild Hall",
    keeper: "Sefa",
    greeting: "A shift of work for a day's pay. Every shift costs a tide.",
    costsTide: true,
    ring: 2,
    sprites: [{ sheet: "greek", frame: "houseSmallBlue", ...at(northOfRoad(OUTER_ROAD, 25)) }],
    door: door(OUTER_ROAD, 25),
  },
  // --- The outer ring -----------------------------------------------------------------------------
  {
    id: "drowned_bell",
    name: "The Drowned Bell",
    keeper: "Nerissa",
    greeting: "Sit, drink, listen. Tavern talk is right more often than not.",
    costsTide: false,
    ring: 2,
    sprites: [{ sheet: "greek", frame: "houseBalconyRed", ...at(northOfRoad(OUTER_ROAD, 130)) }],
    door: door(OUTER_ROAD, 130),
  },
  {
    id: "circle",
    name: "Old Maro's Circle",
    keeper: "Old Maro",
    greeting: "We pool our coin and take turns. A loan from friends is still a loan.",
    costsTide: false,
    ring: 2,
    sprites: [{ sheet: "greek", frame: "houseSmallGreen", ...at(northOfRoad(OUTER_ROAD, 148)) }],
    door: door(OUTER_ROAD, 148),
  },
  {
    id: "black_reef",
    name: "The Black Reef",
    keeper: "Grin",
    greeting: "Coin now, no questions. Half again by next season.",
    costsTide: false,
    ring: 2,
    sprites: [{ sheet: "ruins", frame: "darkRuin", ...at(northOfRoad(OUTER_ROAD, -168)) }],
    door: door(OUTER_ROAD, -168),
  },
];

export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<
  BuildingId,
  Building
>;
