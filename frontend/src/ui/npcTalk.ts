/**
 * What the people of Atlantis say, and what they offer to do with you.
 *
 * Everything here follows the engine. Lines are built from the engine's public state
 * (``state.details.view``) and from the event lines the engine has already announced ("heard"),
 * so nobody knows a secret the engine keeps hidden: which rumors are true, the year's scenario,
 * when the Council will debase the coin. Every number comes from the state, never from here.
 *
 * Tasks are the engine's own actions (``available_actions``), sent through the same API as the
 * money panels, so the engine decides whether they're allowed and what they cost. "Go to" tasks
 * take the player into a building, which the engine records as a visit: time at the Drowned Bell
 * makes tavern talk more likely, and the Black Reef draws pickpockets.
 *
 * In-world words only (Standing, Vault, Leviathan Credit, ◈): real-world terms belong to the
 * Modern Mirror. Owned by P3 for now; the writing could move into backend/app/content/npcs.json.
 */

import type { BuildingId } from "../game/buildings";
import type { NpcId } from "../game/npcs";
import type { ActionInput } from "../store";
import type { State } from "../types";

/** One event line the engine announced, and the state version it arrived with. */
export interface Heard {
  version: number;
  text: string;
}

export interface Choice {
  label: string;
  /** An engine action this choice carries out. */
  action?: ActionInput;
  /** Or a building to go into. */
  goTo?: BuildingId;
  /** Why it can't be taken right now; the button is disabled. */
  blocked?: string;
  /** A short fact about the choice, shown under it. */
  note?: string;
}

export interface Talk {
  lines: string[];
  choices: Choice[];
  /** Something new or waiting on the player: shows the "!" over their head. */
  alert: boolean;
}

export interface TalkContext {
  /** The journey's state, or null before one has started. */
  state: State | null;
  /** Whether choices can act (a real journey, not the ?demo preview). */
  playable: boolean;
  heard: Heard[];
  /** The state version when the player last spoke to this person (0 if never). */
  lastTalked: number;
}

// --- Reading the engine's state --------------------------------------------------------------------

interface Loan {
  balance: number;
  rate: number;
  payment_due: number;
}

interface View {
  passage_price?: number;
  vault_locked?: number;
  vault_rate?: number;
  hungry_next?: boolean;
  free_visits?: { market?: boolean; exchange?: boolean };
  standing_factors?: Partial<Record<"payments" | "credit_used" | "history", number>>;
  card?: { balance: number; limit: number; min_due: number; frozen: boolean } | null;
  loans?: Partial<Record<"guild_loan" | "bank_loan" | "black_reef_loan" | "circle_loan", Loan>>;
  bills?: Array<{ id: number; kind: string; amount: number; late: boolean }>;
  circle_due?: number;
  prices?: { houses?: Record<string, number> };
  shares?: Record<string, number>;
  house_records?: Record<string, boolean[]>;
  storm_level?: number;
  offers?: Array<{ kind: string; amount: number }>;
}

const viewOf = (state: State): View => (state.details.view ?? {}) as View;

/** Money arrives in hundredths of a coin; people speak in whole coins. */
const coins = (minor: number) => Math.floor(minor / 100);
const fmt = (minor: number) => `${coins(minor).toLocaleString("en-US")}◈`;
const pct = (rate: number) => `${Math.round(rate * 100)}%`;
/** Actions take money in hundredths too, and only whole coins. */
const whole = (minor: number) => coins(minor) * 100;

const can = (state: State, kind: string) => state.available_actions.includes(kind);

/** A choice that runs an engine action, blocked with a reason when it can't run. */
function act(ctx: TalkContext, label: string, action: ActionInput, cost = 0, note?: string): Choice {
  const state = ctx.state!;
  let blocked: string | undefined;
  if (!ctx.playable) blocked = "Start a journey to do this.";
  else if (!can(state, action.kind)) blocked = "Not something you can do right now.";
  else if (cost > state.purse) blocked = "Not enough coin in your Purse.";
  return { label, action, blocked, note };
}

// --- Reading what the engine has announced ---------------------------------------------------------

