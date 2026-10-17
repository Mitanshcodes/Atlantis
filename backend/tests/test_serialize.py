import json
import random

import pytest
from test_game import random_action

from app.engine.actions import ActionError
from app.engine.game import new_game, step
from app.engine.serialize import from_data, to_data
from app.engine.state import ClassId, Phase


@pytest.mark.parametrize("player_class", list(ClassId))
def test_round_trip_is_exact_at_every_step(player_class):
    s = new_game(player_class, 3)
    r = random.Random(3)
    for _ in range(400):
        if s.phase == Phase.ENDED:
            break
        try:
            step(s, random_action(s, r))
        except ActionError:
            continue
        data = to_data(s)
        json.dumps(data)  # plain JSON
        assert from_data(data) == s


def test_restored_state_plays_on_identically():
    a = new_game(ClassId.TIDEWALKER, 9)
    b = from_data(to_data(a))
    ra, rb = random.Random(1), random.Random(1)
    for _ in range(200):
        for s, r in ((a, ra), (b, rb)):
            if s.phase == Phase.ENDED:
                continue
            try:
                step(s, random_action(s, r))
            except ActionError:
                pass
    assert to_data(a) == to_data(b)
