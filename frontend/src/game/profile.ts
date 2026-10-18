/**
 * Who the player is: a name and a look. Chosen in the opening, kept in the browser, shown in the
 * city (the player's sprite), the Chronicle and the ending. It never touches the numbers: anyone
 * in Atlantis can start from any place.
 */

import { EventBus } from "./EventBus";

export const LOOKS = ["amara", "dev", "jomo", "kai", "lin", "mateo", "noor", "ruth"] as const;
export const ROBES = ["own", "coral", "kelp", "night"] as const;

export type Look = (typeof LOOKS)[number];
export type Robe = (typeof ROBES)[number];
export type AvatarFacing = "front" | "left" | "back" | "right";

export interface Profile {
  name: string;
  look: Look;
  robe: Robe;
}

/** Avatar atlases: 96 x 144, columns front/left/back/right, rows own/coral/kelp/night (24 x 36). */
export const AVATAR = {
  url: (look: Look) => `assets/opening/avatars/${look}_robes.png`,
  key: (look: Look) => `avatar-${look}`,
  w: 24,
  h: 36,
  /** The frame row the feet stand on. */
  footY: 33,
  facings: ["front", "left", "back", "right"] as AvatarFacing[],
} as const;

export const avatarFrame = (robe: Robe, facing: AvatarFacing) =>
  ROBES.indexOf(robe) * 4 + AVATAR.facings.indexOf(facing);

export const NAME_MAX = 14;
const KEY = "atlantis.profile";

export function loadProfile(): Profile | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    if (p && LOOKS.includes(p.look) && ROBES.includes(p.robe) && typeof p.name === "string") return p;
  } catch {
    // Unreadable or blocked storage: no saved profile.
  }
  return null;
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage blocked: the profile lasts for this page only.
  }
  EventBus.emit("profile-changed", profile);
}
