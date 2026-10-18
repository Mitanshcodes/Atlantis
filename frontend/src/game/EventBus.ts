/**
 * The one channel between Phaser and React. Scenes emit what the player does in the world;
 * React emits what the UI decides. Event names and payloads are typed here so both sides agree.
 */

import Phaser from "phaser";
import type { BuildingId } from "./buildings";
import type { Profile } from "./profile";
import type { NpcId } from "./npcs";

export interface GameEvents {
  /** The city scene finished loading and is on screen. */
  "city-ready": [];
  /**
   * The pointer moved onto a building (or off all of them: null). ``anchor`` is the building's
   * top-right corner in screen pixels, re-sent whenever the camera moves it.
   */
  "building-hover": [id: BuildingId | null, anchor?: { x: number; y: number }];
  /** The player reached a building's door and went in. */
  "building-entered": [id: BuildingId];
  /** React closed the building's panel; the player steps back outside. */
  "building-left": [id: BuildingId];
  /** React sends the player to a building (an event card's or someone's "go there"); they hop over and go in. */
  "go-to-building": [id: BuildingId];
  /** The player chose (or changed) their name and look; the city redraws their sprite. */
  "profile-changed": [profile: Profile];
  /** The player reached someone in the street and started talking. */
  "npc-talk": [id: NpcId];
  /** React closed the conversation; they go back to pottering about. */
  "npc-left": [id: NpcId];
  /** Who has something new to say, worked out by React from the engine state. */
  "npc-alerts": [alerts: Partial<Record<NpcId, boolean>>];
}

type Handler<K extends keyof GameEvents> = (...args: GameEvents[K]) => void;

class TypedEventBus {
  private emitter = new Phaser.Events.EventEmitter();

  emit<K extends keyof GameEvents>(event: K, ...args: GameEvents[K]): void {
    this.emitter.emit(event, ...args);
  }

  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }
}

export const EventBus = new TypedEventBus();