const CLUE = /^A rumor from (.+?) \((.+?)\)\.$/;

/** What each clue the engine drops sounds like, and who says it (sources in config.SCENARIO_CLUES). */
const CLUE_LINES: Record<string, { by: NpcId; line: string }> = {
  "debasement.orichalcum": { by: "nerissa", line: "They say the Council is short on orichalcum." },
  "scenario.silk_boom": { by: "kaito", line: "Word from the surface: the kingdoms are ordering cloth by the shipload." },
  "scenario.kelp_blight": { by: "nerissa", line: "Farmers are whispering about rot in the kelp beds." },
  "scenario.stormy_seas": { by: "oro", line: "Mark me: the autumn seas will be cruel this year." },
};

/** The newest heard line matching ``test``, if any. */
function latest(heard: Heard[], test: (text: string) => boolean): Heard | undefined {
  for (let i = heard.length - 1; i >= 0; i--) if (test(heard[i].text)) return heard[i];
  return undefined;
}

/** Clues this person has to pass on, newest last. */
function cluesFor(heard: Heard[], who: NpcId): Array<Heard & { line: string }> {
  const out: Array<Heard & { line: string }> = [];
  for (const h of heard) {
    const key = CLUE.exec(h.text)?.[2];
    const clue = key ? CLUE_LINES[key] : undefined;
    if (clue?.by === who && !out.some((o) => o.line === clue.line)) out.push({ ...h, line: clue.line });
  }
  return out;
}

const isNew = (ctx: TalkContext, h?: Heard) => !!h && h.version > ctx.lastTalked;

// --- The people ----------------------------------------------------------------------------------

type Speaker = (ctx: TalkContext) => Talk;

const kaito: Speaker = (ctx) => {
  const lines = ["Hear the Council's word. What the Herald says is always true."];
  const choices: Choice[] = [];
  let alert = false;
  const { state } = ctx;
  if (state) {
    const v = viewOf(state);
    if (state.season === "Long Dark") {
      lines.push("The Long Dark has come. The last ship sails when the final tide runs out.");
    } else if (v.passage_price) {
      lines.push(`It is ${state.season}. Passage on the last ship costs ${fmt(v.passage_price)} today.`);
    }
    const season = latest(ctx.heard, (t) => / began\. Passage costs /.test(t));
    const debased = latest(ctx.heard, (t) => t.startsWith("The Council debased the coin"));
    if (debased) {
      lines.push("By the Council's decree the coin was debased. Prices and Passage rose; coin in hand did not.");
    }
    const rate = latest(ctx.heard, (t) => t.startsWith("The Council set the Vault rate"));
    if (rate && v.vault_rate !== undefined) {
      lines.push(`The Council now pays ${pct(v.vault_rate)} a season on coin kept in a Vault.`);
    }
    const clues = cluesFor(ctx.heard, "kaito");
    for (const clue of clues) lines.push(clue.line);
    const tithe = (v.bills ?? []).filter((b) => b.kind === "tithe");
    const owed = tithe.reduce((sum, b) => sum + b.amount, 0);
    if (owed > 0) {
      lines.push(`The Council's tithe is ${fmt(owed)} this season. A late tithe marks your Standing.`);
      choices.push(act(ctx, `Pay the tithe (${fmt(owed)})`, { kind: "pay_tithe", amount: whole(owed) }, owed));
    }
    alert = owed > 0 || [season, debased, rate, ...clues].some((h) => isNew(ctx, h));
  }
  return { lines, choices, alert };
};

