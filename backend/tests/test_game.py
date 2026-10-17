import random
from dataclasses import asdict

import pytest
from helpers import advance_to, game, kinds, settle_debts

from app import config
from app.engine import money
from app.engine.actions import (
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
    InvestPearlExchange,
    MarketTrip,
    OpenSecuredCard,
    OpenVault,
    Order,
    PayBill,
    PayCard,
    PayLoan,
    Rest,
    SellBusiness,
    ShareOrder,
    TakeBankLoan,
    Visit,
    Withdraw,
    Work,
)
from app.engine.game import apply, new_game, step, visit_is_free
from app.engine.state import (
    LONG_DARK,
    Account,
    BusinessKind,
    ClassId,
    Good,
    House,
    LoanKind,
    NessieOp,
    Phase,
    Place,
)

# --- Setup ----------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "player_class,purse,vault,standing,card,loans",
    [
        (ClassId.NEWCOMER, 500, None, None, False, {}),
        (ClassId.FIRST_OF_LINE, 800, 0, 580, True, {LoanKind.GUILD: 500}),
        (ClassId.CARETAKER, 1100, 0, 620, True, {LoanKind.CIRCLE: 400}),  # 700 + the circle's pot
        (ClassId.TIDEWALKER, 500, None, 540, True, {}),
    ],
)
def test_each_class_starts_from_a_different_place(quiet, player_class, purse, vault, standing, card, loans):
    s = game(player_class)
    assert (s.purse, s.vault, s.standing, s.card is not None) == (purse, vault, standing, card)
    assert {k: l.balance for k, l in s.loans.items()} == loans
    assert (s.season, s.tide, s.tides_total, s.phase) == (0, 0, 6, Phase.PLAYING)


def test_wages_by_class(quiet):
    s = game(ClassId.FIRST_OF_LINE)
    step(s, Work())
    assert s.purse == 850
    advance_to(s, 2)
    before = s.purse
    step(s, Work())
    assert s.purse - before == 70  # 50 + 10 per season


def test_tidewalker_pay_is_irregular(quiet):
    pays = set()
    for seed in range(20):
        s = game(ClassId.TIDEWALKER, seed)
        step(s, Work())
        pays.add(s.purse - 500)
    assert len(pays) > 5 and all(0 <= p <= 120 for p in pays)


# --- Time -----------------------------------------------------------------------------------------


def test_six_tides_then_the_season_turns(quiet):
    s = game()
    for _ in range(6):
        step(s, Work())
    assert (s.season, s.tide) == (1, 0)
    assert "season_end" in kinds(s.log)


def test_free_actions_do_not_spend_tides(quiet):
    s = game(ClassId.CARETAKER)
    step(s, Deposit(100))
    step(s, PayBill())
    step(s, Visit(Place.DROWNED_BELL))
    assert s.tide == 0


def test_caretaker_loses_two_tides_to_care(quiet):
    s = game(ClassId.CARETAKER)
    advance_to(s, 1)
    assert s.tides_total == 4
    advance_to(s, 2)
    assert s.tides_total == 6
    advance_to(s, LONG_DARK)
    assert s.tides_total == 4


def test_a_hungry_season_costs_two_tides(quiet):
    s = game(ClassId.NEWCOMER)
    s.purse = 0
    step(s, EndSeason())
    assert s.tides_total == 4 and "kelp_eaten" in kinds(s.log)


def test_long_dark_hunger_hits_at_once_and_stacks(quiet):
    s = game(ClassId.NEWCOMER)
    advance_to(s, 2)
    s.purse = 0
    step(s, EndSeason())
    assert s.season == LONG_DARK and s.tides_total == 2


def test_long_dark_posts_kelp_at_open_and_lands_no_voyages(quiet):
    s = game(ClassId.CARETAKER)
    advance_to(s, LONG_DARK)
    eaten = [e for e in s.log if e.kind == "kelp_eaten" and e.season == LONG_DARK]
    assert len(eaten) == 1 and eaten[0].tide == 0
    records = {h: len(hm.record) for h, hm in s.houses.items()}
    settle_debts(s)
    step(s, EndSeason())
    assert s.phase == Phase.FINAL_CALL
    assert {h: len(hm.record) for h, hm in s.houses.items()} == records
    assert not any(e.kind == "season_end" and e.season == LONG_DARK for e in s.log)


