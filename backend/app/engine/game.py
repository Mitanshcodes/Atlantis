"""Game flow: new game, actions, tides and the season loop. The engine's public entry point.

    state = new_game(ClassId.NEWCOMER, seed=42)
    result = apply(state, Work())      # pure: ``state`` is untouched
    result.state, result.events, result.ledger

``apply`` is what the API should call. ``step`` mutates in place and exists for the simulator,
where copying the state every action would dominate the run time.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable, Dict, List, Type

from app import config
from app.engine import business, events, exchange, market, money, scrolls
from app.engine.actions import (
    TIDE_ACTIONS,
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
    PayBill,
    PayCard,
    PayLoan,
    Rest,
    SellBusiness,
    TakeBankLoan,
    Visit,
    Withdraw,
    Work,
)
from app.engine.rng import rng
from app.engine.state import (
    BillKind,
    Card,
    ClassId,
    GameState,
    Good,
    GoodMarket,
    Holding,
    House,
    LedgerEntry,
    Loan,
    LoanKind,
    LogEvent,
    NessieOp,
    Phase,
    Place,
)


@dataclass
class StepResult:
    state: GameState
    events: List[LogEvent]  # what this action caused, in order
    ledger: List[LedgerEntry]  # coin movements to push to Nessie


def new_game(player_class: ClassId, seed: int) -> GameState:
    spec = config.CLASSES[player_class]
    setup = random.Random(f"{seed}:setup")
    s = GameState(
        seed=seed,
        player_class=player_class,
        scenario=events.pick_scenario(setup),
        debasement_season=events.pick_debasement_season(setup),
    )
    s.purse = spec.start_purse
    s.vault = 0 if spec.start_vault else None
    s.vault_rate = config.VAULT_RATE
    s.standing = spec.start_standing
    if spec.starts_with_card and spec.start_standing is not None:
        s.card = Card()
    if spec.guild_loan:
        s.loans[LoanKind.GUILD] = Loan(LoanKind.GUILD, spec.guild_loan, config.GUILD_LOAN_RATE)
    s.goods = {g: GoodMarket() for g in market.enabled_goods()}
    s.stores = {g: Holding() for g in s.goods}
    s.houses = exchange.new_houses()
    s.shares = {h: Holding() for h in [*s.houses, House.INDEX]}
    s.flags.started_unrated = s.standing is None
    s.record("game_start", player_class=player_class)

    if spec.circle_pot:
        money.add_loan(s, LoanKind.CIRCLE, spec.circle_pot, 0.0, "Lending circle pot", NessieOp.TRANSFER)
    _open_season(s)
    return s


def apply(state: GameState, action: object) -> StepResult:
    """Apply one action to a copy of ``state``. Raises ActionError if it's illegal."""
    s = state.clone()
    log_start, ledger_start = len(s.log), len(s.ledger)
    step(s, action)
    return StepResult(s, s.log[log_start:], s.ledger[ledger_start:])


def step(s: GameState, action: object) -> None:
    """Apply one action in place. After an ActionError the state may be half-changed: discard it."""
    if s.phase == Phase.ENDED:
        raise ActionError("game_over", "The year is over.")
    handler = _HANDLERS.get(type(action))
    if handler is None:
        raise ActionError("unknown_action", f"Unknown action: {type(action).__name__}.")
    free_place = _free_visit(s, action)
    spends_tide = isinstance(action, TIDE_ACTIONS) and free_place is None
    if free_place is not None:
        money.require(s.phase == Phase.PLAYING, "no_tides", "The Market and Harbor are closed.")
    elif spends_tide or isinstance(action, EndSeason):
        money.require(s.phase == Phase.PLAYING and s.tides_left > 0, "no_tides", "No tides left this season.")
    handler(s, action)
    if free_place is not None:
        s.free_visits_used.append(free_place)
    if spends_tide:
        _pass_tide(s)
    scrolls.check(s)


_VISIT_PLACES = {MarketTrip: Place.MARKET, ExchangeVisit: Place.HARBOR}


def visit_is_free(s: GameState, place: Place) -> bool:
    """Whether the next Market trip (MARKET) or Exchange visit (HARBOR) this season costs no tide."""
    return s.free_visits_used.count(place) < config.FREE_VISITS_PER_SEASON.get(place, 0)


def _free_visit(s: GameState, action: object):
    place = _VISIT_PLACES.get(type(action))
    return place if place is not None and visit_is_free(s, place) else None


# --- Tides and seasons ----------------------------------------------------------------------------


def _pass_tide(s: GameState) -> None:
    s.tide += 1
    r = rng(s)
    exchange.after_tide(s, r)
    market.after_tide(s, r)
    events.fire_due(s)
    if s.tide < s.tides_total:
        return
    if s.is_long_dark:
        s.phase = Phase.FINAL_CALL
        s.record("final_call", passage_price=money.passage_price(s))
    else:
        _end_season(s)
        s.season += 1
        _open_season(s)


def _end_season(s: GameState) -> None:
    r = rng(s)
    exchange.correct_false_rumors(s)
    exchange.land_voyages(s, r)
    business.season_profit(s, r)
    money.autopay_bills(s)
    s.hungry_next = market.eat_kelp(s)["hungry"]
    market.spoil_kelp(s)
    events.expire_offers(s)
    report = money.settle_season(s)
    exchange.charge_index_fee(s)
    scrolls.check(s)
    s.record(
        "season_end",
        season=s.season_name,
        purse=s.purse,
        vault=s.vault,
        debt=money.total_debt(s),
        hungry=s.hungry_next,
        **report,
    )


