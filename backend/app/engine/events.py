"""The year's scenario, the Council's debasement, clues, and the weighted event deck.

Each season opens by scheduling one or two events at random tides. When a tide passes the
scheduled point the deck is drawn *then*, so the weights see the player's situation at that moment
(a fat Purse draws pickpockets, low Standing draws Grin).
"""

from __future__ import annotations

import random
from typing import Dict

from app import config
from app.engine import exchange, money
from app.engine.rng import rng, weighted_choice
from app.engine.state import (
    SEASONS,
    Account,
    BillKind,
    EventKind,
    GameState,
    Good,
    LoanKind,
    NessieOp,
    Offer,
    Place,
    Scenario,
    Season,
)


def pick_scenario(r: random.Random) -> Scenario:
    return weighted_choice(r, config.SCENARIO_WEIGHTS)


def pick_debasement_season(r: random.Random) -> int:
    return SEASONS.index(r.choice(config.DEBASEMENT_SEASONS))


# --- Season open ----------------------------------------------------------------------------------


def schedule(s: GameState, r: random.Random) -> None:
    count = min(weighted_choice(r, config.EVENTS_PER_SEASON), s.tides_total)
    s.event_tides = sorted(r.sample(range(1, s.tides_total + 1), count))
    s.fired_events = []
    s.shock = None
    s.shock_tide = r.randint(1, s.tides_total) if shock_candidates(s) else None


# --- Market shocks: one unexpected market event a season -------------------------------------


def shock_candidates(s: GameState) -> Dict[str, float]:
    """Shocks that can happen this season and haven't yet this year, by weight."""
    return {
        name: spec.weight
        for name, spec in config.MARKET_SHOCKS.items()
        if name not in s.flags.shocks_seen and s.season_name in spec.seasons
    }


def fire_shock(s: GameState, r: random.Random) -> None:
    candidates = shock_candidates(s)
    if not candidates:
        return
    name = weighted_choice(r, candidates)
    spec = config.MARKET_SHOCKS[name]
    for good, mult in (spec.goods or {}).items():
        if good in s.goods:
            s.goods[good].event_mult *= mult
    for house, mult in (spec.houses or {}).items():
        if house in s.houses:
            s.houses[house].price = max(config.MIN_SHARE_PRICE, s.houses[house].price * mult)
    for _ in range(spec.storm):
        exchange.raise_storm(s)
    s.flags.shocks_seen.append(name)
    s.shock = name
    s.record("market_shock", shock=name)


def announce(s: GameState) -> None:
    """The Herald's season news, the debasement if it lands now, and any clues."""
    s.record("season_open", season=s.season_name, passage_price=money.passage_price(s), tides=s.tides_total)
    if s.season == s.debasement_season:
        s.flags.cash_at_debasement = money.liquid_coin(s)
        exchange.inflate(s, config.DEBASEMENT_MULT)
        s.record("debasement", mult=config.DEBASEMENT_MULT)
    if s.season == s.debasement_season - 1:
        s.record("clue", source="nerissa", key="debasement.orichalcum")
    clue_season, source = config.SCENARIO_CLUES[s.scenario]
    if s.season_name == clue_season:
        s.record("clue", source=source, key=f"scenario.{s.scenario.value}")


# --- The deck -------------------------------------------------------------------------------------


def behind_pace(s: GameState) -> bool:
    progress = (s.season + 1) / len(SEASONS)
    return money.liquid_coin(s) - money.total_debt(s) < money.passage_price(s) * progress


def weights(s: GameState) -> Dict[EventKind, float]:
    """Each event's chance of being drawn right now. Events fire at most once a season."""
    deck = config.EVENT_DECK
    spec = money.class_spec(s)
    voyages_pending = not s.is_long_dark

    def pick(kind: EventKind, boosted: bool) -> float:
        e = deck[kind]
        return e.boosted if boosted and e.boosted is not None else e.weight

    w = {
        EventKind.KELP_BLIGHT_SCARE: pick(EventKind.KELP_BLIGHT_SCARE, False),
        EventKind.STORM_WARNING: pick(EventKind.STORM_WARNING, s.season_name == Season.AUTUMN)
        if voyages_pending and s.storm_level < len(config.STORM_MULTIPLIERS) - 1 else 0.0,
        EventKind.FRAUD_CHARGE: pick(EventKind.FRAUD_CHARGE, False) if s.purse > 0 else 0.0,
        EventKind.PICKPOCKET: pick(
            EventKind.PICKPOCKET,
            s.purse > config.PICKPOCKET_PURSE_TRIGGER or Place.BLACK_REEF in s.flags.visited,
        ) if s.purse > 0 else 0.0,
        EventKind.ROOF_LEAK: pick(EventKind.ROOF_LEAK, False),
        EventKind.SURFACE_BOOM: pick(
            EventKind.SURFACE_BOOM, s.scenario == Scenario.SILK_BOOM and s.season_name == Season.SUMMER
        ) if config.FEATURE_SILK else 0.0,
        EventKind.TAVERN_RUMOR: pick(EventKind.TAVERN_RUMOR, Place.DROWNED_BELL in s.flags.visited)
        if voyages_pending else 0.0,
        EventKind.LUCKY_SALVAGE: pick(EventKind.LUCKY_SALVAGE, False) * spec.lucky_salvage_mult,
        EventKind.GRINS_OFFER: pick(
            EventKind.GRINS_OFFER,
            s.standing is None or s.standing < config.GRIN_STANDING_TRIGGER or s.purse < config.GRIN_PURSE_TRIGGER,
        ) * spec.grins_offer_mult,
        EventKind.PEARL_EXCHANGE: 0.0 if s.flags.pearl_pitch_seen else pick(EventKind.PEARL_EXCHANGE, behind_pace(s)),
        EventKind.COUNCIL_RATE_CHANGE: pick(EventKind.COUNCIL_RATE_CHANGE, False),
    }
    for kind in s.fired_events:
        w[kind] = 0.0
    return w


