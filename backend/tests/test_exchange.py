import pytest
from helpers import game, rand

from app import config
from app.engine import exchange
from app.engine.actions import ActionError
from app.engine.state import LONG_DARK, ClassId, House, Scenario


@pytest.fixture
def s(quiet):
    return game(ClassId.CARETAKER)


def test_houses_start_at_doc_prices(s):
    assert {h: hm.price for h, hm in s.houses.items()} == {
        House.ORO: 50,
        House.LEVIATHAN: 40,
        House.DEEPCORAL: 20,
    }
    assert House.SILKWIND not in s.houses  # only if ahead


def test_tide_index_is_a_45_45_10_basket(s):
    start = 0.45 * 50 + 0.45 * 40 + 0.10 * 20
    assert exchange.share_price(s, House.INDEX) == pytest.approx(start)
    basket = exchange.index_basket()
    value_share = {h: units * s.houses[h].price / start for h, units in basket.items()}
    assert value_share == pytest.approx({House.ORO: 0.45, House.LEVIATHAN: 0.45, House.DEEPCORAL: 0.10})
    exchange.charge_index_fee(s)
    assert exchange.share_price(s, House.INDEX) == pytest.approx(start * 0.99)


def test_index_follows_its_houses(s):
    before = exchange.share_price(s, House.INDEX)
    s.houses[House.LEVIATHAN].price *= 1.30
    assert exchange.share_price(s, House.INDEX) == pytest.approx(before * (1 + 0.45 * 0.30))


def test_debasement_lifts_share_prices(s):
    index = exchange.share_price(s, House.INDEX)
    exchange.inflate(s, 1.15)
    assert s.houses[House.ORO].price == pytest.approx(57.5)
    assert exchange.share_price(s, House.INDEX) == pytest.approx(index * 1.15)


def test_deepcoral_loses_on_average():
    spec = config.HOUSES[House.DEEPCORAL]
    assert spec.success * spec.win - (1 - spec.success) * spec.loss < 0


def test_buy_and_sell_shares(s):
    assert exchange.trade(s, House.ORO, 4) == 200
    assert s.purse == 1100 - 200
    assert exchange.trade(s, House.ORO, -1) == 50
    assert (s.shares[House.ORO].qty, s.shares[House.ORO].cost) == (3, 150)
    with pytest.raises(ActionError):
        exchange.trade(s, House.ORO, -4)


def test_successful_voyages_raise_prices_and_pay_dividends(s):
    exchange.trade(s, House.ORO, 10)
    exchange.trade(s, House.INDEX, 3)
    purse = s.purse
    for hm in s.houses.values():
        hm.voyage_outcome = True
    exchange.land_voyages(s, rand())
    assert s.houses[House.ORO].price == pytest.approx(54)
    assert s.houses[House.LEVIATHAN].price == pytest.approx(52)
    assert s.houses[House.DEEPCORAL].price == pytest.approx(50)
    # 10 Oro x 1 + 3 index x (0.3825 Oro shares each x 1)
    assert s.purse == purse + 11
    assert s.houses[House.ORO].record == [True]


def test_failed_voyages_drop_prices_and_pay_nothing(s):
    exchange.trade(s, House.ORO, 10)
    purse = s.purse
    for hm in s.houses.values():
        hm.voyage_outcome = False
    exchange.land_voyages(s, rand())
    assert s.houses[House.ORO].price == pytest.approx(44)
    assert s.houses[House.LEVIATHAN].price == pytest.approx(26)
    assert s.purse == purse


def test_captains_record_keeps_last_four(s):
    for _ in range(6):
        exchange.land_voyages(s, rand())
    assert len(s.houses[House.ORO].record) == 4


def test_storms_and_scenarios_change_success(s):
    s.scenario = Scenario.STORMY_SEAS
    s.season = 2
    exchange.open_season(s)
    assert s.storm_level == 2
    assert exchange.success_chance(s, House.ORO) == pytest.approx(0.9 * 0.7 * 0.9)
    assert exchange.success_chance(s, House.LEVIATHAN) == pytest.approx(0.7 * 0.7)
    s.scenario = Scenario.SILK_BOOM
    s.season = 1
    exchange.open_season(s)
    assert exchange.success_chance(s, House.ORO) == pytest.approx(0.95)
    s.season = 2
    exchange.open_season(s)
    assert exchange.success_chance(s, House.ORO) == pytest.approx(0.9 * 0.85)


def test_long_dark_panic_drops_every_house(s):
    s.season = LONG_DARK
    exchange.open_season(s)
    assert s.houses[House.ORO].price == pytest.approx(40)


def test_tide_moves_stay_within_each_house_swing(s):
    for seed in range(30):
        before = {h: hm.price for h, hm in s.houses.items()}
        exchange.after_tide(s, rand(seed))
        assert abs(s.houses[House.ORO].price / before[House.ORO] - 1) <= 0.02 + 1e-9
        assert abs(s.houses[House.DEEPCORAL].price / before[House.DEEPCORAL] - 1) <= 0.08 + 1e-9


def rumor_accuracy(player_class, trials=10_000):
    s = game(player_class)
    right = 0
    for seed in range(trials):
        for hm in s.houses.values():
            hm.rumor = hm.voyage_outcome = None
        heard = exchange.spread_rumor(s, rand(10_000_000 + seed))
        right += heard["claims_success"] == s.houses[heard["house"]].voyage_outcome
    return right / trials


def test_rumors_are_right_seventy_percent_of_the_time(quiet):
    assert rumor_accuracy(ClassId.CARETAKER) == pytest.approx(0.70, abs=0.03)


def test_newcomer_hears_better_rumors(quiet):
    assert rumor_accuracy(ClassId.NEWCOMER) == pytest.approx(0.90, abs=0.02)


def test_rumor_preroll_decides_the_voyage(s):
    heard = exchange.spread_rumor(s, rand(3))
    hm = s.houses[heard["house"]]
    outcome = hm.voyage_outcome
    result = next(x for x in exchange.land_voyages(s, rand(99)) if x["house"] == heard["house"])
    assert result["success"] == outcome


def test_false_rumor_is_corrected_at_season_end(s):
    heard = exchange.spread_rumor(s, rand(3))
    hm = s.houses[heard["house"]]
    hm.rumor.true = False
    price_before_rumor = hm.price / hm.rumor.reaction
    exchange.correct_false_rumors(s)
    assert hm.price == pytest.approx(price_before_rumor)


def test_selling_shares_at_a_loss_in_the_long_dark_is_a_fire_sale(s):
    exchange.trade(s, House.LEVIATHAN, 5)
    s.season = LONG_DARK
    exchange.open_season(s)
    exchange.trade(s, House.LEVIATHAN, -5)
    assert s.flags.fire_sale
