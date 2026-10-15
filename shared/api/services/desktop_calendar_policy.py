# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure CalendarApp event validation (no I/O): title/notes bounds, interval, list range.
# Invariants:
# - Widget slot id ``calendar`` is forbidden (agenda stays plan due_date).
# - List window is at most RANGE_MAX_DAYS; from must be strictly before to.
# Related:
# - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
# - api/services/desktop_calendar_events.py
# ---

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

TITLE_MAX = 200
NOTES_MAX = 4000
RANGE_MAX_DAYS = 93
FORBIDDEN_WIDGET_SLOT_TYPE = "calendar"


class CalendarPolicyError(ValueError):
    """User-correctable calendar contract violation."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def to_naive_utc(value: datetime) -> datetime:
    """Store UTC-naive instants (desktop DateTime convention).

    Naive input is treated as already-UTC (wire JSON without offset).
    """
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def to_aware_utc(value: datetime) -> datetime:
    """Tag stored naive UTC as aware UTC for JSON (``Z`` / ``+00:00``)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def normalize_title(raw: str) -> str:
    title = (raw or "").strip()
    if not title:
        raise CalendarPolicyError("title_required", "Title is required")
    if len(title) > TITLE_MAX:
        raise CalendarPolicyError("title_too_long", f"Title must be at most {TITLE_MAX} characters")
    return title


def normalize_notes(raw: str | None) -> str:
    notes = (raw or "").strip()
    if len(notes) > NOTES_MAX:
        raise CalendarPolicyError("notes_too_long", f"Notes must be at most {NOTES_MAX} characters")
    return notes


def validate_interval(*, starts_at: datetime, ends_at: datetime) -> tuple[datetime, datetime]:
    start = to_naive_utc(starts_at)
    end = to_naive_utc(ends_at)
    if end <= start:
        raise CalendarPolicyError("invalid_interval", "Event must end after it starts")
    return start, end


def validate_list_range(*, range_from: datetime, range_to: datetime) -> tuple[datetime, datetime]:
    start = to_naive_utc(range_from)
    end = to_naive_utc(range_to)
    if end <= start:
        raise CalendarPolicyError("invalid_range", "Range end must be after range start")
    if (end - start) > timedelta(days=RANGE_MAX_DAYS):
        raise CalendarPolicyError(
            "range_too_long",
            f"Range must be at most {RANGE_MAX_DAYS} days",
        )
    return start, end


@dataclass(frozen=True, slots=True)
class CalendarEventDraft:
    title: str
    notes: str
    starts_at: datetime
    ends_at: datetime
    all_day: bool


def build_event_draft(
    *,
    title: str,
    notes: str | None,
    starts_at: datetime,
    ends_at: datetime,
    all_day: bool = False,
) -> CalendarEventDraft:
    start, end = validate_interval(starts_at=starts_at, ends_at=ends_at)
    return CalendarEventDraft(
        title=normalize_title(title),
        notes=normalize_notes(notes),
        starts_at=start,
        ends_at=end,
        all_day=bool(all_day),
    )
