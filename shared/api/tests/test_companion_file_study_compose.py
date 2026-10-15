# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for file study → in-chat lyrics compose (music suppression).
# Invariants:
# - No asyncpg / HTTP.
# Related:
# - api/ewa_platform/companion/orchestration/file_study_compose.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.file_study_compose import (
    _music_tool_for_clause,
    user_line_is_file_study_compose_turn,
)
from api.ewa_platform.companion.orchestration.turn_context_guards import (
    side_effect_tools_suppressed_for_turn,
)

_UC = "00000000-0000-4000-8000-000000000001"


def test_file_study_compose_detects_analyze_and_lyrics() -> None:
    profile = {
        "learned_preferences": {
            "companion_file_focus_v1": {
                "stack": [{"name": "notes.md", "unified_content_id": _UC, "source": "catalog_discuss"}],
            },
        },
    }
    line = "проанализируй, сделай выводы и напиши самой текст песни на эту тему"
    assert user_line_is_file_study_compose_turn(line, profile)


def test_file_study_compose_suppresses_side_effects() -> None:
    profile = {
        "learned_preferences": {
            "companion_file_focus_v1": {
                "stack": [{"name": "notes.md", "unified_content_id": _UC, "source": "catalog_discuss"}],
            },
        },
    }
    line = "проанализируй документ и напиши сама текст песни"
    assert side_effect_tools_suppressed_for_turn(line, profile)


def test_file_study_compose_with_followup_music_generation_is_detected() -> None:
    profile = {
        "learned_preferences": {
            "companion_file_focus_v1": {
                "stack": [{"name": "notes.md", "unified_content_id": _UC, "source": "catalog_discuss"}],
            },
        },
    }
    line = "проанализируй документ, сделай выводы и напиши сама текст песни, потом сгенерируй песню"
    assert user_line_is_file_study_compose_turn(line, profile)
    assert side_effect_tools_suppressed_for_turn(line, profile)


def test_explicit_audio_generation_not_file_study_compose() -> None:
    line = "прочитай notes.md и сгенерируй песню"
    assert not user_line_is_file_study_compose_turn(line, None)


def test_followup_music_tool_selection() -> None:
    assert _music_tool_for_clause("потом сгенерируй песню сама") == "music_generation_xl_base"
    assert _music_tool_for_clause("потом сгенерируй песню") == "music_generation"
