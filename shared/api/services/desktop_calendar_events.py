# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Personal Desktop CalendarApp event persistence (overlap list + owner CRUD).
# Invariants:
# - Rows are scoped to desktop user_id; missing/other-owner reads look like 404.
# - List uses half-open overlap: starts_at < range_to AND ends_at > range_from.
# Related:
# - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
# - api/routers/desktop_calendar.py
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop import DesktopCalendarEvent
from api.services.desktop_calendar_policy import (
    CalendarEventDraft,
    build_event_draft,
    validate_list_range,
)
from api.utils.datetime_helpers import utc_now_naive


class CalendarEventNotFoundError(LookupError):
    """Owner-scoped miss (do not distinguish foreign ids)."""


async def list_calendar_events(
    db: AsyncSession,
    *,
    user_id: UUID,
    range_from: datetime,
    range_to: datetime,
) -> list[DesktopCalendarEvent]:
    start, end = validate_list_range(range_from=range_from, range_to=range_to)
    stmt = (
        select(DesktopCalendarEvent)
        .where(
            and_(
                DesktopCalendarEvent.user_id == user_id,
                DesktopCalendarEvent.starts_at < end,
                DesktopCalendarEvent.ends_at > start,
            )
        )
        .order_by(DesktopCalendarEvent.starts_at.asc(), DesktopCalendarEvent.id.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_own_calendar_event(
    db: AsyncSession,
    *,
    user_id: UUID,
    event_id: UUID,
) -> DesktopCalendarEvent:
    stmt = select(DesktopCalendarEvent).where(
        DesktopCalendarEvent.id == event_id,
        DesktopCalendarEvent.user_id == user_id,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise CalendarEventNotFoundError(str(event_id))
    return row


async def create_calendar_event(
    db: AsyncSession,
    *,
    user_id: UUID,
    draft: CalendarEventDraft,
) -> DesktopCalendarEvent:
    now = utc_now_naive()
    row = DesktopCalendarEvent(
        id=uuid4(),
        user_id=user_id,
        title=draft.title,
        notes=draft.notes,
        starts_at=draft.starts_at,
        ends_at=draft.ends_at,
        all_day=draft.all_day,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    return row


async def update_calendar_event(
    db: AsyncSession,
    *,
    user_id: UUID,
    event_id: UUID,
    title: str | None,
    notes: str | None,
    starts_at: datetime | None,
    ends_at: datetime | None,
    all_day: bool | None,
) -> DesktopCalendarEvent:
    row = await get_own_calendar_event(db, user_id=user_id, event_id=event_id)
    next_title = title if title is not None else row.title
    next_notes = notes if notes is not None else row.notes
    next_start = starts_at if starts_at is not None else row.starts_at
    next_end = ends_at if ends_at is not None else row.ends_at
    next_all_day = row.all_day if all_day is None else all_day
    draft = build_event_draft(
        title=next_title,
        notes=next_notes,
        starts_at=next_start,
        ends_at=next_end,
        all_day=next_all_day,
    )
    # SQLAlchemy Column descriptors confuse Pyright on instance writes — bind via Any.
    row_m: Any = row
    row_m.title = draft.title
    row_m.notes = draft.notes
    row_m.starts_at = draft.starts_at
    row_m.ends_at = draft.ends_at
    row_m.all_day = draft.all_day
    row_m.updated_at = utc_now_naive()
    await db.flush()
    return row


async def delete_calendar_event(
    db: AsyncSession,
    *,
    user_id: UUID,
    event_id: UUID,
) -> None:
    row = await get_own_calendar_event(db, user_id=user_id, event_id=event_id)
    await db.delete(row)
    await db.flush()
