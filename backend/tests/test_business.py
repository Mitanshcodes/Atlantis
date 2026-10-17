import pytest
from helpers import game, rand

from app import config
from app.engine import business, money, scrolls
from app.engine.actions import ActionError
from app.engine.state import LONG_DARK, BusinessKind, ClassId, Good, ScrollId


@pytest.fixture
def s(quiet, features):
    features("businesses", "silk", "bank_loan")
    state = game(ClassId.CARETAKER)
    state.purse = 5000
    state.debasement_season = 4  # keep base prices at the doc's table
    return state


def test_businesses_are_off_until_ahead(quiet):
    with pytest.raises(ActionError):
        business.buy(game(ClassId.CARETAKER), BusinessKind.KELP_STALL)


def test_one_business_at_a_time(s):
    business.buy(s, BusinessKind.KELP_STALL)
    with pytest.raises(ActionError):
        business.buy(s, BusinessKind.SALVAGE_BOAT)


def test_kelp_stall_earns_on_the_season_base(s):
    business.buy(s, BusinessKind.KELP_STALL)
    s.goods[Good.KELP].impact = 0.5  # pumping kelp doesn't raise earnings
    assert business.season_profit(s, rand()) == 30 * 4 - 20


def collect_year(s, seed=0):
    for season in range(4):
        s.season = season
        business.season_profit(s, rand(seed * 10 + season))


def year_return(s, kind, seed=0):
    """Buy in Spring, collect every season, sell in the Long Dark: payback multiple."""
    business.buy(s, kind)
    collect_year(s, seed)
    s.season = LONG_DARK
    business.sell(s)
    return (s.flags.business_result + config.BUSINESSES[kind].cost) / config.BUSINESSES[kind].cost


@pytest.mark.parametrize("kind", [BusinessKind.KELP_STALL, BusinessKind.SILK_LOOM])
def test_spring_to_long_dark_returns_about_one_and_a_half(s, kind):
    assert 1.4 <= year_return(s, kind) <= 1.6


def test_salvage_boat_returns_about_one_and_a_half_on_average(quiet, features):
    features("businesses")
    returns = []
    for seed in range(300):
        st = game(ClassId.CARETAKER)
        st.purse = 5000
        returns.append(year_return(st, BusinessKind.SALVAGE_BOAT, seed))
    assert 1.35 <= sum(returns) / len(returns) <= 1.55


def test_long_dark_resale_is_thirty_percent_and_a_fire_sale(s):
    business.buy(s, BusinessKind.SILK_LOOM)
    s.season = LONG_DARK
    assert business.resale_value(s) == 240
    business.sell(s)
    assert s.flags.fire_sale


def test_good_debt_when_the_business_beats_the_loan(s):
    money.take_bank_loan(s, 1000)
    business.buy(s, BusinessKind.KELP_STALL)
    assert s.business.loan_funded
    s.flags.bank_interest_paid = 60
    collect_year(s)
    business.sell(s)
    assert scrolls._good_debt(s)


def test_no_good_debt_without_a_loan(s):
    business.buy(s, BusinessKind.KELP_STALL)
    business.sell(s)
    assert not scrolls._good_debt(s)
    assert ScrollId.GOOD_DEBT not in s.scrolls
