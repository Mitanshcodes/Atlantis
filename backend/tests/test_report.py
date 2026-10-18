"""The season report card: facts from the log, marks, Modern Mirror topics, the bridge's season
book, the API, and the checks on Chelo's AI-written note."""

import json
from uuid import uuid4

import httpx
import pytest

from app import config
from app.ai import report as ai
from app.engine import bridge, report
from app.engine.actions import EndSeason, ExchangeVisit, Gamble, MarketTrip, Order, Rest, ShareOrder, Work
from app.engine.game import new_game, step
from app.engine.state import ClassId, Good, House
from app.models import Action
from tests.test_api import make, ok, start  # noqa: F401  (fixture)


def play_spring(cls=ClassId.NEWCOMER, seed=3, moves=()):
    s = new_game(cls, seed)
    for move in moves:
        step(s, move)
    while s.season == 0:
        step(s, Work())
    return s


def test_every_finished_season_has_a_report_and_the_long_dark_has_none():
    s = new_game(ClassId.CARETAKER, 4)
    for season in range(3):
        while s.season == season:
            step(s, Work())
        assert report.season_report(s, season)["season_index"] == season
    with pytest.raises(ValueError):
        report.season_report(s, 3)


def test_tide_uses_add_up_to_the_season():
    s = play_spring(moves=[ExchangeVisit((ShareOrder(House.ORO, 2),)), ExchangeVisit((ShareOrder(House.ORO, 1),)),
                           Rest(), MarketTrip((Order(Good.KELP, 5),))])
    t = report.season_report(s, 0)["tides"]
    assert t["free_trips"] == 2 and t["exchange"] == 1 and t["rested"] == 1
    assert t["work"] + t["exchange"] + t["market"] + t["rested"] + t["skipped"] == t["total"] == 6


def test_coin_in_and_out_come_from_the_ledger():
    s = play_spring(ClassId.FIRST_OF_LINE, moves=[Gamble("wheel", 10)])
    r = report.season_report(s, 0)
    flow = {x["category"]: x["amount"] for x in r["money"]["in"]}
    assert flow["wages"] == sum(e.data["pay"] for e in s.log if e.kind == "work" and e.season == 0)
    out = {x["category"]: x["amount"] for x in r["money"]["out"]}
    assert out["wagers"] == 10 and out["bills"] >= config.TITHE


def test_unused_tides_and_working_every_tide_are_marked():
    busy = {m["subject"]: m for m in report.season_report(play_spring(), 0)["marks"]}
    assert busy["tides"]["grade"] == "A"
    s = new_game(ClassId.NEWCOMER, 3)
    step(s, Rest())
    step(s, EndSeason())
    idle = {m["subject"]: m for m in report.season_report(s, 0)["marks"]}
    assert idle["tides"]["grade"] == "D" and idle["tides"]["params"]["idle"] == 6


def test_investments_show_each_house_and_the_index_move():
    s = play_spring(moves=[ExchangeVisit((ShareOrder(House.INDEX, 3), ShareOrder(House.DEEPCORAL, 2)))])
    inv = report.season_report(s, 0)["investments"]
    assert {r["house"] for r in inv["rows"]} == {"tide_index", "deepcoral"}
    assert inv["index_change"] is not None
    topics = report.season_report(s, 0)["topics"]
    assert "lottery" in topics and len(topics) <= config.REPORT_MIRROR_TOPICS


def test_every_mark_and_topic_has_words():
    words, mirror = bridge.content("report"), bridge.content("mirror")
    keys = set(words["marks"])
    for grade in "ABCD":
        assert f"pace.{grade}" in keys and f"tides.{grade}" in keys
    for key in ("food.hungry", "food.card", "food.dark_short", "food.stocked", "food.bought", "safety.scam",
                "safety.lost", "safety.no_vault", "safety.vault_locked", "safety.idle", "safety.kept",
                "safety.fair", "debt.reef", "debt.missed", "debt.card", "debt.loan", "debt.interest_free", "debt.none"):
        assert key in keys
    import inspect
    source = inspect.getsource(report._topics)
    for topic in mirror["topics"]:
        assert f'"{topic}"' in source
    assert set(mirror["rooms"]) == {"bank", "market", "harbor", "guild_hall", "drowned_bell", "black_reef", "circle", "council"}


