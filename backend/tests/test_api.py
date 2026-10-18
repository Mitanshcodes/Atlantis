"""The P1 engine through P2's API and Nessie sync, against an in-memory Nessie (POST, GET, PUT)."""

import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.engine import bridge
from app.main import create_app
from app.nessie.client import NessieClient
from app.nessie.test_integration import Remote
from app.settings import Settings


class FullRemote(Remote):
    """P2's mock Nessie plus PUT updates, and a log of every request method."""

    def __init__(self):
        super().__init__()
        self.methods = []

    def handle(self, request):
        self.methods.append(request.method)
        if request.method == "PUT":
            path = request.url.path
            if path not in self.records:
                return httpx.Response(404)
            self.records[path].update(json.loads(request.content))
            return httpx.Response(202, json={"code": 202, "message": "Accepted update"})
        return super().handle(request)


@pytest.fixture
def make(tmp_path, monkeypatch):
    def build(loans=True, bills=False):
        monkeypatch.setenv("NESSIE_LOANS_VERIFIED", "true" if loans else "false")
        monkeypatch.setenv("NESSIE_BILLS_VERIFIED", "true" if bills else "false")
        settings = Settings(db=str(tmp_path / f"{uuid4().hex}.sqlite3"), live=True, api_key="test-key",
                            loans_verified=loans, bills_verified=bills)
        remote = FullRemote()
        client = NessieClient(settings, httpx.MockTransport(remote.handle))
        app = create_app(settings, client=client, engine_adapter=bridge, background=False)
        return TestClient(app), app, remote

    return build


def start(client, class_id="first_of_their_line", seed=7):
    response = client.post("/api/runs", json={"class_id": class_id, "seed": seed})
    assert response.status_code == 201, response.text
    return response.json()


def act(client, run, kind, **fields):
    response = client.post(f"/api/runs/{run['run_id']}/actions", json={
        "action_id": uuid4().hex, "expected_version": run["state"]["version"], "kind": kind, **fields})
    return response


def ok(client, run, kind, **fields):
    response = act(client, run, kind, **fields)
    assert response.status_code == 200, (kind, response.text)
    return response.json()


def drain(app, run_id, ticks=3000):
    for _ in range(ticks):
        app.state.sync.tick()
        entries = app.state.store.ledger(run_id)
        if all(e["status"] == "confirmed" for e in entries):
            return entries
    return app.state.store.ledger(run_id)


def assert_settled(client, app, run):
    entries = drain(app, run["run_id"])
    stuck = [(e["id"], e["status"], e["error"]) for e in entries if e["status"] != "confirmed"]
    assert not stuck, stuck
    ledger = client.get(f"/api/runs/{run['run_id']}/ledger").json()
    for name, evidence in ledger["balances"].items():
        assert evidence["matches"] is True, (name, evidence)
    return entries


# --- Creating runs --------------------------------------------------------------------------------


@pytest.mark.parametrize("class_id,purse,vault,debt", [
    ("newcomer", 50000, None, 4000),
    ("first_of_their_line", 80000, 0, 54000),
    ("caretaker", 110000, 0, 50000),
    ("tidewalker", 50000, None, 4000),
])
def test_each_class_starts_on_the_real_engine(make, class_id, purse, vault, debt):
    client, app, _ = make()
    run = start(client, class_id)
    state = run["state"]
    assert state["development"] is False
    assert (state["purse"], state["vault"], state["debt"]) == (purse, vault, debt)
    assert state["season"] == "Spring" and state["tides"] == 6
    assert "work" in state["available_actions"]
    assert_settled(client, app, run)


def test_engine_secrets_never_reach_the_browser(make):
    client, _, _ = make()
    run = start(client)
    for body in (run, client.get(f"/api/runs/{run['run_id']}").json(), ok(client, run, "work")):
        assert set(body["state"]["details"]) == {"view", "moments", "engine_owns_obligations"}
        text = json.dumps(body)
        assert "scenario" not in text and "debasement_season" not in text and "voyage_outcome" not in text


# --- Playing --------------------------------------------------------------------------------------


