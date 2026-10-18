"""The season report: what the player did with their tides and coin, and how it went.

Everything here is worked out from the log and the ledger, so a report can be rebuilt for any
finished season. ``snapshot`` records the numbers a report compares (what you were worth, prices,
holdings) when a season opens and when it ends. ``season_report`` turns one season into facts,
marks and the Modern Mirror topics worth showing. Words live in ``content/report.json`` and
``content/mirror.json``; this module only decides which ones apply.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app import config
from app.engine import exchange, market, money, scrolls
from app.engine.state import (
    LONG_DARK,
    SEASONS,
    Account,
    EventKind,
    GameState,
    Good,
    House,
    LedgerEntry,
    LogEvent,
    NessieOp,
    Place,
)


def snapshot(s: GameState, at: str) -> None:
    """Record what the player holds and what it's worth, at a season's open or end."""
    s.record(
        "snapshot",
        at=at,
        purse=s.purse,
        vault=s.vault,
        debt=money.total_debt(s),
        assets=scrolls.assets_value(s),
        net_worth=scrolls.net_worth(s),
        passage=money.passage_price(s),
        prices={h.value: round(exchange.share_price(s, h), 2) for h in s.shares},
        shares={h.value: [x.qty, x.cost] for h, x in s.shares.items() if x.qty},
        goods={g.value: [x.qty, x.cost, round(market.unit_price(s, g), 2)] for g, x in s.stores.items() if x.qty},
    )


# Ledger memos (set by the engine) -> report categories. First matching prefix wins.
_IN = (
    ("Wages", "wages"),
    ("Grand Market: sold", "sales"),
    ("Harbor Exchange: sold", "sales"),
    ("Sold the", "sales"),
    ("Harbor Exchange dividends", "dividends"),
    ("Vault interest", "interest"),
    ("Drowned Bell winnings", "winnings"),
    ("Business earnings", "business"),
    ("Lucky salvage", "windfalls"),
    ("Dispute refund", "windfalls"),
)
_OUT = (
    ("Household kelp", "food"),
    ("Grand Market", "market"),
    ("Harbor Exchange", "shares"),
    ("Drowned Bell wager", "wagers"),
    ("Unrecognized charge", "losses"),
    ("Pickpocketed", "losses"),
    ("The Pearl Exchange", "losses"),
    ("Roof repair", "repairs"),
    ("Passage", "passage"),
    ("Bought a", "business"),
    ("Business upkeep", "business"),
    ("Leviathan interest", "interest"),
    ("Interest:", "interest"),
    ("Black Reef fee", "interest"),
    ("Late fee", "fees"),
)


def _category(memo: str, table: Tuple[Tuple[str, str], ...]) -> str:
    return next((cat for prefix, cat in table if memo.startswith(prefix)), "other")


def _money(ledger: List[LedgerEntry]) -> Dict[str, Any]:
    """Coin in and out by category, plus what moved between your own accounts."""
    flow_in: Dict[str, int] = {}
    flow_out: Dict[str, int] = {}
    saved = debt_paid = borrowed = 0

    def add(book: Dict[str, int], cat: str, amount: int) -> None:
        book[cat] = book.get(cat, 0) + amount

    for e in ledger:
        if e.op == NessieOp.DEPOSIT:
            add(flow_in, _category(e.memo, _IN), e.amount)
        elif e.op in (NessieOp.PURCHASE, NessieOp.WITHDRAWAL):
            add(flow_out, _category(e.memo, _OUT), e.amount)
        elif e.op == NessieOp.BILL:
            if e.memo.startswith("Late fee"):
                add(flow_out, "fees", e.amount)
            elif not e.pending:
                add(flow_out, "bills", e.amount)
        elif e.op == NessieOp.LOAN:
            if e.to_account == Account.PURSE:
                borrowed += e.amount
            else:
                add(flow_out, _category(e.memo, _OUT), e.amount)
        elif e.op == NessieOp.TRANSFER:
            if e.to_account == Account.VAULT:
                saved += e.amount
            elif e.account == Account.VAULT:
                saved -= e.amount
            elif e.to_account == Account.PURSE:
                borrowed += e.amount  # the circle's pot, or the circle covering the gap
            else:
                debt_paid += e.amount
    order = lambda book: sorted(book.items(), key=lambda kv: -kv[1])  # noqa: E731
    return {
        "in": [{"category": c, "amount": a} for c, a in order(flow_in)],
        "out": [{"category": c, "amount": a} for c, a in order(flow_out)],
        "total_in": sum(flow_in.values()),
        "total_out": sum(flow_out.values()),
        "saved": saved,
        "debt_paid": debt_paid,
        "borrowed": borrowed,
    }


def _first(log: List[LogEvent], kind: str, **match: Any) -> Optional[LogEvent]:
    return next((e for e in log if e.kind == kind and all(e.data.get(k) == v for k, v in match.items())), None)


def _tides(s: GameState, season: int, log: List[LogEvent]) -> Dict[str, Any]:
    opened = _first(log, "season_open")
    total = opened.data["tides"] if opened else config.TIDES_PER_SEASON
    spec = money.class_spec(s)
    care = spec.care_tides if SEASONS[season] in spec.care_seasons else 0
    hunger = max(0, config.TIDES_PER_SEASON - care - total)
    work = [e for e in log if e.kind == "work"]
    trips = [e for e in log if e.kind == "trip"]
    paid = [e for e in trips if not e.data["free"]]
    business = sum(1 for e in log if e.kind in ("business_bought", "business_sold"))
    rested = sum(1 for e in log if e.kind == "rest")
    used = len(work) + rested + len(paid) + business
    skipped = max(0, total - used)
    wage = spec.wage + spec.wage_growth * season if not spec.wage_range else sum(spec.wage_range) // 2
    return {
        "total": total,
        "care": care,
        "hunger": hunger,
        "work": len(work),
        "wages": sum(e.data["pay"] for e in work),
        "market": sum(1 for e in paid if e.data["place"] == Place.MARKET),
        "exchange": sum(1 for e in paid if e.data["place"] == Place.HARBOR),
        "free_trips": len(trips) - len(paid),
        "business": business,
        "rested": rested,
        "skipped": skipped,
        "idle": rested + skipped,
        "wage": wage,
    }


def _investments(start: LogEvent, end: LogEvent, log: List[LogEvent]) -> Dict[str, Any]:
    """Each house held or traded this season: shares, value, and how its price moved."""
    p0, p1 = start.data["prices"], end.data["prices"]
    s0, s1 = start.data["shares"], end.data["shares"]
    voyages = _first(log, "voyages")
    landed = {r["house"]: r["success"] for r in voyages.data["results"]} if voyages else {}
    traded: Dict[str, List[int]] = {}
    for e in log:
        if e.kind == "share_trade":
            t = traded.setdefault(e.data["house"], [0, 0])  # [coin spent buying, coin got selling]
            t[0 if e.data["qty"] > 0 else 1] += e.data["total"]
    rows = []
    for house in p1:
        q0, q1 = s0.get(house, [0, 0])[0], s1.get(house, [0, 0])
        if not (q0 or q1[0] or house in traded):
            continue
        bought, sold = traded.get(house, [0, 0])
        value = money.coin(q1[0] * p1[house])
        rows.append({
            "house": house,
            "shares": q1[0],
            "paid": q1[1],
            "value": value,
            "price_start": p0[house],
            "price_end": p1[house],
            "change": round(p1[house] / p0[house] - 1, 4),
            "season_gain": value - money.coin(q0 * p0[house]) - bought + sold,
            "voyage": landed.get(house),
        })
    index = House.INDEX.value
    pearls = end.data["goods"].get("pearls")
    return {
        "rows": rows,
        "dividends": voyages.data["dividends"] if voyages else 0,
        "index_change": round(p1[index] / p0[index] - 1, 4) if index in p0 else None,
        "pearls": {"qty": pearls[0], "paid": pearls[1], "value": money.coin(pearls[0] * pearls[2])} if pearls else None,
        "held": [r["house"] for r in rows if r["shares"]],
    }


def _food(log: List[LogEvent], ledger: List[LedgerEntry], end: LogEvent) -> Dict[str, Any]:
    eaten = _first(log, "kelp_eaten")
    bought = [e for e in log if e.kind == "trade" and e.data["good"] == "kelp" and e.data["qty"] > 0]
    qty = sum(e.data["qty"] for e in bought)
    return {
        "from_stores": eaten.data["from_stores"] if eaten else 0,
        "bought_at_end": eaten.data["bought"] if eaten else 0,
        "cost_at_end": eaten.data["cost"] if eaten else 0,
        "hungry": bool(eaten and eaten.data["hungry"]),
        "on_card": any(e.account == Account.CARD and e.memo.startswith("Household kelp") for e in ledger),
        "bought": qty,
        "bought_avg": round(sum(e.data["total"] for e in bought) / qty, 2) if qty else None,
        "stored": end.data["goods"].get("kelp", [0])[0],
        "eaten_per_season": config.KELP_EATEN_PER_SEASON,
        "long_dark_price": config.GOOD_BASE_PRICES[Good.KELP][LONG_DARK],
    }


def season_report(s: GameState, season: int) -> Dict[str, Any]:
    """Facts, marks and Modern Mirror topics for a finished season (Spring to Autumn)."""
    log = [e for e in s.log if e.season == season]
    start, end = _first(log, "snapshot", at="open"), _first(log, "snapshot", at="end")
    if start is None or end is None or season >= LONG_DARK:
        raise ValueError("That season hasn't ended yet.")
    ledger = [e for e in s.ledger if e.season == season]
    closed = _first(log, "season_end")
    next_open = next((e for e in s.log if e.season == season + 1 and e.kind == "season_open"), None)
    standing = _first(log, "standing")
    events = [e for e in log if e.kind == "event"]
    shock = _first(log, "market_shock")
    gambles = [e for e in log if e.kind == "gamble"]

    tides = _tides(s, season, log)
    flow = _money(ledger)
    invest = _investments(start, end, log)
    food = _food(log, ledger, end)
    passage_now = end.data["passage"]
    passage_next = next_open.data["passage_price"] if next_open else passage_now
    nw0, nw1 = start.data["net_worth"], end.data["net_worth"]
    ready = (end.data["purse"] + (end.data["vault"] or 0)) - end.data["debt"]
    pace = {
        "net_worth_start": nw0,
        "net_worth_end": nw1,
        "growth": round(nw1 / nw0 - 1, 4) if nw0 > 0 else None,
        "passage_start": start.data["passage"],
        "passage_next": passage_next,
        "passage_growth": round(passage_next / start.data["passage"] - 1, 4),
        "ready": ready,
        "ready_share": round(max(0, ready) / passage_next, 4),
        "worth_share": round(max(0, nw1) / passage_next, 4),
    }
    debt = {
        "start": start.data["debt"],
        "end": end.data["debt"],
        "card_interest": closed.data["card_interest"] if closed else 0,
        "interest_paid": sum(r["amount"] for r in flow["out"] if r["category"] in ("interest", "fees")),
        "missed_minimum": bool(closed and closed.data["missed_minimum"]),
        "late_bills": closed.data["late_bills"] if closed else [],
        "missed_loan": bool(closed and closed.data["missed_loan_payment"]),
        "black_reef": any(e.account == Account.BLACK_REEF for e in ledger),
        "loan_interest": sum(e.amount for e in ledger if e.op == NessieOp.LOAN and e.to_account is None
                             and e.memo.startswith("Interest:")),
    }
    happened = [e.data["event"].value if hasattr(e.data["event"], "value") else e.data["event"] for e in events]
    losses = {
        "pickpocket": sum(e.amount for e in ledger if e.memo == "Pickpocketed"),
        "fraud_lost": sum(e.data["amount"] for e in log if e.kind == "fraud_lost"),
        "scam": sum(e.data["amount"] for e in log if e.kind == "scam"),
    }
    facts = {
        "season": SEASONS[season].value,
        "season_index": season,
        "tides": tides,
        "money": flow,
        "investments": invest,
        "food": food,
        "pace": pace,
        "debt": debt,
        "end": {"purse": end.data["purse"], "vault": end.data["vault"]},
        "standing": {"before": standing.data["before"], "after": standing.data["after"],
                     "payments": standing.data["payments"], "credit_used": standing.data["credit_used"],
                     "history": standing.data["history"]} if standing else None,
        "events": happened,
        "losses": losses,
        "shock": shock.data["shock"] if shock else None,
        "debased": _first(log, "debasement") is not None,
        "gambling": {"games": len(gambles), "staked": sum(e.data["stake"] for e in gambles),
                     "won": sum(e.data["won"] for e in gambles)} if gambles else None,
        "scrolls": [e.data["scroll"].value if hasattr(e.data["scroll"], "value") else e.data["scroll"]
                    for e in log if e.kind == "scroll"],
        "circle": any(e.to_account == Account.CIRCLE for e in ledger),
        "vault_min_standing": money.class_spec(s).vault_min_standing
        if (s.standing or 0) < money.class_spec(s).vault_min_standing else 0,
    }
    facts["marks"] = _marks(facts)
    facts["topics"] = _topics(facts)
    return facts


# --- Marks ----------------------------------------------------------------------------------------


def _mark(subject: str, grade: str, why: str, **params: Any) -> Dict[str, Any]:
    return {"subject": subject, "grade": grade, "why": why, "params": params}


def _marks(f: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [_pace_mark(f), _tides_mark(f), _food_mark(f), _safety_mark(f), _debt_mark(f)]


def _pace_mark(f: Dict[str, Any]) -> Dict[str, Any]:
    """On course for Passage: what you're worth against what Passage will cost next season."""
    p = f["pace"]
    target = config.REPORT_PACE_TARGETS[f["season_index"]]
    b, c = config.REPORT_PACE_STEPS
    share = p["worth_share"]
    grade = "A" if share >= target else "B" if share >= target - b else "C" if share >= target - c else "D"
    return _mark("pace", grade, f"pace.{grade}", share=_pct(share), target=_pct(target), worth=p["net_worth_end"],
                 passage=p["passage_next"], growth=_pct(p["growth"]), passage_growth=_pct(p["passage_growth"]),
                 gained=p["net_worth_end"] - p["net_worth_start"])


