"""Businesses (only if ahead; behind ``config.FEATURE_BUSINESSES``).

One business at a time. Earnings use the season's base price, so the player can't pump them by
trading, and the low Long Dark resale makes a business poor cash when Passage is due.
"""

from __future__ import annotations

import random
from typing import Optional

from app import config
from app.engine import market, money
from app.engine.state import Business, BusinessKind, GameState, LoanKind


def resale_value(s: GameState) -> int:
    if s.business is None:
        return 0
    share = config.BUSINESS_SELL_BACK_LONG_DARK if s.is_long_dark else config.BUSINESS_SELL_BACK
    return money.coin(s.business.cost * share)


def buy(s: GameState, kind: BusinessKind) -> None:
    money.require(config.FEATURE_BUSINESSES, "unavailable", "No businesses are for sale yet.")
    money.require(s.business is None, "already_owned", "You can own one business at a time.")
    spec = config.BUSINESSES[kind]
    money.require(spec.earn_good is None or spec.earn_good in s.goods, "unavailable", "That trade isn't open yet.")
    money.spend(s, spec.cost, f"Bought a {kind.value.replace('_', ' ')}")
    s.business = Business(kind, spec.cost, s.season, loan_funded=LoanKind.BANK in s.loans)
    s.record("business_bought", business=kind, cost=spec.cost)


def sell(s: GameState) -> None:
    money.require(s.business is not None, "nothing_owned", "You don't own a business.")
    b, proceeds = s.business, resale_value(s)
    money.earn(s, proceeds, f"Sold the {b.kind.value.replace('_', ' ')}")
    s.flags.business_result = b.earned + proceeds - b.cost
    s.flags.business_loan_funded = b.loan_funded
    if s.is_long_dark and proceeds < b.cost:
        s.flags.fire_sale = True
    s.business = None
    s.record("business_sold", business=b.kind, proceeds=proceeds)


def season_profit(s: GameState, r: random.Random) -> Optional[int]:
    """Pay the season's earnings and take upkeep. Returns the net, or None with no business."""
    b = s.business
    if b is None:
        return None
    spec = config.BUSINESSES[b.kind]
    if spec.earn_range:
        earnings = r.randint(*spec.earn_range)
    else:
        earnings = money.coin(spec.earn_units * market.season_base(s, spec.earn_good))
    money.earn(s, earnings, "Business earnings")
    money.cover_cost(s, spec.upkeep, "Business upkeep")
    net = earnings - spec.upkeep
    b.earned += net
    s.record("business_profit", business=b.kind, earnings=earnings, upkeep=spec.upkeep)
    return net
