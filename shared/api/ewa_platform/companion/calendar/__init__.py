# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion access to the user's personal Desktop CalendarApp events (main Postgres).
# Invariants:
# - Personal events stay on ``desktop_calendar_events``; assistant plan steps stay on EWA plans.
# Related:
# - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
# ---
"""Companion calendar awareness (prompt + chat tool)."""

from api.ewa_platform.companion.calendar.intent import (
    user_line_requests_calendar_create,
    user_line_requests_calendar_list,
)
from api.ewa_platform.companion.calendar.prompt import format_user_calendar_prompt_block
from api.ewa_platform.companion.calendar.service import (
    create_personal_calendar_event,
    list_upcoming_personal_calendar_events,
    principal_to_desktop_user_id,
)

__all__ = (
    "create_personal_calendar_event",
    "format_user_calendar_prompt_block",
    "list_upcoming_personal_calendar_events",
    "principal_to_desktop_user_id",
    "user_line_requests_calendar_create",
    "user_line_requests_calendar_list",
)
