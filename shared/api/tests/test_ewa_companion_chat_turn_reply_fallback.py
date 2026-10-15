# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for companion chat visible-reply coercion when the LLM returns action-only or empty markdown-fence
# content; users must still see a short acknowledgement for file/app operations.
# Invariants:
# - Pure unit tests: no Postgres, HTTP LLM, or desktop side effects.
# - Action-aware fallbacks must preserve the requested operation in prose instead of generic empty-reply text.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Tests: companion visible reply fallback for action-only turns."""

from __future__ import annotations

from api.ewa_platform.companion.turn.chat_turn import _coerce_visible_reply_for_turn


def test_blank_markdown_fence_doceditor_action_gets_visible_ack() -> None:
    reply = _coerce_visible_reply_for_turn(
        "```\n\n```",
        user_line="открой первый файл в редакторе",
        actions=[
            {
                "type": "open_app",
                "app_component": "DocEditor",
                "unified_content_id": "11111111-1111-1111-1111-111111111111",
            }
        ],
    )
    assert reply == "Открыла файл в редакторе."


def test_blank_markdown_fence_content_manager_action_gets_visible_ack() -> None:
    reply = _coerce_visible_reply_for_turn(
        "```markdown\n```",
        user_line="show my files",
        actions=[{"type": "open_app", "app_component": "ContentManagerPro"}],
    )
    assert reply == "Opening the file catalogue."


def test_non_blank_reply_is_preserved() -> None:
    reply = _coerce_visible_reply_for_turn(
        "Открываю, секунду.",
        user_line="открой первый файл в редакторе",
        actions=[{"type": "open_app", "app_component": "DocEditor"}],
    )
    assert reply == "Открываю, секунду."
