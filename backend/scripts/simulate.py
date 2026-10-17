"""Balance testing: play many seeded years per class with simple bot strategies and print the odds.

    cd backend
    python3 -m scripts.simulate                 # 300 runs per class per bot
    python3 -m scripts.simulate --runs 1000 --bots thoughtful gambler --classes newcomer

Design targets (CLAUDE.md, Tuning): a thoughtful first-time player escapes about 1 in 3 runs,
escaping with wealth is rare, and all cash / all Deepcoral / ignoring the news usually miss the
ship. Working every tide and saving everything should end near 1,900◈, far short of Passage.
"""

from __future__ import annotations

import argparse
import sys
import time
from collections import Counter
from multiprocessing import Pool
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config  # noqa: E402
from app.engine import exchange, market, money, scrolls  # noqa: E402
from app.engine.actions import (  # noqa: E402
    ActionError,
    BuyPassage,
    Deposit,
    DisputeCharge,
    EndYear,
    ExchangeVisit,
    MarketTrip,
    OpenSecuredCard,
    OpenVault,
    Order,
    PayBill,
    PayCard,
    PayLoan,
    ShareOrder,
    Visit,
    Withdraw,
    Work,
)
from app.engine.game import new_game, step  # noqa: E402
from app.engine.state import (  # noqa: E402
    LONG_DARK,
    ClassId,
    Ending,
    EventKind,
    GameState,
    Good,
    House,
    LoanKind,
    Phase,
    Place,
    Season,
)

KELP_BUFFER = 150  # coin a bot keeps back for the household's kelp and bills


def attempt(s: GameState, action: object) -> bool:
    try:
        step(s, action)
        return True
    except ActionError:
        return False


# --- Housekeeping every bot does ------------------------------------------------------------------


def housekeeping(s: GameState) -> None:
    """Pay what's due, clear debt when it can, and buy Passage the moment it's affordable."""
    if s.bills and s.purse >= sum(b.amount for b in s.bills):
        attempt(s, PayBill())
    if LoanKind.BLACK_REEF in s.loans:
        attempt(s, PayLoan(LoanKind.BLACK_REEF, min(s.purse, s.loans[LoanKind.BLACK_REEF].balance)))
    if s.card and s.card.balance:
        owed = s.card.balance if s.purse - s.card.balance >= KELP_BUFFER else s.card.min_due - s.card.paid_this_season
        if owed > 0:
            attempt(s, PayCard(min(owed, s.purse)))
    try_passage(s)


def try_passage(s: GameState) -> None:
    if s.passage_paid is not None:
        return
    price = money.passage_price(s)
    coin = s.purse + money.vault_free(s)
    if coin < price + money.total_debt(s):
        return
    if money.vault_free(s):
        attempt(s, Withdraw(money.vault_free(s)))
    if s.bills:
        attempt(s, PayBill())
    if s.card and s.card.balance:
        attempt(s, PayCard(s.card.balance))
    for kind in list(s.loans):
        attempt(s, PayLoan(kind, s.loans[kind].balance))
    attempt(s, BuyPassage())


def spare_coin(s: GameState) -> int:
    return max(0, s.purse - KELP_BUFFER - sum(b.amount for b in s.bills))


def sell_everything(s: GameState) -> Optional[object]:
    """One tide to turn shares (or goods) into coin, if there's anything to sell."""
    shares = tuple(ShareOrder(h, -hold.qty) for h, hold in s.shares.items() if hold.qty)
    if shares:
        return ExchangeVisit(shares)
    goods = tuple(Order(g, -hold.qty) for g, hold in s.stores.items() if hold.qty and g != Good.KELP)
    return MarketTrip(goods) if goods else None


def last_tide_before_dark(s: GameState) -> bool:
    return s.season == LONG_DARK - 1 and s.tides_left == 1


# --- Bots -----------------------------------------------------------------------------------------
# Each bot picks one tide action; housekeeping runs before every pick. Every bot but the worker
# plays carefully (banks savings in the Vault, disputes fraud), so the strategy is the only
# difference between them.


def careful(s: GameState) -> None:
    if any(o.kind == EventKind.FRAUD_CHARGE for o in s.offers):
        attempt(s, DisputeCharge())
    if s.vault is None:
        attempt(s, OpenVault())


def bank_spare(s: GameState) -> None:
    if spare_coin(s) and s.vault is not None:
        attempt(s, Deposit(spare_coin(s)))


def spendable(s: GameState) -> int:
    return spare_coin(s) + money.vault_free(s)


def fund(s: GameState, amount: int) -> None:
    """Move Vault coin into the Purse so a trade can use it."""
    short = min(amount + KELP_BUFFER - s.purse, money.vault_free(s))
    if short > 0:
        attempt(s, Withdraw(short))


