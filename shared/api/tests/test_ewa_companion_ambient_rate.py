# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for Continuity W5a — ambient hourly cap + theme cooldown.
# Invariants:
# - Pure unit tests — no Postgres / Redis / LLM I/O.
# Related:
# - api/ewa_platform/companion/actions/ambient_rate.py
# ---
"""Unit tests: ambient rate budget."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.ewa_platform.companion.actions.ambient_rate import (
    AMBIENT_BUDGET_NS,
    ambient_budget_allows,
    record_ambient_injection,
)
from api.ewa_platform.companion.persona.continuity import CONTINUITY_NS
from api.ewa_platform.companion.turn.turn_action_prelude import prepend_ambient_from_continuity


def test_hourly_cap_blocks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_MAX_PER_HOUR", "2")
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_THEME_COOLDOWN_MIN", "0")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    profile = {
        "learned_preferences": {
            AMBIENT_BUDGET_NS: {
                "window_start": (now - timedelta(minutes=10)).isoformat(),
                "count": 2,
                "last_injected_at": (now - timedelta(minutes=5)).isoformat(),
            }
        }
    }
    allowed, reason = ambient_budget_allows(profile, now=now)
    assert allowed is False
    assert reason == "hourly_cap"


def test_theme_user_cooldown_blocks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_MAX_PER_HOUR", "5")
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_THEME_COOLDOWN_MIN", "30")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    profile = {
        "learned_preferences": {
            AMBIENT_BUDGET_NS: {
                "window_start": (now - timedelta(minutes=10)).isoformat(),
                "count": 0,
                "last_theme_user_at": (now - timedelta(minutes=5)).isoformat(),
            }
        }
    }
    allowed, reason = ambient_budget_allows(profile, now=now)
    assert allowed is False
    assert reason == "theme_user_cooldown"


def test_record_increments_count(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_MAX_PER_HOUR", "3")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    blob = record_ambient_injection({}, now=now)
    assert blob["count"] == 1
    profile = {"learned_preferences": {AMBIENT_BUDGET_NS: blob}}
    blob2 = record_ambient_injection(profile, now=now + timedelta(minutes=1))
    assert blob2["count"] == 2


def test_prepend_respects_hourly_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_FROM_CONTINUITY", "1")
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_MAX_PER_HOUR", "1")
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_THEME_COOLDOWN_MIN", "0")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    profile = {
        "learned_preferences": {
            CONTINUITY_NS: {
                "mood_tint": "focus",
                "valence": 0.3,
                "arousal": 0.5,
                "unspoken_notes": [],
            },
            AMBIENT_BUDGET_NS: {
                "window_start": now.isoformat(),
                "count": 1,
                "last_injected_at": (now - timedelta(minutes=1)).isoformat(),
            },
        }
    }
    out, budget = prepend_ambient_from_continuity([], profile, persona_seed="parent")
    assert out == []
    assert budget is None
