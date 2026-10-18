/**
 * The game's words. They live in backend/app/content/*.json (Mitansh's writing, shared with the
 * engine, which uses the same files for the news and the Chronicle); this file only types them.
 * Edit the JSON, not this file.
 *
 * In-world terms only, except in the Modern Mirror (each room's, each season report's and the
 * ending's), which names the real ideas.
 */

import buildingsJson from "@content/buildings.json";
import classesJson from "@content/classes.json";
import endingsJson from "@content/endings.json";
import eventsJson from "@content/events.json";
import marketJson from "@content/market.json";
import mirrorJson from "@content/mirror.json";
import onboardingJson from "@content/onboarding.json";
import scrollsJson from "@content/scrolls.json";
import type { BuildingId } from "../game/buildings";
import type { ClassId } from "../types";

export interface ClassCopy {
  id: ClassId;
  /** "The Newcomer" on the card; "Newcomer" in a sentence. */
  title: string;
  name: string;
  job: string;
  /** Starting coin, whole coins. */
  coin: number;
  /** A note beside the coin (the First of Their Line's debt). */
  coinNote?: string;
  hard: string;
  edge: string;
  standing: string;
  pay: string;
  /** The opening's workplace scene: assets/opening/scenes/<scene>.png. */
  scene: string;
  /** What Chelo says when you pick this place. */
  chelo: string;
  /** The story scroll's first page. */
  story: string;
}

export interface BuildingInfo {
  about: string;
  do: string[];
  cost: string;
}

export interface Words {
  title: string;
  story?: string;
  means?: string;
}

export interface MaroQuestion {
  when: "debt" | "card" | "no_savings" | "behind" | "idle_coin" | "low_kelp" | "passage" | "always";
  q: string;
}

export const CLASSES = classesJson as ClassCopy[];

export const BUILDING_INFO = buildingsJson as unknown as Record<BuildingId, BuildingInfo>;
export const MARO_QUESTIONS = buildingsJson.maro_questions as MaroQuestion[];
export const TAVERN = buildingsJson.tavern;

/** One unexpected market event a season: title, story, and what it means for the player. */
export const SHOCKS = eventsJson.shocks as Record<string, Words>;
/** The event deck: a title for each event, and a line on what it means for the player. */
export const DECK = eventsJson.deck as Record<string, Words>;
export const EVENT_TITLES: Record<string, string> = Object.fromEntries(Object.entries(DECK).map(([k, v]) => [k, v.title]));
export const MOMENT_TITLES = eventsJson.moments as Record<string, string>;

export const SCROLLS = scrollsJson as Record<string, { name: string; how: string; lesson: string }>;
export const SCROLL_COUNT = Object.keys(SCROLLS).length;

export const ENDINGS = endingsJson.endings as Record<string, { title: string; line: string }>;
/** The Modern Mirror: the only place real-world finance terms appear. */
export const MIRROR = endingsJson.mirror as Record<string, string>;

export const HOUSES: Record<string, string> = Object.fromEntries(Object.entries(marketJson.houses).map(([k, v]) => [k, v.name]));
export const HOUSE_NOTES: Record<string, string> = Object.fromEntries(Object.entries(marketJson.houses).map(([k, v]) => [k, v.note]));
export const GOODS = marketJson.goods as Record<string, { name: string; note: string }>;

/** One line of the Modern Mirror: a thing in Atlantis, what it is in the real world, and why. */
export interface MirrorPair {
  here: string;
  there: string;
  text: string;
}
/** Each building's Modern Mirror, shown at the top of its room. */
export const ROOM_MIRROR = mirrorJson.rooms as Record<BuildingId, MirrorPair[]>;

/** A step of Chelo's first-time tour: a building (its words come from BUILDING_INFO) or part of the HUD. */
export interface TourStep {
  id: string;
  building?: BuildingId;
  hud?: "season" | "passage";
  title?: string;
  chelo: string;
  lines?: string[];
}
export const TOUR = onboardingJson.steps as TourStep[];

/** The opening's cinematic story: lines typed one by one. {name}, {class}, {coin}, {passage} are filled in. */
export const STORY = onboardingJson.story as Array<{ text: string; style?: "big" | "gold" }>;
