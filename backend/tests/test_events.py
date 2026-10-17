import pytest
from helpers import advance_to, game, kinds, rand

from app import config
from app.engine import events, money
from app.engine.actions import ActionError
from app.engine.state import LONG_DARK, SEASONS, BillKind, ClassId, EventKind, Good, Place, Scenario


@pytest.fixture
def s(quiet):
    return game(ClassId.CARETAKER)


def first_seed(predicate, player_class=ClassId.CARETAKER):
    return next(seed for seed in range(500) if predicate(game(player_class, seed)))


# --- Weights --------------------------------------------------------------------------------------


def test_no_rumors_or_storms_in_the_long_dark(s):
    s.season = LONG_DARK
    w = events.weights(s)
    assert w[EventKind.TAVERN_RUMOR] == 0 and w[EventKind.STORM_WARNING] == 0


def test_storm_warnings_are_likelier_in_autumn(s):
    spring = events.weights(s)[EventKind.STORM_WARNING]
    s.season = 2
    assert events.weights(s)[EventKind.STORM_WARNING] > spring


def test_fat_purse_or_black_reef_draws_pickpockets(s):
    s.purse = 100
    base = events.weights(s)[EventKind.PICKPOCKET]
    s.flags.visited.append(Place.BLACK_REEF)
    assert events.weights(s)[EventKind.PICKPOCKET] > base
    s.flags.visited.clear()
    s.purse = 600
    assert events.weights(s)[EventKind.PICKPOCKET] > base
    s.purse = 0
    assert events.weights(s)[EventKind.PICKPOCKET] == 0


def test_drowned_bell_draws_rumors(s):
    base = events.weights(s)[EventKind.TAVERN_RUMOR]
    s.visit(Place.DROWNED_BELL)
    assert events.weights(s)[EventKind.TAVERN_RUMOR] > base


def test_tidewalker_salvage_is_three_times_as_likely(quiet):
    tide = events.weights(game(ClassId.TIDEWALKER))[EventKind.LUCKY_SALVAGE]
    care = events.weights(game(ClassId.CARETAKER))[EventKind.LUCKY_SALVAGE]
    assert tide == pytest.approx(3 * care)


def test_low_standing_draws_grin(s):
    base = events.weights(s)[EventKind.GRINS_OFFER]
    s.standing = 500
    assert events.weights(s)[EventKind.GRINS_OFFER] > base


def test_pearl_exchange_pitches_once_per_run(s):
    events.fire(s, EventKind.PEARL_EXCHANGE, rand())
    assert events.weights(s)[EventKind.PEARL_EXCHANGE] == 0


def test_an_event_fires_at_most_once_a_season(s):
    events.fire(s, EventKind.ROOF_LEAK, rand())
    assert events.weights(s)[EventKind.ROOF_LEAK] == 0


def test_surface_boom_needs_silk(s):
    s.scenario, s.season = Scenario.SILK_BOOM, 1
    assert events.weights(s)[EventKind.SURFACE_BOOM] == 0


def test_surface_boom_in_a_silk_boom_summer(quiet, features):
    features("silk")
    s = game(ClassId.CARETAKER)
    s.scenario, s.season = Scenario.SILK_BOOM, 1
    assert events.weights(s)[EventKind.SURFACE_BOOM] == config.EVENT_DECK[EventKind.SURFACE_BOOM].boosted


# --- Effects --------------------------------------------------------------------------------------


def test_fraud_can_be_disputed(s):
    events.fire(s, EventKind.FRAUD_CHARGE, rand())
    assert s.purse == 1100 - 55  # 5% of 1100
    events.dispute_charge(s)
    assert s.purse == 1100 and s.flags.disputed_fraud
    with pytest.raises(ActionError):
        events.dispute_charge(s)


def test_fraud_charge_is_at_least_thirty(s):
    s.purse = 100
    events.fire(s, EventKind.FRAUD_CHARGE, rand())
    assert s.purse == 70


