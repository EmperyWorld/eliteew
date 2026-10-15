# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for Contemplation W2 — presence mode + observation hint suppress contract.
# Invariants:
# - Pure unit tests for helpers; observation suppress exercised via mode helpers.
# Related:
# - api/ewa_platform/companion/ux/presence_mode.py
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md
# ---
"""Unit tests: companion presence / contemplation mode."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.ux.presence_mode import (
    PRESENCE_NS,
    companion_contemplation_enabled,
    get_presence_mode,
    is_contemplation_active,
    merge_presence_mode_into_learned_preferences,
)
from api.ewa_platform.schemas.pydantic.companion_observation import CompanionObservationOut


def test_contemplation_flag_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_CONTEMPLATION_ENABLED", raising=False)
    assert companion_contemplation_enabled() is False
    monkeypatch.setenv("EWA_COMPANION_CONTEMPLATION_ENABLED", "1")
    assert companion_contemplation_enabled() is True


def test_get_presence_mode_defaults_chat() -> None:
    assert get_presence_mode(None) == "chat"
    assert get_presence_mode({"learned_preferences": {}}) == "chat"
    assert get_presence_mode({"learned_preferences": {PRESENCE_NS: {"mode": "contemplation"}}}) == "contemplation"


def test_is_contemplation_active_requires_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    profile = {"learned_preferences": {PRESENCE_NS: {"mode": "contemplation"}}}
    monkeypatch.delenv("EWA_COMPANION_CONTEMPLATION_ENABLED", raising=False)
    assert is_contemplation_active(profile) is False
    monkeypatch.setenv("EWA_COMPANION_CONTEMPLATION_ENABLED", "1")
    assert is_contemplation_active(profile) is True


def test_merge_presence_mode_into_lp() -> None:
    lp = merge_presence_mode_into_learned_preferences({}, "contemplation")
    assert lp[PRESENCE_NS]["mode"] == "contemplation"
    lp2 = merge_presence_mode_into_learned_preferences(lp, "nope")
    assert lp2[PRESENCE_NS]["mode"] == "chat"


def test_observation_out_presence_schema() -> None:
    out = CompanionObservationOut(
        ok=True,
        accepted=True,
        hint=None,
        episode_recorded=True,
        presence={
            "mode": "contemplation",
            "continuity_applied": False,
            "hint_suppressed_reason": "contemplation",
        },
    )
    assert out.hint is None
    assert out.presence is not None
    assert out.presence.hint_suppressed_reason == "contemplation"
