"""Engine state: the enums and dataclasses that make up one run.

Everything here is plain data. Rules live in the other engine modules and numbers live in
``app/config.py``. A ``GameState`` is fully serializable (``dataclasses.asdict`` gives JSON-ready
data because every enum is a ``str`` enum), and it carries its own RNG position, so a saved state
always continues the same way.

Fields listed in ``HIDDEN_FIELDS`` are secrets the engine needs (the year's scenario, pre-rolled
voyages, whether a rumor is true). The API must strip them before sending state to the browser.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class Season(str, Enum):
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    LONG_DARK = "long_dark"


SEASONS: List[Season] = list(Season)
LONG_DARK = SEASONS.index(Season.LONG_DARK)


class ClassId(str, Enum):
    NEWCOMER = "newcomer"
    FIRST_OF_LINE = "first_of_line"
    CARETAKER = "caretaker"
    TIDEWALKER = "tidewalker"


class Good(str, Enum):
    KELP = "kelp"
    PEARLS = "pearls"
    SILK = "silk"


class House(str, Enum):
    ORO = "oro"
    LEVIATHAN = "leviathan"
    DEEPCORAL = "deepcoral"
    SILKWIND = "silkwind"
    INDEX = "tide_index"  # tradeable like a house, priced from the others


class Scenario(str, Enum):
    SILK_BOOM = "silk_boom"
    KELP_BLIGHT = "kelp_blight"
    STORMY_SEAS = "stormy_seas"


class EventKind(str, Enum):
    KELP_BLIGHT_SCARE = "kelp_blight_scare"
    STORM_WARNING = "storm_warning"
    FRAUD_CHARGE = "fraud_charge"
    PICKPOCKET = "pickpocket"
    ROOF_LEAK = "roof_leak"
    SURFACE_BOOM = "surface_boom"
    TAVERN_RUMOR = "tavern_rumor"
    LUCKY_SALVAGE = "lucky_salvage"
    GRINS_OFFER = "grins_offer"
    PEARL_EXCHANGE = "pearl_exchange"
    COUNCIL_RATE_CHANGE = "council_rate_change"


class BillKind(str, Enum):
    TITHE = "tithe"
    CARE = "care"
    REPAIR = "repair"  # a roof leak nobody could pay for


class LoanKind(str, Enum):
    GUILD = "guild"
    BANK = "bank"
    BLACK_REEF = "black_reef"
    CIRCLE = "circle"  # the lending-circle pot: a loan from friends is still a loan


class BusinessKind(str, Enum):
    KELP_STALL = "kelp_stall"
    SILK_LOOM = "silk_loom"
    SALVAGE_BOAT = "salvage_boat"


class Place(str, Enum):
    BANK = "bank"
    MARKET = "market"
    HARBOR = "harbor"
    DROWNED_BELL = "drowned_bell"
    BLACK_REEF = "black_reef"


class ScrollId(str, Enum):
    RAINY_DAY = "rainy_day"
    BOUGHT_LOW = "bought_low"
    MELTING_COIN = "melting_coin"
    DEBT_SPIRAL = "debt_spiral"
    RICH_ON_PAPER = "rich_on_paper"
    NOT_ALL_ON_ONE_SHIP = "not_all_on_one_ship"
    FIRE_SALE = "fire_sale"
    SIREN_SONG = "siren_song"
    READ_THE_LEDGER = "read_the_ledger"
    CREDIT_BUILT = "credit_built"
    GOOD_DEBT = "good_debt"
    CIRCLE_OF_TRUST = "circle_of_trust"
    HOUSE_ALWAYS_WINS = "house_always_wins"


class Ending(str, Enum):
    ESCAPED_WITH_WEALTH = "escaped_with_wealth"
    ESCAPED_WITH_NOTHING = "escaped_with_nothing"
    RESCUED_BY_CIRCLE = "rescued_by_circle"
    MISSED_THE_SHIP = "missed_the_ship"


class MissCause(str, Enum):
    DEBT = "debt"
    ILLIQUID = "illiquid"  # assets you couldn't sell in time
    SCAM = "scam"
    NO_SAVINGS = "no_savings"


class Phase(str, Enum):
    PLAYING = "playing"
    FINAL_CALL = "final_call"  # Long Dark tides are spent; only free actions and EndYear remain
    ENDED = "ended"


class Account(str, Enum):
    PURSE = "purse"  # Nessie Checking
    VAULT = "vault"  # Nessie Savings
    CARD = "card"  # Nessie Credit Card
    GUILD_LOAN = "guild_loan"
    BANK_LOAN = "bank_loan"
    BLACK_REEF = "black_reef"
    CIRCLE = "circle"  # the other lending-circle members (another Nessie customer)


class NessieOp(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    PURCHASE = "purchase"
    BILL = "bill"
    TRANSFER = "transfer"
    LOAN = "loan"


LOAN_ACCOUNTS = {
    LoanKind.GUILD: Account.GUILD_LOAN,
    LoanKind.BANK: Account.BANK_LOAN,
    LoanKind.BLACK_REEF: Account.BLACK_REEF,
    LoanKind.CIRCLE: Account.CIRCLE,
}


@dataclass
class Card:
    """A Leviathan Credit card. The limit is derived from Standing, never stored."""

    secured: bool = False
    balance: int = 0
    min_due: int = 0  # set at each season end, checked at the next one
    paid_this_season: int = 0


@dataclass
class Loan:
    kind: LoanKind
    balance: int
    rate: float  # per season
    payment_due: int = 0  # required payment this season (Bank loan only)
    paid_this_season: int = 0


@dataclass
class Bill:
    id: int
    kind: BillKind
    amount: int
    season_posted: int
    late: bool = False


@dataclass
class GoodMarket:
    impact: float = 0.0  # the player's own price pressure; halves each tide
    noise: float = 0.0  # this tide's random swing
    event_mult: float = 1.0  # resets every season


@dataclass
class Rumor:
    claims_success: bool
    true: bool  # hidden
    reaction: float  # multiplier applied to the price when heard


@dataclass
class HouseMarket:
    price: float
    record: List[bool] = field(default_factory=list)  # last four voyages, newest last
    voyage_outcome: Optional[bool] = None  # hidden; pre-rolled when a rumor names this house
    rumor: Optional[Rumor] = None


@dataclass
class Holding:
    qty: int = 0
    cost: int = 0  # total cost basis in coin


@dataclass
class Business:
    kind: BusinessKind
    cost: int
    bought_season: int
    loan_funded: bool
    earned: int = 0  # cumulative profit after upkeep


@dataclass
class Offer:
    """Something waiting on the player this season: a charge to dispute, a pitch, an offer."""

    kind: EventKind
    amount: int
    season: int


@dataclass
class LedgerEntry:
    """One coin movement, in the shape nessie/sync.py pushes to Nessie.

    ``account`` is where the coin moved from or to; ``to_account`` is set for transfers.
    Bills appear twice: once ``pending`` when posted, once when paid.
    """

    seq: int
    season: int
    tide: int
    op: NessieOp
    account: Account
    amount: int
    memo: str
    to_account: Optional[Account] = None
    bill_id: Optional[int] = None
    pending: bool = False


@dataclass
class LogEvent:
    """One thing that happened, for the Chronicle, the UI and the Modern Mirror."""

    season: int
    tide: int
    kind: str
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Flags:
    """Facts the Scrolls and endings need that the rest of the state doesn't keep."""

    started_unrated: bool = False
    kelp_bought_summer: int = 0
    kelp_entering_dark: int = 0
    cash_at_debasement: Optional[int] = None
    min_only_streak: int = 0
    fire_sale: bool = False
    fell_for_scam: bool = False
    scam_lost: int = 0
    scam_revealed: bool = False
    disputed_fraud: bool = False
    circle_missed: bool = False
    pearl_pitch_seen: bool = False
    bank_interest_paid: int = 0
    business_result: Optional[int] = None  # profit + sale price - cost, once sold
    business_loan_funded: bool = False
    visited: List[Place] = field(default_factory=list)  # this season
    shocks_seen: List[str] = field(default_factory=list)  # market shocks already used this run
    games_this_season: int = 0  # Drowned Bell games played this season
    games_played: int = 0
    gamble_net: int = 0  # coin won minus coin staked at the Drowned Bell, all year