const ione: Speaker = (ctx) => {
  const lines = ["Welcome to the Bank of the Tides. Nothing here costs a tide."];
  const choices: Choice[] = [];
  let alert = false;
  const { state } = ctx;
  if (state) {
    const v = viewOf(state);
    const fraud = v.offers?.find((o) => o.kind === "fraud_charge");
    if (fraud) {
      lines.push(
        `There's a charge of ${fmt(fraud.amount)} in your Purse ledger that nobody here recognizes. ` +
          "Dispute it this season, or the coin is gone for good.",
      );
      choices.push(act(ctx, "Dispute the charge", { kind: "dispute_charge" }));
      alert = true;
    }
    const pickpocket = latest(ctx.heard, (t) => t.startsWith("A pickpocket took"));
    if (isNew(ctx, pickpocket)) {
      lines.push("I heard about the pickpocket. Coin in a Vault can't be stolen.");
      alert = true;
    }
    if (state.vault === null) {
      lines.push("You have no Vault yet. Coin kept there is safe from thieves and grows a little each season.");
      if (can(state, "open_vault")) {
        choices.push(act(ctx, "Open a Vault", { kind: "open_vault" }));
        alert = true;
      }
    } else {
      const locked = v.vault_locked ? ` (${fmt(v.vault_locked)} of it held for your card)` : "";
      lines.push(`Your Vault holds ${fmt(state.vault)}${locked}.`);
      if (coins(state.purse) >= 2) {
        const half = whole(state.purse / 2);
        choices.push(act(ctx, `Put ${fmt(half)} in the Vault`, { kind: "save", amount: half }, half));
        choices.push(act(ctx, `Put all ${fmt(state.purse)} in the Vault`, { kind: "save", amount: whole(state.purse) }, state.purse));
      }
    }
    if (state.standing === null) {
      lines.push("You have no Standing yet, so I can't issue a Leviathan card on your word alone.");
      if (can(state, "open_secured_card")) {
        lines.push("Lock some coin in a Vault as surety and I'll issue you a starter card.");
        choices.push(act(ctx, "Ask for a starter card", { kind: "open_secured_card" }));
        alert = true;
      }
    } else {
      lines.push(`Your Standing is ${state.standing}.`);
    }
    if (v.card) {
      if (v.card.frozen) lines.push("Your Standing fell too low, so the Bank has frozen your Leviathan card.");
      else lines.push(`Your Leviathan Credit: ${fmt(v.card.balance)} owed of a ${fmt(v.card.limit)} limit.`);
      if (v.card.min_due > 0) {
        lines.push(`At least ${fmt(v.card.min_due)} is due before the season ends.`);
        choices.push(act(ctx, `Pay ${fmt(v.card.min_due)}`, { kind: "repay_credit", amount: whole(v.card.min_due) }, v.card.min_due));
        alert = true;
      }
      if (v.card.balance > (v.card.min_due || 0)) {
        choices.push(act(ctx, `Pay it all (${fmt(v.card.balance)})`, { kind: "repay_credit", amount: whole(v.card.balance) }, v.card.balance));
      }
    }
  }
  return { lines, choices, alert };
};

const FACTOR_NAMES = { payments: "paying on time", credit_used: "how much of your card you use", history: "the seasons your accounts have stood open" };

const sefa: Speaker = (ctx) => {
  const lines = ["A shift's work for a shift's pay. Every shift spends a tide."];
  const choices: Choice[] = [];
  let alert = false;
  const { state } = ctx;
  if (state) {
    const v = viewOf(state);
    if (state.tides === 0) lines.push("No tides left this season. The Hall opens again when the tide turns.");
    choices.push(act(ctx, "Work a shift", { kind: "work" }, 0, "Spends a tide."));
    if (v.hungry_next) {
      lines.push("Word is your household went hungry. You'll have fewer tides next season.");
      alert = true;
    }
    const guild = v.loans?.guild_loan;
    if (guild && guild.balance > 0) {
      lines.push(`Your guild loan stands at ${fmt(guild.balance)}. It must be settled before the last ship will take you.`);
      const pay = Math.min(state.purse, guild.balance);
      if (coins(pay) > 0) choices.push(act(ctx, `Repay ${fmt(pay)} of the guild loan`, { kind: "repay_guild", amount: whole(pay) }, pay));
    }
    // The First of Their Line's strength: Sefa walks them through every part of their Standing.
    const factors = v.standing_factors ?? {};
    if (state.class_id === "first_of_their_line" && Object.keys(factors).length) {
      const parts = (Object.keys(FACTOR_NAMES) as Array<keyof typeof FACTOR_NAMES>)
        .filter((k) => factors[k] !== undefined)
        .map((k) => `${FACTOR_NAMES[k]} ${factors[k]! >= 0 ? "+" : ""}${factors[k]}`);
      lines.push(`Last season your Standing moved like this: ${parts.join(", ")}.`);
      alert = alert || isNew(ctx, latest(ctx.heard, (t) => t.startsWith("Standing moved")));
    }
  }
  return { lines, choices, alert };
};