def test_final_call_allows_only_free_actions(quiet):
    s = game(ClassId.CARETAKER)
    advance_to(s, LONG_DARK)
    step(s, EndSeason())
    with pytest.raises(ActionError) as err:
        step(s, Work())
    assert err.value.code == "no_tides"
    step(s, PayBill())
    step(s, EndYear())
    assert s.phase == Phase.ENDED
    with pytest.raises(ActionError) as err:
        step(s, PayBill())
    assert err.value.code == "game_over"


def test_end_year_waits_for_the_last_ship(quiet):
    with pytest.raises(ActionError) as err:
        step(game(), EndYear())
    assert err.value.code == "too_early"


def test_unknown_actions_are_rejected(quiet):
    with pytest.raises(ActionError):
        step(game(), object())


# --- Purity and determinism -----------------------------------------------------------------------


def test_apply_leaves_the_input_untouched(quiet):
    s = game(ClassId.CARETAKER)
    before = s.clone()
    result = apply(s, MarketTrip((Order(Good.KELP, 10),)))
    assert s == before
    assert result.state.stores[Good.KELP].qty == 10
    assert "trade" in kinds(result.events)
    assert [e.op for e in result.ledger][0] == NessieOp.PURCHASE


def test_failed_apply_leaves_the_input_untouched(quiet):
    s = game()
    before = s.clone()
    with pytest.raises(ActionError):
        apply(s, MarketTrip((Order(Good.PEARLS, 1), Order(Good.KELP, 999))))
    assert s == before


def test_same_seed_same_actions_same_year():
    a, b = play_randomly(ClassId.TIDEWALKER, 7), play_randomly(ClassId.TIDEWALKER, 7)
    assert asdict(a) == asdict(b)


def test_different_seeds_differ():
    assert asdict(play_randomly(ClassId.NEWCOMER, 1)) != asdict(play_randomly(ClassId.NEWCOMER, 2))


# --- Ledger ---------------------------------------------------------------------------------------


def replay_ledger(s):
    """Rebuild Purse, Vault and card balance from the ledger alone."""
    spec = config.CLASSES[s.player_class]
    purse, vault, card = spec.start_purse, 0, 0
    for e in s.ledger:
        if e.pending:
            continue
        if e.to_account is not None:
            purse += e.amount * ((e.to_account == Account.PURSE) - (e.account == Account.PURSE))
            vault += e.amount * ((e.to_account == Account.VAULT) - (e.account == Account.VAULT))
            card -= e.amount * (e.to_account == Account.CARD)
        elif e.account == Account.PURSE:
            purse += e.amount if e.op == NessieOp.DEPOSIT else -e.amount
        elif e.account == Account.VAULT:
            vault += e.amount
        elif e.account == Account.CARD:
            card += e.amount
    return purse, vault, card


def check_invariants(s):
    assert s.purse >= 0
    assert s.vault is None or s.vault >= s.vault_locked >= 0
    assert s.standing is None or config.STANDING_MIN <= s.standing <= config.STANDING_MAX
    assert s.card is None or s.card.balance >= 0
    assert all(l.balance > 0 for l in s.loans.values())
    assert all(h.qty >= 0 and h.cost >= 0 for h in [*s.stores.values(), *s.shares.values()])
    if Good.KELP in s.stores:
        assert s.stores[Good.KELP].qty <= config.CELLAR_CAPACITY
    assert 0 <= s.tide <= s.tides_total
    assert all(e.seq == i for i, e in enumerate(s.ledger))


# --- Fuzz: a random player must never break the engine --------------------------------------------


def random_action(s, r):
    goods = list(s.goods)
    houses = list(s.shares)
    amount = r.choice([1, 10, 50, 100, 300, 1000])
    pick = r.random()
    if s.phase == Phase.FINAL_CALL and pick < 0.25:
        return EndYear()
    return r.choice(
        [
            Work(),
            Work(),
            Rest(),
            MarketTrip((Order(r.choice(goods), r.randint(-30, 40)),)),
            ExchangeVisit((ShareOrder(r.choice(houses), r.randint(-10, 15)),)),
            Deposit(amount),
            Withdraw(amount),
            PayCard(amount),
            PayBill(),
            PayLoan(r.choice(list(LoanKind)), amount),
            BlackReefAdvance(r.choice([50, 100, 300])),
            DisputeCharge(),
            InvestPearlExchange(amount),
            Visit(r.choice(list(Place))),
            OpenVault(),
            OpenSecuredCard(),
            CloseCard(),
            BuyPassage(),
            TakeBankLoan(r.choice([200, 1000])),
            BuyBusiness(r.choice(list(BusinessKind))),
            SellBusiness(),
            EndSeason() if pick < 0.05 else Work(),
        ]
    )


