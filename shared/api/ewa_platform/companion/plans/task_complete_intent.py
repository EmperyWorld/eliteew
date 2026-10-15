# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Chat utterance gate + task title matching for ``plan_task_complete_v1``.
# Invariants:
# - Requires an active plan with open tasks; never invents task ids.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

_PLAN_TASK_COMPLETE_RE = re.compile(
    r"(?is)"
    r"(?:"
    r"\b(?:отметь|отметить)\s+(?:выполненным|готовым|done|complete)"
    r"|\b(?:шаг|задач\w*|task)\s+.+\s+(?:готов|выполнен|done|completed)\b"
    r"|\b(?:готово|выполнил|сделал|завершил)\b"
    r"|\bmark\s+(?:as\s+)?(?:done|complete|finished)\b"
    r"|\bcheck\s+off\b"
    r")",
)


def user_line_requests_plan_task_complete(user_line: str) -> bool:
    return bool(_PLAN_TASK_COMPLETE_RE.search((user_line or "").strip()))


def task_title_needle_from_user_line(user_line: str) -> str:
    """Best-effort substring to match an open plan task title."""

    for pat in (
        r"(?is)(?:отметь\s+(?:выполненным|готовым)\s*[:—-]?\s*)(.+)$",
        r"(?is)(?:mark\s+(?:as\s+)?(?:done|complete|finished)\s*[:—-]?\s*)(.+)$",
        r"(?is)(?:шаг\s+)(.+?)(?:\s+готов|\s+выполнен|$)",
        r"[«\"']([^«»\"']{3,120})[»\"']",
    ):
        m = re.search(pat, user_line.strip())
        if m:
            return m.group(1).strip()[:120]
    return user_line.strip()[:80]


def match_open_plan_task(
    open_tasks: list[Mapping[str, Any]],
    user_line: str,
) -> Mapping[str, Any] | None:
    if not open_tasks:
        return None
    needle = task_title_needle_from_user_line(user_line).lower()
    if needle:
        for task in open_tasks:
            title = str(task.get("title") or "").lower()
            if needle in title or title in needle:
                return task
    if len(open_tasks) == 1:
        return open_tasks[0]
    return None


__all__ = (
    "match_open_plan_task",
    "task_title_needle_from_user_line",
    "user_line_requests_plan_task_complete",
)