const nerissa: Speaker = (ctx) => {
  const lines = ["Sit, drink, listen. Talk at the Bell is right more often than not."];
  const talk = latest(ctx.heard, (t) => t.startsWith("Tavern talk: "));
  const corrected = latest(ctx.heard, (t) => / proved false\.$/.test(t));
  const scam = latest(ctx.heard, (t) => t.startsWith("The Pearl Exchange vanished"));
  const clues = cluesFor(ctx.heard, "nerissa");
  if (talk) lines.push(`The talk tonight: ${talk.text.replace("Tavern talk: ", "")} Make of it what you will.`);
  if (corrected && (!talk || corrected.version >= talk.version)) {
    lines.push(`${corrected.text.replace(/^The rumor about (.+) proved false\.$/, "That talk about $1? It came to nothing.")}`);
  }
  for (const clue of clues) lines.push(clue.line);
  if (scam) lines.push("The Pearl Exchange folk vanished overnight, and plenty of coin went with them.");
  if (!talk && !clues.length && !scam) lines.push("Nothing worth repeating yet. Talk reaches the Bell first; sit a while.");
  return {
    lines,
    choices: [{ label: "Go into the Drowned Bell", goTo: "drowned_bell", note: "Time at the Bell brings more tavern talk your way." }],
    alert: [talk, corrected, scam, ...clues].some((h) => isNew(ctx, h)),
  };
};

const maro: Speaker = (ctx) => {
  const lines = ["We pool our coin and take turns with the pot. A loan from friends is still a loan."];
  const choices: Choice[] = [];
  let alert = false;
  const { state } = ctx;
  if (state) {
    const v = viewOf(state);
    const circle = v.loans?.circle_loan;
    if (circle && circle.balance > 0) {
      lines.push(`The circle trusted you with the first pot. You still owe it ${fmt(circle.balance)}.`);
      const due = v.circle_due ?? 0;
      if (due > 0) {
        lines.push(`${fmt(due)} is due to the circle before this season ends. The circle remembers who keeps faith.`);
        choices.push(act(ctx, `Pay the circle ${fmt(due)}`, { kind: "pay_circle", amount: whole(due) }, due));
        alert = true;
      }
      if (circle.balance > due) {
        choices.push(act(ctx, `Pay off the rest (${fmt(circle.balance)})`, { kind: "pay_circle", amount: whole(circle.balance) }, circle.balance));
      }
    }
    if (state.kelp === 0 && state.season !== "Long Dark") {
      lines.push("Your cellar is bare. Kelp costs more in the Long Dark than in any other season.");
    }
    const luck = latest(ctx.heard, (t) => t.startsWith("Lucky salvage") || t.startsWith("The roof leaked"));
    if (luck) lines.push("Fortune comes and goes like the tide. Keep something by for the leaky roof.");
  } else {
    lines.push("Every family in the outer ring has a share in a circle. It's how we get by.");
  }
  return { lines, choices, alert };
};

/** A house's last voyages, newest last, in a captain's words. */
const record = (ships: boolean[] = []) => ships.map((ok) => (ok ? "home safe" : "lost")).join(", ");

function harborChoice(ctx: TalkContext): Choice {
  const free = ctx.state ? viewOf(ctx.state).free_visits?.exchange : false;
  return {
    label: "Go to the Harbor Exchange",
    goTo: "harbor",
    note: free ? "Your first Exchange visit this season costs no tide." : "Trading at the Exchange spends a tide.",
  };
}

