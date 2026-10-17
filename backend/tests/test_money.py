import pytest
from helpers import game

from app import config
from app.engine import money
from app.engine.actions import ActionError, EndSeason
from app.engine.game import step
from app.engine.state import BillKind, ClassId, LoanKind


def clear_bills(s):
    if s.bills:
        s.purse += sum(b.amount for b in s.bills)
        money.pay_bill(s)


# --- Vault ----------------------------------------------------------------------------------------


def test_deposit_and_withdraw(quiet):
    s = game(ClassId.CARETAKER)
    money.deposit(s, 300)
    assert (s.purse, s.vault) == (1100 - 300, 300)
    money.withdraw(s, 100)
    assert (s.purse, s.vault) == (900, 200)
    with pytest.raises(ActionError):
        money.withdraw(s, 201)


def test_tidewalker_needs_standing_550_for_a_vault(quiet):
    s = game(ClassId.TIDEWALKER)
    with pytest.raises(ActionError) as err:
        money.open_vault(s)
    assert err.value.code == "standing_too_low"
    s.standing = 550
    money.open_vault(s)
    assert s.vault == 0


# --- Leviathan Credit -----------------------------------------------------------------------------


def test_newcomer_secured_card_locks_200(quiet):
    s = game(ClassId.NEWCOMER)
    assert s.card is None and s.standing is None
    money.open_secured_card(s)
    assert (s.purse, s.vault, s.vault_locked) == (300, 200, 200)
    assert s.standing == 500 and s.card.secured
    assert money.card_limit(s) == 200
    with pytest.raises(ActionError):
        money.withdraw(s, 1)


def test_closing_a_secured_card_returns_the_collateral(quiet):
    s = game(ClassId.NEWCOMER)
    money.open_secured_card(s)
    money.close_card(s)
    assert s.vault_locked == 0 and money.vault_free(s) == 200


@pytest.mark.parametrize("standing,limit", [(449, 200), (549, 200), (550, 400), (649, 400), (650, 800)])
def test_card_limit_follows_standing(quiet, standing, limit):
    s = game(ClassId.CARETAKER)
    s.standing = standing
    assert money.card_limit(s) == limit


def test_card_freezes_below_450(quiet):
    s = game(ClassId.CARETAKER)
    s.standing = 449
    assert money.card_frozen(s)
    assert money.charge_card(s, 10, "x") == 0


def test_purchases_over_the_limit_are_declined(quiet):
    s = game(ClassId.TIDEWALKER)  # 540 -> 200 limit
    assert money.charge_card(s, 250, "x") == 200
    assert s.card.balance == 200
    assert money.charge_card(s, 1, "x") == 0


def test_cover_cost_uses_purse_then_vault_then_card(quiet):
    s = game(ClassId.CARETAKER)
    s.purse, s.vault = 50, 100
    unpaid = money.cover_cost(s, 600, "x", use_vault=True)
    assert (s.purse, s.vault, s.card.balance) == (0, 0, 400)  # limit 400 at Standing 620
    assert unpaid == 50


def test_missed_minimum_costs_fee_interest_and_standing(quiet):
    s = game(ClassId.FIRST_OF_LINE)  # Standing 580, limit 400
    clear_bills(s)
    s.card.balance, s.card.min_due = 100, 10
    report = money.settle_season(s)
    assert report["missed_minimum"]
    assert s.card.balance == 129  # 100 + 20 fee, then 7.5% interest (9)
    assert s.card.min_due == 13
    # -60 missed minimum, credit used 129/400 = 32% (no change), +10 history
    assert s.standing == 580 - 60 + 10


def test_clean_season_gains_thirty(quiet):
    s = game(ClassId.CARETAKER)
    clear_bills(s)
    money.settle_season(s)
    assert s.standing == 620 + 15 + 5 + 10
    assert s.standing_factors == {"payments": 15, "credit_used": 5, "history": 10}


