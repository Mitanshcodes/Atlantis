import random

import pytest
from helpers import game, rand

from app import config
from app.engine import events, scrolls
from app.engine.actions import ActionError, EndSeason, Gamble
from app.engine.game import new_game, step
from app.engine.state import LONG_DARK, ClassId, Good, House, NessieOp, ScrollId, SEASONS


# --- Market shocks --------------------------------------------------------------------------------


def shocks_in(log):
    return [e for e in log if e.kind == "market_shock"]


@pytest.mark.parametrize("seed", range(12))
def test_one_shock_every_season_and_none_repeats(seed):
    s = new_game(ClassId.CARETAKER, seed)
    while s.phase.value == "playing":
        step(s, EndSeason())
    fired = shocks_in(s.log)
    assert [e.season for e in fired] == list(range(len(SEASONS)))
    names = [e.data["shock"] for e in fired]
    assert len(set(names)) == len(names)


def test_storm_shocks_skip_the_long_dark_when_no_ships_sail():
    for spec in config.MARKET_SHOCKS.values():
        if spec.storm:
            assert SEASONS[LONG_DARK] not in spec.seasons


def test_a_goods_shock_moves_prices_for_the_season(quiet, monkeypatch):
    monkeypatch.setattr(config, "MARKET_SHOCKS", {"jellyfish_bloom": config.MarketShock(goods={Good.KELP: 1.5})})
    s = game(ClassId.CARETAKER)
    events.fire_shock(s, rand())
    assert s.goods[Good.KELP].event_mult == pytest.approx(1.5)
    assert s.shock == "jellyfish_bloom" and s.flags.shocks_seen == ["jellyfish_bloom"]
    step(s, EndSeason())
    assert s.goods[Good.KELP].event_mult == 1.0  # the next season starts fresh
    assert s.shock is None or s.shock != "jellyfish_bloom"


def test_a_house_shock_moves_share_prices(quiet, monkeypatch):
    monkeypatch.setattr(config, "MARKET_SHOCKS", {"royal_contract": config.MarketShock(houses={House.LEVIATHAN: 1.2})})
    s = game(ClassId.CARETAKER)
    before = s.houses[House.LEVIATHAN].price
    events.fire_shock(s, rand())
    assert s.houses[House.LEVIATHAN].price == pytest.approx(before * 1.2)


def test_every_shock_has_words_in_content():
    import json
    from pathlib import Path

    content = json.loads((Path(__file__).parents[1] / "app/content/events.json").read_text())
    assert set(content["shocks"]) == set(config.MARKET_SHOCKS)
    for words in content["shocks"].values():
        assert words["title"] and words["story"] and words["means"]


# --- The Drowned Bell -----------------------------------------------------------------------------


def play(s, game_name, stake, pick=None):
    step(s, Gamble(game_name, stake, pick))
    return [e for e in s.log if e.kind == "gamble"][-1].data


@pytest.mark.parametrize("game_name,expected", [("shells", 2.5 / 3), ("wheel", 0.88)])
def test_every_game_pays_back_less_than_it_takes(game_name, expected):
    staked = won = 0
    for seed in range(1500):
        s = new_game(ClassId.CARETAKER, seed)
        r = random.Random(seed)
        result = play(s, game_name, 100, r.randint(1, 3) if game_name == "shells" else None)
        staked += 100
        won += result["won"]
    assert won / staked == pytest.approx(expected, abs=0.06)
    assert won < staked


def test_the_shell_game_pays_when_you_find_the_pearl(quiet):
    s = game(ClassId.CARETAKER)
    result = play(s, "shells", 20, 2)
    assert result["won"] == (50 if result["pearl"] == 2 else 0)
    assert s.purse == 1100 - 20 + result["won"]


def test_three_games_a_season(quiet):
    s = game(ClassId.CARETAKER)
    for _ in range(config.GAMES_PER_SEASON):
        play(s, "wheel", 5)
    with pytest.raises(ActionError) as err:
        step(s, Gamble("wheel", 5))
    assert err.value.code == "no_games_left"
    step(s, EndSeason())
    play(s, "wheel", 5)  # a new season, new games


@pytest.mark.parametrize("stake", [0, 4, 101])
def test_stakes_have_limits(quiet, stake):
    with pytest.raises(ActionError):
        step(game(ClassId.CARETAKER), Gamble("wheel", stake))


def test_the_shell_game_needs_a_shell(quiet):
    for pick in (None, 0, 4):
        with pytest.raises(ActionError):
            step(game(ClassId.CARETAKER), Gamble("shells", 10, pick))


def test_gambling_is_free_of_tides_and_counts_as_a_tavern_visit(quiet):
    s = game(ClassId.CARETAKER)
    play(s, "wheel", 10)
    assert s.tide == 0
    assert "drowned_bell" in [p.value for p in s.flags.visited]


def test_wagers_and_winnings_reach_the_ledger(quiet):
    s = game(ClassId.CARETAKER)
    result = play(s, "wheel", 50)
    tail = [(e.op, e.amount) for e in s.ledger if "Drowned Bell" in e.memo]
    assert tail[0] == (NessieOp.PURCHASE, 50)
    if result["won"]:
        assert tail[1] == (NessieOp.DEPOSIT, result["won"])


def test_losing_a_hundred_earns_the_house_always_wins(quiet):
    s = game(ClassId.CARETAKER)
    s.flags.gamble_net = -99
    scrolls.check(s)
    assert ScrollId.HOUSE_ALWAYS_WINS not in s.scrolls
    s.flags.gamble_net = -100
    scrolls.check(s)
    assert ScrollId.HOUSE_ALWAYS_WINS in s.scrolls
