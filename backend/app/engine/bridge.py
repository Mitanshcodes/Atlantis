"""The engine behind Person 2's API contract (``app.models``): ``new_game`` and ``apply_action``.

Translates in both directions:

- P2 ``Action`` (money in hundredths, P2 action names) -> engine actions (whole coin).
- Engine ``GameState`` -> P2 ``State``: a UI snapshot, plus the full engine state in
  ``details["engine"]`` (server-only: ``app.main`` strips it before responding) and a public
  ``details["view"]`` for the UI.
- Engine ledger entries -> ordered ``MoneyEffect`` records for Nessie, named so that P2's
  balance reconstruction of the Purse and Vault matches the engine exactly.

Obligation records (Nessie loans and bills) are only emitted when that resource is verified
(``NESSIE_LOANS_VERIFIED`` / ``NESSIE_BILLS_VERIFIED``): P2's sync holds every later effect in
a run behind an unverified one, so emitting them unverified would stall the run's whole queue.
The money itself always moves.
"""

from __future__ import annotations

import copy
import dataclasses
import json
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from app import config
from app.engine import exchange, game, market, money, report, scrolls
from app.engine.actions import (
    ActionError,
    BlackReefAdvance,
    BuyBusiness,
    BuyPassage,
    CloseCard,
    Deposit,
    DisputeCharge,
    EndSeason,
    EndYear,
    ExchangeVisit,
    Gamble,
    InvestPearlExchange,
    MarketTrip,
    OpenSecuredCard,
    OpenVault,
    Order,
    PayBill,
    PayCard,
    PayLoan,
    Rest,
    SellBusiness,
    ShareOrder,
    TakeBankLoan,
    Visit,
    Withdraw,
    Work,
)
from app.engine.serialize import decode, from_data, to_data
from app.engine.state import (
    SEASONS,
    Account,
    BillKind,
    BusinessKind,
    ClassId,
    EventKind,
    GameState,
    Good,
    House,
    LedgerEntry,
    LoanKind,
    LogEvent,
    NessieOp,
    Phase,
    Place,
    Season,
)
from app.models import Action, MoneyEffect, State, Transition
from app.settings import Settings

DEVELOPMENT = False
MINOR = 100  # P2 money is integer hundredths of a coin

CLASS_IDS = {
    "newcomer": ClassId.NEWCOMER,
    "first_of_their_line": ClassId.FIRST_OF_LINE,
    "caretaker": ClassId.CARETAKER,
    "tidewalker": ClassId.TIDEWALKER,
}
SEASON_NAMES = {
    Season.SPRING: "Spring",
    Season.SUMMER: "Summer",
    Season.AUTUMN: "Autumn",
    Season.LONG_DARK: "Long Dark",
}
LOAN_NAMES = {
    LoanKind.GUILD: "guild_loan",
    LoanKind.BANK: "bank_loan",
    LoanKind.BLACK_REEF: "black_reef_loan",
    LoanKind.CIRCLE: "circle_loan",
}
LOAN_ACCOUNTS = {
    Account.GUILD_LOAN: LoanKind.GUILD,
    Account.BANK_LOAN: LoanKind.BANK,
    Account.BLACK_REEF: LoanKind.BLACK_REEF,
    Account.CIRCLE: LoanKind.CIRCLE,
}
HOUSE_NAMES = {
    House.ORO: "Oro & Daughters",
    House.LEVIATHAN: "Leviathan Line",
    House.DEEPCORAL: "Deepcoral Salvage",
    House.SILKWIND: "Silkwind Trading",
    House.INDEX: "the Tide Index",
}


def minor(coins: float) -> int:
    return int(round(coins * MINOR))


CONTENT_DIR = Path(__file__).resolve().parents[1] / "content"


@lru_cache(maxsize=None)
def content(name: str) -> Dict[str, Any]:
    """The writing in app/content/<name>.json (shared with the frontend)."""
    return json.loads((CONTENT_DIR / f"{name}.json").read_text(encoding="utf-8"))


# --- The P2 contract ------------------------------------------------------------------------------


