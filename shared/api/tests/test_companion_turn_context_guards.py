# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Guards against side-effect false positives after file-focus turns (e.g. «что думаешь о нём» → music).
# Related:
# - api/ewa_platform/companion/orchestration/turn_context_guards.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.turn_context_guards import user_line_is_file_focus_chat
from api.ewa_platform.companion.sidecar.file_focus import (
    COMPANION_FILE_FOCUS_KEY,
    focus_entry_from_parts,
)


def _profile_with_focus() -> dict:
    uid = "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    return {
        "learned_preferences": {
            COMPANION_FILE_FOCUS_KEY: {
                "stack": [
                    focus_entry_from_parts(
                        unified_content_id=uid,
                        name="notes.md",
                        source="catalog_discuss",
                    ),
                ],
            },
        },
    }


def test_file_focus_opinion_ru_detected() -> None:
    profile = _profile_with_focus()
    line = "что ты думаешь о нём?"
    assert user_line_is_file_focus_chat(line, profile)


def test_file_focus_opinion_en_detected() -> None:
    profile = _profile_with_focus()
    line = "what do you think about it?"
    assert user_line_is_file_focus_chat(line, profile)


def test_music_mood_question_not_file_chat() -> None:
    profile = _profile_with_focus()
    line = "как ты думаешь про песню?"
    assert not user_line_is_file_focus_chat(line, profile)


def test_no_focus_no_file_chat_gate() -> None:
    line = "что ты думаешь о нём?"
    assert not user_line_is_file_focus_chat(line, {})
