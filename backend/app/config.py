"""Every tuning number in Atlantis (CLAUDE.md rule 5).

Values come from the design doc as amended by Balance pass v2, unless marked ``engine default``: the doc left those open, so the
engine picked a starting value (see "Engine decisions" in CLAUDE.md). Engine modules always read
``config.NAME`` at call time, so tests and the simulator can monkeypatch anything here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from app.engine.state import BusinessKind, ClassId, EventKind, Good, House, Place, Scenario, Season

# --- Feature flags: "only if ahead" systems stay off until the core loop works end to end -------

FEATURE_SILK = False  # sea silk and Silkwind Trading
FEATURE_BUSINESSES = False
FEATURE_BANK_LOAN = False

# --- Time -----------------------------------------------------------------------------------------

TIDES_PER_SEASON = 6
# The first visits each season cost no tide; later visits and work still do.
FREE_VISITS_PER_SEASON: Dict[Place, int] = {Place.MARKET: 1, Place.HARBOR: 1}
HUNGRY_TIDE_PENALTY = 2
MIN_TIDES = 1  # engine default: a season always has at least one tide

# --- Classes --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class ClassSpec:
    wage: int  # pay per shift
    start_purse: int
    wage_growth: int = 0  # added each season
    wage_range: Optional[Tuple[int, int]] = None  # random pay instead of ``wage``
    start_vault: bool = False  # starts with a Savings account
    start_standing: Optional[int] = None  # None = Unrated
    starts_with_card: bool = True  # engine default: every rated class holds a Leviathan card
    vault_min_standing: int = 0
    guild_loan: int = 0
    care_bill: int = 0
    care_tides: int = 0
    care_seasons: Tuple[Season, ...] = ()
    circle_pot: int = 0
    rumor_accuracy: float = 0.70
    lucky_salvage_mult: float = 1.0
    grins_offer_mult: float = 1.0
    extra_explanations: bool = False  # Ione and Sefa explain one extra factor (UI)


CLASSES: Dict[ClassId, ClassSpec] = {
    ClassId.NEWCOMER: ClassSpec(
        wage=60,
        start_purse=500,
        starts_with_card=False,
        rumor_accuracy=0.90,
    ),
    ClassId.FIRST_OF_LINE: ClassSpec(
        wage=50,
        wage_growth=10,
        start_purse=800,  # "800◈, but 500◈ of it is owed to the guild"
        start_vault=True,
        start_standing=580,
        guild_loan=500,
        extra_explanations=True,
    ),
    ClassId.CARETAKER: ClassSpec(
        wage=55,
        start_purse=700,
        start_vault=True,
        start_standing=620,
        care_bill=60,
        care_tides=2,
        care_seasons=(Season.SUMMER, Season.LONG_DARK),
        circle_pot=400,
    ),
    ClassId.TIDEWALKER: ClassSpec(
        wage=60,
        wage_range=(0, 120),
        start_purse=500,
        start_standing=540,
        vault_min_standing=550,
        lucky_salvage_mult=3.0,
        grins_offer_mult=2.0,  # engine default for "Grin's offers appear more often"
    ),
}

# --- Grand Market ---------------------------------------------------------------------------------

# Base prices by season (Spring, Summer, Autumn, Long Dark), before debasement and panic.
GOOD_BASE_PRICES: Dict[Good, Tuple[float, float, float, float]] = {
    Good.KELP: (4, 3, 5, 12),
    Good.PEARLS: (40, 42, 46, 48),
    Good.SILK: (25, 28, 30, 15),
}
SCENARIO_PRICE_OVERRIDES: Dict[Scenario, Dict[Tuple[Good, Season], float]] = {
    Scenario.KELP_BLIGHT: {(Good.KELP, Season.LONG_DARK): 18},
    Scenario.SILK_BOOM: {(Good.SILK, Season.SUMMER): 40},
}
GOOD_TIDE_SWING: Dict[Good, float] = {
    Good.KELP: 0.0,
    Good.PEARLS: 0.03,
    Good.SILK: 0.03,  # engine default
}
LONG_DARK_GOOD_PANIC: Dict[Good, float] = {Good.PEARLS: 0.90, Good.SILK: 0.70}
IMPACT_PER_UNIT = 0.005
IMPACT_FADE_PER_TIDE = 0.5
PRICE_FLOOR = 0.20  # share of season base
KELP_EATEN_PER_SEASON = 20
CELLAR_CAPACITY = 60  # kelp only
KELP_SPOILAGE = 0.10

# --- Harbor Exchange ------------------------------------------------------------------------------


@dataclass(frozen=True)
class HouseSpec:
    start_price: float
    success: float
    win: float
    loss: float
    dividend: float  # per share, only when a voyage succeeds
    tide_swing: float


HOUSES: Dict[House, HouseSpec] = {
    House.ORO: HouseSpec(50, 0.90, 0.08, 0.12, 1, 0.02),
    House.LEVIATHAN: HouseSpec(40, 0.70, 0.30, 0.35, 0, 0.06),
    House.DEEPCORAL: HouseSpec(20, 0.10, 1.50, 0.20, 0, 0.08),
    House.SILKWIND: HouseSpec(30, 0.80, 0.20, 0.25, 1, 0.04),
}
# The Tide Index is a basket: at the start, each index share holds these value weights of each house.
INDEX_WEIGHTS: Dict[House, float] = {House.ORO: 0.45, House.LEVIATHAN: 0.45, House.DEEPCORAL: 0.10}
INDEX_FEE_PER_SEASON = 0.01
MIN_SHARE_PRICE = 1.0  # engine default

STORM_MULTIPLIERS: Tuple[float, ...] = (1.0, 0.85, 0.70, 0.55)  # by storm level; 0.55 engine default
SEASON_STORM_LEVEL: Dict[Season, int] = {
    Season.SPRING: 0,
    Season.SUMMER: 0,
    Season.AUTUMN: 1,
    Season.LONG_DARK: 0,
}
STORMY_SEAS_AUTUMN_LEVEL = 2
STORMY_SEAS_WORST_HIT: Dict[House, float] = {House.ORO: 0.9, House.SILKWIND: 0.9}  # engine default
SILK_BOOM_SUMMER_SUCCESS: Dict[House, float] = {House.ORO: 0.95, House.SILKWIND: 0.95}
LONG_DARK_HOUSE_PANIC = 0.80
RUMOR_PRICE_REACTION = 0.10  # engine default

# --- Money ----------------------------------------------------------------------------------------

VAULT_RATE = 0.02
VAULT_RATE_OPTIONS: Tuple[float, ...] = (0.01, 0.03)  # Council rate change

CARD_RATE = 0.075
CARD_MIN_PAYMENT = 0.10
LATE_FEE = 20
CARD_LIMITS: Tuple[Tuple[int, int], ...] = ((650, 800), (550, 400), (0, 200))  # (min Standing, limit)
CARD_FREEZE_BELOW = 450
SECURED_DEPOSIT = 200
SECURED_START_STANDING = 500

GUILD_LOAN_RATE = 0.01
BLACK_REEF_MAX = 300
BLACK_REEF_FEE = 0.50
BANK_LOAN_MIN_STANDING = 620
BANK_LOAN_MAX = 1000
BANK_LOAN_RATE = 0.03

TITHE = 40
CIRCLE_PAYMENT = 100
# Bills autopay from the Purse at season end; one the Purse can't cover is late and gains LATE_FEE.

STANDING_MIN = 300
STANDING_MAX = 850
STANDING_CLEAN_SEASON = 15
STANDING_MISSED_MINIMUM = -60
STANDING_LATE_TITHE = -40
STANDING_MISSED_LOAN = -60
STANDING_HIGH_UTILIZATION = -20
STANDING_LOW_UTILIZATION = 5
STANDING_HISTORY = 10
HIGH_UTILIZATION = 0.50
LOW_UTILIZATION = 0.30

# --- Council, scenarios, Passage ------------------------------------------------------------------

DEBASEMENT_MULT = 1.15  # goods, Passage and share prices; Purse, Vault and debts don't move
DEBASEMENT_SEASONS: Tuple[Season, ...] = (Season.SUMMER, Season.AUTUMN)
SCENARIO_WEIGHTS: Dict[Scenario, float] = {s: 1.0 for s in Scenario}
# Which season each scenario's clue appears in, and who gives it.
SCENARIO_CLUES: Dict[Scenario, Tuple[Season, str]] = {
    Scenario.SILK_BOOM: (Season.SPRING, "herald"),
    Scenario.KELP_BLIGHT: (Season.SUMMER, "nerissa"),
    Scenario.STORMY_SEAS: (Season.SUMMER, "captain_oro"),
}

PASSAGE_PRICES: Dict[Season, int] = {
    Season.SPRING: 1200,
    Season.SUMMER: 1285,
    Season.AUTUMN: 1375,
    Season.LONG_DARK: 1470,
}
WEALTH_THRESHOLD = 1000
CIRCLE_RESCUE_MAX = 400

# --- Events ---------------------------------------------------------------------------------------

EVENTS_PER_SEASON: Dict[int, float] = {1: 0.5, 2: 0.5}  # count -> weight


@dataclass(frozen=True)
class EventSpec:
    weight: float
    boosted: Optional[float] = None  # weight when the "more likely when" condition holds


EVENT_DECK: Dict[EventKind, EventSpec] = {  # engine default weights
    EventKind.KELP_BLIGHT_SCARE: EventSpec(1.0),
    EventKind.STORM_WARNING: EventSpec(0.5, boosted=1.5),  # Autumn
    EventKind.FRAUD_CHARGE: EventSpec(1.0),
    EventKind.PICKPOCKET: EventSpec(0.3, boosted=1.5),  # rich Purse or Black Reef visit
    EventKind.ROOF_LEAK: EventSpec(0.8),
    EventKind.SURFACE_BOOM: EventSpec(0.0, boosted=3.0),  # Summer of a Silk Boom year
    EventKind.TAVERN_RUMOR: EventSpec(0.6, boosted=2.4),  # after the Drowned Bell
    EventKind.LUCKY_SALVAGE: EventSpec(0.5),
    EventKind.GRINS_OFFER: EventSpec(0.3, boosted=1.5),  # low Standing or empty Purse
    EventKind.PEARL_EXCHANGE: EventSpec(0.3, boosted=1.5),  # behind pace for Passage
    EventKind.COUNCIL_RATE_CHANGE: EventSpec(0.4),
}

KELP_SCARE_MULT = 1.5
FRAUD_SHARE = 0.05
FRAUD_MIN = 30
PICKPOCKET_SHARE = 0.20
PICKPOCKET_PURSE_TRIGGER = 500
ROOF_LEAK_SHARE = 0.10
ROOF_LEAK_MIN = 150
SURFACE_BOOM_HOUSES: Dict[House, float] = {House.SILKWIND: 1.25}
SURFACE_BOOM_GOODS: Dict[Good, float] = {Good.SILK: 1.30}
LUCKY_SALVAGE_AMOUNT = 300
GRIN_STANDING_TRIGGER = 550
GRIN_PURSE_TRIGGER = 50
PEARL_EXCHANGE_PROMISE = 0.40  # the "guaranteed" rate in the pitch

# --- Market shocks: one unexpected market event every season ------------------------------------
# Words (title, story, what it means) live in app/content/events.json under the same ids.


@dataclass(frozen=True)
class MarketShock:
    weight: float = 1.0
    goods: Optional[Dict[Good, float]] = None  # price multiplier for the rest of the season
    houses: Optional[Dict[House, float]] = None  # one-off share price jump
    storm: int = 0  # storm levels added for this season's voyages
    seasons: Tuple[Season, ...] = tuple(Season)  # when it can happen


_VOYAGE_SEASONS = (Season.SPRING, Season.SUMMER, Season.AUTUMN)

MARKET_SHOCKS: Dict[str, MarketShock] = {
    "jellyfish_bloom": MarketShock(goods={Good.KELP: 1.5}),
    "beached_whale": MarketShock(goods={Good.KELP: 0.6}),
    "crab_raid": MarketShock(goods={Good.KELP: 1.35}),
    "glowing_tide": MarketShock(goods={Good.KELP: 0.75}),
    "pearl_strike": MarketShock(goods={Good.PEARLS: 1.25}),
    "counterfeit_pearls": MarketShock(goods={Good.PEARLS: 0.8}),
    "diving_bell_tourists": MarketShock(goods={Good.PEARLS: 1.2, Good.KELP: 1.1}),
    "kraken_sighting": MarketShock(houses={House.LEVIATHAN: 0.85}, storm=1, seasons=_VOYAGE_SEASONS),
    "royal_contract": MarketShock(houses={House.LEVIATHAN: 1.2}, seasons=_VOYAGE_SEASONS),
    "new_trade_route": MarketShock(houses={House.ORO: 1.12}, seasons=_VOYAGE_SEASONS),
    "deepcoral_map": MarketShock(houses={House.DEEPCORAL: 1.5}, seasons=_VOYAGE_SEASONS),
    "current_reversal": MarketShock(
        houses={House.ORO: 0.9, House.LEVIATHAN: 0.9, House.DEEPCORAL: 0.9}, seasons=_VOYAGE_SEASONS
    ),
    "seahorse_derby": MarketShock(goods={Good.PEARLS: 1.15}, houses={House.ORO: 0.95}),
    "eel_blackout": MarketShock(goods={Good.KELP: 1.2, Good.PEARLS: 0.9}),
}

# --- The Drowned Bell: Nerissa's games -----------------------------------------------------------
# Odds are shown to the player as they are. Every game pays back a little less than it takes.


@dataclass(frozen=True)
class GameSpec:
    #: (chance, multiple of the stake paid back); chances sum to 1. The pick-a-shell game is a
    #: 1-in-``choices`` guess instead.
    outcomes: Tuple[Tuple[float, float], ...] = ()
    choices: int = 0
    payout: float = 0.0


GAMES: Dict[str, GameSpec] = {
    "shells": GameSpec(choices=3, payout=2.5),  # 1 in 3 to win 2.5x: pays back 83%
    "wheel": GameSpec(outcomes=((0.71, 0.0), (0.20, 2.0), (0.07, 4.0), (0.02, 10.0))),  # pays back 88%
}
GAMBLE_MIN = 5
GAMBLE_MAX = 100
GAMES_PER_SEASON = 3

# --- Scrolls --------------------------------------------------------------------------------------

BOUGHT_LOW_MIN_KELP = 20  # engine default
MELTING_COIN_MIN_CASH = 1000  # engine default for "lots of cash"
DEBT_SPIRAL_SEASONS = 2
MIN_ONLY_TOLERANCE = 1.5  # paying under 1.5x the minimum counts as "only the minimum"
CREDIT_BUILT_STANDING = 580
DIVERSIFIED_HOUSES = 3
HOUSE_ALWAYS_WINS_LOSS = 100  # coin lost at the Drowned Bell over the year

# --- Businesses (only if ahead) -------------------------------------------------------------------


@dataclass(frozen=True)
class BusinessSpec:
    cost: int
    upkeep: int
    earn_good: Optional[Good] = None  # earns ``earn_units`` x the season's base price of this good
    earn_units: int = 0
    earn_range: Optional[Tuple[int, int]] = None  # or a random amount


BUSINESSES: Dict[BusinessKind, BusinessSpec] = {
    BusinessKind.KELP_STALL: BusinessSpec(500, 20, earn_good=Good.KELP, earn_units=30),
    BusinessKind.SILK_LOOM: BusinessSpec(800, 40, earn_good=Good.SILK, earn_units=12),
    BusinessKind.SALVAGE_BOAT: BusinessSpec(600, 30, earn_range=(50, 350)),
}
BUSINESS_SELL_BACK = 0.50
BUSINESS_SELL_BACK_LONG_DARK = 0.30