def new_game(class_id: str, seed: int) -> Transition:
    if class_id not in CLASS_IDS:
        raise ValueError(f"Unknown class: {class_id}")
    s = game.new_game(CLASS_IDS[class_id], seed)
    memory: Dict[str, Any] = {"loan_names": {}, "loan_count": 0}
    _keep_season(s, memory)
    effects = _effects(None, s, prefix="start", memory=memory)
    return Transition(state=_snapshot(s, 0, class_id, memory), events=describe(s.log), effects=effects)


def apply_action(state: State, action: Action) -> Transition:
    engine = state.details.get("engine")
    if not isinstance(engine, dict):
        raise ValueError("This run has no engine state; start a new journey")
    before = from_data(engine)
    s = from_data(engine)
    memory = copy.deepcopy(state.details.get("bridge") or {"loan_names": {}, "loan_count": 0})
    memory.setdefault("loan_names", {})
    try:
        for engine_action in translate(action, s):
            game.step(s, engine_action)
    except ActionError as exc:
        raise ValueError(exc.message) from None
    _keep_season(s, memory)
    effects = _effects(before, s, prefix=action.action_id, memory=memory)
    return Transition(
        state=_snapshot(s, state.version + 1, state.class_id, memory),
        events=describe(s.log),
        effects=effects,
    )


# --- Season reports -------------------------------------------------------------------------------


def _plain(items: Sequence[Any]) -> List[Dict[str, Any]]:
    return json.loads(json.dumps([dataclasses.asdict(x) for x in items]))


def _keep_season(s: GameState, memory: Dict[str, Any]) -> None:
    """The stored engine state drops its log after every move, so the bridge keeps the current
    season's log and ledger itself. When a season ends, its report is worked out and kept."""
    book = memory.setdefault("season_book", {"log": [], "ledger": []})
    book["log"] += _plain(s.log)
    book["ledger"] += _plain(s.ledger)
    ended = [e.season for e in s.log if e.kind == "season_end"]
    if not ended:
        return
    reports = memory.setdefault("reports", {})
    for season in ended:
        past = s.clone()
        # The season, plus the next one's opening (its Passage price, debasement included).
        past.log = [decode(LogEvent, d) for d in book["log"]
                    if d["season"] == season or (d["season"] == season + 1 and d["kind"] == "season_open")]
        past.ledger = [decode(LedgerEntry, d) for d in book["ledger"] if d["season"] == season]
        reports[str(season)] = json.loads(json.dumps(report.season_report(past, season)))
    last = max(ended)
    book["log"] = [d for d in book["log"] if d["season"] > last]
    book["ledger"] = [d for d in book["ledger"] if d["season"] > last]


def _fill(template: str, params: Dict[str, Any]) -> str:
    def show(v: Any) -> Any:
        return "" if v is None else f"{v:,}" if isinstance(v, int) and not isinstance(v, bool) else v
    return template.format(**{k: show(v) for k, v in params.items()})


GRADE_ORDER = "DCBA"


def _chelo(marks: List[Dict[str, Any]], lines: Dict[str, Any]) -> str:
    """Chelo's hand-written note: praise for the best thing, a question about the worst."""
    by_why = {m["why"]: m for m in marks}
    praise = next((line for why, line in lines["praise"].items() if why in by_why), "")
    worst = min(marks, key=lambda m: GRADE_ORDER.index(m["grade"]))
    if worst["grade"] not in "CD":
        return " ".join(filter(None, [praise, lines["steady"]]))
    ask = lines["ask"].get(worst["why"]) or lines["ask"][worst["subject"]]
    return " ".join(filter(None, [praise, _fill(ask, worst["params"])]))


