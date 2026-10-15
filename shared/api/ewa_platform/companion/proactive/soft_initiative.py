# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Soft initiative budget + partner-tone rewrite for anticipation hints (Continuity W3).
# Deterministic — no LLM. Caps daily partner nudges so observation ticks stay quiet.
# Invariants:
# - When flag off, hints pass through unchanged.
# - Budget exhaustion / min-gap / snooze ⇒ return ``None`` hint (episode may already be recorded).
# - Never invent “I completed…” claims; only offer to look together.
# Related:
# - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md (W3)
# - api/ewa_platform/companion/persona/anticipation.py
# ---
"""Soft proactive initiative budget for companion observation hints."""

from __future__ import annotations

import os
from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta
from typing import Any

from api.ewa_platform.companion.persona.continuity import get_continuity

SOFT_INITIATIVE_NS: str = "companion_soft_initiative_v1"
DEFAULT_DAILY_CAP: int = 3
DEFAULT_MIN_GAP_MIN: int = 45


def companion_soft_initiative_enabled() -> bool:
    return str(os.getenv("EWA_COMPANION_SOFT_INITIATIVE_ENABLED", "0")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def soft_initiative_daily_cap() -> int:
    raw = os.getenv("EWA_COMPANION_SOFT_INITIATIVE_DAILY_CAP", str(DEFAULT_DAILY_CAP))
    try:
        return max(0, min(int(str(raw).strip()), 24))
    except TypeError, ValueError:
        return DEFAULT_DAILY_CAP


def soft_initiative_min_gap_minutes() -> int:
    raw = os.getenv("EWA_COMPANION_SOFT_INITIATIVE_MIN_GAP_MIN", str(DEFAULT_MIN_GAP_MIN))
    try:
        return max(0, min(int(str(raw).strip()), 24 * 60))
    except TypeError, ValueError:
        return DEFAULT_MIN_GAP_MIN


def _today_utc() -> str:
    return date.today().isoformat()


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


def get_soft_initiative_state(profile: Mapping[str, Any] | None) -> dict[str, Any]:
    if not isinstance(profile, Mapping):
        return {"day": _today_utc(), "count": 0, "last_hint_at": None, "snooze_until": None}
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return {"day": _today_utc(), "count": 0, "last_hint_at": None, "snooze_until": None}
    block = lp.get(SOFT_INITIATIVE_NS)
    if not isinstance(block, Mapping):
        return {"day": _today_utc(), "count": 0, "last_hint_at": None, "snooze_until": None}
    day = str(block.get("day") or _today_utc())
    try:
        count = int(block.get("count") or 0)
    except TypeError, ValueError:
        count = 0
    if day != _today_utc():
        return {
            "day": _today_utc(),
            "count": 0,
            "last_hint_at": None,
            "snooze_until": block.get("snooze_until"),
        }
    return {
        "day": day,
        "count": max(0, count),
        "last_hint_at": block.get("last_hint_at"),
        "snooze_until": block.get("snooze_until"),
    }


def soft_initiative_allows_hint(profile: Mapping[str, Any] | None, *, now: datetime | None = None) -> tuple[bool, str]:
    """Return ``(allowed, deny_reason)``."""

    if not companion_soft_initiative_enabled():
        return True, ""
    cap = soft_initiative_daily_cap()
    if cap <= 0:
        return False, "cap_zero"
    state = get_soft_initiative_state(profile)
    instant = now or datetime.now(UTC)
    snooze = _parse_iso(state.get("snooze_until"))
    if snooze is not None and snooze > instant:
        return False, "snooze"
    if int(state.get("count") or 0) >= cap:
        return False, "daily_cap"
    gap_min = soft_initiative_min_gap_minutes()
    last = _parse_iso(state.get("last_hint_at"))
    if last is not None and gap_min > 0 and instant - last < timedelta(minutes=gap_min):
        return False, "min_gap"
    return True, ""


def _partner_hint_text(
    *,
    title: str | None,
    app: str | None,
    continuity_note: str | None,
    related: list[str],
    base_hint: str,
) -> str:
    label = (title or app or "").strip()
    note = (continuity_note or "").strip()
    if label and (note or related):
        bridge = note or related[0]
        bridge = bridge[:120].rstrip(" .")
        return (
            f"Слушай, я тут заметила связь между тем, что ты делаешь сейчас («{label}»), "
            f"и тем, что мы уже держали в поле: {bridge}… хочешь взглянуть?"
        )[:400]
    if label:
        return (f"Слушай, ты снова в «{label}» — могу мягко подтянуть, что у нас уже связано с этим. Хочешь?")[:400]
    return (base_hint or "").strip()[:400]


def apply_soft_initiative_to_hint(
    profile: Mapping[str, Any],
    hint: Mapping[str, Any] | None,
    *,
    title: str | None = None,
    app: str | None = None,
    now: datetime | None = None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Rewrite/budget one anticipation hint.

    Returns ``(hint_or_none, soft_initiative_lp_blob_or_none)``.
    When disabled, returns ``(dict(hint), None)``.
    """

    if hint is None:
        return None, None
    if not companion_soft_initiative_enabled():
        return dict(hint), None

    allowed, reason = soft_initiative_allows_hint(profile, now=now)
    if not allowed:
        return None, None

    continuity = get_continuity(profile)
    notes = list(continuity.get("unspoken_notes") or [])
    note = notes[0] if notes else None
    related = [str(x) for x in (hint.get("related_episodes") or []) if str(x).strip()][:3]
    base = str(hint.get("hint_text") or "")
    partner = _partner_hint_text(
        title=title,
        app=app,
        continuity_note=note,
        related=related,
        base_hint=base,
    )
    if not partner:
        return None, None

    instant = now or datetime.now(UTC)
    state = get_soft_initiative_state(profile)
    next_state = {
        "schema": SOFT_INITIATIVE_NS,
        "day": _today_utc(),
        "count": int(state.get("count") or 0) + 1,
        "last_hint_at": instant.replace(microsecond=0).isoformat(),
        "snooze_until": state.get("snooze_until"),
        "last_deny_reason": reason or None,
    }
    out = dict(hint)
    out["kind"] = "soft_initiative"
    out["hint_text"] = partner
    return out, next_state


def merge_soft_initiative_into_learned_preferences(
    lp: Mapping[str, Any] | None,
    soft_blob: Mapping[str, Any],
) -> dict[str, Any]:
    out = dict(lp) if isinstance(lp, Mapping) else {}
    out[SOFT_INITIATIVE_NS] = dict(soft_blob)
    return out


def snooze_soft_initiative_until(
    profile: Mapping[str, Any] | None,
    *,
    until: datetime,
) -> dict[str, Any]:
    """Build LP blob with ``snooze_until`` (keeps day/count)."""

    state = get_soft_initiative_state(profile)
    return {
        "schema": SOFT_INITIATIVE_NS,
        "day": state.get("day") or _today_utc(),
        "count": int(state.get("count") or 0),
        "last_hint_at": state.get("last_hint_at"),
        "snooze_until": until.astimezone(UTC).replace(microsecond=0).isoformat(),
        "last_deny_reason": "snooze",
    }


__all__ = (
    "SOFT_INITIATIVE_NS",
    "apply_soft_initiative_to_hint",
    "companion_soft_initiative_enabled",
    "get_soft_initiative_state",
    "merge_soft_initiative_into_learned_preferences",
    "snooze_soft_initiative_until",
    "soft_initiative_allows_hint",
    "soft_initiative_daily_cap",
    "soft_initiative_min_gap_minutes",
)