def test_work_save_trade_and_repay_reach_nessie(make):
    client, app, remote = make()
    run = start(client)
    run = ok(client, run, "work")
    assert run["state"]["purse"] == 85000
    run = ok(client, run, "save", amount=10000)
    run = ok(client, run, "market_visit", orders=[{"side": "buy", "target": "kelp", "quantity": 10}])
    assert run["state"]["kelp"] == 10
    assert run["state"]["tides"] == 5  # the first Market visit each season is free
    run = ok(client, run, "exchange_visit", orders=[{"side": "buy", "target": "oro", "quantity": 2}])
    run = ok(client, run, "repay_guild", amount=10000)
    entries = assert_settled(client, app, run)
    kinds = [e["body"]["kind"] for e in entries]
    assert {"deposit", "withdrawal", "purchase", "loan", "loan_update"} <= set(kinds)
    assert {"POST", "GET", "PUT"} <= set(remote.methods)


def test_a_full_year_settles_on_nessie(make):
    client, app, remote = make()
    run = start(client, "newcomer", seed=11)
    while run["state"]["tides"] > 0 or "end_year" not in run["state"]["available_actions"]:
        if "end_year" in run["state"]["available_actions"]:
            break
        run = ok(client, run, "work")
    run = ok(client, run, "end_year")
    assert run["state"]["available_actions"] == []
    assert run["state"]["details"]["view"]["ending"] is not None
    assert_settled(client, app, run)
    chronicle = client.get(f"/api/runs/{run['run_id']}/chronicle?season=Spring").json()
    assert "Worked a shift" in chronicle["text"]


def test_illegal_actions_are_rejected_without_changing_anything(make):
    client, _, _ = make()
    run = start(client)
    response = act(client, run, "withdraw", amount=999900)
    assert response.status_code == 422
    assert client.get(f"/api/runs/{run['run_id']}").json()["state"]["version"] == 0
    assert act(client, run, "save", amount=150).status_code == 422  # fractions of a coin
    assert act(client, run, "fly_to_surface").status_code == 422


def test_caretaker_owes_the_circle_before_passage(make):
    client, app, _ = make()
    run = start(client, "caretaker")
    assert "pay_circle" in run["state"]["available_actions"]
    response = act(client, run, "buy_passage")
    assert response.status_code == 422
    run = ok(client, run, "pay_circle", amount=10000)
    assert run["state"]["details"]["view"]["loans"]["circle_loan"]["balance"] == 30000
    assert_settled(client, app, run)


def test_black_reef_advance_creates_a_loan_and_a_deposit(make):
    client, app, _ = make()
    run = start(client, "tidewalker")
    run = ok(client, run, "borrow_black_reef", amount=20000)
    assert run["state"]["purse"] == 70000
    entries = assert_settled(client, app, run)
    reasons = [(e["body"]["kind"], e["body"]["reason"]) for e in entries]
    assert ("deposit", "Black Reef cash advance") in reasons
    assert any(kind == "loan" and "Black Reef" in reason for kind, reason in reasons)


def test_obligations_are_skipped_until_verified_so_the_queue_never_stalls(make):
    client, app, _ = make(loans=False, bills=False)
    run = start(client)
    run = ok(client, run, "repay_guild", amount=10000)
    entries = assert_settled(client, app, run)
    assert not [e for e in entries if e["body"]["kind"] in ("loan", "loan_update", "bill", "bill_update")]


def test_verified_bills_are_created_updated_and_paid(make):
    client, app, remote = make(loans=True, bills=True)
    run = start(client)
    run = ok(client, run, "pay_tithe", amount=4000)
    entries = assert_settled(client, app, run)
    kinds = [e["body"]["kind"] for e in entries]
    assert "bill" in kinds and "bill_update" in kinds
    assert "PUT" in remote.methods


def test_moments_and_news_survive_for_the_ui(make):
    client, _, _ = make()
    run = start(client)
    run = ok(client, run, "end_season")
    moments = run["state"]["details"]["moments"]
    assert {"kind": "season_end", "season": "Spring"}.items() <= next(m for m in moments if m["kind"] == "season_end").items()
    assert run["state"]["season"] == "Summer"
    reloaded = client.get(f"/api/runs/{run['run_id']}").json()
    assert reloaded["events"] and any("Summer began" in line for line in reloaded["events"])


def test_moments_name_events_and_scrolls_by_plain_value():
    from app.engine.state import EventKind, LogEvent, ScrollId

    moments = bridge.moments_of([
        LogEvent(0, 1, "event", {"event": EventKind.PICKPOCKET, "amount": 10}),
        LogEvent(0, 1, "scroll", {"scroll": ScrollId.RAINY_DAY}),
    ])
    assert [m.get("event") or m.get("scroll") for m in moments] == ["pickpocket", "rainy_day"]