def _open_season(s: GameState) -> None:
    """Spring to Autumn just set up. The Long Dark also posts its kelp and profit now, because
    nothing may hit after the player's last move."""
    r = rng(s)
    spec = money.class_spec(s)
    s.tide = 0
    s.flags.visited = []
    s.flags.games_this_season = 0
    s.free_visits_used = []
    market.open_season(s, r)
    exchange.open_season(s)

    money.post_bill(s, BillKind.TITHE, config.TITHE)
    if spec.care_bill:
        money.post_bill(s, BillKind.CARE, spec.care_bill)

    hungry_seasons = int(s.hungry_next)
    s.hungry_next = False
    if s.is_long_dark:
        s.flags.kelp_entering_dark = s.stores[Good.KELP].qty
        business.season_profit(s, r)
        hungry_seasons += int(market.eat_kelp(s)["hungry"])

    care = spec.care_tides if s.season_name in spec.care_seasons else 0
    tides = config.TIDES_PER_SEASON - care - config.HUNGRY_TIDE_PENALTY * hungry_seasons
    s.tides_total = max(config.MIN_TIDES, tides)
    events.schedule(s, r)
    events.announce(s)


# --- Action handlers ------------------------------------------------------------------------------


def _work(s: GameState, _: Work) -> None:
    spec = money.class_spec(s)
    if spec.wage_range:
        pay = rng(s).randint(*spec.wage_range)
    else:
        pay = spec.wage + spec.wage_growth * s.season
    money.earn(s, pay, "Wages")
    s.record("work", pay=pay)


def _market_trip(s: GameState, a: MarketTrip) -> None:
    money.require(bool(a.orders), "no_orders", "Choose something to buy or sell.")
    s.visit(Place.MARKET)
    for order in sorted(a.orders, key=lambda o: o.qty > 0):  # sells first, to fund the buys
        market.trade(s, order.good, order.qty)


def _exchange_visit(s: GameState, a: ExchangeVisit) -> None:
    money.require(bool(a.orders), "no_orders", "Choose shares to buy or sell.")
    s.visit(Place.HARBOR)
    for order in sorted(a.orders, key=lambda o: o.qty > 0):
        exchange.trade(s, order.house, order.qty)


def _end_season_now(s: GameState, _: EndSeason) -> None:
    for _ in range(s.tides_left):
        _pass_tide(s)


def _gamble(s: GameState, a: Gamble) -> None:
    """Stake Purse coin on a game; the roll is seeded like everything else."""
    spec = config.GAMES.get(a.game)
    money.require(spec is not None, "unknown_game", "Nerissa doesn't know that game.")
    money.require(s.phase != Phase.ENDED, "game_over", "The tavern is closed.")
    money.require(
        s.flags.games_this_season < config.GAMES_PER_SEASON,
        "no_games_left",
        f"Nerissa deals {config.GAMES_PER_SEASON} games a season. Come back next season.",
    )
    money.require(
        isinstance(a.stake, int) and config.GAMBLE_MIN <= a.stake <= config.GAMBLE_MAX,
        "invalid_amount",
        f"Stakes are {config.GAMBLE_MIN}◈ to {config.GAMBLE_MAX}◈.",
    )
    if spec.choices:
        money.require(a.pick is not None and 1 <= a.pick <= spec.choices, "invalid_pick", "Pick a shell.")
    s.visit(Place.DROWNED_BELL)
    money.spend(s, a.stake, f"Drowned Bell wager: {a.game}")
    r = rng(s)
    if spec.choices:
        hidden = r.randint(1, spec.choices)
        multiple = spec.payout if hidden == a.pick else 0.0
        detail = {"pick": a.pick, "pearl": hidden}
    else:
        roll, multiple, detail = r.random(), 0.0, {}
        for chance, pays in spec.outcomes:
            if roll < chance:
                multiple = pays
                break
            roll -= chance
        detail = {"multiple": multiple}
    won = money.coin(a.stake * multiple)
    money.earn(s, won, f"Drowned Bell winnings: {a.game}")
    s.flags.games_this_season += 1
    s.flags.games_played += 1
    s.flags.gamble_net += won - a.stake
    s.record("gamble", game=a.game, stake=a.stake, won=won, **detail)


def _end_year(s: GameState, _: EndYear) -> None:
    money.require(s.phase == Phase.FINAL_CALL, "too_early", "The last ship hasn't called yet.")
    scrolls.finish(s)


_HANDLERS: Dict[Type, Callable[[GameState, object], None]] = {
    Work: _work,
    Rest: lambda s, a: s.record("rest"),
    EndSeason: _end_season_now,
    MarketTrip: _market_trip,
    ExchangeVisit: _exchange_visit,
    BuyBusiness: lambda s, a: business.buy(s, a.kind),
    SellBusiness: lambda s, a: business.sell(s),
    Visit: lambda s, a: s.visit(a.place),
    OpenVault: lambda s, a: money.open_vault(s),
    Deposit: lambda s, a: money.deposit(s, a.amount),
    Withdraw: lambda s, a: money.withdraw(s, a.amount),
    OpenSecuredCard: lambda s, a: money.open_secured_card(s),
    CloseCard: lambda s, a: money.close_card(s),
    PayCard: lambda s, a: money.pay_card(s, a.amount),
    PayBill: lambda s, a: money.pay_bill(s, a.bill_id),
    PayLoan: lambda s, a: money.pay_loan(s, a.kind, a.amount),
    TakeBankLoan: lambda s, a: money.take_bank_loan(s, a.amount),
    BlackReefAdvance: lambda s, a: money.black_reef_advance(s, a.amount),
    DisputeCharge: lambda s, a: events.dispute_charge(s),
    InvestPearlExchange: lambda s, a: events.invest_pearl_exchange(s, a.amount),
    BuyPassage: lambda s, a: money.buy_passage(s),
    Gamble: _gamble,
    EndYear: _end_year,
}
