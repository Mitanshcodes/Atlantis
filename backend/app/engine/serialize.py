"""GameState to JSON-ready data and back, so the API can store a run between requests.

``to_data`` gives plain dicts, lists, strings and numbers. ``from_data`` rebuilds the exact
dataclasses and enums using the type hints in ``state.py``, so new fields need no code here.
"""

from __future__ import annotations

import dataclasses
import json
import typing
from enum import Enum
from functools import lru_cache
from typing import Any, Dict, Union

from app.engine import state as state_module
from app.engine.state import GameState


def to_data(s: GameState) -> Dict[str, Any]:
    # json round-trip turns enum keys and values into their string values.
    return json.loads(json.dumps(dataclasses.asdict(s)))


def from_data(data: Dict[str, Any]) -> GameState:
    return _decode(GameState, data)


@lru_cache(maxsize=None)
def _hints(cls: type) -> Dict[str, Any]:
    return typing.get_type_hints(cls, vars(state_module))


def _decode(hint: Any, value: Any) -> Any:
    if value is None:
        return None
    origin = typing.get_origin(hint)
    args = typing.get_args(hint)
    if origin is Union:  # Optional[X]
        inner = [a for a in args if a is not type(None)]
        return _decode(inner[0], value)
    if origin in (list, typing.List):
        return [_decode(args[0], v) for v in value]
    if origin in (tuple, typing.Tuple):
        return tuple(_decode(args[0], v) for v in value)
    if origin in (dict, typing.Dict):
        return {_decode(args[0], k): _decode(args[1], v) for k, v in value.items()}
    if hint is Any:
        return value
    if isinstance(hint, type) and issubclass(hint, Enum):
        return hint(value)
    if dataclasses.is_dataclass(hint):
        hints = _hints(hint)
        fields = {f.name for f in dataclasses.fields(hint)}
        return hint(**{k: _decode(hints[k], v) for k, v in value.items() if k in fields})
    if hint is float:
        return float(value)
    return value