const oro: Speaker = (ctx) => {
  const lines = ["Oro & Daughters. Steady ships, steady dividends."];
  let alert = false;
  const { state } = ctx;
  if (state) {
    const v = viewOf(state);
    const price = v.prices?.houses?.oro;
    if (price) lines.push(`Our shares trade at ${fmt(price)}.`);
    const ships = v.house_records?.oro ?? [];
    lines.push(ships.length ? `Our last voyages: ${record(ships)}.` : "Our ships are at sea. You'll hear when they land.");
    if (state.season === "Long Dark") lines.push("No ships sail in the Long Dark. Only the last one, and it won't wait.");
    if ((v.storm_level ?? 0) > 0) {
      lines.push("Storm warnings are up. Every ship at sea has worse odds until they pass.");
      alert = isNew(ctx, latest(ctx.heard, (t) => t.startsWith("A storm warning")));
    }
  }
  const clues = cluesFor(ctx.heard, "oro");
  for (const clue of clues) lines.push(clue.line);
  return { lines, choices: [harborChoice(ctx)], alert: alert || clues.some((h) => isNew(ctx, h)) };
};

const dax: Speaker = (ctx) => {
  const lines = ["Leviathan Line! Big ships, big hauls, big swings."];
  let alert = false;
  const { state } = ctx;
  if (state) {
    const v = viewOf(state);
    const price = v.prices?.houses?.leviathan;
    if (price) lines.push(`A share of the Line goes for ${fmt(price)} today.`);
    const held = v.shares?.leviathan ?? 0;
    if (held > 0) lines.push(`You've ${held} ${held === 1 ? "share" : "shares"} riding with us. Hold on tight.`);
    const ships = v.house_records?.leviathan ?? [];
    if (ships.length) lines.push(`Our last voyages: ${record(ships)}.`);
    const landed = latest(ctx.heard, (t) => t.startsWith("Voyages landed") && t.includes("Leviathan Line"));
    if (landed) {
      lines.push(
        landed.text.includes("Leviathan Line succeeded")
          ? "Did you see? The Line came home heavy!"
          : "We lost one. The sea takes its share, and we sail again.",
      );
      alert = isNew(ctx, landed);
    }
  }
  const talk = latest(ctx.heard, (t) => t.startsWith("Tavern talk: ") && t.includes("Leviathan Line"));
  if (talk) lines.push("Heard what they're saying about us at the Bell? Not everything said at the Bell is true.");
  return { lines, choices: [harborChoice(ctx)], alert };
};

const grin: Speaker = (ctx) => {
  const lines = ["Coin now, no questions asked. I never check anyone's Standing."];
  const choices: Choice[] = [];
  let alert = false;
  const { state } = ctx;
  if (state) {
    const v = viewOf(state);
    const owed = v.loans?.black_reef_loan;
    const offer = v.offers?.find((o) => o.kind === "grins_offer");
    if (offer && offer.amount > 0) {
      lines.push(`I could spare you up to ${fmt(offer.amount)} right now.`);
      const note = "Every debt must be settled before the last ship will take you.";
      choices.push(act(ctx, `Take ${fmt(offer.amount)}`, { kind: "borrow_black_reef", amount: whole(offer.amount) }, 0, note));
      const half = whole(offer.amount / 2);
      if (half > 0 && half < offer.amount) {
        choices.push(act(ctx, `Take ${fmt(half)}`, { kind: "borrow_black_reef", amount: half }, 0, note));
      }
      alert = true;
    }
    if (owed && owed.balance > 0) {
      lines.push(`You owe me ${fmt(owed.balance)}, and it grows by ${pct(owed.rate)} every season you leave it.`);
      const pay = Math.min(state.purse, owed.balance);
      if (coins(pay) > 0) choices.push(act(ctx, `Repay ${fmt(pay)}`, { kind: "repay_black_reef", amount: whole(pay) }, pay));
    } else if (!offer) {
      lines.push("Short of coin? You know where to find me.");
    }
  }
  choices.push({ label: "Go to the Black Reef", goTo: "black_reef", note: "Folk say pickpockets work the Reef." });
  return { lines, choices, alert };
};

const SPEAKERS: Record<NpcId, Speaker> = { kaito, ione, sefa, nerissa, maro, oro, dax, grin };

export function talk(id: NpcId, ctx: TalkContext): Talk {
  return SPEAKERS[id](ctx);
}
