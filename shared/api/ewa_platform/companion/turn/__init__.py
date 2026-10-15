# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Turn** subpackage: synchronous + SSE companion chat entrypoints and helpers (canonical ``chat_turn`` module).
# Invariants:
# - HTTP routers may import ``api.ewa_platform.companion.turn.chat_turn`` (shim) or ``.turn.chat_turn`` directly.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Companion chat **turn** layer (canonical implementation under ``turn/chat_turn``)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.ewa_platform.companion.turn.chat_turn import (
        execute_companion_chat_message,
        iter_companion_chat_stream,
    )

__all__: tuple[str, ...] = ("execute_companion_chat_message", "iter_companion_chat_stream")


def __getattr__(name: str):
    if name == "execute_companion_chat_message":
        from api.ewa_platform.companion.turn.chat_turn import execute_companion_chat_message

        return execute_companion_chat_message
    if name == "iter_companion_chat_stream":
        from api.ewa_platform.companion.turn.chat_turn import iter_companion_chat_stream

        return iter_companion_chat_stream
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
