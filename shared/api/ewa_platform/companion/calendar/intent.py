# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regex gates for listing or creating personal CalendarApp events from companion chat.
# Invariants:
# - Plan-creation lines («составь план») never match calendar create.
# - Empty lines never match.
# Related:
# - api/ewa_platform/companion/plans/intent.py
# - api/ewa_platform/companion/orchestration/tools/handlers_ops.py
# ---
"""Calendar chat-intent gates for ``calendar_v1``."""

from __future__ import annotations

import re

from api.ewa_platform.companion.plans.intent import user_line_requests_plan

_LIST_RE = re.compile(
    r"(?is)"
    r"(?:"
    r"(?:что|какие|какое)\s+(?:у\s+меня\s+)?"
    r"(?:сегодня|завтра|на\s+этой\s+неделе|на\s+неделе)?\s*"
    r"(?:в\s+календар|событи|встреч|расписан)"
    r"|"
    r"(?:покаж|напомн|выведи|скажи).{0,24}(?:календар|событи|встреч|расписан)"
    r"|"
    r"(?:мой|моё|мое)\s+календар"
    r"|"
    r"what(?:'s|s| is| are)?\s+(?:on\s+)?(?:my\s+)?(?:calendar|schedule)"
    r"|"
    r"what\s+events?\s+(?:do\s+i\s+have|have\s+i)"
    r"|"
    r"(?:show|list|remind)\s+(?:me\s+)?(?:my\s+)?(?:calendar|events|schedule)"
    r")",
)

_CREATE_RE = re.compile(
    r"(?is)"
    r"(?:"
    r"(?:добав|создай|запиши|поставь|внеси).{0,48}(?:в\s+календар|событи|встреч)"
    r"|"
    r"add.{0,40}(?:to\s+(?:my\s+)?calendar|an?\s+event|a\s+meeting)"
    r"|"
    r"schedule.{0,24}(?:meeting|event|appointment)"
    r"|"
    r"put.{0,24}(?:on|in)\s+(?:my\s+)?calendar"
    r")",
)


def user_line_requests_calendar_list(user_line: str) -> bool:
    """True when the user asks what is already on their personal calendar."""

    line = (user_line or "").strip()
    if len(line) < 6:
        return False
    return bool(_LIST_RE.search(line))


def user_line_requests_calendar_create(user_line: str) -> bool:
    """True when the user asks to add a personal calendar event (not an assistant plan)."""

    line = (user_line or "").strip()
    if len(line) < 8:
        return False
    if user_line_requests_plan(line):
        return False
    return bool(_CREATE_RE.search(line))


__all__ = (
    "user_line_requests_calendar_create",
    "user_line_requests_calendar_list",
)
