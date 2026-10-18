/**
 * The game's words, from the design doc. Placeholder until Mitansh's writing in backend/app/content
 * replaces it: keep every player-facing line here so that swap touches one file.
 *
 * In-world terms only, except in the Modern Mirror (the ending), which names the real ideas.
 */

import type { ClassId } from "../types";

export interface ClassCopy {
  id: ClassId;
  name: string;
  job: string;
  start: string;
  barrier: string;
  strength: string;
}

export const CLASSES: ClassCopy[] = [
  {
    id: "newcomer",
    name: "Newcomer",
    job: "Dock trader · 60◈ a shift",
    start: "500◈ in your Purse",
    barrier: "Unrated. No Standing yet, so no Leviathan card or loans until you open a secured card.",
    strength: "You know the surface ports: tavern rumors reach you right nine times in ten.",
  },
  {
    id: "first_of_their_line",
    name: "First of Their Line",
    job: "Guild apprentice · 50◈ a shift, +10◈ each season",
    start: "800◈, but 500◈ of it is owed to the guild",
    barrier: "No family savings behind you, and a guild loan to clear before Passage.",
    strength: "Your pay grows every season, and Ione and Sefa explain more of every choice.",
  },
  {
    id: "caretaker",
    name: "Caretaker",
    job: "Kelp farmer · 55◈ a shift",
    start: "700◈, plus the lending circle's first 400◈ pot",
    barrier: "Care takes two tides in Summer and the Long Dark, and a 60◈ care bill every season.",
    strength: "Old Maro's lending circle gives you the first pot, and stands by you if you stand by it.",
  },
  {
    id: "tidewalker",
    name: "Tidewalker",
    job: "Salvage diver · 0–120◈ a shift",
    start: "500◈ in your Purse",
    barrier: "Pay swings with every dive, no Vault until Standing 550, and Grin knows your street.",
    strength: "Lucky salvage finds you three times as often.",
  },
];

/** Event cards: a title for each event the engine can fire. */
export const EVENT_TITLES: Record<string, string> = {
  kelp_blight_scare: "Blight in the Kelp Beds",
  storm_warning: "Storm Warning",
  fraud_charge: "A Charge You Don't Recognize",
  pickpocket: "Pickpocketed",
  roof_leak: "The Roof Leaks",
  surface_boom: "Boom on the Surface",
  tavern_rumor: "Tavern Talk",
  lucky_salvage: "Lucky Salvage",
  grins_offer: "Grin Has an Offer",
  pearl_exchange: "The Pearl Exchange",
  council_rate_change: "The Council Moves the Vault Rate",
};

export const MOMENT_TITLES: Record<string, string> = {
  scroll: "A New Scroll",
  debasement: "The Coin Is Debased",
  clue: "Word Reaches You",
  passage_bought: "Passage Secured",
  fraud_lost: "The Charge Stands",
  scam_revealed: "The Pearl Exchange Is Gone",
  card_frozen: "Card Frozen",
};

export const SCROLLS: Record<string, { name: string; how: string }> = {
  rainy_day: { name: "Rainy Day", how: "Enter the Long Dark with a season of kelp stored." },
  bought_low: { name: "Bought Low", how: "Stockpile kelp in Summer." },
  melting_coin: { name: "The Melting Coin", how: "Hold lots of coin through the debasement." },
  debt_spiral: { name: "The Debt Spiral", how: "Pay only the minimum on Leviathan Credit for two seasons." },
  rich_on_paper: { name: "Rich on Paper", how: "Own enough for Passage but fail to turn it into coin in time." },
  not_all_on_one_ship: { name: "Not All on One Ship", how: "Hold three houses, or the Tide Index." },
  fire_sale: { name: "Fire Sale", how: "Sell at a loss in the Long Dark." },
  siren_song: { name: "Siren Song", how: "Fall for the Pearl Exchange." },
  read_the_ledger: { name: "Read the Ledger", how: "Catch and dispute a fraudulent charge." },
  credit_built: { name: "Credit Built", how: "Take your Standing from Unrated to 580." },
  good_debt: { name: "Good Debt", how: "Earn more from a loan-funded business than the loan costs." },
  circle_of_trust: { name: "Circle of Trust", how: "Never miss a circle payment, even in the Long Dark." },
};

export const ENDINGS: Record<string, { title: string; line: string }> = {
  escaped_with_wealth: {
    title: "Escaped with Wealth",
    line: "You board the last ship with a full purse, and watch Atlantis slip beneath the waves.",
  },
  escaped_with_nothing: {
    title: "Escaped with Nothing",
    line: "You board the last ship with little but your Passage. You are alive, and that is everything.",
  },
  rescued_by_circle: {
    title: "Rescued by the Circle",
    line: "You came up short, but Old Maro's circle covered the gap. You kept faith with them; they kept faith with you.",
  },
  missed_the_ship: {
    title: "Missed the Last Ship",
    line: "The last ship sails without you. Atlantis goes dark.",
  },
};

/** The Modern Mirror: the only place real-world finance terms appear. */
export const MIRROR: Record<string, string> = {
  escaped_with_wealth:
    "In real life, this is an emergency fund plus a diversified portfolio. Cash for the unexpected, assets that grow faster than inflation, and no high-interest debt.",
  escaped_with_nothing:
    "In real life, this is about liquidity and timing. Wealth only helps if you can turn it into cash when you need it, and prices for the things you need rise over time.",
  rescued_by_circle:
    "In real life, this is a ROSCA (rotating savings and credit association), one of the oldest forms of community finance. A loan from friends is still a loan; keeping your payments is what keeps the safety net there.",
  debt:
    "In real life, this is compound interest working against you. Credit card APRs around 30% and payday lenders double what you owe fast. Pay balances in full and avoid cash advances.",
  illiquid:
    "In real life, this is a liquidity crisis. Assets aren't cash: in a panic they sell at a discount, or can't be sold in time. Keep enough in cash for what you know is coming.",
  scam:
    "In real life, this is investment fraud. A “guaranteed” high return is the oldest sign of a scam. If it can't lose, it isn't real.",
  no_savings:
    "In real life, this is inflation outrunning cash. Wages alone rarely keep up with rising prices; saving early and investing steadily is how ordinary incomes get ahead.",
};

export const HOUSES: Record<string, string> = {
  oro: "Oro & Daughters",
  leviathan: "Leviathan Line",
  deepcoral: "Deepcoral Salvage",
  silkwind: "Silkwind Trading",
  tide_index: "The Tide Index",
};

export const HOUSE_NOTES: Record<string, string> = {
  oro: "Steady voyages and a small dividend when they land.",
  leviathan: "Big wins, big losses.",
  deepcoral: "One jackpot in ten. Usually sinks.",
  silkwind: "Rides the surface's appetite for silk.",
  tide_index: "A little of every house, for a small fee.",
};

export const GOODS: Record<string, { name: string; note: string }> = {
  kelp: { name: "Kelp", note: "Your household eats 20 a season. Dear in the Long Dark." },
  pearls: { name: "Pearls", note: "Holds its value as prices rise." },
  silk: { name: "Sea Silk", note: "Booms with the surface trade." },
};