def season_report(state: State, season: str) -> Dict[str, Any]:
    """The report card for a finished season, in words from content/report.json and
    content/mirror.json. Money here is in whole coin. Raises LookupError if there's none."""
    index = next((i for i, s in enumerate(SEASONS) if SEASON_NAMES[s] == season), None)
    facts = ((state.details.get("bridge") or {}).get("reports") or {}).get(str(index))
    if facts is None:
        raise LookupError("No report for that season.")
    words, mirror, houses = content("report"), content("mirror"), content("market")["houses"]
    marks = [
        {"subject": m["subject"], "label": words["subjects"][m["subject"]], "grade": m["grade"],
         "text": _fill(words["marks"][m["why"]], m["params"])}
        for m in facts["marks"]
    ]
    t = facts["tides"]
    tides = [
        {"use": use, "label": words["tides"][use], "count": t[use]}
        for use in ("work", "market", "exchange", "business", "rested", "skipped", "care", "hunger")
        if t[use]
    ]
    money_words = {"in": words["money_in"], "out": words["money_out"]}
    flow = facts["money"]
    inv = facts["investments"]
    return {
        "season": season,
        "season_index": index,
        "next_season": SEASON_NAMES[SEASONS[index + 1]],
        "class_id": state.class_id,
        "pace": facts["pace"],
        "target": round(config.REPORT_PACE_TARGETS[index] * 100),
        "marks": marks,
        "tides": {"total": t["total"], "uses": tides, "free_trips": t["free_trips"], "wages": t["wages"]},
        "money": {
            side: [{"category": r["category"], "label": money_words[side].get(r["category"], r["category"]),
                    "amount": r["amount"]} for r in flow[side]]
            for side in ("in", "out")
        } | {k: flow[k] for k in ("total_in", "total_out", "saved", "debt_paid", "borrowed")},
        "investments": {
            "rows": [dict(r, name=houses.get(r["house"], {}).get("name", r["house"])) for r in inv["rows"]],
            "dividends": inv["dividends"],
            "index_change": inv["index_change"],
            "pearls": inv["pearls"],
        },
        "standing": facts["standing"],
        "shock": facts["shock"],
        "events": facts["events"],
        "scrolls": facts["scrolls"],
        "mirror": [dict(mirror["topics"][topic], topic=topic) for topic in facts["topics"]],
        "chelo": _chelo(facts["marks"], words["chelo"]),
        "facts": facts,
    }


# --- Actions --------------------------------------------------------------------------------------


def _coins(amount: Optional[int]) -> int:
    if amount is None:
        raise ValueError("Choose an amount")
    if amount % MINOR:
        raise ValueError("Use whole coins")
    return amount // MINOR


def _quantity(action: Action) -> int:
    if action.quantity is None:
        raise ValueError("Choose how many")
    return action.quantity


def _enum(kind: Any, value: Optional[str], what: str) -> Any:
    try:
        return kind(value)
    except ValueError:
        raise ValueError(f"Unknown {what}: {value}") from None


def _pay_bills_of(s: GameState, kind: BillKind, amount: Optional[int]) -> List[object]:
    bills = [b for b in s.bills if b.kind == kind]
    if not bills:
        raise ValueError(f"No {kind.value} bill is due")
    total = sum(b.amount for b in bills)
    if amount is not None and amount < total * MINOR:
        raise ValueError(f"The {kind.value} due is {total}◈")
    return [PayBill(b.id) for b in bills]


def translate(action: Action, s: GameState) -> List[object]:
    """P2 action -> the engine actions that carry it out, in order."""
    k = action.kind
    simple = {
        "work": Work,
        "rest": Rest,
        "end_season": EndSeason,
        "end_year": EndYear,
        "open_vault": OpenVault,
        "open_secured_card": OpenSecuredCard,
        "close_card": CloseCard,
        "dispute_charge": DisputeCharge,
        "buy_passage": BuyPassage,
        "sell_business": SellBusiness,
    }
    if k in simple:
        return [simple[k]()]
    if k == "save":
        return [Deposit(_coins(action.amount))]
    if k == "withdraw":
        return [Withdraw(_coins(action.amount))]
    if k == "repay_credit":
        return [PayCard(_coins(action.amount))]
    loan_repayments = {
        "repay_guild": LoanKind.GUILD,
        "repay_black_reef": LoanKind.BLACK_REEF,
        "repay_bank": LoanKind.BANK,
        "pay_circle": LoanKind.CIRCLE,
    }
    if k in loan_repayments:
        return [PayLoan(loan_repayments[k], _coins(action.amount))]
    if k == "pay_tithe":
        return _pay_bills_of(s, BillKind.TITHE, action.amount)
    if k == "pay_care":
        return _pay_bills_of(s, BillKind.CARE, action.amount)
    if k == "pay_bills":
        return [PayBill()]
    if k == "borrow_black_reef":
        return [BlackReefAdvance(_coins(action.amount))]
    if k == "take_bank_loan":
        return [TakeBankLoan(_coins(action.amount))]
    if k == "invest_pearl_exchange":
        return [InvestPearlExchange(_coins(action.amount))]
    if k == "visit":
        return [Visit(_enum(Place, action.target, "place"))]
    if k == "gamble":
        # The stake is ``amount``; the shell game's pick (1-3) travels as ``quantity``.
        return [Gamble(action.target or "", _coins(action.amount), action.quantity)]
    if k == "buy_business":
        return [BuyBusiness(_enum(BusinessKind, action.target, "business"))]
    trades = {"buy_kelp": (Good.KELP, 1), "sell_kelp": (Good.KELP, -1), "buy_pearls": (Good.PEARLS, 1), "sell_pearls": (Good.PEARLS, -1)}
    if k in trades:
        good, sign = trades[k]
        return [MarketTrip((Order(good, sign * _quantity(action)),))]
    if k in ("buy_shares", "sell_shares"):
        house = _enum(House, action.target, "house")
        return [ExchangeVisit((ShareOrder(house, (1 if k == "buy_shares" else -1) * _quantity(action)),))]
    if k == "market_visit":
        orders = tuple(Order(_enum(Good, o.target, "good"), o.quantity if o.side == "buy" else -o.quantity) for o in action.orders or ())
        return [MarketTrip(orders)]
    if k == "exchange_visit":
        orders = tuple(ShareOrder(_enum(House, o.target, "house"), o.quantity if o.side == "buy" else -o.quantity) for o in action.orders or ())
        return [ExchangeVisit(orders)]
    raise ValueError(f"Unknown action: {k}")


