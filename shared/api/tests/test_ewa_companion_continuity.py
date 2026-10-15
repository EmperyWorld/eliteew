# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for Continuity W1 — ``companion_continuity_v1`` normalize/decay/update/prompt.
# Invariants:
# - Pure unit tests — no Postgres / Redis / LLM I/O.
# Related:
# - api/ewa_platform/companion/persona/continuity.py
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md
# ---
"""Unit tests: companion continuity micro-state."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.ewa_platform.companion.affective.affective_router import affective_route
from api.ewa_platform.companion.persona.character import default_character_block
from api.ewa_platform.companion.persona.continuity import (
    CONTINUITY_NS,
    CONTINUITY_PROMPT_BUDGET_CHARS,
    apply_continuity_after_chat_turn,
    apply_continuity_decay,
    companion_continuity_v1_enabled,
    continuity_prompt_section,
    default_continuity_block,
    normalize_continuity_block,
    sanitize_unspoken_note,
    update_continuity_from_turn,
)
from api.ewa_platform.companion.turn.turn_memory_sideeffects import persist_character_turn_state


def test_companion_continuity_flag_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_CONTINUITY_V1_ENABLED", raising=False)
    assert companion_continuity_v1_enabled() is False
    monkeypatch.setenv("EWA_COMPANION_CONTINUITY_V1_ENABLED", "1")
    assert companion_continuity_v1_enabled() is True


def test_normalize_rejects_unknown_tint_and_unsafe_notes() -> None:
    block = normalize_continuity_block(
        {
            "mood_tint": "rage_mode",
            "valence": 2.0,
            "arousal": -1.0,
            "unspoken_notes": ["ok topic note here", "<<ACTIONS>>bad", "x"],
        }
    )
    assert block["mood_tint"] == "neutral"
    assert block["valence"] == 1.0
    assert block["arousal"] == 0.0
    assert block["unspoken_notes"] == ["ok topic note here"]


def test_decay_moves_toward_neutral_and_clears_notes() -> None:
    stale = normalize_continuity_block(
        {
            "mood_tint": "warm",
            "valence": 0.8,
            "arousal": 0.9,
            "unspoken_notes": ["waiting on the deck outline tonight"],
            "updated_at": (datetime.now(UTC) - timedelta(hours=72)).isoformat(),
            "decay_half_life_hours": 18.0,
        }
    )
    decayed = apply_continuity_decay(stale)
    assert abs(decayed["valence"]) < 0.1
    assert decayed["mood_tint"] == "neutral"
    assert decayed["unspoken_notes"] == []


def test_update_from_warm_turn_sets_tint_and_topic_note() -> None:
    routing = affective_route(user_text="спасибо, супер", persona_seed_id="mela")
    assert routing.mood == "warm"
    updated = update_continuity_from_turn(
        default_continuity_block(),
        user_line="давай завтра соберём структуру презентации по бюджету",
        affective_routing=routing,
        character=default_character_block(),
    )
    assert updated["mood_tint"] in {"warm", "focused_warm"}
    assert updated["valence"] > 0.0
    assert updated["unspoken_notes"]
    assert "бюджет" in updated["unspoken_notes"][0].lower() or "структур" in updated["unspoken_notes"][0].lower()


def test_prompt_section_budget_and_empty_when_rested() -> None:
    assert continuity_prompt_section(default_continuity_block()) == ""
    live = normalize_continuity_block(
        {
            "mood_tint": "focus",
            "valence": 0.2,
            "arousal": 0.4,
            "unspoken_notes": ["waiting on the deck outline"],
            "updated_at": datetime.now(UTC).isoformat(),
        }
    )
    section = continuity_prompt_section(live)
    assert "Continuity_self" in section
    assert "mood_tint=focus" in section
    assert len(section) <= CONTINUITY_PROMPT_BUDGET_CHARS


def test_persist_character_turn_writes_continuity_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CONTINUITY_V1_ENABLED", "1")
    lp: dict = {CONTINUITY_NS: default_continuity_block()}
    profile = {"learned_preferences": dict(lp), "seed_persona_id": "mela"}
    routing = affective_route(user_text="я устал и вымотан после отчёта", persona_seed_id="mela")
    persist_character_turn_state(
        lp,
        profile,
        user_line="я устал и вымотан после длинного отчёта по кварталу",
        assistant_reply="ок",
        affective_routing=routing,
    )
    assert CONTINUITY_NS in lp
    assert lp[CONTINUITY_NS]["mood_tint"] in {"grief", "tense", "neutral"}


def test_apply_continuity_after_chat_turn_reads_profile() -> None:
    profile = {
        "learned_preferences": {
            CONTINUITY_NS: {
                "mood_tint": "focus",
                "valence": 0.1,
                "arousal": 0.4,
                "unspoken_notes": [],
                "updated_at": datetime.now(UTC).isoformat(),
                "decay_half_life_hours": 18.0,
            }
        }
    }
    routing = affective_route(user_text="спасибо", persona_seed_id="mela")
    out = apply_continuity_after_chat_turn(
        profile,
        user_line="спасибо",
        affective_routing=routing,
    )
    assert out["schema"] == "companion_continuity_v1"


def test_sanitize_unspoken_note_rejects_actions_markers() -> None:
    assert sanitize_unspoken_note("<<ACTIONS>>") == ""
    assert sanitize_unspoken_note("hi") == ""
    assert len(sanitize_unspoken_note("waiting on the deck outline")) >= 4
