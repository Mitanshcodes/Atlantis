import pytest
from helpers import advance_to, game, settle_debts

from app.engine import money, scrolls
from app.engine.actions import EndSeason, ExchangeVisit, MarketTrip, Order, ShareOrder
from app.engine.game import step
from app.engine.state import LONG_DARK, BillKind, ClassId, Ending, Good, House, MissCause, Phase, ScrollId


def at_final_call(player_class=ClassId.CARETAKER, seed=1):
    s = game(player_class, seed)
    advance_to(s, LONG_DARK)
    settle_debts(s)
    step(s, EndSeason())
    assert s.phase == Phase.FINAL_CALL
    return s


# --- Endings --------------------------------------------------------------------------------------


def test_escaped_with_wealth(quiet):
    s = at_final_call()
    s.purse = money.passage_price(s) + 1500
    scrolls.finish(s)
    assert s.ending == Ending.ESCAPED_WITH_WEALTH and s.miss_cause is None


def test_escaped_with_nothing(quiet):
    s = at_final_call()
    s.purse = money.passage_price(s) + 200
    scrolls.finish(s)
    assert s.ending == Ending.ESCAPED_WITH_NOTHING


def test_circle_rescues_a_faithful_caretaker(quiet):
    s = at_final_call(ClassId.CARETAKER)
    s.purse = money.passage_price(s) - 300
    scrolls.finish(s)
    assert s.ending == Ending.RESCUED_BY_CIRCLE
    assert s.passage_paid == money.passage_price(s) and s.purse == 0
    assert ScrollId.CIRCLE_OF_TRUST in s.scrolls


def test_circle_does_not_rescue_after_a_missed_payment(quiet):
    s = at_final_call(ClassId.CARETAKER)
    s.flags.circle_missed = True
    s.purse = money.passage_price(s) - 300
    scrolls.finish(s)
    assert s.ending == Ending.MISSED_THE_SHIP
    assert ScrollId.CIRCLE_OF_TRUST not in s.scrolls


def test_circle_covers_at_most_one_pot(quiet):
    s = at_final_call(ClassId.CARETAKER)
    s.purse = money.passage_price(s) - 401
    scrolls.finish(s)
    assert s.ending == Ending.MISSED_THE_SHIP


def test_only_the_caretaker_has_a_circle(quiet):
    s = at_final_call(ClassId.FIRST_OF_LINE)
    s.purse = money.passage_price(s) - 100
    scrolls.finish(s)
    assert s.ending == Ending.MISSED_THE_SHIP


def test_missed_because_of_debt(quiet):
    s = at_final_call()
    s.purse = 10_000
    s.card.balance = 50
    scrolls.finish(s)
    assert (s.ending, s.miss_cause) == (Ending.MISSED_THE_SHIP, MissCause.DEBT)


def test_missed_because_assets_could_not_be_sold(quiet):
    s = at_final_call()
    s.purse = 0
    s.shares[House.ORO].qty = 500
    scrolls.finish(s)
    assert s.miss_cause == MissCause.ILLIQUID
    assert ScrollId.RICH_ON_PAPER in s.scrolls


def test_missed_because_of_a_scam(quiet):
    s = at_final_call()
    s.purse, s.flags.fell_for_scam = 100, True
    scrolls.finish(s)
    assert s.miss_cause == MissCause.SCAM


def test_missed_with_no_savings(quiet):
    s = at_final_call()
    s.purse = 100
    scrolls.finish(s)
    assert s.miss_cause == MissCause.NO_SAVINGS
    assert ScrollId.RICH_ON_PAPER not in s.scrolls


# --- Scrolls --------------------------------------------------------------------------------------


def test_rainy_day_for_entering_the_dark_with_kelp(quiet):
    s = game(ClassId.CARETAKER)
    advance_to(s, 2)
    step(s, MarketTrip((Order(Good.KELP, 60),)))
    advance_to(s, LONG_DARK)  # Autumn eats 20, 4 spoil: 36 enter the dark
    assert s.flags.kelp_entering_dark == 36
    assert ScrollId.RAINY_DAY in s.scrolls


def test_bought_low_for_stockpiling_in_summer(quiet):
    s = game(ClassId.CARETAKER)
    advance_to(s, 1)
    step(s, MarketTrip((Order(Good.KELP, 20),)))
    assert ScrollId.BOUGHT_LOW in s.scrolls


def test_melting_coin_for_holding_cash_through_the_debasement(quiet):
    s = game(ClassId.CARETAKER)
    s.purse = 5000
    advance_to(s, s.debasement_season)
    assert ScrollId.MELTING_COIN in s.scrolls


def test_no_melting_coin_without_much_cash(quiet):
    s = game(ClassId.TIDEWALKER)
    s.purse = 100
    advance_to(s, s.debasement_season, pay=False)
    assert ScrollId.MELTING_COIN not in s.scrolls


def test_debt_spiral(quiet):
    s = game()
    s.flags.min_only_streak = 2
    scrolls.check(s)
    assert ScrollId.DEBT_SPIRAL in s.scrolls


@pytest.mark.parametrize(
    "orders,earned",
    [
        ((ShareOrder(House.INDEX, 1),), True),
        ((ShareOrder(House.ORO, 1), ShareOrder(House.LEVIATHAN, 1), ShareOrder(House.DEEPCORAL, 1)), True),
        ((ShareOrder(House.ORO, 1), ShareOrder(House.LEVIATHAN, 1)), False),
    ],
)
def test_not_all_on_one_ship(quiet, orders, earned):
    s = game(ClassId.CARETAKER)
    step(s, ExchangeVisit(orders))
    assert (ScrollId.NOT_ALL_ON_ONE_SHIP in s.scrolls) == earned


@pytest.mark.parametrize(
    "flag,scroll",
    [
        ("fire_sale", ScrollId.FIRE_SALE),
        ("fell_for_scam", ScrollId.SIREN_SONG),
        ("disputed_fraud", ScrollId.READ_THE_LEDGER),
    ],
)
def test_flag_scrolls(quiet, flag, scroll):
    s = game()
    setattr(s.flags, flag, True)
    scrolls.check(s)
    assert scroll in s.scrolls


def test_credit_built_only_from_unrated(quiet):
    s = game(ClassId.NEWCOMER)
    money.open_secured_card(s)
    s.standing = 579
    scrolls.check(s)
    assert ScrollId.CREDIT_BUILT not in s.scrolls
    s.standing = 580
    scrolls.check(s)
    assert ScrollId.CREDIT_BUILT in s.scrolls
    rated = game(ClassId.CARETAKER)
    scrolls.check(rated)
    assert ScrollId.CREDIT_BUILT not in rated.scrolls


def test_circle_of_trust_needs_every_payment(quiet):
    s = at_final_call(ClassId.CARETAKER)
    s.purse = money.passage_price(s) + 100
    scrolls.finish(s)
    assert ScrollId.CIRCLE_OF_TRUST in s.scrolls
    assert not any(b.kind == BillKind.CIRCLE for b in s.bills)


def test_scrolls_are_awarded_once(quiet):
    s = game()
    s.flags.fire_sale = True
    scrolls.check(s)
    scrolls.check(s)
    assert s.scrolls.count(ScrollId.FIRE_SALE) == 1
    assert sum(e.kind == "scroll" for e in s.log) == 1