def available_actions(s: GameState) -> List[str]:
    """Actions worth offering right now. The engine still validates every one."""
    if s.phase == Phase.ENDED:
        return []
    out: List[str] = ["visit"]
    if s.phase == Phase.PLAYING:
        out += ["work", "rest", "end_season", "market_visit", "exchange_visit"]
    else:
        out.append("end_year")
    if s.vault is None:
        out.append("open_vault")
    else:
        out.append("save")
        if money.vault_free(s) > 0:
            out.append("withdraw")
    if s.standing is None and s.card is None:
        out.append("open_secured_card")
    if s.card is not None and s.card.balance > 0:
        out.append("repay_credit")
    for kind, name in ((LoanKind.GUILD, "repay_guild"), (LoanKind.BLACK_REEF, "repay_black_reef"),
                       (LoanKind.BANK, "repay_bank"), (LoanKind.CIRCLE, "pay_circle")):
        if kind in s.loans:
            out.append(name)
    for kind, name in ((BillKind.TITHE, "pay_tithe"), (BillKind.CARE, "pay_care")):
        if any(b.kind == kind for b in s.bills):
            out.append(name)
    if s.bills:
        out.append("pay_bills")
    owed = s.loans[LoanKind.BLACK_REEF].balance if LoanKind.BLACK_REEF in s.loans else 0
    if owed < config.BLACK_REEF_MAX:
        out.append("borrow_black_reef")
    if config.FEATURE_BANK_LOAN and LoanKind.BANK not in s.loans:
        out.append("take_bank_loan")
    if any(o.kind == EventKind.FRAUD_CHARGE for o in s.offers):
        out.append("dispute_charge")
    if any(o.kind == EventKind.PEARL_EXCHANGE for o in s.offers):
        out.append("invest_pearl_exchange")
    if s.flags.games_this_season < config.GAMES_PER_SEASON and s.purse >= config.GAMBLE_MIN:
        out.append("gamble")
    if s.passage_paid is None:
        out.append("buy_passage")
    if config.FEATURE_BUSINESSES and s.phase == Phase.PLAYING:
        out.append("sell_business" if s.business else "buy_business")
    return out


# --- State ----------------------------------------------------------------------------------------


def _snapshot(s: GameState, version: int, class_id: str, memory: Dict[str, Any]) -> State:
    moments = moments_of(s.log)
    engine = to_data(s)
    engine["log"] = []  # already delivered as events; keeps stored state small
    engine["ledger"] = []  # already delivered as effects
    return State(
        class_id=class_id,
        seed=s.seed,
        version=version,
        development=False,
        purse=minor(s.purse),
        vault=None if s.vault is None else minor(s.vault),
        debt=minor(money.total_debt(s)),
        kelp=s.stores[Good.KELP].qty,
        tides=s.tides_left if s.phase == Phase.PLAYING else 0,
        season=SEASON_NAMES[s.season_name],
        standing=s.standing,
        passage=s.passage_paid is not None,
        available_actions=available_actions(s),
        details={
            "engine": engine,
            "bridge": memory,
            "view": view(s),
            # What this move set off, for event cards, the Chronicle and the ending.
            "moments": moments,
            # Tells P2's seeding that the engine emits its own obligations (guild loan, circle).
            "engine_owns_obligations": True,
        },
    )


