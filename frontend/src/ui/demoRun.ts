/**
 * A real engine snapshot (First of Their Line, seed 42, two shifts into Spring) for checking the
 * HUD's layout without a backend: open the game with ``?demo``. Never used otherwise.
 */

import type { Run } from "../types";

export const DEMO_RUN: Run = {
  run_id: "demo",
  events: ["Worked a shift for 50◈.", "Worked a shift for 50◈."],
  state: {
    class_id: "first_of_their_line",
    seed: 42,
    version: 2,
    development: false,
    purse: 90000,
    vault: 0,
    debt: 54000,
    kelp: 0,
    tides: 4,
    season: "Spring",
    standing: 580,
    passage: false,
    available_actions: ["visit", "work", "rest", "end_season", "market_visit", "exchange_visit", "save"],
    details: {
      view: {
        phase: "playing",
        season_index: 0,
        tide: 2,
        tides_total: 6,
        hungry_next: false,
        free_visits: { market: true, exchange: true },
        card: { balance: 0, limit: 40000, min_due: 0, frozen: false, secured: false },
        loans: { guild_loan: { balance: 50000, rate: 0.01, payment_due: 0 } },
        passage_price: 120000,
        passage_paid: null,
        net_worth: 36000,
        scrolls: [],
      },
    },
  },
};
