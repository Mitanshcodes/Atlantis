/**
 * The game's words, from the design doc. Placeholder until Mitansh's writing in backend/app/content
 * replaces it: keep every player-facing line here so that swap touches one file.
 *
 * In-world terms only, except in the Modern Mirror (the ending), which names the real ideas.
 */

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

export const CLASSES: ClassCopy[] = [
  {
    id: "newcomer",
    title: "The Newcomer",
    name: "Newcomer",
    job: "Dock trader · 60◈ a shift",
    coin: 500,
    hard: "No history with the Bank, so no card or loans at first.",
    edge: "Hears the surface ports. Rumors are right 9 times in 10.",
    standing: "Unrated",
    pay: "60◈",
    scene: "v_newcomer",
    chelo: "New to the city? The Bank won't lend to a stranger. A secured card is how you become someone it knows.",
    story:
      "You came down from the surface ports with a trader's ear and 500◈. The Bank has never heard of you, so it won't lend you a thing until you give it a reason to.",
  },
  {
    id: "first_of_their_line",
    title: "First of Their Line",
    name: "First of Their Line",
    job: "Guild apprentice · 50◈ a shift",
    coin: 800,
    coinNote: "500◈ of it owed to the guild",
    hard: "No family savings, and a guild loan to repay.",
    edge: "Pay rises 10◈ each season. Ione and Sefa explain more.",
    standing: "580",
    pay: "50◈",
    scene: "v_first",
    chelo: "You hold 800◈, but 500◈ of it isn't yours. Passage won't sell to anyone who still owes the guild.",
    story:
      "No one in your family has ever kept a Vault. You're the first to apprentice at the Guild Hall: 50◈ a shift, and 10◈ more each season. You start with 800◈, but 500◈ of it is owed to the guild.",
  },
  {
    id: "caretaker",
    title: "The Caretaker",
    name: "Caretaker",
    job: "Kelp farmer · 55◈ a shift",
    coin: 700,
    hard: "Care takes 2 of 6 tides in Summer and the Long Dark, plus 60◈ a season.",
    edge: "Old Maro's circle hands you its first 400◈ pot.",
    standing: "620",
    pay: "55◈",
    scene: "v_caretaker",
    chelo: "The circle's pot is trust, not a gift. Pay it back a hundred a season and they'll stand by you to the end.",
    story:
      "You farm kelp and care for someone who needs you, and that costs tides and coin every season. But Old Maro's lending circle has handed you its first 400◈ pot.",
  },
  {
    id: "tidewalker",
    title: "The Tidewalker",
    name: "Tidewalker",
    job: "Salvage diver · 0 to 120◈",
    coin: 500,
    hard: "Pay swings every tide. No Vault until your Standing reaches 550.",
    edge: "Lucky salvage finds you three times as often.",
    standing: "540",
    pay: "0–120◈",
    scene: "v_tidewalker",
    chelo: "Some dives come up empty. Keep coin aside for the lean tides, and keep clear of Grin.",
    story:
      "You dive the wrecks off the outer ring. Some tides you bring up 120◈, some tides nothing at all. The Bank won't give you a Vault yet, and Grin knows your street.",
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
    line: "{name} boards the last ship with a full purse, and watches Atlantis slip beneath the waves.",
  },
  escaped_with_nothing: {
    title: "Escaped with Nothing",
    line: "{name} boards the last ship with little but a Passage. Alive, and that is everything.",
  },
  rescued_by_circle: {
    title: "Rescued by the Circle",
    line: "{name} came up short, but Old Maro's circle covered the gap. Faith kept is faith returned.",
  },
  missed_the_ship: {
    title: "Missed the Last Ship",
    line: "The last ship sails without {name}. Atlantis goes dark.",
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
