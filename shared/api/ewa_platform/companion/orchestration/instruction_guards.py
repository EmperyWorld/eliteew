# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared negative gates for companion regex tool routing — avoid music/plan false positives on meta-instructions.
# Invariants:
# - Pure string heuristics; no I/O.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/plans/intent.py
# ---

from __future__ import annotations

import re

_MEMORY_PLAN_META_RE = re.compile(
    r"(?ix)"
    r"\b(?:запомни|запомнить|remember)\b"
    r"|"
    r"\b(?:внеси|внести)\s+изменени"
    r"|"
    r"\b(?:не\s+)?(?:повторя(?:й|ть)|repeat)\b.{0,48}\b(?:задач|tasks)\b"
    r"|"
    r"\bстатус\s+прогресс\b"
    r"|"
    r"\b(?:текущ(?:ие|ая|ую))\s+задач"
)


def user_line_is_memory_or_plan_meta_instruction(user_line: str) -> bool:
    """True when the line adjusts memory/plan behaviour — not music generation."""

    u = (user_line or "").strip()
    if not u:
        return False
    return bool(_MEMORY_PLAN_META_RE.search(u))


__all__ = ("user_line_is_memory_or_plan_meta_instruction",)