def _tides_mark(f: Dict[str, Any]) -> Dict[str, Any]:
    t = f["tides"]
    a, b, c = config.REPORT_IDLE_TIDES
    grade = "A" if t["idle"] <= a else "B" if t["idle"] <= b else "C" if t["idle"] <= c else "D"
    return _mark("tides", grade, f"tides.{grade}", idle=t["idle"], work=t["work"], total=t["total"],
                 wages=t["wages"], cost=t["idle"] * t["wage"])


def _food_mark(f: Dict[str, Any]) -> Dict[str, Any]:
    k = f["food"]
    params = {"stored": k["stored"], "bought": k["bought"], "bought_at_end": k["bought_at_end"],
              "cost_at_end": k["cost_at_end"], "dark_price": k["long_dark_price"], "need": k["eaten_per_season"]}
    if k["hungry"]:
        return _mark("food", "D", "food.hungry", **params)
    if k["on_card"]:
        return _mark("food", "C", "food.card", **params)
    if f["season_index"] == LONG_DARK - 1 and k["stored"] < k["eaten_per_season"]:
        return _mark("food", "C", "food.dark_short", **params)
    if k["from_stores"] >= k["eaten_per_season"] or k["bought"] >= k["eaten_per_season"]:
        return _mark("food", "A", "food.stocked", **params)
    return _mark("food", "B", "food.bought", **params)


