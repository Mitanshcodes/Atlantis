/**
 * The buildings you can walk into, where they stand, and who keeps them.
 *
 * Importance decides the ring: the Council and the Bank on the central island, the Market, the
 * Exchange and the Guild Hall on the middle ring, and the tavern, the lending circle and the Black
 * Reef on the outer ring. A sprite's (x, y) is its foot (bottom centre). ``door`` is where the
 * player stops to go in: on the ring road in front of the building. Ids match the engine's Place
 * values where one exists (bank, market, harbor, drowned_bell, black_reef).
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

export const BUILDINGS: Building[] = [
  // --- The island ---------------------------------------------------------------------------------
  {
    id: "council",
    name: "Council of Ten",
    keeper: "Herald Kaito",
    greeting: "Hear the Council's word: what is announced here is always true.",
    ring: 0,
    sprites: [{ sheet: "greek", frame: "templeGreenBig", x: CX - 92, y: CY + 10 }],
    door: { x: CX - 92, y: CY + 28 },
  },
  {
    id: "bank",
    name: "Bank of the Tides",
    keeper: "Ione",
    greeting: "Coin in the Vault is safe from thieves. Everything here is free and costs no tide.",
    ring: 0,
    sprites: [{ sheet: "greek", frame: "templeBlueBig", x: CX + 92, y: CY + 10 }],
    door: { x: CX + 92, y: CY + 28 },
  },
  // --- The middle ring ----------------------------------------------------------------------------
  {
    id: "market",
    name: "Grand Market",
    keeper: "the stallholders",
    greeting: "Kelp to eat, pearls to keep. Buy cheap, sell dear, and mind the cellar.",
    ring: 1,
    sprites: [
      { sheet: "greek", frame: "stallPots", ...at(northOfRoad(MIDDLE_ROAD, -146)) },
      { sheet: "greek", frame: "stallAmphora", ...at(northOfRoad(MIDDLE_ROAD, -134)) },
      { sheet: "greek", frame: "stallWheel", ...at(northOfRoad(MIDDLE_ROAD, -122)) },
    ],
    door: door(MIDDLE_ROAD, -134),
  },
  {
    id: "harbor",
    name: "Harbor Exchange",
    keeper: "Captain Oro & Dax",
    greeting: "Shares in the shipping houses, and Passage on the last ship out.",
    ring: 1,
    sprites: [{ sheet: "greek", frame: "templeRedSmall", ...at(northOfRoad(MIDDLE_ROAD, -45)) }],
    door: door(MIDDLE_ROAD, -45),
  },
  {
    id: "guild_hall",
    name: "The Guild Hall",
    keeper: "Sefa",
    greeting: "A shift of work for a day's pay. Every shift costs a tide.",
    ring: 1,
    sprites: [{ sheet: "greek", frame: "houseWideBlue", ...at(northOfRoad(MIDDLE_ROAD, 120)) }],
    door: door(MIDDLE_ROAD, 120),
  },
  // --- The outer ring -----------------------------------------------------------------------------
  {
    id: "drowned_bell",
    name: "The Drowned Bell",
    keeper: "Nerissa",
    greeting: "Sit, drink, listen. Tavern talk is right more often than not.",
    ring: 2,
    sprites: [{ sheet: "greek", frame: "houseWideRed", ...at(northOfRoad(OUTER_ROAD, 140)) }],
    door: door(OUTER_ROAD, 140),
  },
  {
    id: "circle",
    name: "The Lending Circle",
    keeper: "Old Maro",
    greeting: "We pool our coin and take turns. A loan from friends is still a loan.",
    ring: 2,
    sprites: [{ sheet: "greek", frame: "houseSmallGreen", ...at(northOfRoad(OUTER_ROAD, 50)) }],
    door: door(OUTER_ROAD, 50),
  },
  {
    id: "black_reef",
    name: "The Black Reef",
    keeper: "Grin",
    greeting: "Coin now, no questions. Half again by next season.",
    ring: 2,
    sprites: [{ sheet: "ruins", frame: "darkRuin", ...at(northOfRoad(OUTER_ROAD, -40)) }],
    door: door(OUTER_ROAD, -40),
  },
];

export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<
  BuildingId,
  Building
>;
