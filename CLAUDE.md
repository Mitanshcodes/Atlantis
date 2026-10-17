# Atlantis

Hackathon game about personal finance. Atlantis sinks at the end of the year; the player wins by buying **Passage** on the last ship out, paid in coin, with **no debt of any kind**. It's a 2D city navigated by clicking. One run = one in-game year ≈ 10 minutes.

- **Target prizes:** Technica *Deep Sea Gamechanger* (gamification) and Capital One *Best Use of Nessie*.
- **Framing:** everyone starts Atlantis from a different place (four classes, each built on a real financial barrier).
- **Source of truth:** the design doc "Atlantis: Game Design" (Oct 17, 2026, @Mitansh). This file summarizes it. If they disagree, the doc wins; ask before changing the design.

## Stack

- **Backend:** Python (`backend/`). API routes, the deterministic engine, Nessie sync, Gemini Chronicle.
- **Frontend:** TypeScript + React + Phaser (`frontend/`). Phaser draws the clickable city; React draws every panel and screen on top. They talk through `EventBus.ts`.
- **External services:** Nessie (Capital One mock banking API) and Gemini. Keys go in `backend/.env` (template in `.env.example`); never commit real keys.

## Team and ownership

| Tag | Who | Area |
|---|---|---|
| **P1** | Person 1: Engine (suggested: Mitansh, since he designed the economics) | Game rules, numbers, tests, balance simulator |
| **P2** | Person 2: Nessie, API and money UI | State contract, API routes, Nessie, Gemini, frontend data layer, money panels |
| **P3** | Person 3: World, art and screens | Phaser city, art/audio, screen flow, non-panel UI, styling |
| **M** | Mitansh (alongside his role) | All writing in `backend/app/content/` |
| **Shared** | Not assigned in the work split | Coordinate before editing |

### Ownership rules

- **Stay in your own files.** Before editing, check the tag on the file in the tree below. If a change needs a file someone else owns, tell the user and ask instead of editing it.
- **Only P2 edits `backend/app/models.py` and `frontend/src/types.ts`, and both always change together** in the same commit. They're the shared state contract; everyone else codes against them.
- **Code freeze 3 hours before the deadline.**

## File structure

```
Atlantis/
├── README.md                          [Shared]
├── CREDITS.md                         [P3]  asset credits
├── CLAUDE.md                          [Shared]  this file
├── backend/
│   ├── requirements.txt               [Shared]
│   ├── .env.example                   [Shared]  Nessie + Gemini keys
│   ├── app/
│   │   ├── main.py                    [P2]  API routes
│   │   ├── models.py                  [P2]  game state + actions (shared contract)
│   │   ├── config.py                  [P1]  all tuning numbers
│   │   ├── engine/                    [P1]
│   │   │   ├── game.py                [P1]  new game, actions, season loop
│   │   │   ├── market.py              [P1]  kelp, pearls, prices
│   │   │   ├── exchange.py            [P1]  shipping houses, Tide Index
│   │   │   ├── money.py               [P1]  Purse, Vault, credit, Standing, Black Reef
│   │   │   ├── events.py              [P1]  event deck, scenarios
│   │   │   └── scrolls.py             [P1]  Scrolls, endings
│   │   ├── nessie/                    [P2]
│   │   │   ├── client.py              [P2]  Nessie API calls
│   │   │   ├── sync.py                [P2]  pushes transactions to Nessie
│   │   │   └── seed.py                [P2]  creates customers, accounts, merchants
│   │   ├── ai/                        [P2]
│   │   │   └── chronicle.py           [P2]  Gemini Chronicle
│   │   └── content/                   [M]   all writing
│   │       ├── classes.json           [M]
│   │       ├── events.json            [M]
│   │       ├── scenarios.json         [M]
│   │       ├── scrolls.json           [M]
│   │       └── npcs.json              [M]
│   ├── tests/                         [P1]
│   └── scripts/
│       └── simulate.py                [P1]  balance testing
└── frontend/
    ├── package.json                   [Shared]
    ├── public/assets/                 [P3]  city/ sprites/ ui/ audio/
    └── src/
        ├── main.tsx                   [Shared]
        ├── App.tsx                    [P3]  screen switcher
        ├── api.ts                     [P2]  backend calls
        ├── types.ts                   [P2]  mirrors models.py
        ├── store.ts                   [P2]  game state
        ├── styles.css                 [P3]
        ├── game/                      [P3]  Phaser
        │   ├── PhaserGame.tsx         [P3]
        │   ├── EventBus.ts            [P3]  Phaser ↔ React
        │   ├── buildings.ts           [P3]  click zones
        │   └── scenes/
        │       ├── Boot.ts            [P3]
        │       └── City.ts            [P3]
        └── ui/                        React
            ├── ClassSelect.tsx        [P3]
            ├── Hud.tsx                [P3]
            ├── Dialogue.tsx           [P3]
            ├── EventCard.tsx          [P3]
            ├── Chronicle.tsx          [P3]
            ├── Scrolls.tsx            [P3]
            ├── Ending.tsx             [P3]
            └── panels/                [P2]
                ├── Bank.tsx           [P2]
                ├── Market.tsx         [P2]
                ├── Exchange.tsx       [P2]  shares + Passage
                └── Ledger.tsx         [P2]  live Nessie log
```

