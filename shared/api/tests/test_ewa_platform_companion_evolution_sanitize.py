# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``sanitize_learned_preferences_delta`` (shallow JSON-safe evolution deltas).
# Invariants:
# - Nested structures and bad keys are dropped with reason codes in warnings.
# Related:
# - api/ewa_platform/companion/persona/evolution_tick.py
# ---
from __future__ import annotations

from api.ewa_platform.companion.persona.evolution_tick import sanitize_learned_preferences_delta


def test_sanitize_delta_accepts_scalars() -> None:
    out, warns = sanitize_learned_preferences_delta(
        {"tone_pref": "warm", "age_int": 1, "ok_float": 0.5, "flag": True, "empty": None},
    )
    assert out["tone_pref"] == "warm"
    assert out["age_int"] == 1
    assert out["ok_float"] == 0.5
    assert out["flag"] is True
    assert out["empty"] is None
    assert warns == []


def test_sanitize_delta_drops_nested_and_bad_keys() -> None:
    out, warns = sanitize_learned_preferences_delta(
        {"valid_key": "a", "nested": {"x": 1}, "bad!": 1},
    )
    assert out == {"valid_key": "a"}
    assert any("unsupported_value_type" in w for w in warns)
    assert any("bad_key_skipped" in w for w in warns)
