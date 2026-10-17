# Atlantis

Hackathon game about personal finance. Atlantis sinks at the end of the year; the player wins by buying **Passage** on the last ship out, paid in coin, with **no debt of any kind**. It's a 2D city navigated by clicking. One run = one in-game year ≈ 10 minutes.

- **Target prizes:** Technica *Deep Sea Gamechanger* (gamification) and Capital One *Best Use of Nessie*.
- **Framing:** everyone starts Atlantis from a different place (four classes, each built on a real financial barrier).
- **Source of truth:** the design doc "Atlantis: Game Design" (Oct 17, 2026, @Mitansh) as amended by **Balance pass v2** (Passage, debasement, Exchange, class starts, bill autopay, Credit Built). This file reflects both. If this file and the doc disagree on a v2 number, v2 wins; otherwise the doc wins. Ask before changing the design.

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
│   │   │   ├── game.py                [P1]  new game, actions, season loop (public entry point)
│   │   │   ├── state.py               [P1]  enums + GameState dataclasses (engine's own state)
│   │   │   ├── actions.py             [P1]  action dataclasses + ActionError
│   │   │   ├── rng.py                 [P1]  seeded RNG stored in the state
│   │   │   ├── market.py              [P1]  kelp, pearls, prices
│   │   │   ├── exchange.py            [P1]  shipping houses, Tide Index
│   │   │   ├── money.py               [P1]  Purse, Vault, credit, Standing, Black Reef
│   │   │   ├── events.py              [P1]  event deck, scenarios
│   │   │   ├── business.py            [P1]  businesses (only if ahead)
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
│   ├── tests/                         [P1]  pytest: one file per engine module + fuzz tests
│   └── scripts/
│       └── simulate.py                [P1]  balance testing (bot strategies, escape rates)
└── frontend/
    ├── package.json                   [Shared]  Vite + React 18 + Phaser 3.90 + TypeScript
    ├── index.html                     [P3]  fonts (Cinzel, Pixelify Sans, Silkscreen)
    ├── vite.config.ts, tsconfig.json  [Shared]
    ├── asset-packs/                   [P3]  raw downloaded packs (gitignored, see below)
    ├── public/assets/                 [P3]  city/ sprites/ ui/ audio/ (only the sheets the game uses)
    └── src/
        ├── main.tsx                   [Shared]
        ├── App.tsx                    [P3]  screen switcher
        ├── api.ts                     [P2]  backend calls
        ├── types.ts                   [P2]  mirrors models.py
        ├── store.ts                   [P2]  game state
        ├── styles.css                 [P3]
        ├── game/                      [P3]  Phaser
        │   ├── PhaserGame.tsx         [P3]  mounts Phaser in React
        │   ├── EventBus.ts            [P3]  typed Phaser ↔ React events
        │   ├── assets.ts              [P3]  sheet paths + named frame rects
        │   ├── geometry.ts            [P3]  the rings: radii, canals, roads, groundAt()
        │   ├── ground.ts              [P3]  paints the seabed texture pixel by pixel
        │   ├── buildings.ts           [P3]  enterable buildings, which ring, keepers
        │   ├── cityMap.ts             [P3]  decor placement, walking routes
        │   ├── cursors.ts             [P3]  the round cursor (Phaser + CSS)
        │   ├── random.ts              [P3]  seeded RNG + coordinate hash
        │   ├── fx/underwater.ts       [P3]  caustics, colour grade, light, bubbles, fish, sway
        │   └── scenes/
        │       ├── Boot.ts            [P3]  loads sheets, names frames, draws generated textures
        │       └── City.ts            [P3]  the city scene: world, buildings, player, camera
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

The Python packages (`app/`, `engine/`, `nessie/`, `ai/`) also have empty `__init__.py` files, owned by whoever owns the folder. Empty asset folders hold a `.gitkeep`.

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
| **Newcomer** | Dock trader, 60◈ | Unrated: no Standing history, so no Leviathan card or loans until they open a secured card | Surface-port rumors are right 90% instead of 70% | 500◈ | Checking only | Unrated (500 once secured card opens) |
| **First of Their Line** | Guild apprentice, 50◈, +10◈ each season | No family savings; owes a 500◈ guild loan | Pay grows every season; Ione and Sefa explain one extra factor in every decision | 800◈ ("800◈, but 500◈ of it is owed to the guild") | Checking, Savings, guild loan | 580 |
| **Caretaker** | Part-time kelp farmer, 55◈ | Care duties take 2 of 6 tides in Summer and the Long Dark; 60◈ care bill every season | Takes the first 400◈ pot in Old Maro's lending circle | 700◈ | Checking, Savings, extra recurring bill | 620 |
| **Tidewalker** | Salvage diver, 0–120◈ random (avg 60◈) | Irregular pay; can't open a Vault until Standing 550; lives in outer ring, so Grin's offers appear more often | Lucky salvage is 3× as likely | 500◈ | Checking with irregular deposits, no Savings | 540 |

Devpost angle: each class is built on a real financial barrier, many of which fall hardest on the communities Technica supports.

## Time and the season loop

Year: **Spring → Summer → Autumn → Long Dark**. Each season gives **6 tides**.

- **Costs 1 tide:** a work shift; a market trip (any number of goods); a Harbor Exchange visit (any number of orders); buying or selling a business.
- **Free first visits:** the first Market trip and the first Exchange visit each season cost no tide; later visits do. Investing pays off without frantic trading being free.
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
| Guild loan (First of Their Line) | 500◈ at 1%/season, all due before Passage; a simple bill | Loans |
| Tithe and care bills | Tithe 40◈/season for everyone; care bill 60◈/season for Caretaker. **Autopay** from the Purse at season end; late only if the Purse can't cover it (Standing hit + 20◈ late fee). Paying early by hand stays available. | Recurring bills |
| Wages, dividends, sales | Credited when earned | Deposits |
| Goods and shares | Debited when bought | Purchases |
| Lending circle (Caretaker only) | 400◈ pot in Spring, paid back 100◈/season (autopaid from the Purse at season end, last share at the Passage check; can be paid ahead). **It's a loan: what's still owed counts as debt for Passage.** A payment the Purse can't cover is missed (no Standing hit). | Transfers between customers |
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

Three levers: the tithe, the Vault rate, and **debasing the coin**. A debasement raises goods prices, the Passage price **and share prices** by 15%; the Purse, Vault, debts and upkeep don't move (real inflation lifts assets and melts cash). It lands in **Summer or Autumn**, varying per run.

### Passage rule

Every debt must be settled first: Leviathan Credit, Bank and guild loans, the Black Reef, unpaid bills, and **money still owed to the lending circle** (a loan from friends is still a loan). Nobody borrows their way onto the ship.

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
| Oro & Daughters | 50◈ | 90% (95% in Summer of a Trade Boom year) | +8% / −12% | 1◈/share, only on success | ±2% | Blue chips, dividends (~+8%/season) |
| Leviathan Line (Dax) | 40◈ | 70% | +30% / −35% | None | ±6% | Leverage, boom and bust (~+10%/season) |
| Deepcoral Salvage | 20◈ | 10% jackpot | +150% / −20% | None | ±8% | Lottery thinking (negative EV) |
| The Tide Index | 42.5◈ (basket) | Follows the basket | Follows the basket | Passes through | Weighted | Diversification (~+7%/season) |
| Silkwind Trading *(only if ahead)* | 30◈ | 80% | +20% / −25% | 1◈, only on success | ±4% | Seasonality |

- The Tide Index is a basket worth 45% Oro / 45% Leviathan / 10% Deepcoral at the start, less a **1% fee each season**.
- Deepcoral's average return must stay below zero (a test enforces it).
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
| Credit Built | Take Standing from Unrated to 580 | Building credit |
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
| Passage price | 1,200◈ | 1,285◈ | 1,375◈ | 1,470◈ |

- **The rule every number obeys:** Passage is the game's inflation. Over a year, Vault < Passage growth ≈ diversified investing < good concentrated bets. Cash loses ground slowly; diversified keeps pace; concentrated bets can beat it with real risk; work alone never reaches Passage; Deepcoral loses on average.
- Passage rises ~7% a season, before debasement, which adds 15% from the season it lands (Long Dark ≈ 1,690◈).
- **Targets** (escape rate averaged across classes): worker (wages only) 0%; all cash < 5%; gambler (all Deepcoral) 5–10%; kelp trader 15–25%; diversified 25–35%; thoughtful 33–40%. The thoughtful bot must escape 20–45% for **every** class.
- **Tuning knobs, in order, within ranges:** Passage base (Spring 900–1,600, +6–8% a season); Exchange win/loss sizes (±3 points each, Deepcoral average < 0); class start coin (±200◈). Never change wages; work-only must stay at 0%.
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

## Frontend city (P3)

Run from `frontend/`: `npm install`, then `npm run dev` (http://localhost:5173) and `npm run typecheck`.

- **Art:** Ancient Greeks tileset (CC BY 4.0, credit required) for ground, temples, houses and stalls; Mucho Pixels Underwater pack for kelp, coral, ruins, wrecks, treasure and bubbles. The **raw packs live in `frontend/asset-packs/` and are gitignored**, because the Mucho Pixels licence forbids redistributing the files. Only the sheets the game uses are copied into `public/assets/city/`. Each teammate needs the packs locally only to add new sheets. Credits are in `CREDITS.md`.
- **Frames:** every sprite is a named rect in `game/assets.ts` (`FRAMES.<sheet>.<name>`), registered as a texture frame in Boot. To use new art, add its rect there; don't hardcode coordinates elsewhere.
- **Layout (Plato's Atlantis):** a 2240 × 2240 world. A central island, two rings of land, three rings of water (the outer one is the moat), four avenues (N/E/S/W) bridging the inner canals, and a ring road on each land ring. All radii live in `geometry.ts`; `groundAt(x, y)` says what's at any pixel and drives both the ground texture and placement checks.
- **Rings by importance:** island = Council of Ten and Bank of the Tides; middle ring = Grand Market, Harbor Exchange, Guild Hall; outer ring = Drowned Bell, Lending Circle, Black Reef. Past the moat are "the wilds" (kelp forests, ruins, wrecks), which are scenery only: clicks there walk you to the moat's edge.
- **Placement:** sprites are placed by their **foot** (bottom centre) and depth-sorted by y (overlay layers in `DEPTH` sit above objects + world height). Ring buildings stand just north of their ring road, and their door is the road point in front. Houses and vegetation are placed by a seeded search that only accepts open sand, so the city is identical on every load and nothing lands on a road or canal.
- **Ground:** `ground.ts` paints the whole seabed once at boot (~1–2s), sampling sand and paver tiles from the Greek terrain sheet, so curves are clean pixel art rather than 16px steps.
- **Underwater look** is all Phaser (`fx/underwater.ts`): a light-aqua multiply grade plus teal lift (bright turquoise, modelled on the team's reference image), two scrolling caustics layers, shimmer on the canals (masked to the water), a cobalt fade toward the top of the screen, slanted light shafts, bubbles and marine snow, fish schools, swaying kelp, glows on key buildings, and a soft vignette.
- **Interaction:** click a building → the player walks there along the ring roads and avenues → `building-entered` fires → React shows the keeper's greeting (`ui/Dialogue.tsx`, placeholder for the real panels) → Leave fires `building-left`. Click the ground to walk; drag to pan; mouse wheel zooms 1×/2×/3× toward the cursor. The cursor is a round ring (gold over buildings, a bubble while dragging). Building ids match the engine's `Place` values where one exists.
- **`?overview`** in the URL shows the whole map at once, for checking the layout.
- **Placeholders:** the player (a code-drawn 12×20 diver) and fish, until a character pack is chosen. Swap `GENERATED.player` for a spritesheet with walk animations.

## Engine (P1)

Python 3.9-compatible, standard library only. Run everything from `backend/`:

```
python3 -m pytest                      # all engine tests (~1s)
python3 -m scripts.simulate            # 300 seeded runs per class per bot
python3 -m scripts.simulate --runs 1000 --bots thoughtful --classes newcomer
```

**Using the engine (for P2):**

```python
from app.engine.game import new_game, apply
from app.engine.actions import Work, MarketTrip, Order, ActionError
from app.engine.state import ClassId, Good

state = new_game(ClassId.NEWCOMER, seed=42)
result = apply(state, MarketTrip((Order(Good.KELP, 20),)))   # pure: `state` is untouched
result.state     # new GameState
result.events    # LogEvents this action caused (for UI, Chronicle)
result.ledger    # LedgerEntries this action caused (push these to Nessie)
```

- Illegal actions raise `ActionError(code, message)`. `code` is stable (e.g. `no_tides`, `insufficient_funds`, `debts_outstanding`); `message` is player-facing. Map it to HTTP 400.
- Every action is a frozen dataclass in `engine/actions.py`. Tide actions: `Work`, `Rest`, `MarketTrip`, `ExchangeVisit`, `BuyBusiness`, `SellBusiness`, except that the first `MarketTrip` and first `ExchangeVisit` each season are free (`game.visit_is_free(state, Place.MARKET | Place.HARBOR)` tells the UI); `EndSeason` spends all remaining tides. Everything else is free. `EndYear` is only legal in `Phase.FINAL_CALL`.
- `dataclasses.asdict(state)` is JSON-ready (all enums are `str` enums). **Strip `state.HIDDEN_FIELDS` before sending state to the browser:** the scenario, debasement season, RNG step, scheduled event tides, pre-rolled voyages and whether a rumor is true.
- UI previews without changing state: `market.quote`, `exchange.quote`, `money.passage_price`, `money.card_limit`, `money.circle_due`, `scrolls.net_worth`, `game.visit_is_free`.
- **Ledger → Nessie:** every coin movement is a `LedgerEntry` with a `NessieOp` (deposit, withdrawal, purchase, bill, transfer, loan), an `Account` and optionally `to_account`. Bills appear twice: `pending=True` when posted, then again when paid. Starting balances are *not* in the ledger; `seed.py` should create accounts from `new_game`'s state.
- `step(state, action)` is the in-place version for the simulator. Don't use it in the API.

**Engine conventions:** coin is always an `int` (rounded halves up with `money.coin`); prices are floats. All numbers come from `config.X` read at call time, so tests monkeypatch config. Randomness only through `rng.rng(state)`, which derives a generator from `(seed, rng_step)`. "Only if ahead" systems sit behind `config.FEATURE_SILK`, `FEATURE_BUSINESSES` and `FEATURE_BANK_LOAN`. They're all implemented and tested, and off by default.

### Engine decisions (gaps in the doc, filled with defaults)

All of these are in `config.py` or one obvious place in the engine; change them freely.

- **Long Dark:** bills, kelp and business profit post at its open. No interest, minimum check, or Standing update happens in the Long Dark (it has no season end). Its bills must be paid before Passage, like any debt.
- **Final call:** when the Long Dark's tides run out, the game enters `FINAL_CALL`. Free actions still work (pay debts, move Vault coin, buy Passage), then `EndYear` runs the Passage check. If the player has the coin (Purse + Vault) and owes nothing, the check boards them automatically.
- **Hunger:** a hungry season costs 2 tides next season. Long Dark hunger (kelp eaten at its open) costs 2 tides immediately and stacks with an Autumn hunger. Every season keeps at least 1 tide.
- **Bills autopay** from the Purse at season end (oldest first, before the household eats) and at the final Passage check. A bill the Purse can't cover is late: +20◈ fee, still owed, −40 Standing for a tithe, a missed circle payment for the circle. Any late bill makes the season "not clean" (no +15).
- **Card minimum** is set at each season end (10% of the balance after interest) and checked at the next season end. Everyone rated starts with a Leviathan card (limit by Standing). The Market and Exchange take Purse coin only; the card covers kelp shortfalls, roof leaks and business upkeep.
- **Kelp shortfall** buys from Purse then card, never the Vault. **Roof leak** pays Purse → Vault → card, and anything left becomes a repair bill. "Your coin" for the roof leak and the endings means Purse + Vault.
- **Rumors** pre-roll the named house's voyage, then claim the true outcome with the class's accuracy (70%, Newcomer 90%). The price jumps ±10% on the rumor and reverts at season end if it was false.
- **"Trade Boom year"** in the Oro row is treated as the Silk Boom scenario. In Stormy Seas, Oro and Silkwind take an extra ×0.9 in Autumn.
- **Scenario clues:** Silk Boom from the Herald in Spring; Kelp Blight from Nerissa in Summer; Stormy Seas from Captain Oro in Summer. The debasement clue comes from Nerissa one season before it lands. Clues are `clue` log events with a `key` for `content/`.
- **Event deck weights** are in `config.EVENT_DECK` (base weight, plus a boosted weight when the doc's "more likely when" holds). An event fires at most once a season.
- **The lending circle is a loan** (`LoanKind.CIRCLE`, 0% interest). By each season's end its balance must be at most 100◈ × the seasons left before the Long Dark; autopay covers the difference from the Purse, and if it can't, the payment is missed. Paying ahead lowers later dues.
- **Scroll thresholds:** Bought Low = 20 kelp bought in Summer. Melting Coin = 1,000◈+ (Purse + Vault) when the debasement lands. Debt Spiral = 2 seasons paying ≥ the minimum but < 1.5× it while carrying a balance.
- **Miss causes**, checked in this order: debt (paying it off is what kept them off the ship) → assets would have covered it (illiquid) → fell for the scam → no savings.

### Known balance problems (need a design call)

Balance pass v2, 1,000 seeded runs per class per bot (`python3 -m scripts.simulate --runs 1000`). Escape rate averaged across classes:

| Bot | Target | v2 result |
|---|---|---|
| worker (wages only) | 0% | 10% |
| all cash (Vault saver) | < 5% | 17% |
| gambler (all Deepcoral) | 5–10% | 16% |
| kelp trader | 15–25% | 22% |
| diversified | 25–35% | 1% |
| thoughtful | 33–40% | 7% (Newcomer 2%, First of Their Line 2%, Caretaker 10%, Tidewalker 15%) |

A sweep across every allowed knob (Spring Passage 900–1,600 at +6% or +8%, Exchange wins/losses ±3 points, start coin ±200) found no setting near the targets. The best still had the worker at 7–13%, diversified at about 2% and thoughtful at about 13%. Three structural causes:

1. **Trading costs a tide, and a tide pays 60◈.** A few hundred coin invested at +7–10% a season earns 30–50◈, less than the shift it costs to place the order. So diversified investing ends with *less* than saving in the Vault. Kelp storage is the only trade that clearly pays for its tide.
2. **Luck is bigger than strategy.** Lucky salvage (+300◈, three times as likely for the Tidewalker) appears in 99% of worker escapes. Strategy differences are worth ~100–300◈ a year, about the same as one salvage or roof leak.
3. **The circle pot bought Passage.** 98 of 122 Caretaker worker escapes bought Passage in Spring with the 400◈ pot (700 + 400 + a salvage > 1,200), because what was still owed to the circle wasn't counted as debt.

Experiment (outside the allowed knobs): counting future circle payments as debt and halving salvage to 150◈ brings the worker to 2%, but diversified and thoughtful fall to about 0–1%. Luck was what carried them too. Hitting the targets needs investing to be worth more than a shift.

**Applied since (not yet simulated):** money owed to the circle now counts as debt (fixes cause 3), and the first Market trip and first Exchange visit each season are free (aimed at cause 1). Re-run the simulator and re-tune in the testing phase. The bots in `scripts/simulate.py` were written for paid visits, so check they use the free visit sensibly before trusting the numbers.

## Open questions

- **The 1,900◈ wage check** only roughly holds for the Newcomer; other classes land much lower on wages alone. Confirm that's intended.
- **Nessie mapping:** a Black Reef advance is emitted as a `withdrawal` (per the doc's table) with `to_account=purse`. P2 should confirm that maps sensibly onto Nessie.