def view(s: GameState) -> Dict[str, Any]:
    """What the UI may show. Money in hundredths, like the rest of the P2 contract. No secrets."""
    card = None
    if s.card is not None:
        card = {
            "balance": minor(s.card.balance),
            "limit": minor(money.card_limit(s)),
            "min_due": minor(s.card.min_due),
            "frozen": money.card_frozen(s),
            "secured": s.card.secured,
        }
    spec = money.class_spec(s)
    wage = spec.wage_range or (spec.wage + spec.wage_growth * s.season,) * 2
    return {
        "phase": s.phase.value,
        "wage": {"min": minor(wage[0]), "max": minor(wage[1])},
        "limits": {
            "cellar": config.CELLAR_CAPACITY,
            "kelp_per_season": config.KELP_EATEN_PER_SEASON,
            "black_reef_max": minor(config.BLACK_REEF_MAX),
            "secured_deposit": minor(config.SECURED_DEPOSIT),
            "vault_min_standing": spec.vault_min_standing,
        },
        "season_index": s.season,
        "tide": s.tide,
        "tides_total": s.tides_total,
        "hungry_next": s.hungry_next,
        "free_visits": {
            "market": game.visit_is_free(s, Place.MARKET),
            "exchange": game.visit_is_free(s, Place.HARBOR),
        },
        "vault_locked": minor(s.vault_locked),
        "vault_rate": s.vault_rate,
        "standing_factors": dict(s.standing_factors),
        "card": card,
        "loans": {
            LOAN_NAMES[k]: {"balance": minor(l.balance), "rate": l.rate, "payment_due": minor(l.payment_due)}
            for k, l in s.loans.items()
        },
        "bills": [{"id": b.id, "kind": b.kind.value, "amount": minor(b.amount), "late": b.late} for b in s.bills],
        "circle_due": minor(money.circle_due(s)),
        "passage_price": minor(money.passage_price(s)),
        "passage_paid": None if s.passage_paid is None else minor(s.passage_paid),
        "prices": {
            "goods": {g.value: minor(market.unit_price(s, g)) for g in s.goods},
            "houses": {h.value: minor(exchange.share_price(s, h)) for h in s.shares},
        },
        "stores": {g.value: h.qty for g, h in s.stores.items()},
        "shares": {h.value: hold.qty for h, hold in s.shares.items()},
        "house_records": {h.value: list(hm.record) for h, hm in s.houses.items()},
        "storm_level": s.storm_level,
        "offers": [{"kind": o.kind.value, "amount": minor(o.amount)} for o in s.offers],
        "scrolls": [x.value for x in s.scrolls],
        "shock": s.shock,
        "tavern": {
            "games_left": max(0, config.GAMES_PER_SEASON - s.flags.games_this_season),
            "min": minor(config.GAMBLE_MIN),
            "max": minor(config.GAMBLE_MAX),
            "net": minor(s.flags.gamble_net),
        },
        "net_worth": minor(scrolls.net_worth(s)),
        "ending": s.ending.value if s.ending else None,
        "miss_cause": s.miss_cause.value if s.miss_cause else None,
    }


# --- Money effects --------------------------------------------------------------------------------


def _merchant(memo: str) -> Optional[str]:
    if memo.startswith(("Grand Market", "Household kelp")):
        return "grand_market"
    if memo.startswith("Harbor Exchange"):
        return "harbor_exchange"
    if memo.startswith("Passage"):
        return "passage"
    if memo.startswith("Tithe"):
        return "council"
    return None


def _loan_payload(s: GameState, kind: LoanKind) -> Dict[str, Any]:
    loan = s.loans[kind]
    due = {LoanKind.CIRCLE: config.CIRCLE_PAYMENT, LoanKind.BANK: loan.payment_due}.get(kind, 0)
    return {
        "type": "personal",
        "status": "approved",
        "credit_score": s.standing if s.standing is not None else config.STANDING_MIN,
        "monthly_payment": due,
    }