def _safety_mark(f: Dict[str, Any]) -> Dict[str, Any]:
    lost, end = f["losses"], f["end"]
    if lost["scam"]:
        return _mark("safety", "D", "safety.scam", lost=lost["scam"])
    taken = lost["pickpocket"] + lost["fraud_lost"]
    if taken:
        return _mark("safety", "C", "safety.lost", lost=taken)
    if end["vault"] is None:
        locked = f["vault_min_standing"]
        return _mark("safety", "B", "safety.vault_locked" if locked else "safety.no_vault",
                     purse=end["purse"], standing=locked)
    if end["purse"] > config.REPORT_IDLE_PURSE:
        return _mark("safety", "C", "safety.idle", purse=end["purse"], vault=end["vault"])
    if end["vault"] and end["purse"] <= config.REPORT_SAFE_PURSE:
        interest = next((r["amount"] for r in f["money"]["in"] if r["category"] == "interest"), 0)
        return _mark("safety", "A", "safety.kept", purse=end["purse"], vault=end["vault"], interest=interest)
    return _mark("safety", "B", "safety.fair", purse=end["purse"], vault=end["vault"])


def _debt_mark(f: Dict[str, Any]) -> Dict[str, Any]:
    d = f["debt"]
    params = {"interest": d["interest_paid"], "debt": d["end"], "card_interest": d["card_interest"]}
    if d["black_reef"]:
        return _mark("debt", "D", "debt.reef", **params)
    if d["missed_minimum"] or d["late_bills"] or d["missed_loan"]:
        return _mark("debt", "D", "debt.missed", **params)
    if d["card_interest"]:
        return _mark("debt", "C", "debt.card", **params)
    if d["interest_paid"]:
        return _mark("debt", "B", "debt.loan", **params)
    if d["end"]:
        return _mark("debt", "A", "debt.interest_free", **params)
    return _mark("debt", "A", "debt.none", **params)


