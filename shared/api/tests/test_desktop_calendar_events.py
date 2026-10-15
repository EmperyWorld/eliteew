# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Owner-scoped CalendarApp event service: overlap list and 404 for foreign ids.
# Invariants:
# - No live Postgres; AsyncMock execute/scalars boundary.
# Related:
# - api/services/desktop_calendar_events.py
# ---

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.desktop_calendar_events import (
    CalendarEventNotFoundError,
    get_own_calendar_event,
    list_calendar_events,
)
from api.services.desktop_calendar_policy import CalendarPolicyError


def _result(rows: list[object]) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    return result


@pytest.mark.asyncio
async def test_list_calendar_events_rejects_inverted_range() -> None:
    db = AsyncMock()
    with pytest.raises(CalendarPolicyError) as exc:
        await list_calendar_events(
            db,
            user_id=uuid4(),
            range_from=datetime(2026, 8, 20),
            range_to=datetime(2026, 8, 19),
        )
    assert exc.value.code == "invalid_range"
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_get_own_calendar_event_foreign_id_is_not_found() -> None:
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_result([]))
    with pytest.raises(CalendarEventNotFoundError):
        await get_own_calendar_event(db, user_id=uuid4(), event_id=uuid4())


@pytest.mark.asyncio
async def test_list_calendar_events_returns_overlap_rows() -> None:
    db = AsyncMock()
    row = SimpleNamespace(id=uuid4(), title="Standup")
    db.execute = AsyncMock(return_value=_result([row]))
    out = await list_calendar_events(
        db,
        user_id=uuid4(),
        range_from=datetime(2026, 8, 1),
        range_to=datetime(2026, 8, 31),
    )
    assert out == [row]
    db.execute.assert_awaited()