def play_randomly(player_class, seed, check=False):
    s = new_game(player_class, seed)
    r = random.Random(seed)
    for _ in range(3000):
        if s.phase == Phase.ENDED:
            break
        try:
            step(s, random_action(s, r))
        except ActionError:
            continue
        if check:
            check_invariants(s)
    return s


@pytest.mark.parametrize("player_class", list(ClassId))
def test_random_players_never_break_the_engine(player_class):
    for seed in range(40):
        s = play_randomly(player_class, seed, check=True)
        assert s.phase == Phase.ENDED and s.ending is not None
        assert replay_ledger(s) == (s.purse, s.vault or 0, s.card.balance if s.card else 0)


@pytest.mark.parametrize("player_class", list(ClassId))
def test_random_players_with_every_feature_on(features, player_class):
    features("silk", "businesses", "bank_loan")
    for seed in range(25):
        s = play_randomly(player_class, seed, check=True)
        assert s.phase == Phase.ENDED
        assert replay_ledger(s) == (s.purse, s.vault or 0, s.card.balance if s.card else 0)


# --- Passage --------------------------------------------------------------------------------------


def test_passage_can_be_bought_early_and_play_continues(quiet):
    s = game(ClassId.CARETAKER)
    s.purse = 5000
    step(s, PayBill())
    step(s, PayLoan(LoanKind.CIRCLE, 400))
    step(s, BuyPassage())
    step(s, Work())
    assert s.passage_paid == 1200 and s.phase == Phase.PLAYING


def test_the_harbor_takes_vault_coin_at_the_final_check(quiet):
    s = game(ClassId.CARETAKER)
    advance_to(s, LONG_DARK)
    step(s, EndSeason())
    settle_debts(s)
    s.vault = money.passage_price(s) + 2000
    s.purse = 0
    step(s, EndYear())
    assert s.passage_paid == money.passage_price(s)
    assert s.ending.value == "escaped_with_wealth"


def test_newcomer_who_only_works_misses_the_ship(quiet):
    s = game(ClassId.NEWCOMER)
    while s.phase == Phase.PLAYING:
        step(s, Work())
        if s.bills:
            step(s, PayBill())
    step(s, EndYear())
    assert s.ending.value == "missed_the_ship"
    assert s.miss_cause.value == "no_savings"


def test_exchange_visit_counts_as_harbor_visit(quiet):
    s = game(ClassId.CARETAKER)
    step(s, ExchangeVisit((ShareOrder(House.ORO, 1),)))
    assert Place.HARBOR in s.flags.visited


# --- Free visits ----------------------------------------------------------------------------------


def test_first_market_and_exchange_visits_each_season_are_free(quiet):
    s = game(ClassId.CARETAKER)
    assert visit_is_free(s, Place.MARKET) and visit_is_free(s, Place.HARBOR)
    step(s, MarketTrip((Order(Good.KELP, 5),)))
    step(s, ExchangeVisit((ShareOrder(House.ORO, 1),)))
    assert s.tide == 0
    assert not visit_is_free(s, Place.MARKET) and not visit_is_free(s, Place.HARBOR)
    step(s, MarketTrip((Order(Good.KELP, 5),)))
    step(s, ExchangeVisit((ShareOrder(House.ORO, 1),)))
    assert s.tide == 2


def test_free_visits_come_back_each_season(quiet):
    s = game(ClassId.CARETAKER)
    step(s, MarketTrip((Order(Good.KELP, 5),)))
    step(s, EndSeason())
    assert visit_is_free(s, Place.MARKET)
    step(s, MarketTrip((Order(Good.KELP, 5),)))
    assert s.tide == 0


def test_a_failed_visit_does_not_use_up_the_free_one(quiet):
    s = game(ClassId.CARETAKER)
    with pytest.raises(ActionError):
        apply(s, MarketTrip((Order(Good.KELP, 999),)))
    assert visit_is_free(s, Place.MARKET)


def test_work_still_costs_a_tide(quiet):
    s = game(ClassId.CARETAKER)
    step(s, Work())
    assert s.tide == 1


def test_no_free_visits_after_the_last_tide(quiet):
    s = game(ClassId.CARETAKER)
    advance_to(s, LONG_DARK)
    step(s, EndSeason())
    with pytest.raises(ActionError) as err:
        step(s, MarketTrip((Order(Good.KELP, 1),)))
    assert err.value.code == "no_tides"
