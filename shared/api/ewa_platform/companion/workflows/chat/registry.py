# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Chat LLM workflow identifiers and line-matching (reflect_week, etc.) — **no durable task steps**.
# Related:
# - api/ewa_platform/companion/workflows/chat/runner.py
# - api/ewa_platform/companion/workflows/action/ (multi-step tool cycles, WF-1+)
# ---

from __future__ import annotations

import re
from enum import StrEnum

_REFLECT_WEEK_RE = re.compile(
    r"(?is)"
    r"(?:\bподвед(?:и|ите)\s+итог(?:и)?\s+недел\w*"
    r"|\bитоги\s+недел\w*"
    r"|\bweekly\s+review\b"
    r"|\breflect\s+on\s+(?:the\s+)?week\b)",
)


class WorkflowId(StrEnum):
    PLAN_MONTH = "plan_month"
    REFLECT_WEEK = "reflect_week"
    FILE_FOCUS = "file_focus"


def match_workflow_id(user_line: str) -> WorkflowId | None:
    u = (user_line or "").strip()
    if not u:
        return None
    if _REFLECT_WEEK_RE.search(u):
        return WorkflowId.REFLECT_WEEK
    return None


__all__ = ("WorkflowId", "match_workflow_id")