def _effects(before: Optional[GameState], s: GameState, prefix: str, memory: Dict[str, Any]) -> List[MoneyEffect]:
    """Every money record this step produced, in an order Nessie can apply."""
    settings = Settings.env()
    loans_on, bills_on = settings.loans_verified, settings.bills_verified
    opening = before is None
    out: List[MoneyEffect] = []

    def add(kind: str, reason: str, **fields: Any) -> None:
        out.append(MoneyEffect(effect_id=f"{prefix}:{len(out)}", kind=kind, reason=reason, **fields))

    # Accounts opened this step. P2 seeds the opening Purse and Vault itself.
    if not opening and before.vault is None and s.vault is not None:
        add("account", "Open the Vault", destination="vault", payload={"type": "Savings"})
    if s.card is not None and (opening or before.card is None):
        add("account", "Open Leviathan Credit", destination="credit", payload={"type": "Credit Card"})

    # New loan records come first so later updates have something to update.
    old_loans = {} if opening else {k: l.balance for k, l in before.loans.items()}
    if loans_on:
        for kind, loan in s.loans.items():
            if kind not in old_loans:
                memory["loan_count"] = memory.get("loan_count", 0) + 1
                name = f"{LOAN_NAMES[kind]}_{memory['loan_count']}"
                memory["loan_names"][kind.value] = name
                add("loan", f"{kind.value.replace('_', ' ').title()} loan", source="purse", destination=name,
                    amount=minor(loan.balance), payload=_loan_payload(s, kind))

    old_bills = set() if opening else {b.id for b in before.bills}
    created_bills: set = set()
    for entry in s.ledger:
        _entry_effects(entry, s, add, opening, bills_on, old_bills, created_bills)

    # Loans whose balance moved (interest, fees, repayments, more borrowing) get one update each.
    if loans_on:
        for kind, loan in s.loans.items():
            if kind in old_loans and old_loans[kind] != loan.balance and kind.value in memory["loan_names"]:
                add("loan_update", f"{kind.value.replace('_', ' ').title()} loan balance", source=memory["loan_names"][kind.value],
                    amount=minor(loan.balance), payload=_loan_payload(s, kind))
    return out


def _entry_effects(e: LedgerEntry, s: GameState, add, opening: bool, bills_on: bool, old_bills: set, created: set) -> None:
    amount = minor(e.amount)
    if e.op == NessieOp.BILL:
        name = f"bill_{e.bill_id}"
        if e.pending:
            if not bills_on:
                return
            if e.bill_id in old_bills or e.bill_id in created:
                total = next((b.amount for b in s.bills if b.id == e.bill_id), None)
                if total is not None:
                    add("bill_update", e.memo, source=name, amount=minor(total), payload={"status": "pending"})
            else:
                created.add(e.bill_id)
                add("bill", e.memo, source="purse", destination=name, amount=amount,
                    payload={"status": "pending", "payee": e.memo})
            return
        merchant = _merchant(e.memo)
        if merchant:
            add("purchase", e.memo, source="purse", merchant=merchant, amount=amount)
        else:
            add("withdrawal", e.memo, source="purse", amount=amount)
        if bills_on and (e.bill_id in old_bills or e.bill_id in created):
            add("bill_update", e.memo + " (paid)", source=name, amount=amount, payload={"status": "completed"})
        return

    if e.op == NessieOp.DEPOSIT:
        add("deposit", e.memo, destination="vault" if e.account == Account.VAULT else "purse", amount=amount)
    elif e.op == NessieOp.PURCHASE:
        source = "credit" if e.account == Account.CARD else "purse"
        merchant = _merchant(e.memo)
        if merchant:
            add("purchase", e.memo, source=source, merchant=merchant, amount=amount)
        else:
            add("withdrawal", e.memo, source=source, amount=amount)
    elif e.op == NessieOp.WITHDRAWAL:
        if e.account == Account.PURSE:
            add("withdrawal", e.memo, source="purse", amount=amount)
        elif e.to_account == Account.PURSE:  # a Black Reef advance lands in the Purse
            add("deposit", e.memo, destination="purse", amount=amount)
    elif e.op == NessieOp.TRANSFER:
        src, dst = e.account, e.to_account
        names = {Account.PURSE: "purse", Account.VAULT: "vault", Account.CARD: "credit"}
        if src in names and dst in names:
            add("transfer", e.memo, source=names[src], destination=names[dst], amount=amount)
        elif src == Account.PURSE and dst in LOAN_ACCOUNTS:
            add("withdrawal", e.memo, source="purse", amount=amount)
        elif src == Account.CIRCLE and dst == Account.PURSE and not opening:
            add("deposit", e.memo, destination="purse", amount=amount)
        # At the opening, the circle pot is already in the Purse's opening balance.
    elif e.op == NessieOp.LOAN and e.to_account == Account.PURSE:
        add("deposit", e.memo, destination="purse", amount=amount)
    # Interest and fees on loans change only the loan record (see the loan updates above).