def test_undisputed_fraud_is_lost_at_season_end(s):
    events.fire(s, EventKind.FRAUD_CHARGE, rand())
    events.expire_offers(s)
    assert s.offers == [] and "fraud_lost" in kinds(s.log)


def test_pickpocket_takes_a_fifth(s):
    events.fire(s, EventKind.PICKPOCKET, rand())
    assert s.purse == 880


def test_roof_leak_reaches_into_the_vault(s):
    s.purse, s.vault = 100, 500
    events.fire(s, EventKind.ROOF_LEAK, rand())
    assert (s.purse, s.vault) == (0, 450)  # 10% of 600 is under the 150 minimum


def test_unpayable_roof_leak_becomes_a_bill(s):
    s.purse, s.vault, s.standing = 0, 0, 400  # frozen card
    events.fire(s, EventKind.ROOF_LEAK, rand())
    assert any(b.kind == BillKind.REPAIR and b.amount == 150 for b in s.bills)


def test_lucky_salvage(s):
    events.fire(s, EventKind.LUCKY_SALVAGE, rand())
    assert s.purse == 1400


def test_kelp_scare_raises_kelp_this_season(s):
    events.fire(s, EventKind.KELP_BLIGHT_SCARE, rand())
    assert s.goods[Good.KELP].event_mult == 1.5


def test_council_moves_the_vault_rate(s):
    events.fire(s, EventKind.COUNCIL_RATE_CHANGE, rand())
    assert s.vault_rate in config.VAULT_RATE_OPTIONS


def test_pearl_exchange_takes_the_money(s):
    with pytest.raises(ActionError):
        events.invest_pearl_exchange(s, 100)
    events.fire(s, EventKind.PEARL_EXCHANGE, rand())
    events.invest_pearl_exchange(s, 300)
    assert s.purse == 800 and s.flags.fell_for_scam
    events.expire_offers(s)
    assert "scam_revealed" in kinds(s.log)


def test_grins_offer_shows_what_he_would_advance(s):
    money.black_reef_advance(s, 100)
    events.fire(s, EventKind.GRINS_OFFER, rand())
    assert s.offers[-1].amount == 200


# --- Scheduling, scenarios, clues -----------------------------------------------------------------


def test_one_or_two_events_a_season_at_distinct_tides(s, monkeypatch):
    monkeypatch.setattr(config, "EVENTS_PER_SEASON", {2: 1.0})
    for seed in range(20):
        events.schedule(s, rand(seed))
        assert len(set(s.event_tides)) == 2
        assert all(1 <= t <= s.tides_total for t in s.event_tides)


def test_scheduled_events_fire_as_tides_pass(s):
    s.event_tides = [1]
    s.tide = 1
    events.fire_due(s)
    assert s.event_tides == [] and len(s.fired_events) == 1


def test_every_scenario_and_debasement_season_happens():
    seen = {(game(seed=seed).scenario, game(seed=seed).debasement_season) for seed in range(200)}
    assert {sc for sc, _ in seen} == set(Scenario)
    assert {d for _, d in seen} == {1, 2}


@pytest.mark.parametrize("scenario,season", [(sc, config.SCENARIO_CLUES[sc][0]) for sc in Scenario])
def test_scenario_clue_appears_in_its_season(quiet, scenario, season):
    s = game(seed=first_seed(lambda g: g.scenario == scenario, ClassId.NEWCOMER))
    advance_to(s, SEASONS.index(season))
    clues = [e for e in s.log if e.kind == "clue" and e.data["key"] == f"scenario.{scenario.value}"]
    assert len(clues) == 1 and clues[0].season == SEASONS.index(season)


def test_debasement_is_hinted_then_lands(quiet):
    s = game(seed=first_seed(lambda g: g.debasement_season == 2, ClassId.NEWCOMER))
    advance_to(s, 2)
    clue = next(e for e in s.log if e.kind == "clue" and e.data["key"] == "debasement.orichalcum")
    landed = next(e for e in s.log if e.kind == "debasement")
    assert (clue.season, landed.season) == (1, 2)
    assert s.flags.cash_at_debasement is not None
