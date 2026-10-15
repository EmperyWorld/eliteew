# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for CalendarApp event policy (title, interval, list range).
# Invariants:
# - Widget slot type calendar stays forbidden.
# Related:
# - api/services/desktop_calendar_policy.py
# - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
# ---

from datetime import UTC, datetime, timedelta

import pytest

from api.services.desktop_calendar_policy import (
    FORBIDDEN_WIDGET_SLOT_TYPE,
    RANGE_MAX_DAYS,
    CalendarPolicyError,
    build_event_draft,
    to_aware_utc,
    validate_list_range,
)


def test_forbidden_widget_slot_is_calendar() -> None:
    assert FORBIDDEN_WIDGET_SLOT_TYPE == "calendar"


def test_build_event_draft_trims_and_orders() -> None:
    start = datetime(2026, 8, 19, 9, 0, tzinfo=UTC)
    end = datetime(2026, 8, 19, 10, 0, tzinfo=UTC)
    draft = build_event_draft(title="  Review  ", notes=None, starts_at=start, ends_at=end)
    assert draft.title == "Review"
    assert draft.notes == ""
    assert draft.starts_at.tzinfo is None
    assert draft.ends_at > draft.starts_at


def test_build_event_draft_rejects_empty_title() -> None:
    start = datetime(2026, 8, 19, 9, 0)
    end = datetime(2026, 8, 19, 10, 0)
    with pytest.raises(CalendarPolicyError) as exc:
        build_event_draft(title="   ", notes="", starts_at=start, ends_at=end)
    assert exc.value.code == "title_required"


def test_build_event_draft_rejects_inverted_interval() -> None:
    start = datetime(2026, 8, 19, 10, 0)
    end = datetime(2026, 8, 19, 9, 0)
    with pytest.raises(CalendarPolicyError) as exc:
        build_event_draft(title="Call", notes="", starts_at=start, ends_at=end)
    assert exc.value.code == "invalid_interval"


def test_validate_list_range_rejects_too_long() -> None:
    start = datetime(2026, 1, 1)
    end = start + timedelta(days=RANGE_MAX_DAYS + 1)
    with pytest.raises(CalendarPolicyError) as exc:
        validate_list_range(range_from=start, range_to=end)
    assert exc.value.code == "range_too_long"


def test_validate_list_range_accepts_max_window() -> None:
    start = datetime(2026, 1, 1)
    end = start + timedelta(days=RANGE_MAX_DAYS)
    out_from, out_to = validate_list_range(range_from=start, range_to=end)
    assert out_to > out_from


def test_to_aware_utc_tags_naive_storage_as_utc() -> None:
    naive = datetime(2026, 8, 19, 2, 0)
    aware = to_aware_utc(naive)
    assert aware.tzinfo is UTC
    assert aware.hour == 2
    assert aware.isoformat().endswith("+00:00")


def test_calendar_event_response_json_uses_utc_z_suffix() -> None:
    from api.routers.desktop_calendar import CalendarEventResponse

    payload = CalendarEventResponse(
        id="evt-1",
        title="Call",
        notes="",
        starts_at=datetime(2026, 8, 19, 2, 0),
        ends_at=datetime(2026, 8, 19, 3, 0),
        all_day=False,
        created_at=datetime(2026, 8, 19, 1, 0),
        updated_at=datetime(2026, 8, 19, 1, 0),
    )
    dumped = payload.model_dump(mode="json")
    assert dumped["starts_at"] == "2026-08-19T02:00:00.000Z"
    assert dumped["ends_at"] == "2026-08-19T03:00:00.000Z"