The Python packages (`app/`, `engine/`, `nessie/`, `ai/`) also have empty `__init__.py` files, owned by whoever owns the folder. Empty asset and test folders hold a `.gitkeep`.

**How the layers fit:** the frontend sends an action → `main.py` validates it against `models.py` → `engine/` computes the new state (pure, seeded) → `nessie/sync.py` posts the resulting money movements to Nessie → the new state goes back to the frontend → `store.ts` updates and React re-renders. `ai/chronicle.py` turns the engine's event log into prose at season end, falling back to a template.

## Work split and milestones

| | P1: Engine | P2: Nessie, API and money UI | P3: World, art and screens |
|---|---|---|---|
| **Owns** | `config.py`, `engine/`, `tests/`, `scripts/simulate.py` | `models.py`, `main.py`, `nessie/`, `ai/`, `api.ts`, `types.ts`, `store.ts`, `ui/panels/` | `game/`, `public/assets/`, `CREDITS.md`, `App.tsx`, the rest of `ui/`, `styles.css` |
| **First 2 hours** | Market and kelp eating | Lock the state contract, get a Nessie key, seed Nessie | Pick art, build the city background, place click zones |
| **By hour 12** | One class plays a full year | Transactions post to Nessie; the four panels work | Swimming city, HUD, dialogue, ending |
| **By hour 18** | All classes, events, Scrolls, tuning | Gemini Chronicle, offline mode | Sound, the Long Dark moment, accessibility |

**M** writes everything in `content/` (classes, events, scenarios, Scrolls, NPC dialogue) alongside the P1 role.

## Non-negotiable architecture rules

