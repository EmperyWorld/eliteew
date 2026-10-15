# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helpers for **EWA companion trust** (0–10), **Arlika lock**, **Arlika wrath** (гнев Арлики, 0–10), last chat
# activity stamp (idle auto-revert for **v1 only**), **Arlika v1** quarrel stint flag, and baseline gates for optional
# **Arlika v2** (``arlika_v2``) chat-mode entry without the v1 wrath/lock package.
# Invariants:
# - No I/O; persistence via ``companion_asyncpg`` patch / ``companion_profile_set_seed_persona_id`` /
#   ``companion_profile_revert_arlika`` / ``companion_profile_soft_seed_switch``.
# - Trust score is always an integer in ``[0, 10]``; missing trust keys mean score ``0``. Wrath missing while seed is
#   ``arlika`` is treated as **10** in pre-turn (legacy rows).
# - **``arlika_v2``** skips idle hour + wrath pre-turn; chat EWA↔v2 uses soft switch (no revert memory wipe).
# Related:
# - api/ewa_platform/companion/sidecar/trust_classify.py
# - api/ewa_platform/companion/sidecar/trust_turn.py
# - documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md
# **Canonical path:** ``api.ewa_platform.companion.sidecar.trust_state``; shim ``companion_trust_state``.
# ---
"""Baseline keys for companion trust meter and Arlika transformation."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

TRUST_BASELINE_NS: str = "ewa_companion_trust_v1"
ARLIKA_LOCKED_KEY: str = "ewa_companion_arlika_locked_v1"
ARLIKA_ORIGIN_SEED_KEY: str = "arlika_origin_seed_persona_id"
ARLIKA_TRANSFORMED_AT_KEY: str = "arlika_transformed_at_iso"
ARLIKA_WRATH_NS: str = "ewa_companion_arlika_wrath_v1"
ARLIKA_REVERTED_AT_KEY: str = "arlika_reverted_at_iso"
LAST_FRIEND_CHAT_ACTIVITY_AT_KEY: str = "ewa_companion_last_friend_chat_activity_at_iso"
ARLIKA_IDLE_AMNESIA_FLAG_KEY: str = "ewa_companion_arlika_idle_full_amnesia_v1"
ARLIKA_IDLE_REVERT_AFTER_SEC: int = 3600

ARLIKA_V2_SEED: str = "arlika_v2"
ARLIKA_V1_QUARREL_SEEN_KEY: str = "ewa_companion_arlika_v1_quarrel_seen_v1"
NEXT_ARLIKA_TRANSFORM_IS_V2_KEY: str = "ewa_companion_next_arlika_transform_is_v2_v1"
ARLIKA_V2_UNLOCKED_KEY: str = "ewa_companion_arlika_v2_unlocked_v1"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def read_trust_score(baseline: Mapping[str, Any] | None) -> int:
    if not isinstance(baseline, Mapping):
        return 0
    raw = baseline.get(TRUST_BASELINE_NS)
    if not isinstance(raw, Mapping):
        return 0
    try:
        s = int(raw.get("score", 0))
    except (TypeError, ValueError):  # fmt: skip
        return 0
    return max(0, min(10, s))


def read_arlika_wrath_score(baseline: Mapping[str, Any] | None, *, default_if_missing: int = 10) -> int:
    """Wrath in ``[0, 10]``. Missing namespace → ``default_if_missing`` (legacy Arlika profiles)."""

    if not isinstance(baseline, Mapping):
        return max(0, min(10, int(default_if_missing)))
    raw = baseline.get(ARLIKA_WRATH_NS)
    if not isinstance(raw, Mapping):
        return max(0, min(10, int(default_if_missing)))
    try:
        s = int(raw.get("score", default_if_missing))
    except (TypeError, ValueError):  # fmt: skip
        return max(0, min(10, int(default_if_missing)))
    return max(0, min(10, s))


def _truthy_baseline_flag(val: Any) -> bool:
    if val is True:
        return True
    return isinstance(val, str) and val.strip().lower() in ("true", "1", "yes")


def read_arlika_v1_quarrel_seen(baseline: Mapping[str, Any] | None) -> bool:
    if not isinstance(baseline, Mapping):
        return False
    return _truthy_baseline_flag(baseline.get(ARLIKA_V1_QUARREL_SEEN_KEY))


def read_next_arlika_transform_is_v2(baseline: Mapping[str, Any] | None) -> bool:
    if not isinstance(baseline, Mapping):
        return False
    return _truthy_baseline_flag(baseline.get(NEXT_ARLIKA_TRANSFORM_IS_V2_KEY))


def read_arlika_v2_unlocked(baseline: Mapping[str, Any] | None) -> bool:
    if not isinstance(baseline, Mapping):
        return False
    return _truthy_baseline_flag(baseline.get(ARLIKA_V2_UNLOCKED_KEY))


def is_arlika_locked(baseline: Mapping[str, Any] | None) -> bool:
    if not isinstance(baseline, Mapping):
        return False
    v = baseline.get(ARLIKA_LOCKED_KEY)
    if v is True:
        return True
    return isinstance(v, str) and v.strip().lower() in ("true", "1", "yes")


def trust_baseline_update(score: int) -> dict[str, Any]:
    s = max(0, min(10, int(score)))
    return {
        TRUST_BASELINE_NS: {
            "score": s,
            "updated_at": _now_iso(),
        }
    }


def arlika_wrath_baseline_update(score: int) -> dict[str, Any]:
    w = max(0, min(10, int(score)))
    return {
        ARLIKA_WRATH_NS: {
            "score": w,
            "updated_at": _now_iso(),
        }
    }


def arlika_transform_baseline_delta(*, origin_seed_persona_id: str) -> dict[str, Any]:
    origin = str(origin_seed_persona_id or "").strip().lower()
    out: dict[str, Any] = {
        ARLIKA_LOCKED_KEY: True,
        ARLIKA_ORIGIN_SEED_KEY: origin,
        ARLIKA_TRANSFORMED_AT_KEY: _now_iso(),
        ARLIKA_V1_QUARREL_SEEN_KEY: False,
        NEXT_ARLIKA_TRANSFORM_IS_V2_KEY: False,
    }
    out.update(arlika_wrath_baseline_update(10))
    return out


def arlika_v2_enter_baseline_delta(*, origin_seed_persona_id: str) -> dict[str, Any]:
    """Forward or chat entry to **``arlika_v2``**: keep origin + stamp; **no** v1 wrath spike, **no** baseline lock."""

    origin = str(origin_seed_persona_id or "").strip().lower()
    return {
        ARLIKA_ORIGIN_SEED_KEY: origin,
        ARLIKA_TRANSFORMED_AT_KEY: _now_iso(),
        ARLIKA_LOCKED_KEY: False,
        ARLIKA_V1_QUARREL_SEEN_KEY: False,
        NEXT_ARLIKA_TRANSFORM_IS_V2_KEY: False,
        ARLIKA_V2_UNLOCKED_KEY: True,
        **arlika_wrath_baseline_update(0),
    }


def friend_chat_activity_baseline_touch() -> dict[str, Any]:
    """Bump baseline timestamp after a completed companion chat turn (Arlika idle-revert clock)."""

    return {LAST_FRIEND_CHAT_ACTIVITY_AT_KEY: _now_iso()}


def _parse_iso_datetime_utc(val: Any) -> datetime | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def seconds_since_last_friend_chat_for_arlika_idle(
    baseline: Mapping[str, Any] | None,
    *,
    now: datetime | None = None,
) -> float | None:
    """Seconds since last finished chat turn (or Arlika transform if activity stamp missing). ``None`` → unknown."""

    if not isinstance(baseline, Mapping):
        return None
    clock = now if now is not None else datetime.now(UTC)
    t_act = _parse_iso_datetime_utc(baseline.get(LAST_FRIEND_CHAT_ACTIVITY_AT_KEY))
    if t_act is None:
        t_act = _parse_iso_datetime_utc(baseline.get(ARLIKA_TRANSFORMED_AT_KEY))
    if t_act is None:
        return None
    return max(0.0, (clock - t_act).total_seconds())


def arlika_revert_baseline_delta(
    *,
    idle_full_amnesia: bool = False,
    quarrel_seen_in_v1_stint: bool = False,
) -> dict[str, Any]:
    """Merge into baseline when restoring the pre-Arlika seed; clears lock and wrath, resets trust meter.

    If the user left v1 **without** a quarrel-classified stint, baseline keeps a ``NEXT_ARLIKA_TRANSFORM_IS_V2`` hint
    that may be used by explicit chat-mode switches; otherwise that hint is cleared.
    """

    return {
        ARLIKA_LOCKED_KEY: False,
        ARLIKA_REVERTED_AT_KEY: _now_iso(),
        ARLIKA_IDLE_AMNESIA_FLAG_KEY: bool(idle_full_amnesia),
        ARLIKA_V1_QUARREL_SEEN_KEY: False,
        NEXT_ARLIKA_TRANSFORM_IS_V2_KEY: (not bool(quarrel_seen_in_v1_stint)),
        **arlika_wrath_baseline_update(0),
        **trust_baseline_update(0),
    }


def apply_trust_delta(current: int, delta: int) -> int:
    return max(0, min(10, int(current) + int(delta)))
