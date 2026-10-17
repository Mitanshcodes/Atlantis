/**
 * The one channel between Phaser and React. Scenes emit what the player does in the world;
 * React emits what the UI decides. Event names and payloads are typed here so both sides agree.
 */

import Phaser from "phaser";
import type { BuildingId } from "./buildings";

export interface GameEvents {
  /** The city scene finished loading and is on screen. */
  "city-ready": [];
  /** The pointer moved onto a building (or off all of them: null). */
  "building-hover": [id: BuildingId | null];
  /** The player reached a building's door and went in. */
  "building-entered": [id: BuildingId];
  /** React closed the building's panel; the player steps back outside. */
  "building-left": [id: BuildingId];
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
