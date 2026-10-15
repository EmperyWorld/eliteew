# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin REST for personal Desktop CalendarApp events under /desktop/calendar/events.
# Invariants:
# - OAuth2 + get_desktop_user_id; foreign/missing ids return 404.
# - URL prefix is mounted by parent desktop router (no extra prefix here).
# Related:
# - api/services/desktop_calendar_events.py
# - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
# ---

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, field_serializer
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.desktop import DesktopCalendarEvent
from api.services.desktop_calendar_events import (
    CalendarEventNotFoundError,
    create_calendar_event,
    delete_calendar_event,
    list_calendar_events,
    update_calendar_event,
)
from api.services.desktop_calendar_policy import CalendarPolicyError, build_event_draft, to_aware_utc

router = APIRouter(tags=["desktop"])


async def _get_desktop_user_id(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> UUID:
    from api.routers.desktop import get_desktop_user_id

    return await get_desktop_user_id(current_user=current_user, db=db)


class CalendarEventCreate(BaseModel):
    title: str
    notes: str = ""
    starts_at: datetime
    ends_at: datetime
    all_day: bool = False


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    all_day: bool | None = None


class CalendarEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    notes: str
    starts_at: datetime
    ends_at: datetime
    all_day: bool
    created_at: datetime
    updated_at: datetime

    @field_serializer("starts_at", "ends_at", "created_at", "updated_at")
    def _serialize_utc_instant(self, value: datetime) -> str:
        iso = to_aware_utc(value).isoformat(timespec="milliseconds")
        return iso.replace("+00:00", "Z")


def _to_response(row: DesktopCalendarEvent) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=str(row.id),
        title=row.title,
        notes=row.notes or "",
        starts_at=to_aware_utc(row.starts_at),
        ends_at=to_aware_utc(row.ends_at),
        all_day=bool(row.all_day),
        created_at=to_aware_utc(row.created_at),
        updated_at=to_aware_utc(row.updated_at),
    )


def _raise_policy(exc: CalendarPolicyError) -> None:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.message) from exc


def _raise_not_found() -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")


@router.get("/calendar/events", response_model=list[CalendarEventResponse])
async def get_calendar_events(
    range_from: datetime = Query(..., alias="from"),
    range_to: datetime = Query(..., alias="to"),
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> list[CalendarEventResponse]:
    try:
        rows = await list_calendar_events(db, user_id=user_id, range_from=range_from, range_to=range_to)
    except CalendarPolicyError as exc:
        _raise_policy(exc)
    return [_to_response(row) for row in rows]


@router.post(
    "/calendar/events",
    response_model=CalendarEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_calendar_event(
    body: CalendarEventCreate,
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> CalendarEventResponse:
    try:
        draft = build_event_draft(
            title=body.title,
            notes=body.notes,
            starts_at=body.starts_at,
            ends_at=body.ends_at,
            all_day=body.all_day,
        )
        row = await create_calendar_event(db, user_id=user_id, draft=draft)
    except CalendarPolicyError as exc:
        _raise_policy(exc)
    return _to_response(row)


@router.patch("/calendar/events/{event_id}", response_model=CalendarEventResponse)
async def patch_calendar_event(
    event_id: UUID,
    body: CalendarEventUpdate,
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> CalendarEventResponse:
    try:
        row = await update_calendar_event(
            db,
            user_id=user_id,
            event_id=event_id,
            title=body.title,
            notes=body.notes,
            starts_at=body.starts_at,
            ends_at=body.ends_at,
            all_day=body.all_day,
        )
    except CalendarPolicyError as exc:
        _raise_policy(exc)
    except CalendarEventNotFoundError:
        _raise_not_found()
    return _to_response(row)


@router.delete("/calendar/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event_route(
    event_id: UUID,
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> None:
    try:
        await delete_calendar_event(db, user_id=user_id, event_id=event_id)
    except CalendarEventNotFoundError:
        _raise_not_found()
