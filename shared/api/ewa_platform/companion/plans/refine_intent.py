# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Intent gates for plan **refinement** when an active plan already exists.
# Related:
# - api/ewa_platform/companion/plans/intent.py
# - api/ewa_platform/companion/orchestration/tools/handlers_ops.py
# ---

from __future__ import annotations

import re

from api.ewa_platform.companion.plans.schedule import line_has_schedule_signal

_PLAN_REFINE_RE = re.compile(
    r"(?is)"
    r"(?:"
    r"график|спринт\w*|утверди|зафиксируй|принят\s+в\s+работ|приступай"
    r"|(?:да|нет|именно|ладно|хорошо)[,.\s]+"
    r"|daily\s+schedule|update\s+the\s+plan|refine\s+the\s+plan"
    r")"
)


def user_line_requests_plan_refine(user_line: str) -> bool:
    """True when the user adjusts an existing plan (schedule, confirmation, date window)."""

    u = (user_line or "").strip()
    if len(u) < 6:
        return False
    if line_has_schedule_signal(u):
        return True
    return bool(_PLAN_REFINE_RE.search(u))


__all__ = ("user_line_requests_plan_refine",)
