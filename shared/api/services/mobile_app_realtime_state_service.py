#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Redis-backed mobile app foreground freshness so FCM fallback is not suppressed by stale "online" state.
# Invariants:
# - Missing/stale key means not foreground; failures degrade to background (push allowed).
# - Foreground=true stores epoch seconds; legacy "1" is treated as stale (push allowed).
# Related:
# - api.services.mobile_push_service, api.routers.mobile_app
# ---

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import UUID

from api.core.database_manager import get_database_manager

logger = logging.getLogger(__name__)

_PREFIX = "presence:v1:mobile_fg:"
_FOREGROUND_TTL_SEC = 90
_BACKGROUND_TTL_SEC = 30
_FOREGROUND_FRESH_MAX_AGE_SEC = 60


def _key(user_id: str) -> str:
    return f"{_PREFIX}{user_id}"


async def _redis() -> Any:
    manager = await get_database_manager()
    return await manager.get_redis_client()


async def set_mobile_app_foreground(user_id: str, *, foreground: bool) -> None:
    """Persist whether the native Android shell is interactable (foreground)."""

    uid = str(user_id or "").strip()
    if not uid:
        return
    try:
        UUID(uid)
    except ValueError:
        return
    try:
        r = await _redis()
        if not r:
            return
        if foreground:
            await r.set(_key(uid), str(int(time.time())), ex=_FOREGROUND_TTL_SEC)
        else:
            await r.set(_key(uid), "0", ex=_BACKGROUND_TTL_SEC)
    except Exception:
        logger.debug("set_mobile_app_foreground failed user=%s", uid[:8], exc_info=True)


def _decode_redis_text(raw: Any) -> str:
    if raw is None:
        return ""
    return raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)


def _foreground_report_age_sec(text: str) -> float | None:
    normalized = text.strip()
    if not normalized or normalized == "0":
        return None
    if normalized == "1":
        # Legacy value without timestamp — treat as stale so FCM is not suppressed.
        return None
    try:
        reported_at = int(normalized)
    except ValueError:
        return None
    return max(0.0, time.time() - float(reported_at))


async def user_has_mobile_app_foreground(user_id: str) -> bool:
    """True only when the client recently reported foreground=true."""

    return await user_has_mobile_app_foreground_fresh(
        user_id,
        max_age_sec=_FOREGROUND_FRESH_MAX_AGE_SEC,
    )


async def user_has_mobile_app_foreground_fresh(
    user_id: str,
    *,
    max_age_sec: int = _FOREGROUND_FRESH_MAX_AGE_SEC,
) -> bool:
    """True when foreground=true was reported within max_age_sec."""

    uid = str(user_id or "").strip()
    if not uid or max_age_sec <= 0:
        return False
    try:
        r = await _redis()
        if not r:
            return False
        raw = await r.get(_key(uid))
        if raw is None:
            return False
        age = _foreground_report_age_sec(_decode_redis_text(raw))
        if age is None:
            return False
        return age <= float(max_age_sec)
    except Exception:
        logger.debug("user_has_mobile_app_foreground_fresh failed user=%s", uid[:8], exc_info=True)
        return False
