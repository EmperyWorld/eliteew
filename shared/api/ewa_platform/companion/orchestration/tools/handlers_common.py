# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Cross-handler helpers shared by desktop/media/ops modules and the ``tool_registry`` shim.
# Invariants:
# - No imports from ``registry_core`` or other ``handlers_*`` modules.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---
"""EWA companion tool registry cross-handler helpers."""

from __future__ import annotations

import re
from typing import Final

_NON_EXECUTION_QUESTION_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)^\s*(?:как|почему|зачем|how|why|what)\b",
)


def _looks_like_non_executing_question(user_line: str) -> bool:
    """True for explanatory/meta questions (``how/why``) that should not trigger side effects."""

    s = str(user_line or "").strip()
    if not s:
        return False
    if "?" not in s and not _NON_EXECUTION_QUESTION_RE.search(s):
        return False
    return _NON_EXECUTION_QUESTION_RE.search(s) is not None


__all__ = ("_looks_like_non_executing_question",)