# --- Events ---------------------------------------------------------------------------------------


def _fmt_rate(rate: float) -> str:
    return f"{rate * 100:.0f}%"


def _event_text(data: Dict[str, Any]) -> str:
    kind = data.get("event")
    amount = data.get("amount")
    texts = {
        EventKind.KELP_BLIGHT_SCARE: "Kelp prices jumped on whispers of blight.",
        EventKind.STORM_WARNING: "A storm warning darkened the shipping lanes.",
        EventKind.FRAUD_CHARGE: f"An unrecognized charge of {amount}◈ appeared in the Purse ledger.",
        EventKind.PICKPOCKET: f"A pickpocket took {amount}◈ from the Purse.",
        EventKind.ROOF_LEAK: f"The roof leaked; repairs cost {data.get('cost')}◈.",
        EventKind.SURFACE_BOOM: "Surface kingdoms ordered cloth, and silk soared.",
        EventKind.LUCKY_SALVAGE: f"Lucky salvage brought in {amount}◈.",
        EventKind.GRINS_OFFER: f"Grin offered an advance of up to {amount}◈.",
        EventKind.PEARL_EXCHANGE: f"A stranger pitched the Pearl Exchange, promising {_fmt_rate(data.get('promised_rate', 0))} a season.",
        EventKind.COUNCIL_RATE_CHANGE: f"The Council set the Vault rate to {_fmt_rate(data.get('vault_rate', 0))}.",
    }
    if kind == EventKind.TAVERN_RUMOR:
        if "house" not in data:
            return "The tavern was quiet."
        verb = "come home rich" if data["claims_success"] else "founder"
        return f"Tavern talk: {HOUSE_NAMES[House(data['house'])]}'s voyage will {verb}."
    return texts.get(kind, f"Something happened: {kind}.")


