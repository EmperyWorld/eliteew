# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for Continuity W4 — continuity mood_tint → ambient_adjust.
# Invariants:
# - Pure unit tests — no Postgres / Redis / LLM I/O.
# Related:
# - api/ewa_platform/companion/actions/ambient_from_continuity.py
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md
# ---
"""Unit tests: ambient from continuity."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.actions.ambient import expand_ambient_actions
from api.ewa_platform.companion.actions.ambient_from_continuity import (
    ambient_from_continuity_enabled,
    build_ambient_adjust_from_continuity,
    continuity_tint_to_ambient_mood,
)
from api.ewa_platform.companion.persona.continuity import CONTINUITY_NS
from api.ewa_platform.companion.turn.turn_action_prelude import prepend_ambient_from_continuity


def test_ambient_from_continuity_flag_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_AMBIENT_FROM_CONTINUITY", raising=False)
    assert ambient_from_continuity_enabled() is False
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_FROM_CONTINUITY", "1")
    assert ambient_from_continuity_enabled() is True


def test_tint_mapping() -> None:
    assert continuity_tint_to_ambient_mood("warm") == "warm"
    assert continuity_tint_to_ambient_mood("ironic_soft") == "playful"
    assert continuity_tint_to_ambient_mood("neutral") is None
    assert continuity_tint_to_ambient_mood("unknown") is None


def test_build_skips_near_rest_valence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_FROM_CONTINUITY", "1")
    profile = {
        "learned_preferences": {
            CONTINUITY_NS: {
                "mood_tint": "warm",
                "valence": 0.02,
                "arousal": 0.1,
                "unspoken_notes": [],
            }
        }
    }
    assert build_ambient_adjust_from_continuity(profile) is None


def test_build_sets_contemplation_weak(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_FROM_CONTINUITY", "1")
    profile = {
        "learned_preferences": {
            CONTINUITY_NS: {
                "mood_tint": "tense",
                "valence": -0.4,
                "arousal": 0.6,
                "unspoken_notes": [],
            }
        }
    }
    row = build_ambient_adjust_from_continuity(profile, contemplation=True)
    assert row is not None
    assert row["type"] == "ambient_adjust"
    assert row["mood"] == "tense"
    assert row["contemplation_weak"] is True


def test_expand_skips_music_when_contemplation_weak(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "1")
    expanded = expand_ambient_actions([{"type": "ambient_adjust", "mood": "warm", "contemplation_weak": True}])
    assert all(row.get("app_component") != "MusicPlayer" for row in expanded)
    assert any(row.get("type") == "patch_desktop_config" for row in expanded)


def test_prepend_requires_both_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_FROM_CONTINUITY", "1")
    monkeypatch.delenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", raising=False)
    profile = {
        "learned_preferences": {
            CONTINUITY_NS: {
                "mood_tint": "focus",
                "valence": 0.3,
                "arousal": 0.5,
                "unspoken_notes": [],
            }
        }
    }
    out, budget = prepend_ambient_from_continuity([], profile, persona_seed="parent")
    assert out == []
    assert budget is None

    monkeypatch.setenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_THEME_COOLDOWN_MIN", "0")
    out2, budget2 = prepend_ambient_from_continuity([], profile, persona_seed="parent")
    assert out2 and out2[0].get("type") == "ambient_adjust"
    assert out2[0].get("mood") == "focus"
    assert budget2 is not None
    assert int(budget2.get("count") or 0) == 1