def test_bills_and_the_circle_autopay_from_the_purse(quiet):
    s = game(ClassId.CARETAKER)
    money.autopay_bills(s)
    assert s.bills == [] and s.purse == 1100 - 40 - 60 - 100
    assert s.loans[LoanKind.CIRCLE].balance == 300


def test_autopay_pays_what_the_purse_can_cover_oldest_first(quiet):
    s = game(ClassId.CARETAKER)
    s.purse = 120  # tithe 40 then care 60; the circle's 100 doesn't fit
    money.autopay_bills(s)
    assert s.bills == [] and s.purse == 20
    assert s.loans[LoanKind.CIRCLE].balance == 400


def test_bill_autopay_cannot_cover_is_late_with_a_fee(quiet):
    s = game(ClassId.TIDEWALKER)
    s.purse = 0
    money.autopay_bills(s)
    money.settle_season(s)
    assert s.standing == 540 - 40 + 5 + 10
    assert [(b.late, b.amount) for b in s.bills] == [(True, 40 + config.LATE_FEE)]


def test_season_end_autopays_before_the_household_eats(quiet):
    s = game(ClassId.TIDEWALKER)
    step(s, EndSeason())
    assert not any(b.late for b in s.bills)
    assert s.standing_factors["payments"] == config.STANDING_CLEAN_SEASON


def test_high_utilization_hurts(quiet):
    s = game(ClassId.CARETAKER)
    clear_bills(s)
    s.card.balance = 250  # 62% of 400
    money.settle_season(s)
    assert s.standing_factors["credit_used"] == -20


def test_paying_only_the_minimum_builds_a_streak(quiet):
    s = game(ClassId.CARETAKER)
    s.card.balance, s.card.min_due = 300, 30
    for expected in (1, 2):
        clear_bills(s)
        s.purse += s.card.min_due
        money.pay_card(s, s.card.min_due)
        money.settle_season(s)
        assert s.flags.min_only_streak == expected
    clear_bills(s)
    s.purse += s.card.balance
    money.pay_card(s, s.card.balance)
    money.settle_season(s)
    assert s.flags.min_only_streak == 0


def test_vault_earns_interest(quiet):
    s = game(ClassId.CARETAKER)
    clear_bills(s)
    money.deposit(s, 500)
    assert money.settle_season(s)["vault_interest"] == 10
    assert s.vault == 510


# --- Bills ----------------------------------------------------------------------------------------


def test_caretaker_starts_with_two_bills_and_owes_the_circle(quiet):
    s = game(ClassId.CARETAKER)
    assert sorted(b.kind for b in s.bills) == sorted([BillKind.TITHE, BillKind.CARE])
    assert s.loans[LoanKind.CIRCLE].balance == 400
    assert money.total_debt(s) == 40 + 60 + 400


def test_pay_one_bill_or_all(quiet):
    s = game(ClassId.CARETAKER)
    tithe = next(b for b in s.bills if b.kind == BillKind.TITHE)
    money.pay_bill(s, tithe.id)
    assert len(s.bills) == 1
    money.pay_bill(s)
    assert s.bills == [] and s.purse == 1100 - 40 - 60


def test_cannot_pay_bills_without_the_coin(quiet):
    s = game(ClassId.CARETAKER)
    s.purse = 10
    with pytest.raises(ActionError):
        money.pay_bill(s)


# --- The lending circle ---------------------------------------------------------------------------


def test_circle_payment_the_purse_cannot_cover_is_missed(quiet):
    s = game(ClassId.CARETAKER)
    s.purse = 0
    money.autopay_bills(s)
    money.settle_season(s)
    assert s.flags.circle_missed
    # only the late tithe costs Standing; the circle itself doesn't
    assert s.standing_factors["payments"] == config.STANDING_LATE_TITHE


def test_circle_is_repaid_a_hundred_a_season(quiet):
    s = game(ClassId.CARETAKER)
    balances = []
    for season in range(3):
        s.season = season
        s.purse = 1000
        money.autopay_bills(s)
        money.check_circle(s)
        balances.append(s.loans[LoanKind.CIRCLE].balance)
    assert balances == [300, 200, 100] and not s.flags.circle_missed