def fire_due(s: GameState) -> None:
    if s.shock_tide is not None and s.shock_tide <= s.tide:
        s.shock_tide = None
        fire_shock(s, rng(s))
    while s.event_tides and s.event_tides[0] <= s.tide:
        s.event_tides.pop(0)
        r = rng(s)
        w = weights(s)
        if sum(w.values()) > 0:
            fire(s, weighted_choice(r, w), r)


def fire(s: GameState, kind: EventKind, r: random.Random) -> None:
    """Apply one event's effect and log it."""
    s.fired_events.append(kind)
    data = {}
    if kind == EventKind.KELP_BLIGHT_SCARE:
        s.goods[Good.KELP].event_mult *= config.KELP_SCARE_MULT
    elif kind == EventKind.STORM_WARNING:
        exchange.raise_storm(s)
        data["storm_level"] = s.storm_level
    elif kind == EventKind.FRAUD_CHARGE:
        amount = min(max(money.coin(s.purse * config.FRAUD_SHARE), config.FRAUD_MIN), s.purse)
        money.spend(s, amount, "Unrecognized charge")
        s.offers.append(Offer(kind, amount, s.season))
        data["amount"] = amount
    elif kind == EventKind.PICKPOCKET:
        amount = money.coin(s.purse * config.PICKPOCKET_SHARE)
        s.purse -= amount
        money.post(s, NessieOp.WITHDRAWAL, Account.PURSE, amount, "Pickpocketed")
        data["amount"] = amount
    elif kind == EventKind.ROOF_LEAK:
        cost = max(money.coin(money.liquid_coin(s) * config.ROOF_LEAK_SHARE), config.ROOF_LEAK_MIN)
        unpaid = money.cover_cost(s, cost, "Roof repair", use_vault=True)
        if unpaid:
            money.post_bill(s, BillKind.REPAIR, unpaid)
        data.update(cost=cost, unpaid=unpaid)
    elif kind == EventKind.SURFACE_BOOM:
        for house, mult in config.SURFACE_BOOM_HOUSES.items():
            if house in s.houses:
                s.houses[house].price *= mult
        for good, mult in config.SURFACE_BOOM_GOODS.items():
            if good in s.goods:
                s.goods[good].event_mult *= mult
    elif kind == EventKind.TAVERN_RUMOR:
        data = exchange.spread_rumor(s, r)
    elif kind == EventKind.LUCKY_SALVAGE:
        money.earn(s, config.LUCKY_SALVAGE_AMOUNT, "Lucky salvage")
        data["amount"] = config.LUCKY_SALVAGE_AMOUNT
    elif kind == EventKind.GRINS_OFFER:
        owed = s.loans[LoanKind.BLACK_REEF].balance if LoanKind.BLACK_REEF in s.loans else 0
        amount = max(0, config.BLACK_REEF_MAX - owed)
        s.offers.append(Offer(kind, amount, s.season))
        data["amount"] = amount
    elif kind == EventKind.PEARL_EXCHANGE:
        s.flags.pearl_pitch_seen = True
        s.offers.append(Offer(kind, 0, s.season))
        data["promised_rate"] = config.PEARL_EXCHANGE_PROMISE
    elif kind == EventKind.COUNCIL_RATE_CHANGE:
        s.vault_rate = r.choice(config.VAULT_RATE_OPTIONS)
        data["vault_rate"] = s.vault_rate
    s.record("event", event=kind, **data)


# --- Responses ------------------------------------------------------------------------------------


def _take_offer(s: GameState, kind: EventKind) -> Offer:
    offer = next((o for o in s.offers if o.kind == kind), None)
    money.require(offer is not None, "no_offer", "There's nothing like that waiting on you.")
    s.offers.remove(offer)
    return offer


def dispute_charge(s: GameState) -> None:
    offer = _take_offer(s, EventKind.FRAUD_CHARGE)
    money.earn(s, offer.amount, "Dispute refund: unrecognized charge")
    s.flags.disputed_fraud = True
    s.record("fraud_disputed", amount=offer.amount)


def invest_pearl_exchange(s: GameState, amount: int) -> None:
    money.require_positive(amount)
    money.require(any(o.kind == EventKind.PEARL_EXCHANGE for o in s.offers), "no_offer", "Nobody is pitching you.")
    money.spend(s, amount, "The Pearl Exchange")
    _take_offer(s, EventKind.PEARL_EXCHANGE)
    s.flags.fell_for_scam = True
    s.flags.scam_lost += amount
    s.record("scam", amount=amount)


def expire_offers(s: GameState) -> None:
    """Season end: undisputed charges are lost, pitches vanish, and a scam is revealed."""
    for offer in s.offers:
        if offer.kind == EventKind.FRAUD_CHARGE:
            s.record("fraud_lost", amount=offer.amount)
    s.offers = []
    if s.flags.fell_for_scam and not s.flags.scam_revealed:
        s.flags.scam_revealed = True
        s.record("scam_revealed", amount=s.flags.scam_lost)
