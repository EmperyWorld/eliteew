# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compact system-prompt block for the user's personal CalendarApp events.
# Invariants:
# - Times are shown in operator wall-clock TZ; storage remains UTC.
# - Empty list is explicit so the model must not invent events.
# Related:
# - api/utils/llm_wall_clock_context.py
# - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
# ---
"""Format upcoming personal calendar rows for the companion system prompt."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from api.utils.llm_wall_clock_context import resolve_wall_clock_timezone, wall_clock_snapshot

_PROMPT_EVENT_CAP = 12


def _sanitize_prompt_label(raw: str) -> str:
    collapsed = " ".join(str(raw or "").split())
    return collapsed[:200] or "(untitled)"


def format_user_calendar_unavailable_block() -> str:
    """Prompt when personal calendar could not be read — never pretend the day is empty."""

    snap = wall_clock_snapshot()
    return (
        "User_calendar (authoritative personal events from CalendarApp, not assistant-plan steps):\n"
        f"local_timezone={snap.tz_name} now_local={snap.iso_local}\n"
        "(calendar unread — personal events could not be loaded this turn)\n"
        "Do not invent events. Do not say the calendar is empty. Offer to retry or open CalendarApp.\n"
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def format_user_calendar_prompt_block(
    events: Sequence[Mapping[str, Any]] | None,
    *,
    now: datetime | None = None,
) -> str:
    """Authoritative personal-calendar digest for the main companion LLM."""

    snap = wall_clock_snapshot(now=now)
    tz = resolve_wall_clock_timezone()
    lines = [
        "User_calendar (authoritative personal events from CalendarApp, not assistant-plan steps):",
        f"local_timezone={snap.tz_name} now_local={snap.iso_local}",
    ]
    rows = [row for row in (events or []) if isinstance(row, Mapping)][:_PROMPT_EVENT_CAP]
    if not rows:
        lines.append("(no personal events in the next 7 days)")
        lines.append(
            "Do not invent events. If the user asks what they have today, say the calendar is clear "
            "and offer to add an event or help with the active assistant plan."
        )
        return "\n".join(lines) + "\n"

    soonest_today = False
    for row in rows:
        title = _sanitize_prompt_label(str(row.get("title") or ""))
        starts_raw = row.get("starts_at")
        ends_raw = row.get("ends_at")
        all_day = bool(row.get("all_day"))
        if not isinstance(starts_raw, datetime) or not isinstance(ends_raw, datetime):
            lines.append(f"- {title}")
            continue
        start_local = _as_utc(starts_raw).astimezone(tz)
        end_local = _as_utc(ends_raw).astimezone(tz)
        if all_day:
            lines.append(f"- {start_local.date().isoformat()} all-day {title}")
        else:
            lines.append(f"- {start_local.strftime('%Y-%m-%d %H:%M')}–{end_local.strftime('%H:%M')} {title}")
        if start_local.date() == snap.local_dt.date():
            soonest_today = True

    lines.append(
        "Speak times in this local timezone. Do not invent extra events. Active_user_plan steps are a separate SoT."
    )
    if soonest_today:
        lines.append(
            "If today has a personal event, mention the next one naturally and offer one concrete help "
            "(prepare, reschedule, notes). Do not nag if the user already discussed it this turn."
        )
    else:
        lines.append(
            "If the next personal event is tomorrow or later, mention it only when relevant "
            "or when greeting / asking about the day."
        )
    return "\n".join(lines) + "\n"


__all__ = (
    "format_user_calendar_prompt_block",
    "format_user_calendar_unavailable_block",
)