def test_paying_the_circle_ahead_lowers_later_dues(quiet):
    s = game(ClassId.CARETAKER)
    money.pay_loan(s, LoanKind.CIRCLE, 250)
    assert money.circle_due(s) == 0
    s.season = 1
    assert money.circle_due(s) == 0
    s.season = 2
    assert money.circle_due(s) == 50


def test_no_passage_while_owing_the_circle(quiet):
    s = game(ClassId.CARETAKER)
    s.purse = 5000
    money.pay_bill(s)
    with pytest.raises(ActionError) as err:
        money.buy_passage(s)
    assert err.value.code == "debts_outstanding"
    money.pay_loan(s, LoanKind.CIRCLE, 400)
    money.buy_passage(s)
    assert s.passage_paid == 1200 and LoanKind.CIRCLE not in s.loans


# --- Loans ----------------------------------------------------------------------------------------


def test_guild_loan_accrues_one_percent(quiet):
    s = game(ClassId.FIRST_OF_LINE)
    clear_bills(s)
    money.settle_season(s)
    assert s.loans[LoanKind.GUILD].balance == 505


def test_black_reef_caps_at_300_and_charges_half_a_season(quiet):
    s = game(ClassId.TIDEWALKER)
    money.black_reef_advance(s, 300)
    assert s.purse == 800
    with pytest.raises(ActionError):
        money.black_reef_advance(s, 1)
    money.settle_season(s)
    assert s.loans[LoanKind.BLACK_REEF].balance == 450


def test_paying_off_a_loan_removes_it(quiet):
    s = game(ClassId.FIRST_OF_LINE)
    s.purse = 1000
    money.pay_loan(s, LoanKind.GUILD, 5000)
    assert LoanKind.GUILD not in s.loans and s.purse == 500


def test_bank_loan_is_off_until_ahead(quiet):
    s = game(ClassId.CARETAKER)
    with pytest.raises(ActionError) as err:
        money.take_bank_loan(s, 500)
    assert err.value.code == "unavailable"


def test_bank_loan_needs_standing_and_schedules_payments(quiet, features):
    features("bank_loan")
    s = game(ClassId.CARETAKER)
    money.take_bank_loan(s, 1000)
    loan = s.loans[LoanKind.BANK]
    assert loan.payment_due == money.amortized_payment(1000, 0.03, 4) == 270
    weak = game(ClassId.TIDEWALKER)
    with pytest.raises(ActionError):
        money.take_bank_loan(weak, 100)


def test_missed_bank_payment_costs_sixty_standing(quiet, features):
    features("bank_loan")
    s = game(ClassId.CARETAKER)
    clear_bills(s)
    money.take_bank_loan(s, 1000)
    report = money.settle_season(s)
    assert report["missed_loan_payment"]
    assert s.standing_factors["payments"] == -60


# --- Passage --------------------------------------------------------------------------------------


def test_passage_requires_no_debt(quiet):
    s = game(ClassId.NEWCOMER)
    s.purse = 10_000
    with pytest.raises(ActionError) as err:
        money.buy_passage(s)
    assert err.value.code == "debts_outstanding"
    money.pay_bill(s)
    money.buy_passage(s)
    assert s.passage_paid == 1200 and s.purse == 10_000 - 40 - 1200


def test_passage_price_rises_with_the_debasement(quiet):
    s = game(ClassId.NEWCOMER)
    s.debasement_season = 1
    assert [money.passage_price(s, i) for i in range(4)] == [1200, 1478, 1581, 1690]


def test_passage_needs_the_coin(quiet):
    s = game(ClassId.NEWCOMER)
    money.pay_bill(s)
    with pytest.raises(ActionError) as err:
        money.buy_passage(s)
    assert err.value.code == "insufficient_funds"


def test_amounts_must_be_positive_whole_numbers(quiet):
    s = game(ClassId.CARETAKER)
    for bad in (0, -5, 2.5):
        with pytest.raises(ActionError):
            money.deposit(s, bad)