1. **The engine is deterministic and made of pure functions.** Given the same seed, state and actions, it produces the same result. It owns every number: prices, rolls, events, Standing, interest.
2. **Nessie (Capital One's mock banking API) is the money layer.** Every coin movement is a real Nessie call: accounts, deposits, purchases, bills, transfers, loans, withdrawals. The engine decides the *rules*; Nessie records the *money*.
3. **Cache Nessie responses locally** so the game keeps working if the API lags or fails.
4. **Gemini only writes words.** It may write each season's Chronicle from the engine's event log, and answer "why did this happen?" using only facts the engine passes in. It may **not** set prices, roll outcomes, change Standing, or tell the player what to choose. (The Oracle asks questions; it never decides.) If Gemini fails or is slow, a **template Chronicle** fills in.
5. **Every tunable number lives in one config file.** Nothing in this doc gets hardcoded elsewhere. Playtesting should only ever touch config.
6. **Seeded RNG everywhere.** A fixed **judge-mode seed** gives a reliable demo run.
7. **Build scope:** core systems first. Anything marked *(only if ahead)* waits until the core loop works end to end.
8. **Teach by consequence.** Real-world finance terms (credit score, APR, inflation, etc.) appear **only in the Modern Mirror** at the end. In-game everything uses world terms (Standing, Leviathan Credit, Vault, ◈).
9. Classes are **never labeled by identity**; any class can look like anything.

## Glossary (in-world term → real concept → Nessie)

| In-world | Real concept | Nessie |
|---|---|---|
| ◈ | Currency (coin) | — |
| Purse | Cash / checking. The only coin that shops, the Market and the Exchange accept. No interest. Can be stolen. | Checking account |
| Vault | Savings. Earns 2%/season (below inflation). Safe from theft and scams. | Savings account |
| Leviathan Credit | Credit card | Credit card account |
| Standing | Credit score (300–850) | (engine-side) |
| Black Reef (Grin) | Payday lender / cash advance | Withdrawals |
| Tithe | Tax / recurring bill | Recurring bill |
| Harbor Exchange | Stock market | Purchases / deposits |
| Tide Index | Index fund | — |
| Debasement (Council of Ten) | Inflation / monetary policy | — |
| Lending circle (Old Maro) | ROSCA / community finance | Transfers between Nessie customers |
| Tide | Action point (6 per season) | — |

## The four classes

Each class is a separate seeded Nessie customer.

| Class | Job (pay/shift) | Barrier | Strength | Starts with | Nessie setup | Starting Standing |
|---|---|---|---|---|---|---|
| **Newcomer** | Dock trader, 60◈ | Unrated: no Standing history, so no Leviathan card or loans until they open a secured card | Surface-port rumors are right 90% instead of 70% | 900◈ | Checking only | Unrated (500 once secured card opens) |
| **First of Their Line** | Guild apprentice, 50◈, +10◈ each season | No family savings; owes a 600◈ guild loan | Pay grows every season; Ione and Sefa explain one extra factor in every decision | 400◈ | Checking, Savings, guild loan | 580 |
| **Caretaker** | Part-time kelp farmer, 55◈ | Care duties take 2 of 6 tides in Summer and the Long Dark; 60◈ care bill every season | Takes the first 400◈ pot in Old Maro's lending circle | 700◈ | Checking, Savings, extra recurring bill | 620 |
| **Tidewalker** | Salvage diver, 0–120◈ random (avg 60◈) | Irregular pay; can't open a Vault until Standing 550; lives in outer ring, so Grin's offers appear more often | Lucky salvage is 3× as likely | 500◈ | Checking with irregular deposits, no Savings | 540 |

Devpost angle: each class is built on a real financial barrier, many of which fall hardest on the communities Technica supports.

## Time and the season loop

Year: **Spring → Summer → Autumn → Long Dark**. Each season gives **6 tides**.

- **Costs 1 tide:** a work shift; a market trip (any number of goods); a Harbor Exchange visit (any number of orders); buying or selling a business.
- **Free:** moving around, talking, everything at the Bank (deposits, transfers, bills, loans), checking prices and news.

**Season order (Spring, Summer, Autumn):**
1. **Season opens:** Herald's news, new prices, new Passage price, bills posted to Nessie.
2. **Story beat**, if scheduled.
3. **Player spends tides.** Exchange prices move after every tide. 1–2 weighted events fire during the season. Passage can be bought at the Harbor on any tide; once bought it's locked in and the coin is gone.
4. **Season ends:**
   - Voyages land: big Exchange moves, dividends paid.
   - Business profit and upkeep.
   - Household eats **20 kelp**: from stores first, then bought at current price. No coin → goes on Leviathan Credit. No card → **hungry season: 2 fewer tides next season**.
   - Interest applied (Vault earns, Leviathan charges), minimum payments come due, Standing updates.
5. **The Chronicle** tells the season's story; new Scrolls unlock.

**The Long Dark runs differently,** so nothing hits after the player's last move: its bills, kelp and business profit post **when the season opens**. Ships stay in port, so **no voyages land**. The **Passage check happens right after the last tide**.

## Money layer

| System | Rules | Nessie |
|---|---|---|
| Purse | Everyday coin; only coin shops/Market/Exchange accept; no interest; can be stolen | Checking |
| Vault | 2%/season; safe from theft and scams | Savings |
| Leviathan Credit | 7.5%/season (30%/yr); minimum payment 10% of balance; missed minimum → Standing hit + 20◈ late fee; purchases over limit are declined | Credit card |
| Secured card (Newcomer) | Lock 200◈ in the Vault → Ione issues a 200◈ starter Leviathan card | Savings + credit card |
| Guild loan (First of Their Line) | 600◈ at 1%/season, all due before Passage; a simple bill | Loans |
| Tithe and care bills | Tithe 40◈/season for everyone; care bill 60◈/season for Caretaker | Recurring bills |
| Wages, dividends, sales | Credited when earned | Deposits |
| Goods and shares | Debited when bought | Purchases |
| Lending circle (Caretaker only) | 400◈ pot in Spring, paid back 100◈/season | Transfers between customers |
| Black Reef | Cash advance up to 300◈, 50% fee per season, no Standing check | Withdrawals |
| Bank loan *(only if ahead)* | Needs Standing 620+; up to 1,000◈; 3%/season; equal repayments over remaining seasons; missed payment → −60 Standing + 20◈ fee | Loans |

### Standing (300–850)

Shown to the player as three factors with arrows:
- **On-time payments** (biggest): +15 per clean season; −60 for a missed minimum; −40 for a late tithe.
- **Credit used:** −20 while over 50% of limit; +5 while under 30%.
- **History:** +10 per season with an account open.

Best possible gain ≈ +30/season, so building credit visibly takes the whole year.

**Leviathan limit by Standing:** <550 → 200◈; 550–649 → 400◈; 650+ → 800◈. **Below 450** the Bank freezes your card and stops lending; the Black Reef is the only lender left.

### Council of Ten

Three levers: the tithe, the Vault rate, and **debasing the coin**. A debasement raises goods prices and the Passage price by 15%; shares and upkeep are unchanged. It lands in **Summer or Autumn**, varying per run.

### Passage rule

Every debt must be settled first: Leviathan Credit, Bank and guild loans, and the Black Reef. Nobody borrows their way onto the ship.

## Grand Market

One market trip = 1 tide, whatever you buy or sell. Kelp and pearls are core; silk is *(only if ahead)*.

| Good | Role | Spring | Summer | Autumn | Long Dark | Notes |
|---|---|---|---|---|---|---|
| Kelp | Food | 4◈ | 3◈ | 5◈ | 12◈ (18◈ in Blight year) | Household eats 20/season; cellar holds 60 max; stored kelp spoils 10%/season |
| Pearls | Store of value | 40◈ | 42◈ | 46◈ | 48◈ | Swings up to 3%/tide; keeps pace with inflation; only −10% in the panic |
| Sea silk *(only if ahead)* | Trade good | 25◈ | 28◈ | 30◈ | 15◈ | Booms in summer with surface demand |

Table prices are base prices, before debasement and panic.

- **Price model:** `price = season base × event multiplier × (1 + your impact)`
- **Player impact, unit by unit:** each unit sold pushes price down 0.5%, each unit bought pushes it up 0.5%; you pay/receive the average across units. Half the impact fades each tide. Prices never fall below 20% of base.
- **Debasement:** after it lands, every goods price is 15% higher.
- **Long Dark panic:** silk −30%, pearls −10%.

## Harbor Exchange

Players buy shares in shipping houses. One visit = 1 tide, whatever orders are placed.

| House | Start price | Voyage success | Win / loss | Dividend | Moves per tide | Teaches |
|---|---|---|---|---|---|---|
| Oro & Daughters | 50◈ | 90% (95% in Summer of a Trade Boom year) | +8% / −15% | 2◈/share, only on success | ±2% | Blue chips, dividends |
| Leviathan Line (Dax) | 40◈ | 70% | +30% / −40% | None | ±6% | Leverage, boom and bust |
| Deepcoral Salvage | 20◈ | 10% jackpot | +150% / −20% | None | ±8% | Lottery thinking (negative EV) |
| The Tide Index | Average of the three | Follows the three | Follows the three | Passes through | Average | Diversification |
| Silkwind Trading *(only if ahead)* | 30◈ | 80% | +20% / −25% | 1◈, only on success | ±4% | Seasonality |

- Tide Index charges a **1% fee each season**.
- Each house shows: price chart, route, captain's record (last four voyages), storm risk this season, dividend.
- **Storm risk** multiplies every success chance: ×1 Spring/Summer, ×0.85 Autumn (×0.7 in a Stormy Seas year). No voyages in the Long Dark.

**How prices move:**
- **After each tide:** small random move, plus any news.
- **News:** Herald Kaito's announcements are always true. Nerissa's tavern rumors are true 70% of the time (90% for Newcomer); the price reacts to a rumor immediately and corrects at season end if it was false.
- **Season end:** each voyage rolls success/failure and the price jumps.
- **Long Dark panic:** every house drops 20% when the dark begins.

## Businesses *(only if ahead)*

Cut from the core build. If core is done early: player can own **one** business; buying or selling costs a tide.

| Business | Cost | Upkeep/season | Earns/season | Sells back for | Teaches |
|---|---|---|---|---|---|
| Kelp stall | 500◈ | 20◈ | 30 × season's base kelp price (best in Long Dark) | 50%, or 30% in Long Dark | Steady income, upkeep, payback |
| Silk loom | 800◈ | 40◈ | 12 × season's base silk price (best in Silk Boom summer) | 50%, or 30% in Long Dark | High margin tied to one market |
| Salvage boat | 600◈ | 30◈ | Random 50–350◈ | 50%, or 30% in Long Dark | Irregular returns |

Earnings use the **base** price (player can't pump them). Long Dark profit pays when the dark opens, so you can collect and still sell. Bought in Spring and sold in the Long Dark, each returns ~1.4–1.6× cost. Low Long Dark resale is deliberate: a business is not cash when you need Passage.

## Events

**Fixed beats (every run):**
- **Summer or Autumn:** Council debases the coin (goods and Passage +15%). Clue: tavern talk that the Council is short on orichalcum.
- **Long Dark:** panic selling, kelp spikes, Passage price peaks.
- **End of the Long Dark:** the Sinking.
- Character and story beats (including the **Patron's arc**) are being written separately by Mitansh.

**Year scenarios** (each run secretly picks one):

| Year | What changes | Clues |
|---|---|---|
| Silk Boom | Summer silk 40◈; Silkwind succeeds 95% in Summer | Herald: surface kingdoms ordering cloth |
| Kelp Blight | Long Dark kelp 18◈ | Nerissa: farmers whispering about rot |
| Stormy Seas | Autumn success ×0.7; Oro and Silkwind take the worst of it | Captain Oro's warnings at the Harbor |

**Weighted event deck** (1–2 per season, weighted by player situation):

| Event | Effect | More likely when |
|---|---|---|
| Kelp blight scare | Kelp +50% this season | Any season |
| Storm warning | Storm risk up one level | Autumn |
| Fraudulent charge | Charge for 5% of Purse (min 30◈); dispute it this season or lose it | Any season |
| Pickpocket | Lose 20% of Purse | Purse > 500◈, or after visiting the Black Reef |
| Roof leak | Repair costing 10% of your coin (min 150◈) | Any season; hurts most with an empty Vault |
| Surface boom | Silkwind +25%, silk +30% | Summer of a Silk Boom year |
| Tavern rumor | Tip about one house, true 70% (90% Newcomer) | After visiting the Drowned Bell |
| Lucky salvage | +300◈ | 3× as likely for Tidewalker |
| Grin's offer | A Black Reef cash advance | Standing < 550, or Purse < 50◈ |
| The Pearl Exchange pitch | "Guaranteed" 40%/season; it's a scam, money is gone | Once per run, most likely when behind pace for Passage |
| Council rate change | Vault rate moves to 1% or 3% | Any season |

## Feedback and endings

Players learn from three things: **Scrolls** earned by doing, an in-world **Chronicle** each season (a story, not a report card), and the **Modern Mirror** at the end (the only place real-world terms appear).

**The 12 Scrolls** (unlock for good *and* bad play, so losing still teaches):

| Scroll | Earned when you… | Concept |
|---|---|---|
| Rainy Day | Enter the Long Dark with a season of kelp stored | Emergency fund |
| Bought Low | Stockpile kelp in Summer | Buying ahead of price rises |
| The Melting Coin | Hold lots of cash through the debasement | Inflation |
| The Debt Spiral | Pay only the minimum on Leviathan Credit for 2+ seasons | Compound interest |
| Rich on Paper | Own enough for Passage but can't turn it into coin in time | Liquidity |
| Not All on One Ship | Hold 3+ houses or the Tide Index | Diversification |
| Fire Sale | Sell an asset at a loss in the Long Dark | Forced selling |
| Siren Song | Fall for the Pearl Exchange | Scams |
| Read the Ledger | Catch and dispute a fraudulent charge | Fraud |
| Credit Built | Take Standing from Unrated to 600 | Building credit |
| Good Debt | Earn more from a loan-funded business than the loan costs | Leverage, ROI |
| Circle of Trust | Never miss a circle payment, even in the Long Dark | Community finance |

**Endings:**

| Ending | Condition | Modern Mirror lesson |
|---|---|---|
| Escaped with wealth | Passage paid, 1,000◈+ left | A cushion and a mix of assets |
| Escaped with nothing | Passage paid, < 1,000◈ left | Timing and liquidity |
| Rescued by the circle | Short by ≤ 400◈ (one pot) and never missed a circle payment; circle covers the gap | Community finance |
| Missed the last ship | Can't pay Passage | Keyed to main cause: debt, assets you couldn't sell, a scam, or no savings |

## Tuning

| | Spring | Summer | Autumn | Long Dark |
|---|---|---|---|---|
| Passage price | 3,000◈ | 3,600◈ | 4,300◈ | 5,200◈ |

- Passage prices are **before** debasement, which adds 15% from the season it lands.
- **The check that matters:** working every tide all year and saving everything should end near 1,900◈, far short of Passage. If wages alone can reach it, raise the price.
- **Target:** a thoughtful first-time player escapes ~1 in 3 runs; escaping with wealth is rare. All cash, all Deepcoral, or ignoring the news should usually miss the ship.
- **Simulator:** since the engine is pure functions, a script plays 1,000 seeded runs per class with bot strategies (**all cash, kelp trader, diversified, gambler**) and prints escape rates. Use it to tune and quote the results on Devpost.
- Final tuning: Saturday night, seeded runs, one per class.

## Cast and places (from the doc)

- **Ione, Sefa:** Bank staff (issue cards, explain decisions).
- **Herald Kaito:** official news, always true.
- **Nerissa:** tavern rumors at the **Drowned Bell**.
- **Grin:** the **Black Reef** lender.
- **Old Maro:** runs the lending circle.
- **Captain Oro:** Oro & Daughters; gives storm warnings at the **Harbor**.
- **Dax:** Leviathan Line captain.
- **The Council of Ten:** sets tithe, Vault rate, debasement.
- **The Patron:** story arc TBD.
- Buildings: Bank, Grand Market, Harbor / Harbor Exchange, Drowned Bell, Black Reef. Which character runs each building is still open.

## Open items (from the doc)

- [ ] Write characters and main story, including the Patron's arc (Mitansh)
- [ ] Decide which character runs each building
- [ ] Pick one art pack and one sound pack
- [ ] Playtest and tune the numbers
- [ ] Set the judge-mode seed

## Ambiguities to settle before implementing

These aren't decided in the doc. Ask instead of guessing:

- **Long Dark timing:** do interest, minimum payments and Standing updates run at Long Dark open, or not at all? Is the circle's 4th payment due at Long Dark open?
- **Hungry season in the Long Dark:** kelp posts at Long Dark open. If that season goes hungry, does it cut the Long Dark's own tides?
- **Credit Built may be unreachable:** Newcomer starts at 500, best gain is ~+30/season, and there are only ~3 Standing updates, so they top out around 590 < 600.
- **Purse at the Harbor:** is Passage paid from Purse only (transfer from Vault first, free at the Bank)?
- **"Your coin"** (roof leak, ending's "◈ left"): Purse only, Purse + Vault, or net worth including shares and goods?
- **The 1,900◈ wage check** only roughly holds for the Newcomer; other classes land much lower on wages alone. Confirm that's intended.
- **Black Reef ↔ Nessie "Withdrawals"** and **Exchange/Market ↔ Nessie mapping**: confirm how a cash advance and share sales are modeled.
