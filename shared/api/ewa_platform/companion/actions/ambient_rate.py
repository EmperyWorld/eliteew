# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Hourly cap + theme cooldown for continuity→ambient injects (Continuity W5a).
# Pure helpers; persist LP blob via caller.
# Invariants:
# - Default caps are conservative; cap 0 ⇒ never inject.
# - Theme cooldown honors ``last_theme_user_at`` (user) and ``last_injected_at`` (our ambient).
# Related:
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md (W5)
# - api/ewa_platform/companion/actions/ambient_from_continuity.py
# ---
"""Rate limits for ambient_from_continuity injections."""

from __future__ import annotations

import os
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

AMBIENT_BUDGET_NS: str = "companion_ambient_budget_v1"
DEFAULT_MAX_PER_HOUR: int = 3
DEFAULT_THEME_COOLDOWN_MIN: int = 30


def ambient_max_per_hour() -> int:
    raw = os.getenv("EWA_COMPANION_AMBIENT_MAX_PER_HOUR", str(DEFAULT_MAX_PER_HOUR))
    try:
        return max(0, min(int(str(raw).strip()), 60))
    except TypeError, ValueError:
        return DEFAULT_MAX_PER_HOUR


def ambient_theme_cooldown_minutes() -> int:
    raw = os.getenv("EWA_COMPANION_AMBIENT_THEME_COOLDOWN_MIN", str(DEFAULT_THEME_COOLDOWN_MIN))
    try:
        return max(0, min(int(str(raw).strip()), 24 * 60))
    except TypeError, ValueError:
        return DEFAULT_THEME_COOLDOWN_MIN


def _parse_iso(raw: Any) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def get_ambient_budget_state(profile: Mapping[str, Any] | None) -> dict[str, Any]:
    empty = {
        "window_start": None,
        "count": 0,
        "last_injected_at": None,
        "last_theme_user_at": None,
    }
    if not isinstance(profile, Mapping):
        return empty
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return empty
    block = lp.get(AMBIENT_BUDGET_NS)
    if not isinstance(block, Mapping):
        return empty
    try:
        count = int(block.get("count") or 0)
    except TypeError, ValueError:
        count = 0
    return {
        "window_start": block.get("window_start"),
        "count": max(0, count),
        "last_injected_at": block.get("last_injected_at"),
        "last_theme_user_at": block.get("last_theme_user_at"),
    }


def _in_cooldown(stamp: Any, *, now: datetime, minutes: int) -> bool:
    if minutes <= 0:
        return False
    dt = _parse_iso(stamp)
    if dt is None:
        return False
    return now - dt < timedelta(minutes=minutes)


def ambient_budget_allows(
    profile: Mapping[str, Any] | None,
    *,
    now: datetime | None = None,
    shell_norm: Mapping[str, Any] | None = None,
) -> tuple[bool, str]:
    """Return ``(allowed, deny_reason)`` for a continuity ambient inject."""

    cap = ambient_max_per_hour()
    if cap <= 0:
        return False, "cap_zero"
    instant = now or datetime.now(UTC)
    state = get_ambient_budget_state(profile)
    cooldown = ambient_theme_cooldown_minutes()

    theme_user = state.get("last_theme_user_at")
    if isinstance(shell_norm, Mapping) and shell_norm.get("theme_user_set_at"):
        theme_user = shell_norm.get("theme_user_set_at")
    if _in_cooldown(theme_user, now=instant, minutes=cooldown):
        return False, "theme_user_cooldown"
    if _in_cooldown(state.get("last_injected_at"), now=instant, minutes=cooldown):
        return False, "theme_inject_cooldown"

    window_start = _parse_iso(state.get("window_start"))
    count = int(state.get("count") or 0)
    if window_start is None or instant - window_start >= timedelta(hours=1):
        count = 0
    if count >= cap:
        return False, "hourly_cap"
    return True, ""


def record_ambient_injection(
    profile: Mapping[str, Any] | None,
    *,
    now: datetime | None = None,
    shell_norm: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Next ``companion_ambient_budget_v1`` blob after a successful inject."""

    instant = now or datetime.now(UTC)
    state = get_ambient_budget_state(profile)
    window_start = _parse_iso(state.get("window_start"))
    count = int(state.get("count") or 0)
    if window_start is None or instant - window_start >= timedelta(hours=1):
        window_start = instant
        count = 0
    theme_user = state.get("last_theme_user_at")
    if isinstance(shell_norm, Mapping) and shell_norm.get("theme_user_set_at"):
        theme_user = shell_norm.get("theme_user_set_at")
    return {
        "schema": AMBIENT_BUDGET_NS,
        "window_start": window_start.replace(microsecond=0).isoformat(),
        "count": count + 1,
        "last_injected_at": instant.replace(microsecond=0).isoformat(),
        "last_theme_user_at": theme_user,
    }


def merge_ambient_budget_into_learned_preferences(
    lp: Mapping[str, Any] | None,
    budget_blob: Mapping[str, Any],
) -> dict[str, Any]:
    out = dict(lp) if isinstance(lp, Mapping) else {}
    out[AMBIENT_BUDGET_NS] = dict(budget_blob)
    return out


__all__ = (
    "AMBIENT_BUDGET_NS",
    "ambient_budget_allows",
    "ambient_max_per_hour",
    "ambient_theme_cooldown_minutes",
    "get_ambient_budget_state",
    "merge_ambient_budget_into_learned_preferences",
    "record_ambient_injection",
)