def _pct(x: Optional[float]) -> Optional[int]:
    return None if x is None else round(x * 100)


# --- The Modern Mirror ----------------------------------------------------------------------------


def _topics(f: Dict[str, Any]) -> List[str]:
    """The real-world lessons this season touched, most pressing first."""
    held = set(f["investments"]["held"])
    traded = {r["house"] for r in f["investments"]["rows"]}
    houses = held - {House.INDEX.value}
    checks = [
        ("payday_loan", f["debt"]["black_reef"]),
        ("ponzi", bool(f["losses"]["scam"])),
        ("missed_payment", f["debt"]["missed_minimum"] or bool(f["debt"]["late_bills"]) or f["debt"]["missed_loan"]),
        ("card_interest", bool(f["debt"]["card_interest"])),
        ("card_fraud", EventKind.FRAUD_CHARGE.value in f["events"]),
        ("house_edge", bool(f["gambling"])),
        ("cash_theft", bool(f["losses"]["pickpocket"])),
        ("inflation", f["debased"]),
        ("emergency_fund", EventKind.ROOF_LEAK.value in f["events"]),
        ("lottery", House.DEEPCORAL.value in traded),
        ("index_fund", House.INDEX.value in held),
        ("diversify", len(houses) == 1 and House.INDEX.value not in held),
        ("dividends", f["investments"]["dividends"] > 0),
        ("rosca", f["circle"]),
        ("seasonal_prices", f["food"]["bought"] >= f["food"]["eaten_per_season"]),
        ("opportunity_cost", f["tides"]["idle"] >= 2),
        ("credit_score", bool(f["standing"]) and f["standing"]["after"] != f["standing"]["before"]),
        ("savings_rate", any(r["category"] == "interest" for r in f["money"]["in"])),
        ("news_shock", bool(f["shock"])),
        ("real_return", True),
    ]
    picked = [topic for topic, hit in checks if hit][: config.REPORT_MIRROR_TOPICS]
    return picked
