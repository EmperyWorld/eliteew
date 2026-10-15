# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression checks for hostile Arlika guardrails in companion chat turn processing:
# (1) no auto-ambient desktop mutations from affective warmth, and
# (2) no warm/polite tone drift on small-talk gratitude/apology replies.
# Invariants:
# - Pure unit tests; no DB/HTTP/driver I/O.
# - Guard logic is deterministic and only tightens hostile Arlika (`seed=arlika`) behaviour.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/worklog/2026-05.md
# ---
"""Tests for hostile Arlika ambient/tone guards in companion chat_turn."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from api.ewa_platform.companion.turn import chat_turn


def test_auto_ambient_not_injected_for_arlika(monkeypatch: Any) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_AUTO_AMBIENT_FROM_AFFECTIVE", "1")
    routing = SimpleNamespace(mood="warm", suggested_ambient="ambient_warm_soft")
    out = chat_turn._prepend_auto_ambient_from_affective([], routing, persona_seed="arlika")
    assert out == []


def test_auto_ambient_injected_for_non_arlika_when_enabled(monkeypatch: Any) -> None:
    class _Style:
        action_propensity = {"ambient_adjust": 0.95}

    monkeypatch.setenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_AUTO_AMBIENT_FROM_AFFECTIVE", "1")
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.turn_action_prelude.get_persona_style",
        lambda _seed: _Style(),
    )
    routing = SimpleNamespace(mood="warm", suggested_ambient="ambient_warm_soft")
    out = chat_turn._prepend_auto_ambient_from_affective([], routing, persona_seed="mela")
    assert out and out[0].get("type") == "ambient_adjust"
    assert out[0].get("mood") == "warm"


def test_arlika_tone_guard_appends_edge_for_soft_thanks() -> None:
    reply = "Спасибо, мне приятно это слышать."
    out = chat_turn._enforce_arlika_hostile_tone_guard(
        reply,
        user_line="Спасибо!",
        actions=[],
        persona_seed="arlika",
    )
    assert "индульгенцией" in out


def test_arlika_tone_guard_keeps_reply_when_edge_already_present() -> None:
    reply = "Ой конечно, детский сад устроил — не расслабляйся."
    out = chat_turn._enforce_arlika_hostile_tone_guard(
        reply,
        user_line="Спасибо!",
        actions=[],
        persona_seed="arlika",
    )
    assert out == reply


def test_arlika_tone_guard_skips_task_like_turn_with_actions() -> None:
    reply = "Спасибо, сделала."
    out = chat_turn._enforce_arlika_hostile_tone_guard(
        reply,
        user_line="Открой плеер",
        actions=[{"type": "open_app", "app_component": "MusicPlayer"}],
        persona_seed="arlika",
    )
    assert out == reply
