# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared heuristics for short greeting / mood lines without a concrete desk task — used by output guards and
# orchestration fast-path skips (tool router, branch probes).
# Invariants:
# - Conservative: long lines (>88 chars) never classify as trivial chit-chat.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/orchestration/branch_line_gates.py
# ---

from __future__ import annotations


def is_trivial_chit_chat_user_line(line: str) -> bool:
    """Short greeting / mood without concrete task."""

    s = (line or "").strip()
    if len(s) > 88:
        return False
    low = s.lower()
    keys = (
        "привет",
        "здравствуй",
        "hello",
        "hi ",
        "hey ",
        "как дела",
        "как ты",
        "how are you",
        "что нового",
        "sup ",
        "доброе утро",
        "good morning",
    )
    return any(k in low for k in keys)


__all__ = ("is_trivial_chit_chat_user_line",)
