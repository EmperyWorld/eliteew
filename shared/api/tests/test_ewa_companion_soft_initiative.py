# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for Continuity W3 — soft initiative budget + partner rewrite.
# Invariants:
# - Pure unit tests — no Postgres / Redis / LLM I/O.
# Related:
# - api/ewa_platform/companion/proactive/soft_initiative.py
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md
# ---
"""Unit tests: companion soft initiative."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.ewa_platform.companion.persona.continuity import CONTINUITY_NS
from api.ewa_platform.companion.proactive.soft_initiative import (
    SOFT_INITIATIVE_NS,
    apply_soft_initiative_to_hint,
    companion_soft_initiative_enabled,
    snooze_soft_initiative_until,
    soft_initiative_allows_hint,
)


def test_soft_initiative_flag_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", raising=False)
    assert companion_soft_initiative_enabled() is False
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", "1")
    assert companion_soft_initiative_enabled() is True


def test_passthrough_when_flag_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", raising=False)
    hint = {"kind": "anticipation", "hint_text": "base tip", "related_episodes": ["ep1"]}
    out, blob = apply_soft_initiative_to_hint({}, hint, title="Doc")
    assert out == hint
    assert blob is None


def test_budget_exhaustion_suppresses_hint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_DAILY_CAP", "2")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_MIN_GAP_MIN", "0")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    profile = {
        "learned_preferences": {
            SOFT_INITIATIVE_NS: {
                "day": now.date().isoformat(),
                "count": 2,
                "last_hint_at": (now - timedelta(hours=2)).isoformat(),
            }
        }
    }
    allowed, reason = soft_initiative_allows_hint(profile, now=now)
    assert allowed is False
    assert reason == "daily_cap"
    out, blob = apply_soft_initiative_to_hint(
        profile,
        {"kind": "anticipation", "hint_text": "x", "related_episodes": []},
        title="Notes",
        now=now,
    )
    assert out is None
    assert blob is None


def test_min_gap_suppresses_hint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_DAILY_CAP", "5")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_MIN_GAP_MIN", "45")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    profile = {
        "learned_preferences": {
            SOFT_INITIATIVE_NS: {
                "day": now.date().isoformat(),
                "count": 0,
                "last_hint_at": (now - timedelta(minutes=10)).isoformat(),
            }
        }
    }
    allowed, reason = soft_initiative_allows_hint(profile, now=now)
    assert allowed is False
    assert reason == "min_gap"


def test_rewrite_partner_tone_and_increment_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_DAILY_CAP", "3")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_MIN_GAP_MIN", "0")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    profile = {
        "learned_preferences": {
            CONTINUITY_NS: {
                "mood_tint": "warm",
                "valence": 0.4,
                "arousal": 0.3,
                "unspoken_notes": ["тот план про презентацию"],
                "updated_at": now.isoformat(),
            }
        }
    }
    hint = {
        "kind": "anticipation",
        "hint_text": "template tip",
        "related_episodes": ["про презентацию"],
    }
    out, blob = apply_soft_initiative_to_hint(
        profile,
        hint,
        title="Презентация",
        now=now,
    )
    assert out is not None
    assert out["kind"] == "soft_initiative"
    assert "Презентация" in out["hint_text"]
    assert "хочешь" in out["hint_text"].lower() or "Хочешь" in out["hint_text"]
    assert blob is not None
    assert blob["count"] == 1
    assert blob["day"] == now.date().isoformat()


def test_snooze_until_blocks_hint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_DAILY_CAP", "5")
    monkeypatch.setenv("EWA_COMPANION_SOFT_INITIATIVE_MIN_GAP_MIN", "0")
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    until = now + timedelta(hours=6)
    blob = snooze_soft_initiative_until({}, until=until)
    profile = {"learned_preferences": {SOFT_INITIATIVE_NS: blob}}
    allowed, reason = soft_initiative_allows_hint(profile, now=now)
    assert allowed is False
    assert reason == "snooze"
