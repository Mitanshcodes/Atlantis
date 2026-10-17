"""Seeded randomness that lives inside the game state.

Each call to ``rng`` builds a generator from ``(seed, rng_step)`` and advances the step, so the
state alone determines every future roll: replaying the same actions from the same state always
gives the same run, and a serialized state needs no hidden generator object.
"""

from __future__ import annotations

import random
from typing import Dict, TypeVar

from app.engine.state import GameState

K = TypeVar("K")


def rng(s: GameState) -> random.Random:
    r = random.Random(f"{s.seed}:{s.rng_step}")
    s.rng_step += 1
    return r


def weighted_choice(r: random.Random, weights: Dict[K, float]) -> K:
    """Pick a key with probability proportional to its weight. Weights must sum above zero."""
    keys = [k for k, w in weights.items() if w > 0]
    return r.choices(keys, weights=[weights[k] for k in keys])[0]
