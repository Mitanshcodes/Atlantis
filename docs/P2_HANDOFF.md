# P2 banking integration

## Run locally (PowerShell)

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal, from the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/p2.html>. API documentation is at
<http://127.0.0.1:8000/docs>. Run one backend process, with no extra workers.
This local workshop has no authentication and is intended for loopback use only.
The P3 entrypoints are untouched. Production output is `frontend/dist/p2.html`;
its `/api` requests need a same-origin proxy to the backend when hosted.

The development fixture implements work, buying kelp, saving, and withdrawing.
All fixture classes use a fixed 50-coin wage and a 4-coin kelp price. These are
integration fixtures, not class balance rules. Six tides are available; start
a new journey to repeat the slice. There is no simulated full year or victory.

## Turn on live Nessie

1. Sign in through the hackathon's official Nessie setup and obtain a customer
   key. Put it in `backend/.env`, never frontend variables or chat.
2. Confirm the event's host. The current official public specification lists
   `https://prod-api.nessieisreal.com` and query parameter `key` authentication.
3. From `backend`, run `..\.venv\Scripts\python -m app.nessie.probe --write --obligations`.
   This creates isolated synthetic accounts/transactions and saves a report
   under `.nessie-probe/`. It never deletes resources or prints the key.
4. Inspect every receipt, account delta, and settlement status. In particular,
   verify that creating pending bills and approved loans does not automatically
   move money, and test the credit card withdrawal semantics. If a step is pending
   or uncertain, inspect its saved IDs rather than blindly rerunning a write.
5. Enable only the resources that can be read back: set `NESSIE_LOANS_VERIFIED=true`.
   Keep `NESSIE_BILLS_VERIFIED=false` while production bill reads return HTTP 400.
   Set `NESSIE_LIVE=true` and restart the backend. Existing pending effects then
   drain in order. A blocked obligation intentionally holds later effects.

The production API was probed on October 17, 2026. Customer, account, merchant,
and deposit creation worked, while transaction records did not update
`account.balance`. The published OpenAPI spec omits creation routes for purchases
and transfers. P2 therefore records purchases as withdrawals and expands an
internal transfer into paired withdrawal/deposit records. Atlantis remains the
authoritative balance; the Ledger reconstructs a remote balance from confirmed
Nessie records. Loans can be created and read back without changing account
balances. Bill creation returns an ID, but both individual and account-scoped
bill reads currently return HTTP 400, so bill effects remain gated and visible
as pending. The schema describes account/deposit/loan amounts as integers: fractional
effects on those endpoints are rejected without rounding. Verify fractional
support before relaxing that restriction; interest can produce fractional coin.

Current references:
- https://prod.nessieisreal.com/docs
- https://prod.nessieisreal.com/nessie-openapi-spec.yaml
- https://ai.google.dev/api/generate-content

Use a separate database when changing the API host or key. The database binds
remote IDs to that environment. The key itself is not stored in SQLite.

## P1 engine boundary

**Connected (Oct 17):** `ATLANTIS_ENGINE=p1` is now the default and loads `app/engine/bridge.py`,
which implements the contract below on the real engine. See "Running the whole game" in
CLAUDE.md for the action names it accepts, the `details["view"]` it returns, and its Nessie
effect mapping. P2's tests pin `ATLANTIS_ENGINE=development` and still use the fixture.

The original contract:

```python
def new_game(class_id: str, seed: int) -> Transition: ...
def apply_action(state: State, action: Action) -> Transition: ...
```

Return models from `app.models`. Real engine states must have `development=False`.
The fixture declares `DEVELOPMENT=True`; switching modes requires a new run.

- `State` is the UI-facing snapshot: balances, obligations, inventory, season,
  tides, Standing, and available actions. All money uses integer hundredths of a
  coin. P1 may store additional serializable engine state in `details`.
- Every accepted action increments `version` exactly once. The engine validates
  affordability, eligibility, credit limits, debt-free Passage, timing, and all
  other rules. P2 does not implement those rules in API handlers or panels.
- Return ordered `MoneyEffect` objects. Use IDs such as `action_id + ':0'` and
  `action_id + ':1'`, unique within the run. They are committed with state before
  remote delivery. Effects never contain raw remote IDs or credentials.
- Narration events describe facts. An action's events belong to the season in
  its input state; a season-ending action should describe the season it closes.
- P2 seeds `customer`, `purse`, optional `vault`, the five world merchants, and
  `guild_loan` when initial `state.debt` is nonzero. Do not duplicate these effects.
  P1 emits all additional obligations, credit accounts, circle accounts, and
  their funding effects. The fixture does not create care/tithe bills or invent
  lending-circle timing before P1 supplies those rules.

### Action names consumed by panels

| Panel | Actions | Input |
|---|---|---|
| Bank | `save`, `withdraw` | `amount` |
| Bank | `repay_guild`, `repay_credit`, `repay_black_reef` | `amount`; target supplied as `guild_loan`, `credit`, `black_reef` |
| Bank | `pay_tithe`, `pay_care`, `pay_circle`, `borrow_black_reef` | `amount` |
| Bank | `open_secured_card` | no amount; P1 calculates collateral |
| Market | `buy_kelp`, `sell_kelp`, `buy_pearls`, `sell_pearls` | `quantity` |
| Exchange | `buy_shares`, `sell_shares` | `quantity`, `target`: `oro`, `leviathan`, `deepcoral`, `tide_index` |
| Exchange | `buy_passage` | no amount; P1 calculates price |
| Workshop | `work` | no amount |

