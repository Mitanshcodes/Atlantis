/**
 * The season report card, as GET /runs/{id}/report sends it (app/engine/bridge.py season_report).
 * Unlike the rest of the API, money here is in whole coin.
 */

export interface ReportMark {
  subject: "pace" | "tides" | "food" | "safety" | "debt";
  label: string;
  grade: "A" | "B" | "C" | "D";
  text: string;
}

export interface ReportLine {
  category: string;
  label: string;
  amount: number;
}

export interface ReportHolding {
  house: string;
  name: string;
  shares: number;
  paid: number;
  value: number;
  price_start: number;
  price_end: number;
  /** This season's price move, as a fraction (0.08 = +8%). */
  change: number;
  season_gain: number;
  /** Whether its voyage landed this season; null for the Tide Index. */
  voyage: boolean | null;
}

export interface SeasonReport {
  season: string;
  season_index: number;
  next_season: string;
  class_id: string;
  pace: {
    net_worth_start: number;
    net_worth_end: number;
    growth: number | null;
    passage_start: number;
    passage_next: number;
    passage_growth: number;
    ready: number;
    ready_share: number;
    worth_share: number;
  };
  /** Where you'd want to be by now, as % of next season's Passage. */
  target: number;
  marks: ReportMark[];
  tides: {
    total: number;
    uses: Array<{ use: string; label: string; count: number }>;
    free_trips: number;
    wages: number;
  };
  money: {
    in: ReportLine[];
    out: ReportLine[];
    total_in: number;
    total_out: number;
    saved: number;
    debt_paid: number;
    borrowed: number;
  };
  investments: {
    rows: ReportHolding[];
    dividends: number;
    index_change: number | null;
    pearls: { qty: number; paid: number; value: number } | null;
  };
  standing: {
    before: number;
    after: number;
    payments: number;
    credit_used: number;
    history: number;
  } | null;
  shock: string | null;
  events: string[];
  scrolls: string[];
  mirror: Array<{ topic: string; name: string; text: string }>;
  /** Chelo's hand-written bullets, used until (or instead of) the AI's. */
  chelo: string[];
}

/** Whole coins, with the coin sign. */
export const coin = (n: number) => `${Math.round(n).toLocaleString("en-US")}◈`;

/** A fraction as a signed percentage: 0.083 → "+8%". */
export const pct = (x: number) =>
  `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))}%`;
