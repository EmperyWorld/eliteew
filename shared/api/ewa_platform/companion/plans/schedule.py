# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Deterministic date-range and daily-sprint plan structures (no LLM required).
# Invariants:
# - Parsed due_date years clamp to a sane window around ``reference_today``.
# - Returns None when the line lacks a recognizable schedule signal.
# Related:
# - api/ewa_platform/companion/plans/service.py
# ---

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from api.ewa_platform.companion.plans.time import parse_clock_time_fragment, parse_plan_time_adjustment
from api.ewa_platform.companion.plans.topic import extract_plan_topic_from_user_line

_RU_MONTHS: dict[str, int] = {
    "январ": 1,
    "феврал": 2,
    "март": 3,
    "апрел": 4,
    "ма": 5,
    "июн": 6,
    "июл": 7,
    "август": 8,
    "сентябр": 9,
    "октябр": 10,
    "ноябр": 11,
    "декабр": 12,
}

_EN_MONTHS: dict[str, int] = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

_REFINE_LEADING_RE = re.compile(
    r"(?is)^(?:"
    r"нет[,.\s]+(?:просто\s+)?"
    r"|да[,.\s]+"
    r"|именно\s+"
    r"|ок[,.\s]+"
    r"|ладно[,.\s]+"
    r"|хорошо[,.\s]+"
    r")+"
)

_DAILY_SIGNAL_RE = re.compile(
    r"(?is)"
    r"(?:кажд\w*\s+день|ежедневн\w*|per\s+day|each\s+day|daily\s+sprint|спринт\w*)"
)

_DATE_TOKEN_RE = re.compile(
    r"(?is)"
    r"(?:(\d{1,2})\s*(январ\w*|феврал\w*|март\w*|апрел\w*|ма[йя]\w*|июн\w*|июл\w*|"
    r"август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*|"
    r"jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*))"
    r"|"
    r"(?:сегодня|today)"
)

_RANGE_END_RE = re.compile(
    r"(?is)(?:по|до|until|through)\s+(?:(\d{1,2})\s*(январ\w*|феврал\w*|март\w*|апрел\w*|"
    r"ма[йя]\w*|июн\w*|июл\w*|август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*|"
    r"jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)|"
    r"(сегодня|today))"
)

_RANGE_START_RE = re.compile(
    r"(?is)(?:"
    r"(?:с|from)\s+(?:сегодняшн\w*\s+дат\w*|сегодня|today)"
    r"|"
    r"(?:с|from)\s+(\d{1,2})\s*(январ\w*|феврал\w*|март\w*|апрел\w*|ма[йя]\w*|июн\w*|"
    r"июл\w*|август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*|"
    r"jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)"
    r")"
)

_RESEARCH_SIGNAL_RE = re.compile(r"(?is)(?:исследован\w*|research|study|обзор|анализ)")


def _month_from_token(token: str) -> int | None:
    lower = (token or "").strip().lower()
    for prefix, month in _RU_MONTHS.items():
        if lower.startswith(prefix):
            return month
    for prefix, month in _EN_MONTHS.items():
        if lower.startswith(prefix):
            return month
    return None


def _clamp_plan_year(day: int, month: int, *, reference: date) -> date:
    year = reference.year
    candidate = date(year, month, day)
    if candidate < reference - timedelta(days=400):
        candidate = date(year + 1, month, day)
    elif candidate > reference + timedelta(days=400):
        candidate = date(year - 1, month, day)
    return candidate


def parse_ru_date_fragment(fragment: str, *, reference_today: date | None = None) -> date | None:
    """Parse ``19 августа`` / ``today`` into a calendar date."""

    ref = reference_today or date.today()
    text = (fragment or "").strip()
    if not text:
        return None
    lower = text.lower()
    if lower in {"сегодня", "today"}:
        return ref
    m = re.search(
        r"(?is)(\d{1,2})\s*(январ\w*|феврал\w*|март\w*|апрел\w*|ма[йя]\w*|июн\w*|июл\w*|"
        r"август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*|"
        r"jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)",
        text,
    )
    if not m:
        return None
    day = int(m.group(1))
    month = _month_from_token(m.group(2))
    if month is None or not 1 <= day <= 31:
        return None
    return _clamp_plan_year(day, month, reference=ref)


