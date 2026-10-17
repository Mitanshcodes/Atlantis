"""Money rules: Purse, Vault, Leviathan Credit, Standing, bills, loans, the Black Reef and Passage.

Every coin movement goes through ``post`` so it lands in ``state.ledger`` for Nessie. Functions
here mutate the state they're given; ``game.apply`` hands them a private copy.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

from app import config
from app.engine.actions import ActionError
from app.engine.state import (
    LOAN_ACCOUNTS,
    LONG_DARK,
    SEASONS,
    Account,
    Bill,
    BillKind,
    Card,
    GameState,
    LedgerEntry,
    Loan,
    LoanKind,
    NessieOp,
    Place,
)

BILL_MEMOS = {
    BillKind.TITHE: "Tithe to the Council",
    BillKind.CARE: "Care bill",
    BillKind.REPAIR: "Roof repair",
}


def coin(x: float) -> int:
    """Round to whole coin, halves up (Python's ``round`` rounds halves to even)."""
    return int(math.floor(x + 0.5))


def class_spec(s: GameState) -> config.ClassSpec:
    return config.CLASSES[s.player_class]


def require(condition: bool, code: str, message: str) -> None:
    if not condition:
        raise ActionError(code, message)


def require_positive(amount: int) -> None:
    require(isinstance(amount, int) and amount > 0, "invalid_amount", "Amount must be a positive whole number.")


# --- Ledger and the Purse -------------------------------------------------------------------------


def post(
    s: GameState,
    op: NessieOp,
    account: Account,
    amount: int,
    memo: str,
    *,
    to: Optional[Account] = None,
    bill_id: Optional[int] = None,
    pending: bool = False,
) -> None:
    s.ledger.append(
        LedgerEntry(len(s.ledger), s.season, s.tide, op, account, amount, memo, to, bill_id, pending)
    )


def earn(s: GameState, amount: int, memo: str) -> None:
    """Coin into the Purse (wages, sales, dividends, windfalls)."""
    if amount <= 0:
        return
    s.purse += amount
    post(s, NessieOp.DEPOSIT, Account.PURSE, amount, memo)


def spend(s: GameState, amount: int, memo: str) -> None:
    """Coin out of the Purse. Raises if the Purse can't cover it."""
    require(amount <= s.purse, "insufficient_funds", f"That costs {amount}◈ and your Purse holds {s.purse}◈.")
    if amount <= 0:
        return
    s.purse -= amount
    post(s, NessieOp.PURCHASE, Account.PURSE, amount, memo)


def liquid_coin(s: GameState) -> int:
    return s.purse + (s.vault or 0)


def cover_cost(s: GameState, amount: int, memo: str, *, use_vault: bool = False) -> int:
    """Pay a cost the player can't refuse: Purse, then the Vault if allowed, then Leviathan Credit.

    Returns the part nobody could pay.
    """
    if use_vault and amount > s.purse and vault_free(s) > 0:
        withdraw(s, min(amount - s.purse, vault_free(s)))
    paid = min(amount, s.purse)
    spend(s, paid, memo)
    remaining = amount - paid
    if remaining > 0:
        remaining -= charge_card(s, remaining, memo)
    return remaining


# --- Vault ----------------------------------------------------------------------------------------


def vault_free(s: GameState) -> int:
    return 0 if s.vault is None else s.vault - s.vault_locked


def open_vault(s: GameState) -> None:
    require(s.vault is None, "already_open", "You already have a Vault.")
    min_standing = class_spec(s).vault_min_standing
    if min_standing:
        require(
            s.standing is not None and s.standing >= min_standing,
            "standing_too_low",
            f"The Bank opens a Vault for you once your Standing reaches {min_standing}.",
        )
    s.vault = 0
    s.record("account_opened", account=Account.VAULT)


def deposit(s: GameState, amount: int) -> None:
    require_positive(amount)
    require(s.vault is not None, "no_vault", "Open a Vault first.")
    require(amount <= s.purse, "insufficient_funds", f"Your Purse holds {s.purse}◈.")
    s.purse -= amount
    s.vault += amount
    post(s, NessieOp.TRANSFER, Account.PURSE, amount, "Deposit to Vault", to=Account.VAULT)


def withdraw(s: GameState, amount: int) -> None:
    require_positive(amount)
    require(s.vault is not None, "no_vault", "You have no Vault.")
    require(amount <= vault_free(s), "insufficient_funds", f"You can withdraw up to {vault_free(s)}◈.")
    s.vault -= amount
    s.purse += amount
    post(s, NessieOp.TRANSFER, Account.VAULT, amount, "Withdrawal from Vault", to=Account.PURSE)


# --- Leviathan Credit -----------------------------------------------------------------------------


def card_limit(s: GameState) -> int:
    if s.card is None or s.standing is None:
        return 0
    for min_standing, limit in config.CARD_LIMITS:
        if s.standing >= min_standing:
            return limit
    return 0


def card_frozen(s: GameState) -> bool:
    return s.card is not None and s.standing is not None and s.standing < config.CARD_FREEZE_BELOW


def card_available(s: GameState) -> int:
    if s.card is None or card_frozen(s):
        return 0
    return max(0, card_limit(s) - s.card.balance)


def charge_card(s: GameState, amount: int, memo: str) -> int:
    """Charge up to ``amount``; the rest is declined. Returns what was charged."""
    charged = min(amount, card_available(s))
    if charged <= 0:
        return 0
    s.card.balance += charged
    post(s, NessieOp.PURCHASE, Account.CARD, charged, memo)
    return charged


def open_secured_card(s: GameState) -> None:
    require(s.card is None, "already_open", "You already hold a Leviathan card.")
    require(s.standing is None, "not_needed", "Secured cards are for the Unrated.")
    need = config.SECURED_DEPOSIT
    top_up = max(0, need - vault_free(s))
    require(top_up <= s.purse, "insufficient_funds", f"Ione needs {need}◈ locked in your Vault.")
    if s.vault is None:
        open_vault(s)
    if top_up:
        deposit(s, top_up)
    s.vault_locked += need
    s.card = Card(secured=True)
    s.standing = config.SECURED_START_STANDING
    s.record("account_opened", account=Account.CARD, secured=True, locked=need, standing=s.standing)


def close_card(s: GameState) -> None:
    require(s.card is not None, "no_card", "You hold no Leviathan card.")
    require(s.card.balance == 0, "balance_owed", "Pay off the card before closing it.")
    if s.card.secured:
        s.vault_locked -= config.SECURED_DEPOSIT
    s.card = None
    s.record("account_closed", account=Account.CARD)


def pay_card(s: GameState, amount: int) -> None:
    require_positive(amount)
    require(s.card is not None and s.card.balance > 0, "nothing_owed", "Your card has no balance.")
    amount = min(amount, s.card.balance)
    require(amount <= s.purse, "insufficient_funds", f"Your Purse holds {s.purse}◈.")
    s.purse -= amount
    s.card.balance -= amount
    s.card.paid_this_season += amount
    post(s, NessieOp.TRANSFER, Account.PURSE, amount, "Leviathan Credit payment", to=Account.CARD)


# --- Bills ----------------------------------------------------------------------------------------


def post_bill(s: GameState, kind: BillKind, amount: int) -> Bill:
    bill = Bill(s.next_bill_id, kind, amount, s.season)
    s.next_bill_id += 1
    s.bills.append(bill)
    post(s, NessieOp.BILL, Account.PURSE, amount, BILL_MEMOS[kind], bill_id=bill.id, pending=True)
    return bill


def pay_bill(s: GameState, bill_id: Optional[int] = None) -> None:
    """Pay one bill, or every outstanding bill when ``bill_id`` is None."""
    bills = [b for b in s.bills if bill_id is None or b.id == bill_id]
    require(bool(bills), "no_bill", "There's no such bill to pay.")
    total = sum(b.amount for b in bills)
    require(total <= s.purse, "insufficient_funds", f"That's {total}◈ and your Purse holds {s.purse}◈.")
    for b in bills:
        _settle_bill(s, b)


def autopay_bills(s: GameState) -> None:
    """Season end: the Purse pays every bill it can cover, oldest first, then the circle's
    scheduled payment. Whatever it can't cover goes late (bills) or counts as missed (circle)."""
    for b in sorted(s.bills, key=lambda b: b.id):
        if b.amount <= s.purse:
            _settle_bill(s, b)
    due = circle_due(s)
    if due and due <= s.purse:
        _repay(s, s.loans[LoanKind.CIRCLE], due, "Lending circle payment")


def _settle_bill(s: GameState, b: Bill) -> None:
    s.purse -= b.amount
    post(s, NessieOp.BILL, Account.PURSE, b.amount, BILL_MEMOS[b.kind], bill_id=b.id)
    s.bills.remove(b)


def circle_due(s: GameState) -> int:
    """What the circle needs by this season's end: the pot is repaid ``CIRCLE_PAYMENT`` a season,
    the last share at the Passage check. Paying ahead lowers later dues."""
    loan = s.loans.get(LoanKind.CIRCLE)
    if loan is None:
        return 0
    allowed = config.CIRCLE_PAYMENT * (LONG_DARK - s.season)
    return max(0, loan.balance - allowed)


def check_circle(s: GameState) -> None:
    """After autopay: a payment still due is a missed payment (no Standing hit; the circle remembers)."""
    if circle_due(s):
        s.flags.circle_missed = True


# --- Loans and the Black Reef ---------------------------------------------------------------------


def add_loan(s: GameState, kind: LoanKind, amount: int, rate: float, memo: str, op: NessieOp) -> Loan:
    loan = s.loans.get(kind)
    if loan is None:
        loan = s.loans[kind] = Loan(kind, 0, rate)
    loan.balance += amount
    s.purse += amount
    post(s, op, LOAN_ACCOUNTS[kind], amount, memo, to=Account.PURSE)
    return loan


def pay_loan(s: GameState, kind: LoanKind, amount: int) -> None:
    require_positive(amount)
    loan = s.loans.get(kind)
    require(loan is not None, "no_loan", "You owe nothing there.")
    amount = min(amount, loan.balance)
    require(amount <= s.purse, "insufficient_funds", f"Your Purse holds {s.purse}◈.")
    memo = "Lending circle payment" if kind == LoanKind.CIRCLE else f"Repayment: {kind.value} loan"
    _repay(s, loan, amount, memo)


def _repay(s: GameState, loan: Loan, amount: int, memo: str) -> None:
    s.purse -= amount
    loan.balance -= amount
    loan.paid_this_season += amount
    post(s, NessieOp.TRANSFER, Account.PURSE, amount, memo, to=LOAN_ACCOUNTS[loan.kind])
    if loan.balance == 0:
        del s.loans[loan.kind]


def black_reef_advance(s: GameState, amount: int) -> None:
    require_positive(amount)
    owed = s.loans[LoanKind.BLACK_REEF].balance if LoanKind.BLACK_REEF in s.loans else 0
    require(
        owed + amount <= config.BLACK_REEF_MAX,
        "over_limit",
        f"Grin advances at most {config.BLACK_REEF_MAX}◈; you owe {owed}◈.",
    )
    s.visit(Place.BLACK_REEF)
    add_loan(s, LoanKind.BLACK_REEF, amount, config.BLACK_REEF_FEE, "Black Reef cash advance", NessieOp.WITHDRAWAL)
    s.record("black_reef_advance", amount=amount)


def amortized_payment(balance: int, rate: float, seasons: int) -> int:
    if seasons <= 1:
        return balance
    if rate == 0:
        return math.ceil(balance / seasons)
    return math.ceil(balance * rate / (1 - (1 + rate) ** -seasons))


def take_bank_loan(s: GameState, amount: int) -> None:
    require(config.FEATURE_BANK_LOAN, "unavailable", "The Bank isn't lending yet.")
    require_positive(amount)
    require(LoanKind.BANK not in s.loans, "already_borrowed", "You already have a Bank loan.")
    require(
        s.standing is not None and s.standing >= config.BANK_LOAN_MIN_STANDING,
        "standing_too_low",
        f"The Bank lends from Standing {config.BANK_LOAN_MIN_STANDING}.",
    )
    require(amount <= config.BANK_LOAN_MAX, "over_limit", f"The Bank lends up to {config.BANK_LOAN_MAX}◈.")
    loan = add_loan(s, LoanKind.BANK, amount, config.BANK_LOAN_RATE, "Bank loan", NessieOp.LOAN)
    loan.payment_due = amortized_payment(amount, loan.rate, LONG_DARK - s.season + 1)
    s.record("bank_loan", amount=amount, payment_due=loan.payment_due)


# --- Totals and Passage ---------------------------------------------------------------------------


def total_debt(s: GameState) -> int:
    card = s.card.balance if s.card else 0
    return card + sum(l.balance for l in s.loans.values()) + sum(b.amount for b in s.bills)


def passage_price(s: GameState, season: Optional[int] = None) -> int:
    season = s.season if season is None else season
    price = config.PASSAGE_PRICES[SEASONS[season]]
    if season >= s.debasement_season:
        price *= config.DEBASEMENT_MULT
    return coin(price)


def buy_passage(s: GameState) -> None:
    require(s.passage_paid is None, "already_bought", "Your Passage is already paid.")
    debt = total_debt(s)
    require(debt == 0, "debts_outstanding", f"Settle every debt first; you still owe {debt}◈.")
    price = passage_price(s)
    require(price <= s.purse, "insufficient_funds", f"Passage costs {price}◈ and your Purse holds {s.purse}◈.")
    spend(s, price, "Passage on the last ship")
    s.passage_paid = price
    s.record("passage_bought", price=price)


# --- Season settlement ----------------------------------------------------------------------------


def settle_season(s: GameState) -> Dict[str, Any]:
    """Season-end money: late bills, card minimum and interest, loans, Vault interest, Standing."""
    late = _mark_late_bills(s)
    check_circle(s)
    missed_min, card_interest = _settle_card(s)
    missed_loan = _settle_loans(s)
    vault_interest = 0
    if s.vault:
        vault_interest = coin(s.vault * s.vault_rate)
        if vault_interest:
            s.vault += vault_interest
            post(s, NessieOp.DEPOSIT, Account.VAULT, vault_interest, "Vault interest")
    standing = update_standing(
        s,
        missed_min=missed_min,
        late_tithe=BillKind.TITHE in late,
        missed_loan=missed_loan,
        clean=not (late or missed_min or missed_loan),
    )
    return {
        "late_bills": [k.value for k in late],
        "missed_minimum": missed_min,
        "missed_loan_payment": missed_loan,
        "card_interest": card_interest,
        "vault_interest": vault_interest,
        "standing": standing,
    }


def _mark_late_bills(s: GameState) -> List[BillKind]:
    """Bills autopay couldn't cover are late: each gains the late fee (a second pending entry for
    the same bill, so Nessie's bill grows) and stays owed."""
    late: List[BillKind] = []
    for bill in s.bills:
        bill.late = True
        bill.amount += config.LATE_FEE
        post(s, NessieOp.BILL, Account.PURSE, config.LATE_FEE, "Late fee: " + BILL_MEMOS[bill.kind],
             bill_id=bill.id, pending=True)
        if bill.kind not in late:
            late.append(bill.kind)
    return late


def _settle_card(s: GameState) -> Tuple[bool, int]:
    card = s.card
    if card is None:
        s.flags.min_only_streak = 0
        return False, 0
    missed = card.min_due > 0 and card.paid_this_season < card.min_due
    min_only = (
        card.min_due > 0
        and not missed
        and card.balance > 0
        and card.paid_this_season < card.min_due * config.MIN_ONLY_TOLERANCE
    )
    s.flags.min_only_streak = s.flags.min_only_streak + 1 if min_only else 0
    if missed:
        card.balance += config.LATE_FEE
        post(s, NessieOp.PURCHASE, Account.CARD, config.LATE_FEE, "Late fee: missed minimum")
    interest = coin(card.balance * config.CARD_RATE)
    if interest:
        card.balance += interest
        post(s, NessieOp.PURCHASE, Account.CARD, interest, "Leviathan interest")
    card.min_due = math.ceil(card.balance * config.CARD_MIN_PAYMENT) if card.balance else 0
    card.paid_this_season = 0
    return missed, interest


def _settle_loans(s: GameState) -> bool:
    missed_bank = False
    for kind, loan in list(s.loans.items()):
        account = LOAN_ACCOUNTS[kind]
        if kind == LoanKind.BANK and loan.paid_this_season < loan.payment_due:
            missed_bank = True
            loan.balance += config.LATE_FEE
            post(s, NessieOp.LOAN, account, config.LATE_FEE, "Late fee: missed Bank loan payment")
        interest = coin(loan.balance * loan.rate)
        if interest:
            loan.balance += interest
            memo = "Black Reef fee" if kind == LoanKind.BLACK_REEF else f"Interest: {kind.value} loan"
            post(s, NessieOp.LOAN, account, interest, memo)
        if kind == LoanKind.BANK:
            s.flags.bank_interest_paid += interest
            loan.payment_due = amortized_payment(loan.balance, loan.rate, LONG_DARK - s.season)
        loan.paid_this_season = 0
    return missed_bank


def update_standing(
    s: GameState, *, missed_min: bool, late_tithe: bool, missed_loan: bool, clean: bool
) -> Optional[Dict[str, int]]:
    if s.standing is None:
        return None
    payments = config.STANDING_CLEAN_SEASON if clean else 0
    payments += config.STANDING_MISSED_MINIMUM if missed_min else 0
    payments += config.STANDING_LATE_TITHE if late_tithe else 0
    payments += config.STANDING_MISSED_LOAN if missed_loan else 0

    credit_used = 0
    limit = card_limit(s)
    if s.card is not None and limit:
        utilization = s.card.balance / limit
        if utilization > config.HIGH_UTILIZATION:
            credit_used = config.STANDING_HIGH_UTILIZATION
        elif utilization < config.LOW_UTILIZATION:
            credit_used = config.STANDING_LOW_UTILIZATION

    factors = {"payments": payments, "credit_used": credit_used, "history": config.STANDING_HISTORY}
    before, was_frozen = s.standing, card_frozen(s)
    s.standing = max(config.STANDING_MIN, min(config.STANDING_MAX, before + sum(factors.values())))
    s.standing_factors = factors
    s.record("standing", before=before, after=s.standing, **factors)
    if card_frozen(s) != was_frozen:
        s.record("card_frozen" if card_frozen(s) else "card_unfrozen")
    return {"before": before, "after": s.standing, **factors}
