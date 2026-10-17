"""The 12 Scrolls and the four endings.

``check`` runs after every action and season end, and awards any Scroll whose condition now holds.
``finish`` runs once, at the Passage check, and decides the ending.
"""

from __future__ import annotations

from app import config
from app.engine import business, exchange, market, money
from app.engine.state import Account, BillKind, Ending, GameState, House, MissCause, NessieOp, Phase, ScrollId


def award(s: GameState, scroll: ScrollId) -> None:
    if scroll not in s.scrolls:
        s.scrolls.append(scroll)
        s.record("scroll", scroll=scroll)


def check(s: GameState) -> None:
    f = s.flags
    if f.kelp_entering_dark >= config.KELP_EATEN_PER_SEASON:
        award(s, ScrollId.RAINY_DAY)
    if f.kelp_bought_summer >= config.BOUGHT_LOW_MIN_KELP:
        award(s, ScrollId.BOUGHT_LOW)
    if f.cash_at_debasement is not None and f.cash_at_debasement >= config.MELTING_COIN_MIN_CASH:
        award(s, ScrollId.MELTING_COIN)
    if f.min_only_streak >= config.DEBT_SPIRAL_SEASONS:
        award(s, ScrollId.DEBT_SPIRAL)
    held = exchange.houses_held(s)
    if House.INDEX in held or len(held) >= config.DIVERSIFIED_HOUSES:
        award(s, ScrollId.NOT_ALL_ON_ONE_SHIP)
    if f.fire_sale:
        award(s, ScrollId.FIRE_SALE)
    if f.fell_for_scam:
        award(s, ScrollId.SIREN_SONG)
    if f.disputed_fraud:
        award(s, ScrollId.READ_THE_LEDGER)
    if f.started_unrated and s.standing is not None and s.standing >= config.CREDIT_BUILT_STANDING:
        award(s, ScrollId.CREDIT_BUILT)


def assets_value(s: GameState) -> int:
    """What everything except coin would fetch right now."""
    return market.stores_value(s) + exchange.portfolio_value(s) + business.resale_value(s)


def net_worth(s: GameState) -> int:
    return money.liquid_coin(s) + assets_value(s) - money.total_debt(s)


def finish(s: GameState) -> None:
    """The Passage check after the last tide: board if you can, then decide the ending."""
    price = money.passage_price(s)
    money.autopay_bills(s)
    if s.passage_paid is None:
        _auto_board(s, price)

    cause = None
    if s.passage_paid is not None:
        rich = money.liquid_coin(s) >= config.WEALTH_THRESHOLD
        ending = Ending.ESCAPED_WITH_WEALTH if rich else Ending.ESCAPED_WITH_NOTHING
    elif _circle_rescue(s, price):
        ending = Ending.RESCUED_BY_CIRCLE
    else:
        ending = Ending.MISSED_THE_SHIP
        cause = _miss_cause(s, price)
        if net_worth(s) >= price:
            award(s, ScrollId.RICH_ON_PAPER)

    spec = money.class_spec(s)
    circle_clear = not any(b.kind == BillKind.CIRCLE for b in s.bills)
    if spec.circle_pot and not s.flags.circle_missed and circle_clear:
        award(s, ScrollId.CIRCLE_OF_TRUST)
    if _good_debt(s):
        award(s, ScrollId.GOOD_DEBT)
    check(s)

    s.ending, s.miss_cause, s.phase = ending, cause, Phase.ENDED
    s.record("ending", ending=ending, cause=cause, coin=money.liquid_coin(s), net_worth=net_worth(s))


def _auto_board(s: GameState, price: int) -> None:
    """If the coin is there and nothing is owed, the Harbor takes it: Vault included."""
    if money.total_debt(s):
        return
    if s.card is not None and s.card.secured:
        money.close_card(s)  # the Bank returns the collateral
    if s.purse + money.vault_free(s) < price:
        return
    if s.purse < price:
        money.withdraw(s, price - s.purse)
    money.buy_passage(s)


def _circle_rescue(s: GameState, price: int) -> bool:
    spec = money.class_spec(s)
    if not spec.circle_pot or s.flags.circle_missed or money.total_debt(s):
        return False
    gap = price - money.liquid_coin(s)
    if gap > config.CIRCLE_RESCUE_MAX:
        return False
    if money.vault_free(s):
        money.withdraw(s, money.vault_free(s))
    s.purse += gap
    money.post(s, NessieOp.TRANSFER, Account.CIRCLE, gap, "The circle covers the gap", to=Account.PURSE)
    money.buy_passage(s)
    return True


def _miss_cause(s: GameState, price: int) -> MissCause:
    debt = money.total_debt(s)
    shortfall = price + debt - money.liquid_coin(s)
    if debt and debt >= shortfall:  # without the debt, the coin was there
        return MissCause.DEBT
    if money.liquid_coin(s) + assets_value(s) >= price + debt:
        return MissCause.ILLIQUID
    if s.flags.fell_for_scam:
        return MissCause.SCAM
    return MissCause.NO_SAVINGS


def _good_debt(s: GameState) -> bool:
    b = s.business
    if b is not None:
        result, loan_funded = b.earned + business.resale_value(s) - b.cost, b.loan_funded
    elif s.flags.business_result is not None:
        result, loan_funded = s.flags.business_result, s.flags.business_loan_funded
    else:
        return False
    return loan_funded and result > s.flags.bank_interest_paid
