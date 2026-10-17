"""Helpers shared by the engine tests."""

from __future__ import annotations

import random
from typing import Iterable

from app.engine import money
from app.engine.actions import EndSeason, PayBill, PayCard, PayLoan
from app.engine.game import new_game, step
from app.engine.state import ClassId, GameState, Phase


def game(player_class: ClassId = ClassId.NEWCOMER, seed: int = 1) -> GameState:
    return new_game(player_class, seed)


def rand(seed: int = 0) -> random.Random:
    return random.Random(seed)


def settle_debts(s: GameState) -> None:
    """Pay every bill, the card and every loan, topping up the Purse so it can."""
    s.purse += money.total_debt(s)
    if s.bills:
        step(s, PayBill())
    if s.card and s.card.balance:
        step(s, PayCard(s.card.balance))
    for kind in list(s.loans):
        step(s, PayLoan(kind, s.loans[kind].balance))


def advance_to(s: GameState, season: int, *, pay: bool = True) -> None:
    """Skip whole seasons (paying debts each time unless ``pay`` is False) until ``season`` opens."""
    while s.season < season and s.phase == Phase.PLAYING:
        if pay:
            settle_debts(s)
        step(s, EndSeason())


def kinds(events: Iterable) -> list:
    return [e.kind for e in events]
