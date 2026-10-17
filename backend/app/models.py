"""P2/P1 boundary; amounts are integer hundredths of a coin."""
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

ClassId = Literal['newcomer', 'first_of_their_line', 'caretaker', 'tidewalker']
EffectKind = Literal['customer', 'account', 'merchant', 'deposit', 'purchase', 'transfer', 'withdrawal', 'bill', 'loan']

class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)

class Action(Contract):
    action_id: str = Field(min_length=1, max_length=100)
    expected_version: int = Field(ge=0)
    kind: str = Field(min_length=1, max_length=80)
    amount: int | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, gt=0)
    target: str | None = None

class RunRequest(Contract):
    class_id: ClassId
    seed: int = 42

class State(Contract):
    class_id: ClassId
    seed: int
    version: int = 0
    development: bool = True
    purse: int = Field(ge=0)
    vault: int | None = Field(default=None, ge=0)
    debt: int = Field(default=0, ge=0)
    kelp: int = Field(default=0, ge=0)
    tides: int = Field(default=6, ge=0)
    season: str = 'Spring'
    standing: int | None = None
    passage: bool = False
    available_actions: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)

class MoneyEffect(Contract):
    effect_id: str = Field(min_length=1, max_length=160)
    kind: EffectKind
    source: str | None = None
    destination: str | None = None
    merchant: str | None = None
    amount: int = Field(default=0, ge=0)
    reason: str
    payload: dict[str, Any] = Field(default_factory=dict)

class Transition(Contract):
    state: State
    events: list[str] = Field(default_factory=list)
    effects: list[MoneyEffect] = Field(default_factory=list)

class BalanceEvidence(Contract):
    expected: int
    remote: int | None = None
    matches: bool | None = None
    cached_remote: int | None = None
    cached_at: float | None = None
