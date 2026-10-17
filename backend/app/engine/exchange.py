"""The Harbor Exchange: shipping-house shares, voyages, rumors, the Tide Index.

Prices take a small random step after every tide, jump when voyages land at season end, rise with
the debasement, and drop in the Long Dark panic. The Tide Index is a fixed basket of house shares
(45% Oro, 45% Leviathan, 10% Deepcoral by value at the start), less a 1% fee each season. A tavern rumor pre-rolls that house's voyage, then claims the true outcome
with the class's rumor accuracy, so a good ear really is worth coin.
"""

from __future__ import annotations

import random
from typing import Any, Dict, List

from app import config
from app.engine import market, money
from app.engine.state import GameState, HouseMarket, House, Rumor, Scenario, Season


def enabled_houses() -> List[House]:
    return [h for h in config.HOUSES if h != House.SILKWIND or config.FEATURE_SILK]


def new_houses() -> Dict[House, HouseMarket]:
    return {h: HouseMarket(price=float(config.HOUSES[h].start_price)) for h in enabled_houses()}


def index_basket() -> Dict[House, float]:
    """House shares inside one Tide Index share, before fees."""
    base = sum(w * config.HOUSES[h].start_price for h, w in config.INDEX_WEIGHTS.items())
    return {h: base * w / config.HOUSES[h].start_price for h, w in config.INDEX_WEIGHTS.items()}


def share_price(s: GameState, house: House) -> float:
    if house == House.INDEX:
        return s.index_factor * sum(units * s.houses[h].price for h, units in index_basket().items())
    return s.houses[house].price


def quote(s: GameState, house: House, qty: int) -> int:
    return money.coin(share_price(s, house) * abs(qty))


def trade(s: GameState, house: House, qty: int) -> int:
    """Buy (qty > 0) or sell (qty < 0) whole shares. Returns the coin moved."""
    money.require(house in s.shares, "unavailable", "That house isn't listed.")
    money.require(isinstance(qty, int) and qty != 0, "invalid_amount", "Choose how many shares.")
    holding = s.shares[house]
    total = quote(s, house, qty)
    if qty > 0:
        money.spend(s, total, f"Harbor Exchange: {qty} {house.value} shares")
        holding.qty += qty
        holding.cost += total
    else:
        units = -qty
        money.require(units <= holding.qty, "not_enough", f"You hold {holding.qty} {house.value} shares.")
        basis = market.remove_units(holding, units)
        money.earn(s, total, f"Harbor Exchange: sold {units} {house.value} shares")
        if s.is_long_dark and total < basis:
            s.flags.fire_sale = True
    s.record("share_trade", house=house, qty=qty, total=total)
    return total


def portfolio_value(s: GameState) -> int:
    return money.coin(sum(h.qty * share_price(s, house) for house, h in s.shares.items()))


def houses_held(s: GameState) -> List[House]:
    return [house for house, h in s.shares.items() if h.qty > 0]


# --- Prices ---------------------------------------------------------------------------------------


def after_tide(s: GameState, r: random.Random) -> None:
    for house, hm in s.houses.items():
        swing = config.HOUSES[house].tide_swing
        hm.price = max(config.MIN_SHARE_PRICE, hm.price * (1 + r.uniform(-swing, swing)))


def success_chance(s: GameState, house: House) -> float:
    chance = config.HOUSES[house].success
    if s.scenario == Scenario.SILK_BOOM and s.season_name == Season.SUMMER:
        chance = config.SILK_BOOM_SUMMER_SUCCESS.get(house, chance)
    chance *= config.STORM_MULTIPLIERS[s.storm_level]
    if s.scenario == Scenario.STORMY_SEAS and s.season_name == Season.AUTUMN:
        chance *= config.STORMY_SEAS_WORST_HIT.get(house, 1.0)
    return chance


def open_season(s: GameState) -> None:
    level = config.SEASON_STORM_LEVEL[s.season_name]
    if s.scenario == Scenario.STORMY_SEAS and s.season_name == Season.AUTUMN:
        level = config.STORMY_SEAS_AUTUMN_LEVEL
    s.storm_level = level
    if s.is_long_dark:
        for hm in s.houses.values():
            hm.price *= config.LONG_DARK_HOUSE_PANIC
        s.record("panic", houses=config.LONG_DARK_HOUSE_PANIC)


def inflate(s: GameState, mult: float) -> None:
    """The debasement lifts every share price; coin and debts stay where they are."""
    for hm in s.houses.values():
        hm.price *= mult


def raise_storm(s: GameState) -> None:
    s.storm_level = min(s.storm_level + 1, len(config.STORM_MULTIPLIERS) - 1)


# --- Rumors ---------------------------------------------------------------------------------------


def spread_rumor(s: GameState, r: random.Random) -> Dict[str, Any]:
    """A tavern tip about one house's voyage this season. Returns what the player hears."""
    candidates = [h for h, hm in s.houses.items() if hm.rumor is None]
    if not candidates:
        return {}
    house = r.choice(candidates)
    hm = s.houses[house]
    outcome = r.random() < success_chance(s, house)
    is_true = r.random() < money.class_spec(s).rumor_accuracy
    claims_success = outcome if is_true else not outcome
    reaction = 1 + config.RUMOR_PRICE_REACTION if claims_success else 1 - config.RUMOR_PRICE_REACTION
    hm.voyage_outcome = outcome
    hm.rumor = Rumor(claims_success=claims_success, true=is_true, reaction=reaction)
    hm.price *= reaction
    return {"house": house, "claims_success": claims_success}


def correct_false_rumors(s: GameState) -> None:
    for house, hm in s.houses.items():
        if hm.rumor and not hm.rumor.true:
            hm.price /= hm.rumor.reaction
            s.record("rumor_corrected", house=house)


# --- Season end -----------------------------------------------------------------------------------


def land_voyages(s: GameState, r: random.Random) -> List[Dict[str, Any]]:
    """Every house's voyage succeeds or fails; prices jump and dividends are paid."""
    results = []
    dividends: Dict[House, float] = {}
    for house, hm in s.houses.items():
        spec = config.HOUSES[house]
        success = hm.voyage_outcome if hm.voyage_outcome is not None else r.random() < success_chance(s, house)
        hm.price = max(config.MIN_SHARE_PRICE, hm.price * (1 + spec.win if success else 1 - spec.loss))
        hm.record = (hm.record + [success])[-4:]
        hm.voyage_outcome = None
        hm.rumor = None
        if success and spec.dividend:
            dividends[house] = spec.dividend
        results.append({"house": house, "success": success, "price": round(hm.price, 2)})

    basket = index_basket()
    per_index_share = s.index_factor * sum(units * dividends.get(h, 0.0) for h, units in basket.items())
    payout = sum(s.shares[h].qty * d for h, d in dividends.items())
    payout += s.shares[House.INDEX].qty * per_index_share
    money.earn(s, money.coin(payout), "Harbor Exchange dividends")
    s.record("voyages", results=results, dividends=money.coin(payout))
    return results


def charge_index_fee(s: GameState) -> None:
    s.index_factor *= 1 - config.INDEX_FEE_PER_SEASON
