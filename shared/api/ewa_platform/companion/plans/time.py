# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Parse local wall-clock time adjustments for companion plan tasks.
# Related:
# - api/ewa_platform/companion/plans/service.py
# ---

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import time
from typing import Literal

_SCOPE_TODAY_RE = re.compile(r"(?is)\b(?:сегодня|today|на\s+сегодня)\b")

_TIME_AT_RE = re.compile(
    r"(?is)"
    r"(?:"
    r"(?:на|в|at)\s*(\d{1,2})[:.](\d{2})"
    r"|"
    r"\b(\d{1,2})[:.](\d{2})\s*(?:утра|вечера|am|pm)?"
    r")"
)

_TIME_RANGE_RE = re.compile(
    r"(?is)"
    r"(?:с|from)\s*(\d{1,2})[:.](\d{2})\s*(?:до|until|–|-)\s*(\d{1,2})[:.](\d{2})"
)

_PLAN_TIME_ADJUST_RE = re.compile(
    r"(?is)"
    r"(?:"
    r"(?:исправ|поменя|измен|скоррект|перенес|сдвин|назнач|постав|обнов|fix|change|update|adjust)"
    r".{0,48}(?:время|time|час\w*)"
    r"|"
    r"(?:время|time).{0,32}(?:исправ|поменя|измен|скоррект|fix|change|update|adjust)"
    r")"
)


@dataclass(frozen=True)
class PlanTimeAdjustment:
    due_time: time
    duration_minutes: int
    scope: Literal["all", "today"]


def _clamp_hour_minute(hour: int, minute: int) -> time | None:
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        return None
    return time(hour=hour, minute=minute)


def _minutes_between(start: time, end: time) -> int:
    start_m = start.hour * 60 + start.minute
    end_m = end.hour * 60 + end.minute
    if end_m <= start_m:
        end_m += 24 * 60
    return max(15, min(end_m - start_m, 12 * 60))


def parse_clock_time_fragment(text: str) -> time | None:
    m = _TIME_AT_RE.search(text or "")
    if not m:
        return None
    hour = m.group(1) or m.group(3)
    minute = m.group(2) or m.group(4)
    if hour is None or minute is None:
        return None
    return _clamp_hour_minute(int(hour), int(minute))


def parse_plan_time_adjustment(user_line: str) -> PlanTimeAdjustment | None:
    """Extract a local start time (+ optional duration) from a refinement line."""

    line = user_line or ""
    scope: Literal["all", "today"] = "today" if _SCOPE_TODAY_RE.search(line) else "all"
    range_m = _TIME_RANGE_RE.search(line)
    if range_m:
        start = _clamp_hour_minute(int(range_m.group(1)), int(range_m.group(2)))
        end = _clamp_hour_minute(int(range_m.group(3)), int(range_m.group(4)))
        if start is None or end is None:
            return None
        return PlanTimeAdjustment(
            due_time=start,
            duration_minutes=_minutes_between(start, end),
            scope=scope,
        )
    due_time = parse_clock_time_fragment(line)
    if due_time is None:
        return None
    return PlanTimeAdjustment(due_time=due_time, duration_minutes=60, scope=scope)


def user_line_requests_plan_time_adjustment(user_line: str) -> bool:
    u = (user_line or "").strip()
    if len(u) < 6:
        return False
    if _PLAN_TIME_ADJUST_RE.search(u):
        return True
    return parse_plan_time_adjustment(u) is not None


def parse_due_time_string(raw: object) -> time | None:
    if isinstance(raw, time):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return None
    text = raw.strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            from datetime import datetime

            parsed = datetime.strptime(text[:8], fmt)
            return parsed.time().replace(second=0, microsecond=0)
        except ValueError:
            continue
    return parse_clock_time_fragment(text)


__all__ = (
    "PlanTimeAdjustment",
    "parse_clock_time_fragment",
    "parse_due_time_string",
    "parse_plan_time_adjustment",
    "user_line_requests_plan_time_adjustment",
)
