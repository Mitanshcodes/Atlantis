import pytest
from helpers import game, rand

from app import config
from app.engine import market, money
from app.engine.actions import ActionError
from app.engine.state import LONG_DARK, ClassId, Good, Scenario


@pytest.fixture
def s(quiet):
    return game(ClassId.NEWCOMER)


def test_spring_kelp_is_base_price(s):
    s.debasement_season = 2
    assert market.unit_price(s, Good.KELP) == 4.0


def test_scenario_and_debasement_change_the_base(s):
    s.debasement_season = 2
    s.scenario = Scenario.KELP_BLIGHT
    assert market.season_base(s, Good.KELP, LONG_DARK) == pytest.approx(18 * 1.15)
    s.scenario = Scenario.STORMY_SEAS
    assert market.season_base(s, Good.KELP, LONG_DARK) == pytest.approx(12 * 1.15)
    assert market.season_base(s, Good.KELP, 1) == 3  # before the debasement lands


def test_buying_pays_the_average_of_rising_unit_prices(s):
    s.debasement_season = 2
    # 4 x (1 + 0.005k) for k = 0..9  ->  40.9
    assert market.quote(s, Good.KELP, 10) == 41
    assert market.trade(s, Good.KELP, 10) == 41
    assert s.purse == 500 - 41
    assert s.stores[Good.KELP].qty == 10
    assert s.goods[Good.KELP].impact == pytest.approx(0.05)


def test_selling_pushes_the_price_down(s):
    s.debasement_season = 2
    market.trade(s, Good.KELP, 10)
    # 4 x (1.05 - 0.005k) for k = 0..9  ->  41.1
    assert market.trade(s, Good.KELP, -10) == 41
    assert s.goods[Good.KELP].impact == pytest.approx(0.0)
    assert s.stores[Good.KELP].cost == 0


def test_quote_does_not_change_state(s):
    before = s.clone()
    market.quote(s, Good.PEARLS, 20)
    assert s == before


def test_half_the_impact_fades_each_tide(s):
    s.goods[Good.KELP].impact = 0.2
    market.after_tide(s, rand())
    assert s.goods[Good.KELP].impact == pytest.approx(0.1)


def test_prices_never_fall_below_the_floor(s):
    s.debasement_season = 2
    s.goods[Good.KELP].impact = -0.95
    assert market.unit_price(s, Good.KELP) == pytest.approx(4 * config.PRICE_FLOOR)


def test_cellar_holds_sixty_kelp(s):
    with pytest.raises(ActionError) as err:
        market.trade(s, Good.KELP, 61)
    assert err.value.code == "cellar_full"


def test_cannot_sell_what_you_do_not_hold(s):
    with pytest.raises(ActionError):
        market.trade(s, Good.PEARLS, -1)


def test_silk_is_off_until_ahead(s):
    assert Good.SILK not in s.goods
    with pytest.raises(ActionError):
        market.trade(s, Good.SILK, 1)


def test_long_dark_panic_cuts_pearls(s):
    s.debasement_season = 2
    s.season = LONG_DARK
    s.goods[Good.PEARLS].noise = 0
    assert market.unit_price(s, Good.PEARLS) == pytest.approx(48 * 1.15 * 0.9)


def test_pearl_swing_stays_within_three_percent(s):
    for seed in range(50):
        market.after_tide(s, rand(seed))
        assert abs(s.goods[Good.PEARLS].noise) <= 0.03
        assert s.goods[Good.KELP].noise == 0


def test_household_eats_from_stores_first(s):
    s.stores[Good.KELP].qty, s.stores[Good.KELP].cost = 25, 100
    report = market.eat_kelp(s)
    assert report == {"from_stores": 20, "bought": 0, "cost": 0, "hungry": False}
    assert s.stores[Good.KELP].qty == 5
    assert s.stores[Good.KELP].cost == 20


def test_household_buys_the_rest_from_the_purse(s):
    s.debasement_season = 2
    s.stores[Good.KELP].qty = 5
    report = market.eat_kelp(s)
    assert report["cost"] == 60  # 15 kelp at 4
    assert s.purse == 500 - 60


def test_no_coin_goes_on_leviathan_credit(quiet):
    s = game(ClassId.CARETAKER)
    s.purse = 0
    assert market.eat_kelp(s)["hungry"] is False
    assert s.card.balance == money.coin(20 * market.unit_price(s, Good.KELP))


def test_no_coin_and_no_card_means_hunger(s):
    s.purse = 0
    assert market.eat_kelp(s)["hungry"] is True


def test_stored_kelp_spoils(s):
    s.stores[Good.KELP].qty = 36
    assert market.spoil_kelp(s) == 4
    assert s.stores[Good.KELP].qty == 32


def test_selling_at_a_loss_in_the_long_dark_is_a_fire_sale(s):
    market.trade(s, Good.PEARLS, 5)
    s.season = LONG_DARK
    s.goods[Good.PEARLS].event_mult = 0.5
    market.trade(s, Good.PEARLS, -5)
    assert s.flags.fire_sale


def test_buying_kelp_in_summer_counts_for_bought_low(s):
    s.season = 1
    market.trade(s, Good.KELP, 30)
    assert s.flags.kelp_bought_summer == 30