def describe_event(e: LogEvent) -> Optional[str]:
    d = e.data
    k = e.kind
    if k == "work":
        return f"Worked a shift for {d['pay']}◈."
    if k == "rest":
        return "Let a tide pass."
    if k == "trade":
        verb = "Bought" if d["qty"] > 0 else "Sold"
        return f"{verb} {abs(d['qty'])} {Good(d['good']).value} at the Grand Market for {d['total']}◈."
    if k == "share_trade":
        verb = "Bought" if d["qty"] > 0 else "Sold"
        return f"{verb} {abs(d['qty'])} shares of {HOUSE_NAMES[House(d['house'])]} for {d['total']}◈."
    if k == "event":
        return _event_text(d)
    if k == "season_open":
        return f"{SEASON_NAMES[Season(d['season'])]} began. Passage costs {d['passage_price']}◈; {d['tides']} tides to spend."
    if k == "season_end":
        hungry = " The household went hungry." if d.get("hungry") else ""
        return f"{SEASON_NAMES[Season(d['season'])]} ended with {d['purse']}◈ in the Purse.{hungry}"
    if k == "voyages":
        parts = [f"{HOUSE_NAMES[House(r['house'])]} {'succeeded' if r['success'] else 'failed'}" for r in d["results"]]
        paid = f" Dividends paid {d['dividends']}◈." if d.get("dividends") else ""
        return "Voyages landed: " + ", ".join(parts) + "." + paid
    if k == "kelp_eaten":
        if d.get("hungry"):
            return "There was not enough kelp or coin; the household went hungry."
        bought = f", bought {d['bought']} for {d['cost']}◈" if d.get("bought") else ""
        return f"The household ate its kelp ({d['from_stores']} from the cellar{bought})."
    if k == "kelp_spoiled":
        return f"{d['lost']} stored kelp spoiled."
    if k == "standing":
        return f"Standing moved from {d['before']} to {d['after']}."
    if k == "debasement":
        return "The Council debased the coin. Prices, Passage and shares rose; coin did not."
    if k == "clue":
        return content("scenarios")["clues"].get(d["key"], f"A rumor from {d['source'].replace('_', ' ').title()}.")
    if k == "market_shock":
        words = content("events")["shocks"].get(d["shock"], {})
        return f"{words.get('title', 'Market news')}: {words.get('means', '')}".strip()
    if k == "gamble":
        name = content("buildings")["tavern"]["games"].get(d["game"], {}).get("name", "a game")
        if d["won"]:
            return f"Won {d['won']}◈ on {name} with a {d['stake']}◈ stake."
        return f"Lost {d['stake']}◈ on {name}."
    if k == "panic":
        return "Panic swept the Exchange as the Long Dark began."
    if k == "rumor_corrected":
        return f"The rumor about {HOUSE_NAMES[House(d['house'])]} proved false."
    if k == "fraud_disputed":
        return f"Disputed an unrecognized charge and recovered {d['amount']}◈."
    if k == "fraud_lost":
        return f"An undisputed charge of {d['amount']}◈ was lost."
    if k == "scam":
        return f"Handed {d['amount']}◈ to the Pearl Exchange."
    if k == "scam_revealed":
        return f"The Pearl Exchange vanished with {d['amount']}◈."
    if k == "account_opened":
        return "Opened a Vault." if d["account"] == Account.VAULT else "Opened a secured Leviathan card."
    if k == "account_closed":
        return "Closed the Leviathan card."
    if k in ("card_frozen", "card_unfrozen"):
        return "The Bank froze the Leviathan card." if k == "card_frozen" else "The Leviathan card was restored."
    if k == "black_reef_advance":
        return f"Took {d['amount']}◈ from Grin at the Black Reef."
    if k == "bank_loan":
        return f"Borrowed {d['amount']}◈ from the Bank."
    if k == "passage_bought":
        return f"Bought Passage on the last ship for {d['price']}◈."
    if k == "final_call":
        return f"The last ship called. Passage costs {d['passage_price']}◈."
    if k == "scroll":
        return f"Earned the Scroll: {d['scroll'].replace('_', ' ').title()}."
    if k == "ending":
        return f"The year ended: {d['ending'].replace('_', ' ')}."
    if k == "game_start":
        return f"A year in Atlantis began for the {d['player_class'].replace('_', ' ')}."
    return None


def describe(log: Sequence[LogEvent]) -> List[str]:
    return [text for text in (describe_event(e) for e in log) if text]


def _value(x: Any) -> Any:
    """An enum's value (``str()`` of a str-mixin enum is "Kind.NAME" on Python 3.11+)."""
    return x.value if isinstance(x, Enum) else x


MOMENT_KINDS = ("event", "scroll", "season_end", "debasement", "clue", "passage_bought", "final_call",
                "ending", "fraud_lost", "scam_revealed", "card_frozen", "market_shock", "gamble")


def moments_of(log: Sequence[LogEvent]) -> List[Dict[str, Any]]:
    """The notable things in a move, structured for the UI. Nothing secret: rumors keep their
    claim but never whether they're true."""
    out = []
    for e in log:
        if e.kind not in MOMENT_KINDS:
            continue
        # The season it happened in: cards are often shown after the season has turned.
        moment: Dict[str, Any] = {"kind": e.kind, "text": describe_event(e) or "", "season": SEASON_NAMES[SEASONS[e.season]]}
        if e.kind == "event":
            moment["event"] = _value(e.data.get("event"))
        elif e.kind == "scroll":
            moment["scroll"] = _value(e.data["scroll"])
        elif e.kind == "ending":
            moment["ending"] = _value(e.data["ending"])
        elif e.kind == "clue":
            moment["source"] = _value(e.data["source"])
        elif e.kind == "market_shock":
            moment["shock"] = e.data["shock"]
        elif e.kind == "gamble":
            moment.update(game=e.data["game"], stake=minor(e.data["stake"]), won=minor(e.data["won"]))
            for key in ("pick", "pearl", "multiple"):
                if key in e.data:
                    moment[key] = e.data[key]
        out.append(moment)
    return out
