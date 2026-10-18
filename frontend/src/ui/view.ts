/**
 * The engine's public view of a run (``state.details.view``, built by backend/app/engine/bridge.py
 * ``view``) and what one move set off (``state.details.moments``). The shared contract leaves
 * ``details`` untyped, so these types say what the bridge sends. Money is in hundredths of a coin.
 */

import type { State } from "../types";

export interface GameView {
  phase?: "playing" | "final_call" | "ended";
  season_index?: number;
  tide?: number;
  tides_total?: number;
  hungry_next?: boolean;
  wage?: { min: number; max: number };
  limits?: {
    cellar: number;
    kelp_per_season: number;
    black_reef_max: number;
    secured_deposit: number;
    vault_min_standing: number;
  };
  free_visits?: { market?: boolean; exchange?: boolean };
  vault_locked?: number;
  vault_rate?: number;
  standing_factors?: { payments?: number; credit_used?: number; history?: number };
  card?: { balance: number; limit: number; min_due: number; frozen: boolean; secured: boolean } | null;
  loans?: Record<string, { balance: number; rate: number; payment_due: number }>;
  bills?: Array<{ id: number; kind: string; amount: number; late: boolean }>;
  circle_due?: number;
  passage_price?: number;
  passage_paid?: number | null;
  prices?: { goods: Record<string, number>; houses: Record<string, number> };
  stores?: Record<string, number>;
  shares?: Record<string, number>;
  house_records?: Record<string, boolean[]>;
  storm_level?: number;
  offers?: Array<{ kind: string; amount: number }>;
  scrolls?: string[];
  /** This season's market shock, once it has hit (an id in content/events.json "shocks"). */
  shock?: string | null;
  tavern?: { games_left: number; min: number; max: number; net: number };
  net_worth?: number;
  ending?: string | null;
  miss_cause?: string | null;
}

export interface Moment {
  kind: string;
  text: string;
  event?: string;
  scroll?: string;
  season?: string;
  ending?: string;
  source?: string;
  shock?: string;
  /** A game at the Drowned Bell: stake and winnings in hundredths. */
  game?: string;
  stake?: number;
  won?: number;
  pick?: number;
  pearl?: number;
  multiple?: number;
}

export const viewOf = (state: State): GameView => (state.details.view ?? {}) as GameView;
export const momentsOf = (state: State): Moment[] => (state.details.moments ?? []) as Moment[];

/** Hundredths of a coin to whole coins, rounded down (the engine only deals in whole coin). */
export const coins = (minor: number) => Math.floor(minor / 100);
export const fmt = (minor: number) => `${coins(minor).toLocaleString("en-US")}◈`;
/** Whole coins typed by the player to the contract's hundredths. */
export const toMinor = (wholeCoins: number) => Math.round(wholeCoins * 100);

export const loanOf = (view: GameView, kind: string) =>
  Object.entries(view.loans ?? {}).find(([name]) => name.startsWith(kind))?.[1];
