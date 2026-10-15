# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract guard for **SSE companion chat**: when the HTTP stream leaves ``reply_visible_raw`` empty but
# ``_coerce_visible_reply_for_turn`` injects fallback prose, ``_blankish_visible_reply(reply)`` is **false** — the stream
# layer must still emit a terminal ``delta`` (see ``companion_visible_delta_recovery`` in ``chat_turn.py``).
# Invariants:
# - No I/O; only pure helpers imported from ``chat_turn``.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Contract: visible fallback vs blankish predicate (SSE delta recovery)."""

from __future__ import annotations

from api.ewa_platform.companion.turn.chat_turn import _blankish_visible_reply, _coerce_visible_reply_for_turn


def test_empty_raw_visible_yields_non_blankish_fallback_for_stream_delta() -> None:
    """Regression: empty extract + no actions must still produce user-visible text (non-blankish after coerce)."""

    reply = _coerce_visible_reply_for_turn(
        "",
        user_line="Здравствуйте, как дела?",
        actions=[],
        shell_norm=None,
        catalog_appendix="",
        desktop_config_patch_applied=False,
    )
    assert reply.strip()
    assert not _blankish_visible_reply(reply)
