"""Shared fixtures for the engine tests. Run from ``backend/``: ``python3 -m pytest``."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app import config  # noqa: E402


@pytest.fixture
def quiet(monkeypatch):
    """No random events, so a test sees only the rules it exercises."""
    monkeypatch.setattr(config, "EVENTS_PER_SEASON", {0: 1.0})


@pytest.fixture
def features(monkeypatch):
    """Turn on "only if ahead" systems. Call it before ``new_game``."""

    def enable(*names: str) -> None:
        for name in names:
            monkeypatch.setattr(config, f"FEATURE_{name.upper()}", True)

    return enable
