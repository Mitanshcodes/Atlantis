"""The Grand Market: kelp, pearls and silk, prices, the player's price impact, and the household's kelp.

price = season base x event multiplier x panic x (1 + tide swing) x (1 + your impact),
never below ``PRICE_FLOOR`` of the season base. Each unit traded moves the impact by
``IMPACT_PER_UNIT``; you pay or receive the sum of the per-unit prices.
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

from app import config
from app.engine import money
from app.engine.state import SEASONS, GameState, Good, Holding, Season


def enabled_goods() -> List[Good]:
    return [g for g in Good if g != Good.SILK or config.FEATURE_SILK]


def season_base(s: GameState, good: Good, season: Optional[int] = None) -> float:
    """The season's base price, after the year's scenario and the debasement."""
    season = s.season if season is None else season
    name = SEASONS[season]
    overrides = config.SCENARIO_PRICE_OVERRIDES.get(s.scenario, {})
    base = overrides.get((good, name), config.GOOD_BASE_PRICES[good][season])
    if season >= s.debasement_season:
        base *= config.DEBASEMENT_MULT
    return base


def _reference(s: GameState, good: Good) -> Tuple[float, float]:
    """(price before the player's impact, price floor)."""
    m = s.goods[good]
    base = season_base(s, good)
    panic = config.LONG_DARK_GOOD_PANIC.get(good, 1.0) if s.is_long_dark else 1.0
    return base * m.event_mult * panic * (1 + m.noise), base * config.PRICE_FLOOR


def unit_price(s: GameState, good: Good) -> float:
    ref, floor = _reference(s, good)
    return max(ref * (1 + s.goods[good].impact), floor)


def _trade_value(s: GameState, good: Good, qty: int) -> Tuple[int, float]:
    """Total coin for trading ``qty`` units (positive buys, negative sells) and the impact after."""
    ref, floor = _reference(s, good)
    step = config.IMPACT_PER_UNIT if qty > 0 else -config.IMPACT_PER_UNIT
    impact = s.goods[good].impact
    total = 0.0
    for _ in range(abs(qty)):
        total += max(ref * (1 + impact), floor)
        impact += step
    return money.coin(total), impact


def quote(s: GameState, good: Good, qty: int) -> int:
    """What a trade would cost (buy) or pay (sell), for UI previews. Doesn't change the state."""
    return _trade_value(s, good, qty)[0]


def trade(s: GameState, good: Good, qty: int) -> int:
    """Buy (qty > 0) or sell (qty < 0) at the Grand Market. Returns the coin moved."""
    money.require(good in s.goods, "unavailable", "That good isn't traded yet.")
    money.require(isinstance(qty, int) and qty != 0, "invalid_amount", "Choose how many to trade.")
    holding = s.stores[good]
    if qty > 0:
        if good == Good.KELP:
            room = config.CELLAR_CAPACITY - holding.qty
            money.require(qty <= room, "cellar_full", f"Your cellar has room for {room} more kelp.")
        total, impact = _trade_value(s, good, qty)
        money.spend(s, total, f"Grand Market: {qty} {good.value}")
        holding.qty += qty
        holding.cost += total
        if good == Good.KELP and s.season_name == Season.SUMMER:
            s.flags.kelp_bought_summer += qty
    else:
        units = -qty
        money.require(units <= holding.qty, "not_enough", f"You hold {holding.qty} {good.value}.")
        total, impact = _trade_value(s, good, qty)
        basis = remove_units(holding, units)
        money.earn(s, total, f"Grand Market: sold {units} {good.value}")
        if s.is_long_dark and total < basis:
            s.flags.fire_sale = True
    s.goods[good].impact = impact
    s.record("trade", good=good, qty=qty, total=total)
    return total


def remove_units(holding: Holding, units: int) -> int:
    """Take units out of a holding at average cost. Returns the cost basis removed."""
    basis = money.coin(holding.cost * units / holding.qty) if holding.qty else 0
    holding.qty -= units
    holding.cost = holding.cost - basis if holding.qty else 0
    return basis


def stores_value(s: GameState) -> int:
    return money.coin(sum(h.qty * unit_price(s, g) for g, h in s.stores.items()))


# --- Per tide and per season ----------------------------------------------------------------------


def after_tide(s: GameState, r: random.Random) -> None:
    """Half the player's impact fades and each good takes a fresh random swing."""
    for m in s.goods.values():
        m.impact *= config.IMPACT_FADE_PER_TIDE
    _swing(s, r)


def open_season(s: GameState, r: random.Random) -> None:
    for m in s.goods.values():
        m.event_mult = 1.0
    _swing(s, r)


def _swing(s: GameState, r: random.Random) -> None:
    for good, m in s.goods.items():
        swing = config.GOOD_TIDE_SWING.get(good, 0.0)
        m.noise = r.uniform(-swing, swing) if swing else 0.0


def eat_kelp(s: GameState) -> Dict[str, Any]:
    """The household eats: stores first, then the Purse, then Leviathan Credit, else hunger."""
    need = config.KELP_EATEN_PER_SEASON
    stores = s.stores[Good.KELP]
    from_stores = min(need, stores.qty)
    if from_stores:
        remove_units(stores, from_stores)
    need -= from_stores
    cost = unpaid = 0
    if need:
        cost = money.coin(need * unit_price(s, Good.KELP))
        unpaid = money.cover_cost(s, cost, f"Household kelp: {need}")
    hungry = unpaid > 0
    report = {"from_stores": from_stores, "bought": need, "cost": cost, "hungry": hungry}
    s.record("kelp_eaten", **report)
    return report


def spoil_kelp(s: GameState) -> int:
    stores = s.stores[Good.KELP]
    lost = money.coin(stores.qty * config.KELP_SPOILAGE)
    if lost:
        remove_units(stores, lost)
        s.record("kelp_spoiled", lost=lost)
    return lost