@dataclass
class GameState:
    seed: int
    player_class: ClassId
    scenario: Scenario
    debasement_season: int
    rng_step: int = 0

    phase: Phase = Phase.PLAYING
    season: int = 0
    tide: int = 0  # tides spent this season
    tides_total: int = 6  # tides available this season
    hungry_next: bool = False

    purse: int = 0
    vault: Optional[int] = None  # None means no Vault account yet
    vault_locked: int = 0  # secured-card collateral, part of ``vault``
    vault_rate: float = 0.0
    standing: Optional[int] = None  # None means Unrated
    standing_factors: Dict[str, int] = field(default_factory=dict)  # last season's change, by factor
    card: Optional[Card] = None
    loans: Dict[LoanKind, Loan] = field(default_factory=dict)
    bills: List[Bill] = field(default_factory=list)
    next_bill_id: int = 1

    goods: Dict[Good, GoodMarket] = field(default_factory=dict)
    stores: Dict[Good, Holding] = field(default_factory=dict)
    houses: Dict[House, HouseMarket] = field(default_factory=dict)
    shares: Dict[House, Holding] = field(default_factory=dict)
    index_factor: float = 1.0  # cumulative Tide Index fee
    storm_level: int = 0

    business: Optional[Business] = None
    offers: List[Offer] = field(default_factory=list)
    event_tides: List[int] = field(default_factory=list)  # hidden; tides after which events fire
    fired_events: List[EventKind] = field(default_factory=list)  # this season
    shock_tide: Optional[int] = None  # hidden; the tide after which this season's market shock hits
    shock: Optional[str] = None  # this season's market shock, once it has hit
    free_visits_used: List[Place] = field(default_factory=list)  # this season

    passage_paid: Optional[int] = None
    scrolls: List[ScrollId] = field(default_factory=list)
    ending: Optional[Ending] = None
    miss_cause: Optional[MissCause] = None

    flags: Flags = field(default_factory=Flags)
    log: List[LogEvent] = field(default_factory=list)
    ledger: List[LedgerEntry] = field(default_factory=list)

    @property
    def season_name(self) -> Season:
        return SEASONS[self.season]

    @property
    def tides_left(self) -> int:
        return self.tides_total - self.tide

    @property
    def is_long_dark(self) -> bool:
        return self.season == LONG_DARK

    @property
    def debased(self) -> bool:
        return self.season >= self.debasement_season

    def record(self, kind: str, /, **data: Any) -> None:
        self.log.append(LogEvent(self.season, self.tide, kind, data))

    def visit(self, place: Place) -> None:
        if place not in self.flags.visited:
            self.flags.visited.append(place)

    def clone(self) -> "GameState":
        return copy.deepcopy(self)


HIDDEN_FIELDS = (
    "scenario",
    "debasement_season",
    "rng_step",
    "event_tides",
    "shock_tide",
    "houses[*].voyage_outcome",
    "houses[*].rumor.true",
)