def parse_plan_date_range(user_line: str, *, reference_today: date | None = None) -> tuple[date, date] | None:
    """Return inclusive (start, end) when the user names a from/to window."""

    ref = reference_today or date.today()
    line = user_line or ""
    end_m = _RANGE_END_RE.search(line)
    if not end_m:
        return None
    if end_m.group(1) and end_m.group(2):
        end_day = parse_ru_date_fragment(f"{end_m.group(1)} {end_m.group(2)}", reference_today=ref)
    else:
        end_day = ref
    if end_day is None:
        return None

    start_m = _RANGE_START_RE.search(line)
    if start_m:
        if start_m.group(1) and start_m.group(2):
            start_day = parse_ru_date_fragment(f"{start_m.group(1)} {start_m.group(2)}", reference_today=ref)
        else:
            start_day = ref
    else:
        tokens = list(_DATE_TOKEN_RE.finditer(line))
        if len(tokens) >= 2 and tokens[0].group(1) and tokens[0].group(2):
            start_day = parse_ru_date_fragment(f"{tokens[0].group(1)} {tokens[0].group(2)}", reference_today=ref)
        else:
            start_day = ref
    if start_day is None:
        return None
    if end_day < start_day:
        start_day, end_day = end_day, start_day
    if (end_day - start_day).days > 62:
        return None
    return start_day, end_day


def line_has_schedule_signal(user_line: str) -> bool:
    u = (user_line or "").strip()
    if not u:
        return False
    if _DAILY_SIGNAL_RE.search(u):
        return True
    return parse_plan_date_range(u) is not None


def _schedule_topic_label(user_line: str) -> str:
    cleaned = _REFINE_LEADING_RE.sub("", user_line or "").strip()
    topic = extract_plan_topic_from_user_line(cleaned)
    topic = re.sub(r"(?is)^(?:нет|да|просто)\b", "", topic).strip(" ,.—–-")
    if len(topic) >= 8:
        return topic[:120]
    if _RESEARCH_SIGNAL_RE.search(user_line or ""):
        return "Исследование"
    return "Задачи"


def _daily_task_title(*, day: date, topic: str, research: bool, locale_ru: bool) -> str:
    if research:
        if locale_ru:
            return f"{day.strftime('%d.%m')}: исследование — {topic} + выводы"
        return f"{day.strftime('%d.%m')}: research — {topic} + conclusions"
    if locale_ru:
        return f"{day.strftime('%d.%m')}: {topic}"
    return f"{day.strftime('%d.%m')}: {topic}"


def try_daily_sprint_schedule_structure(
    user_line: str,
    *,
    reference_today: date | None = None,
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]] | None:
    """Build one task per day when the user names a date window and daily work."""

    ref = reference_today or date.today()
    line = user_line or ""
    if not line_has_schedule_signal(line):
        return None
    date_range = parse_plan_date_range(line, reference_today=ref)
    if date_range is None:
        return None
    start, end = date_range
    topic = _schedule_topic_label(line)
    research = bool(_RESEARCH_SIGNAL_RE.search(line))
    locale_ru = any("\u0400" <= ch <= "\u04ff" for ch in line)
    title = f"{topic} ({start.isoformat()} — {end.isoformat()})"
    goals = [
        {
            "title": topic[:200],
            "category": "research" if research else "general",
            "sort_order": 0,
        }
    ]
    tasks: list[dict[str, Any]] = []
    day = start
    sort_order = 0
    while day <= end:
        tasks.append(
            {
                "title": _daily_task_title(day=day, topic=topic, research=research, locale_ru=locale_ru)[:200],
                "description": topic,
                "goal_index": 0,
                "sort_order": sort_order,
                "due_date": day.isoformat(),
            }
        )
        day += timedelta(days=1)
        sort_order += 1
    if not tasks:
        return None
    time_adj = parse_plan_time_adjustment(line)
    if time_adj is None:
        clock = parse_clock_time_fragment(line)
        if clock is not None:
            from api.ewa_platform.companion.plans.time import PlanTimeAdjustment

            time_adj = PlanTimeAdjustment(due_time=clock, duration_minutes=60, scope="all")
    if time_adj is not None:
        due_time_str = time_adj.due_time.strftime("%H:%M")
        for task in tasks:
            task["due_time"] = due_time_str
            task["due_duration_minutes"] = time_adj.duration_minutes
    return title, goals, tasks


__all__ = (
    "line_has_schedule_signal",
    "parse_plan_date_range",
    "parse_ru_date_fragment",
    "try_daily_sprint_schedule_structure",
)