Only actions included in `state.available_actions` render. These names are the
initial handoff proposal; if P1 needs changes, update both contracts and panels
together. When P1 exposes `market_visit` or `exchange_visit`, the panels submit
an ordered basket in one action so the engine can price and commit one-tide visits
atomically. The development fixture retains its simple single-order kelp action.

### Money effect mapping

| Kind | Meaning | Required references/payload |
|---|---|---|
| `customer` | New synthetic customer | `destination` is local resource name |
| `account` | Account with opening balance | `destination`, optional `source` customer (defaults `customer`), payload `type` |
| `merchant` | Shared world merchant | `destination` is stable world name |
| `deposit` | Incoming funds | `destination` account |
| `purchase` | Merchant expenditure; delivered as withdrawal on current API | `source` account and `merchant` world name |
| `transfer` | Move funds; expanded to withdrawal + deposit on current API | `source`, `destination`; both mapped within run |
| `withdrawal` | Cash removed | `source` account |
| `bill` | Obligation record | `source`, optional `destination` resource name; payload `status`, `payee`, optional schedule |
| `loan` | Obligation record | `source`, optional `destination`; payload `type`, `status`, `credit_score`, `monthly_payment` |

Bill and loan effects have independent verification gates. Their
creation never adds a second deposit. For an advance, emit a loan and a separate
deposit only if the probe confirms that loan creation does not disburse funds.
For settlement, P1 emits the money movement once and tracks the remaining game
obligation. `bill_update` and `loan_update` effects modify the corresponding
record after live semantics are verified; they do not create another charge.
Credit-card direction and automated bill settlement must be verified before
enabling credit/repayment actions. A fraud reversal is an explicit compensating
effect linked by its reason, never deletion of an original receipt.

## P3 mounting contract

Use `useBanking()` from `store.ts` once in the screen host. Pass each money panel
`open`, `onClose`, `run`, `busy`, and `onAction`. Ledger receives `open`, `onClose`,
and `ledger`. Disable actions while `busy` or while a saved browser action is
pending. The isolated `p2.html` host shows an example without editing the city.
P3 owns final styling and navigation; the workshop stylesheet is scoped by its
separate entrypoint.

## API and reliability

- `POST /api/runs`: class ID and seed → run ID, snapshot, initial events.
- `GET /api/runs/{id}`: persisted snapshot.
- `POST /api/runs/{id}/actions`: action ID, expected version, kind and arguments.
  Duplicate identical actions return the stored response. Reusing an ID with
  different input or submitting a stale version returns 409. Invalid actions
  return 422 without committing state/effects.
- `GET /api/runs/{id}/ledger`: ordered effects, remote evidence, live flag, and
  local/remote balance comparison. Cached observations are explicitly stale.
- `GET /api/runs/{id}/chronicle?season=Spring`: cached narrative from persisted
  engine events. Without Gemini configuration, a template is returned.
- `GET /api/health`: local health and configuration flags, never secrets.

Statuses: `pending` → `sending` → `confirmed`; uncertain writes become
`needs_review`; permanent rejection becomes `failed`. A later effect cannot
overtake a blocked effect in the same run. Other runs can continue. A POST result
ID is saved before its follow-up GET. Restarted `sending` entries reconcile by
stable markers rather than sending again. Zero/multiple matches remain review
items. A confirmed record must match the intended marker and amount; monetary
transactions also need a completed remote status. Confirmation is not a claim
that every displayed account balance matches—the Ledger compares those separately.

GETs retry briefly. Failed connections and explicit rate-limit rejections may
retry with backoff. Ambiguous timeouts and server errors reconcile first. This
avoids claiming impossible exactly-once guarantees without remote idempotency.
There is deliberately no "force retry" button for unknown writes.

## Tests and judge walkthrough

```powershell
cd backend
..\.venv\Scripts\python -m pytest app/nessie -q
cd ../frontend
npm run build
```

Local walkthrough: First of Their Line → work (+50) → save 100 → buy five kelp
(-20) → reload → Purse 330, Vault 100, kelp 5. Open the Ledger and explain whether
records are locally pending or remotely confirmed. Without a key, show only the
workshop and never present it as a live Nessie demonstration.

The same walkthrough was completed against production Nessie on October 17,
2026: 13 resource/transaction records confirmed, both reconstructed balances
matched, and no entry was pending, failed, or marked for review. Use a new run
for the judge demo rather than depending on that synthetic smoke run.

For the prize demonstration, complete the probe, connect P1, and use a tested
winning seed/action sequence. Show wages, purchases, reserves, obligations, and
Passage, then fetch the corresponding receipts. Briefly stop connectivity and
show recovery without duplicate transactions. The full-year win, Long Dark
timing, credit progression, and passage rules remain blocked on P1/design—not
silently approximated by P2.
