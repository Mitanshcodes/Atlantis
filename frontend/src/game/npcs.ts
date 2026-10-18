/**
 * The people of Atlantis who walk its streets: the named cast from the design doc, each drawn
 * from the Atlantis character pack and posted by the building they keep (see ``buildings.ts``).
 * What they say lives in ``ui/npcTalk.ts``; how they roam lives in ``npcWalkers.ts``.
 *
 * Sprite sheets are 96 x 36: four 24 x 36 static views (front, left, right, back). The pack has
 * no walking frames, so walkers glide with a small bob instead of cycling the views.
 */

import type { BuildingId } from "./buildings";

export type NpcId = "kaito" | "ione" | "sefa" | "nerissa" | "maro" | "oro" | "dax" | "grin";

export interface Npc {
  id: NpcId;
  name: string;
  /** Who they are, in a few words, under their name in the dialogue. */
  title: string;
  /** File name in public/assets/characters/ (the pack's character folder name). */
  sprite: string;
  /** The building they keep and stay close to. */
  home: BuildingId;
  /** Where along the street in front of their door they stand, in pixels from the door. */
  offset: number;
}

export const NPCS: Npc[] = [
  { id: "kaito", name: "Herald Kaito", title: "Herald of the Council of Ten", sprite: "joho", home: "council", offset: -34 },
  { id: "ione", name: "Ione", title: "Keeper of the Bank of the Tides", sprite: "ahaara", home: "bank", offset: 34 },
  { id: "sefa", name: "Sefa", title: "Clerk of the Guild Hall", sprite: "kai", home: "guild_hall", offset: -30 },
  { id: "nerissa", name: "Nerissa", title: "Keeper of the Drowned Bell", sprite: "noor", home: "drowned_bell", offset: 30 },
  { id: "maro", name: "Old Maro", title: "Elder of the lending circle", sprite: "ruth", home: "circle", offset: 28 },
  { id: "oro", name: "Captain Oro", title: "Master of Oro & Daughters", sprite: "mateo", home: "harbor", offset: -36 },
  { id: "dax", name: "Dax", title: "Captain of the Leviathan Line", sprite: "dev", home: "harbor", offset: 36 },
  { id: "grin", name: "Grin", title: "Lender of the Black Reef", sprite: "lin", home: "black_reef", offset: 30 },
];

export const NPCS_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n])) as Record<NpcId, Npc>;

/** The four static views in each sheet, by frame index. */
export const NPC_VIEW = { front: 0, left: 1, right: 2, back: 3 } as const;
export const NPC_FRAME = { width: 24, height: 36 } as const;

export const npcSheetKey = (npc: Npc) => `npc-${npc.id}`;
export const npcSheetUrl = (npc: Npc) => `assets/characters/${npc.sprite}.png`;
export const npcPortraitUrl = (npc: Npc) => `assets/characters/portraits/${npc.sprite}.png`;
