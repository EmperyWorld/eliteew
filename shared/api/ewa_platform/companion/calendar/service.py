# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# asyncpg access to personal ``desktop_calendar_events`` for companion prompt/tool paths.
# Invariants:
# - Rows are owner-scoped by ``users.id`` (same UUID as companion ``principal_id`` when OAuth id matches).
# - Create validates through CalendarApp policy; times are interpreted in operator wall-clock TZ.
# Related:
# - api/services/desktop_calendar_policy.py
# - api/models/desktop.py (DesktopCalendarEvent)
# ---
"""List/create personal CalendarApp events from the companion (main Postgres)."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import asyncpg

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.services.desktop_calendar_policy import CalendarPolicyError, build_event_draft
from api.utils.llm_wall_clock_context import resolve_wall_clock_timezone, wall_clock_snapshot

logger = logging.getLogger(__name__)

_TITLE_FROM_CREATE_RE = re.compile(
    r"(?is)"
    r"(?:добав|создай|запиши|поставь|внеси|add|schedule|put)\w*"
    r".{0,48}(?:в\s+календар|событи|встреч|calendar|event|meeting|appointment)\w*\s*"
    r"(?:на\s+|for\s+|at\s+|в\s+|к\s+)?"
)
_TIME_RE = re.compile(r"\b(\d{1,2})[:.](\d{2})\b")
_ISO_DATE_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_DURATION_MINUTES_DEFAULT = 60
_UPCOMING_DAYS = 7
_UPCOMING_LIMIT = 12


def principal_to_desktop_user_id(principal_id: str) -> UUID | None:
    """Companion principal is ``User.id``; calendar rows use the same UUID when resolvable."""

    raw = str(principal_id or "").strip()
    if not raw:
        return None
    try:
        return UUID(raw)
    except TypeError, ValueError:
        return None


def parse_calendar_create_draft(user_line: str, *, title_override: str | None = None) -> dict[str, Any] | None:
    """Parse a local-civil title/time from chat. Missing time → None (clarification)."""

    line = str(user_line or "").strip()
    if not line:
        return None
    match = _TIME_RE.search(line)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2))
    if hour > 23 or minute > 59:
        return None
    snap = wall_clock_snapshot()
    local = snap.local_dt
    iso_date = _ISO_DATE_RE.search(line)
    if iso_date:
        try:
            day = datetime.strptime(iso_date.group(1), "%Y-%m-%d").date()
        except ValueError:
            day = local.date()
    elif re.search(r"(?is)\bзавтра\b|\btomorrow\b", line):
        day = (local + timedelta(days=1)).date()
    else:
        day = local.date()
    title = str(title_override or "").strip()
    if not title:
        remainder = _TITLE_FROM_CREATE_RE.sub("", line)
        remainder = _TIME_RE.sub("", remainder)
        remainder = _ISO_DATE_RE.sub("", remainder)
        remainder = re.sub(r"(?is)\b(?:сегодня|завтра|today|tomorrow|в|на|at|for)\b", " ", remainder)
        title = re.sub(r"\s+", " ", remainder).strip(" .,:;—-")
    if not title:
        return None
    tz = resolve_wall_clock_timezone()
    start_local = datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)
    end_local = start_local + timedelta(minutes=_DURATION_MINUTES_DEFAULT)
    return {
        "title": title[:200],
        "notes": "",
        "starts_at": start_local.astimezone(UTC).replace(tzinfo=None),
        "ends_at": end_local.astimezone(UTC).replace(tzinfo=None),
        "all_day": False,
        "local_label": f"{day.isoformat()} {hour:02d}:{minute:02d}",
    }


async def list_upcoming_personal_calendar_events(
    pool: asyncpg.Pool,
    *,
    user_id: UUID,
    now: datetime | None = None,
    days: int = _UPCOMING_DAYS,
    limit: int = _UPCOMING_LIMIT,
) -> list[dict[str, Any]]:
    """Upcoming overlapping personal events for the owner (UTC-naive storage)."""

    utc_now = (now.astimezone(UTC) if now is not None and now.tzinfo else datetime.now(UTC)).replace(tzinfo=None)
    range_end = utc_now + timedelta(days=max(1, min(int(days), 31)))
    cap = max(1, min(int(limit), 24))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, title, notes, starts_at, ends_at, all_day
            FROM desktop_calendar_events
            WHERE user_id = $1
              AND ends_at > $2
              AND starts_at < $3
            ORDER BY starts_at ASC, id ASC
            LIMIT $4
            """,
            user_id,
            utc_now,
            range_end,
            cap,
        )
    return [
        {
            "id": str(row["id"]),
            "title": str(row["title"] or ""),
            "notes": str(row["notes"] or ""),
            "starts_at": row["starts_at"],
            "ends_at": row["ends_at"],
            "all_day": bool(row["all_day"]),
        }
        for row in rows
    ]


async def create_personal_calendar_event(
    pool: asyncpg.Pool,
    *,
    user_id: UUID,
    title: str,
    notes: str,
    starts_at: datetime,
    ends_at: datetime,
    all_day: bool = False,
) -> dict[str, Any]:
    """Insert one owner-scoped personal event after CalendarApp policy validation."""

    draft = build_event_draft(
        title=title,
        notes=notes,
        starts_at=starts_at,
        ends_at=ends_at,
        all_day=all_day,
    )
    event_id = uuid4()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO desktop_calendar_events (
                id, user_id, title, notes, starts_at, ends_at, all_day, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                (NOW() AT TIME ZONE 'utc'), (NOW() AT TIME ZONE 'utc')
            )
            RETURNING id, title, notes, starts_at, ends_at, all_day
            """,
            event_id,
            user_id,
            draft.title,
            draft.notes,
            draft.starts_at,
            draft.ends_at,
            draft.all_day,
        )
    if row is None:
        raise RuntimeError("calendar_create_returning_empty")
    return {
        "id": str(row["id"]),
        "title": str(row["title"] or ""),
        "notes": str(row["notes"] or ""),
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
        "all_day": bool(row["all_day"]),
    }


async def load_user_calendar_prompt_block(
    pool: asyncpg.Pool | None,
    *,
    principal_id: str,
) -> str:
    """Best-effort upcoming-events prompt; unread block on miss/fail, never a fake empty day."""

    from api.ewa_platform.companion.calendar.prompt import (
        format_user_calendar_prompt_block,
        format_user_calendar_unavailable_block,
    )

    user_id = principal_to_desktop_user_id(principal_id)
    if user_id is None or pool is None:
        return format_user_calendar_unavailable_block()
    try:
        events = await list_upcoming_personal_calendar_events(pool, user_id=user_id)
        return format_user_calendar_prompt_block(events)
    except Exception as exc:  # noqa: BLE001 — prompt must not fail the chat turn
        companion_degrade_debug(
            logger,
            "user_calendar_prompt_block",
            "personal calendar prompt load failed",
            exc=exc,
            principal_id=principal_id,
        )
        return format_user_calendar_unavailable_block()


__all__ = (
    "CalendarPolicyError",
    "create_personal_calendar_event",
    "list_upcoming_personal_calendar_events",
    "load_user_calendar_prompt_block",
    "parse_calendar_create_draft",
    "principal_to_desktop_user_id",
)