def buy_shares(s: GameState, orders: Dict[House, int]) -> Optional[object]:
    """Spend coin on shares, ``orders`` as coin per house. None if it buys nothing."""
    qty = {h: int(c // exchange.share_price(s, h)) for h, c in orders.items()}
    qty = {h: q for h, q in qty.items() if q > 0}
    if not qty:
        return None
    fund(s, sum(money.coin(q * exchange.share_price(s, h)) for h, q in qty.items()))
    return ExchangeVisit(tuple(ShareOrder(h, q) for h, q in qty.items()))


def buy_goods(s: GameState, good: Good, qty: int) -> Optional[object]:
    if qty <= 0:
        return None
    fund(s, money.coin(qty * market.unit_price(s, good) * 1.3))
    return MarketTrip((Order(good, qty),))


def worker(s: GameState) -> object:
    """Wages only: works every tide and keeps everything in the Purse."""
    return Work()


def all_cash(s: GameState) -> object:
    """A careful saver: works every tide and banks savings. No trading at all."""
    careful(s)
    bank_spare(s)
    return Work()


def kelp_trader(s: GameState) -> object:
    """Fills the cellar while kelp is cheap and sells the surplus in the Long Dark."""
    careful(s)
    kelp = s.stores[Good.KELP]
    action = None
    if s.season_name in (Season.SUMMER, Season.AUTUMN) and s.tide == 0:
        afford = int(spendable(s) // (market.unit_price(s, Good.KELP) * 1.3))
        action = buy_goods(s, Good.KELP, min(60 - kelp.qty, afford))
    elif s.is_long_dark and s.tide == 0 and kelp.qty:
        action = MarketTrip((Order(Good.KELP, -kelp.qty),))
    if action is None:
        bank_spare(s)
    return action or Work()


def diversified(s: GameState) -> object:
    """Spreads savings over the Tide Index and pearls each season; sells before the panic."""
    careful(s)
    action = None
    if last_tide_before_dark(s):
        action = sell_everything(s)
    elif not s.is_long_dark and s.passage_paid is None and s.tide == 0 and spendable(s) >= 200:
        action = buy_shares(s, {House.INDEX: spendable(s) * 0.6})
    elif not s.is_long_dark and s.passage_paid is None and s.tide == 1 and spendable(s) >= 100:
        action = buy_goods(s, Good.PEARLS, int(spendable(s) // (market.unit_price(s, Good.PEARLS) * 1.1)))
    if action is None:
        bank_spare(s)
    return action or Work()


def gambler(s: GameState) -> object:
    """Everything on Deepcoral every voyage season; sells whatever is left in the Long Dark."""
    careful(s)
    action = None
    if s.is_long_dark and s.tide == 0:
        action = sell_everything(s)
    elif s.tide == 0 and not s.is_long_dark and s.passage_paid is None:
        action = buy_shares(s, {House.DEEPCORAL: spendable(s)})
    if action is None:
        bank_spare(s)
    return action or Work()


def _rumors_this_season(s: GameState) -> List[dict]:
    return [
        e.data for e in s.log
        if e.kind == "event" and e.season == s.season and e.data.get("event") == EventKind.TAVERN_RUMOR
    ]


def _clue_seen(s: GameState, key: str) -> bool:
    return any(e.kind == "clue" and e.data.get("key") == key for e in s.log)


def thoughtful(s: GameState) -> object:
    """Reads the news: diversifies, stays invested through the debasement, follows good tips,
    stocks kelp before the Long Dark, builds credit, and sells before the panic."""
    careful(s)
    if s.standing is None and s.purse > 400:
        attempt(s, OpenSecuredCard())
    attempt(s, Visit(Place.DROWNED_BELL))
    action = _thoughtful_tide(s)
    if action is None:
        bank_spare(s)
    return action or Work()


def _thoughtful_tide(s: GameState) -> Optional[object]:
    if last_tide_before_dark(s):
        return sell_everything(s)
    if s.is_long_dark:
        kelp = s.stores[Good.KELP].qty
        if s.tide == 0 and kelp:
            return MarketTrip((Order(Good.KELP, -kelp),))
        return sell_everything(s)

    for tip in _rumors_this_season(s):
        house, held = tip["house"], s.shares[tip["house"]].qty
        if not tip["claims_success"] and held:
            return ExchangeVisit((ShareOrder(house, -held),))
        if tip["claims_success"] and house != House.DEEPCORAL and spendable(s) >= 200:
            return buy_shares(s, {house: spendable(s)})

    if s.season_name == Season.SUMMER and s.tide == 0:
        want = (60 if _clue_seen(s, "scenario.kelp_blight") else 40) - s.stores[Good.KELP].qty
        if want > 0 and spendable(s) > want * 5:
            return buy_goods(s, Good.KELP, want)
    if s.tide <= 1 and s.passage_paid is None and spendable(s) >= 200:
        return buy_shares(s, {House.INDEX: spendable(s) * 0.5, House.ORO: spendable(s) * 0.5})
    return None


BOTS: Dict[str, Callable[[GameState], object]] = {
    "worker": worker,
    "all_cash": all_cash,
    "kelp_trader": kelp_trader,
    "diversified": diversified,
    "gambler": gambler,
    "thoughtful": thoughtful,
}


# --- Runner ---------------------------------------------------------------------------------------


def ready_to_cash_out(s: GameState) -> bool:
    """Holdings plus coin would cover Passage and every debt: sell and board."""
    if s.passage_paid is not None or not scrolls.assets_value(s):
        return False
    coin = s.purse + money.vault_free(s) + scrolls.assets_value(s)
    return coin >= money.passage_price(s) + money.total_debt(s) + KELP_BUFFER


def play(bot: str, player_class: ClassId, seed: int) -> GameState:
    s = new_game(player_class, seed)
    pick = BOTS[bot]
    while s.phase != Phase.ENDED:
        housekeeping(s)
        if s.phase == Phase.FINAL_CALL:
            step(s, EndYear())
            break
        action = (sell_everything(s) if ready_to_cash_out(s) else None) or pick(s)
        if not attempt(s, action):
            step(s, Work())
    return s


def _run(job: Tuple[str, ClassId, int]) -> Tuple[str, ClassId, Ending, Optional[str], int, int]:
    bot, player_class, seed = job
    s = play(bot, player_class, seed)
    cause = s.miss_cause.value if s.miss_cause else None
    return bot, player_class, s.ending, cause, money.liquid_coin(s), scrolls.net_worth(s)


def apply_overrides(overrides: Optional[Dict[str, object]]) -> None:
    """Set config values (by name) in this process; used for tuning sweeps."""
    for name, value in (overrides or {}).items():
        setattr(config, name, value)


def simulate(
    bots: Iterable[str],
    classes: Iterable[ClassId],
    runs: int,
    seed: int,
    workers: int,
    overrides: Optional[Dict[str, object]] = None,
):
    jobs = [(b, c, seed + i) for b in bots for c in classes for i in range(runs)]
    if workers > 1:
        with Pool(workers, initializer=apply_overrides, initargs=(overrides,)) as pool:
            return pool.map(_run, jobs, chunksize=50)
    apply_overrides(overrides)
    return [_run(job) for job in jobs]


def escape_rates(results) -> Dict[Tuple[str, Optional[ClassId]], float]:
    """Escape share (Passage paid or rescued) per (bot, class), plus (bot, None) averaged over classes."""
    counts: Dict[Tuple[str, ClassId], Counter] = {}
    for bot, cls, ending, *_ in results:
        counts.setdefault((bot, cls), Counter())[ending != Ending.MISSED_THE_SHIP] += 1
    rates: Dict[Tuple[str, Optional[ClassId]], float] = {
        key: c[True] / sum(c.values()) for key, c in counts.items()
    }
    for bot in {b for b, _ in counts}:
        per_class = [r for (b, _), r in rates.items() if b == bot]
        rates[(bot, None)] = sum(per_class) / len(per_class)
    return rates


def report(results, runs: int) -> None:
    grouped: Dict[Tuple[str, ClassId], list] = {}
    for bot, cls, ending, cause, coin, worth in results:
        grouped.setdefault((bot, cls), []).append((ending, cause, coin, worth))

    rates = escape_rates(results)
    header = f"{'bot':<12} {'class':<14} {'escape':>7} {'wealth':>7} {'circle':>7} {'avg coin':>9} {'avg worth':>10}  top miss cause"
    print(header)
    print("-" * len(header))
    for (bot, cls), rows in grouped.items():
        endings = Counter(r[0] for r in rows)
        escaped = endings[Ending.ESCAPED_WITH_WEALTH] + endings[Ending.ESCAPED_WITH_NOTHING]
        causes = Counter(r[1] for r in rows if r[1])
        top = ", ".join(f"{c} {n * 100 // len(rows)}%" for c, n in causes.most_common(2))
        escaped += endings[Ending.RESCUED_BY_CIRCLE]
        print(
            f"{bot:<12} {cls.value:<14} {pct(escaped, rows):>7} {pct(endings[Ending.ESCAPED_WITH_WEALTH], rows):>7} "
            f"{pct(endings[Ending.RESCUED_BY_CIRCLE], rows):>7} {avg(r[2] for r in rows):>9} "
            f"{avg(r[3] for r in rows):>10}  {top}"
        )
    print("\nEscape rate averaged across classes:")
    for bot in dict.fromkeys(b for b, _ in grouped):
        print(f"  {bot:<12} {100 * rates[(bot, None)]:.1f}%")


def pct(n: int, rows: list) -> str:
    return f"{100 * n / len(rows):.1f}%"


def avg(values: Iterable[int]) -> int:
    values = list(values)
    return round(sum(values) / len(values))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--runs", type=int, default=300)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--bots", nargs="+", choices=list(BOTS), default=list(BOTS))
    parser.add_argument("--classes", nargs="+", choices=[c.value for c in ClassId], default=[c.value for c in ClassId])
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    started = time.time()
    classes = [ClassId(c) for c in args.classes]
    results = simulate(args.bots, classes, args.runs, args.seed, args.workers)
    report(results, args.runs)
    print(f"\n{len(results)} runs in {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