def drive(st, kind, **fields):
    action = Action(action_id=uuid4().hex, expected_version=st.version, kind=kind, **fields)
    return bridge.apply_action(st, action).state


def test_the_bridge_keeps_the_season_and_files_its_report():
    st = bridge.new_game("tidewalker", 5).state
    st = drive(st, "work")
    assert len(st.details["bridge"]["season_book"]["log"]) > 0
    with pytest.raises(LookupError):
        bridge.season_report(st, "Spring")
    st = drive(st, "end_season")
    r = bridge.season_report(st, "Spring")
    assert r["next_season"] == "Summer" and len(r["marks"]) == 5
    assert r["pace"]["passage_next"] * 100 == st.details["view"]["passage_price"]  # Summer's price, not Spring's
    assert all(m["text"] and "{" not in m["text"] for m in r["marks"])
    assert all(d["season"] > 0 for d in st.details["bridge"]["season_book"]["log"])  # Spring's pages dropped
    assert r["chelo"] and "{" not in r["chelo"]
    st = drive(st, "work")
    assert bridge.season_report(st, "Spring") == r  # stays put as the year goes on


def test_report_endpoints(make):  # noqa: F811
    client, _, _ = make()
    run = start(client, "newcomer")
    rid = run["run_id"]
    assert client.get(f"/api/runs/{rid}/report?season=Spring").status_code == 404
    ok(client, run, "end_season")
    body = client.get(f"/api/runs/{rid}/report?season=Spring").json()
    assert "facts" not in body and body["mirror"] and body["marks"]
    assert "scenario" not in json.dumps(body) and "voyage_outcome" not in json.dumps(body)
    note = client.get(f"/api/runs/{rid}/report/note?season=Spring").json()
    assert note == {"text": body["chelo"], "source": "template"}


# --- Chelo's note ---------------------------------------------------------------------------------

FACTS = {"wages": 300, "lost": 200, "kelp": 12}


def test_the_note_check_keeps_honest_plain_text():
    good = ("You worked hard and 300◈ in wages is the most you've held. Then 200◈ went to Deepcoral and sank, "
            "so a good part of that work now sits at the bottom of the harbor. How much of your next pay is spoken for?")
    assert ai.check(good, FACTS) == good


@pytest.mark.parametrize("bad", [
    "Your journey through the season was a testament to grit, and 300◈ in wages shows real effort from you this time.",
    "You earned 300◈ — and lost 200◈ to Deepcoral, which sank with the tide and took most of your work along with it.",
    "Great season! You earned 300◈ in wages and only lost 200◈ to Deepcoral, which is a fine result for anyone here.",
    "You earned 450◈ in wages this season and then lost 200◈ to Deepcoral, which sank and took your work down with it.",
    "Short.",
])
def test_the_note_check_rejects_slop_and_invented_numbers(bad):
    assert ai.check(bad, FACTS) is None


def sample_report():
    st = bridge.new_game("caretaker", 2).state
    st = drive(st, "end_season")
    return bridge.season_report(st, "Spring")


def test_note_uses_the_model_when_it_follows_the_rules(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    r = sample_report()
    worth = r["facts"]["pace"]["net_worth_end"]
    text = (f"You let every tide slip by, and the season ended with you worth {worth}◈. The circle's coin is a loan, "
            "not a gift, and it comes due whether you work or not. What did the quiet cost you?")
    replies = iter([{"choices": [{"message": {"content": text}}]}])
    client = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, json=next(replies))))
    assert ai.note(r, client=client) == {"text": text, "source": "openai"}


def test_note_falls_back_when_the_model_misbehaves_or_fails(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    r = sample_report()
    slop = {"choices": [{"message": {"content": "What a journey! Keep up the great work, adventurer!"}}]}
    client = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, json=slop)))
    assert ai.note(r, client=client)["source"] == "template"
    broke = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(429, json={})))
    assert ai.note(r, client=broke) == {"text": r["chelo"], "source": "template"}
