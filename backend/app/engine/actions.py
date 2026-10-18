"""Everything a player can do, as plain data, plus the error the engine raises for illegal moves.

Actions that spend a tide: Work, Rest, MarketTrip, ExchangeVisit, BuyBusiness, SellBusiness,
except that the first MarketTrip and first ExchangeVisit each season are free
(``config.FREE_VISITS_PER_SEASON``). EndSeason spends all remaining tides. Everything else is free.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Tuple

from app.engine.state import BusinessKind, Good, House, LoanKind, Place


class ActionError(Exception):
    """An illegal action. ``code`` is stable for the API; ``message`` is for the player."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# --- Tide actions ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class Work:
    pass


@dataclass(frozen=True)
class Rest:
    """Let one tide pass without doing anything."""


@dataclass(frozen=True)
class EndSeason:
    """Let every remaining tide this season pass (events still fire)."""


@dataclass(frozen=True)
class Order:
    good: Good
    qty: int  # positive buys, negative sells


@dataclass(frozen=True)
class MarketTrip:
    orders: Tuple[Order, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ShareOrder:
    house: House
    qty: int  # positive buys, negative sells


@dataclass(frozen=True)
class ExchangeVisit:
    orders: Tuple[ShareOrder, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class BuyBusiness:
    kind: BusinessKind


@dataclass(frozen=True)
class SellBusiness:
    pass


# --- Free actions ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class Visit:
    """Entering a building. Free, but the event deck notices (Drowned Bell, Black Reef)."""

    place: Place


@dataclass(frozen=True)
class OpenVault:
    pass


@dataclass(frozen=True)
class Deposit:
    """Purse to Vault."""

    amount: int


@dataclass(frozen=True)
class Withdraw:
    """Vault to Purse."""

    amount: int


@dataclass(frozen=True)
class OpenSecuredCard:
    pass


@dataclass(frozen=True)
class CloseCard:
    pass


@dataclass(frozen=True)
class PayCard:
    amount: int


@dataclass(frozen=True)
class PayBill:
    bill_id: Optional[int] = None  # None pays every outstanding bill


@dataclass(frozen=True)
class PayLoan:
    kind: LoanKind
    amount: int


@dataclass(frozen=True)
class TakeBankLoan:
    amount: int


@dataclass(frozen=True)
class BlackReefAdvance:
    amount: int


@dataclass(frozen=True)
class DisputeCharge:
    pass


@dataclass(frozen=True)
class InvestPearlExchange:
    amount: int


@dataclass(frozen=True)
class Gamble:
    """One of Nerissa's games at the Drowned Bell. ``pick`` is the shell (1-3) for the shell game."""

    game: str
    stake: int
    pick: Optional[int] = None


@dataclass(frozen=True)
class BuyPassage:
    pass


@dataclass(frozen=True)
class EndYear:
    """Only during the final call: face the Passage check and see the ending."""


TIDE_ACTIONS = (Work, Rest, MarketTrip, ExchangeVisit, BuyBusiness, SellBusiness)
