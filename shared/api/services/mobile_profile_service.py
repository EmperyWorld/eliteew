#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist and merge the mobile-only profile blob under users.preferences.mobile (JSONB).
# Invariants:
# - Does not mutate web/desktop preference keys (ui, theme, accessibility, …).
# - Deep-merge mobile patch; always sets mobile.updated_at on write.
# - Updates touch the PII-protected users row only after setting the session encryption key.
# Related:
# - api/routers/mobile_app.py, api/schemas/mobile_app.py
# ---

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.core.unified_config import unified_settings
from api.schemas.mobile_app import MobileProfileResponse, MobileProfileUpdate

logger = logging.getLogger(__name__)

_MOBILE_PROFILE_KEY = "mobile"


def _deep_merge_dict(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in incoming.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge_dict(out[key], value)
        else:
            out[key] = value
    return out


def _normalize_prefs(raw: Any) -> dict[str, Any]:
    if not raw:
        return {}
    if isinstance(raw, str):
        return json.loads(raw) if raw else {}
    if isinstance(raw, dict):
        return dict(raw)
    return {}


def _mobile_blob_from_prefs(prefs: dict[str, Any]) -> dict[str, Any]:
    mobile = prefs.get(_MOBILE_PROFILE_KEY)
    if isinstance(mobile, dict):
        return dict(mobile)
    return {}


async def _set_encryption_key(conn: asyncpg.Connection) -> None:
    """Set the per-session PII key before touching the protected users row."""

    if not getattr(unified_settings, "encryption_enabled", False):
        return
    key = getattr(unified_settings, "encryption_master_key", None)
    if not key:
        return
    safe_key = str(key).replace("'", "''")
    await conn.execute(f"SET SESSION encryption.pii_key = '{safe_key}'")


async def get_mobile_profile(db_pool: asyncpg.Pool, user_id: UUID) -> MobileProfileResponse:
    try:
        async with db_pool.acquire() as conn:
            await _set_encryption_key(conn)
            row = await conn.fetchrow("SELECT preferences FROM users WHERE id = $1", user_id)
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            prefs = _normalize_prefs(row["preferences"])
            mobile = _mobile_blob_from_prefs(prefs)
            from api.video_calls.call_target import call_target_from_preferences_blob

            response = MobileProfileResponse.model_validate(mobile)
            return response.model_copy(update={"call_target": call_target_from_preferences_blob(prefs)})
    except HTTPException:
        raise
    except asyncpg.PostgresError as exc:
        logger.exception("Database error in get_mobile_profile: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error loading mobile profile",
        ) from exc


async def update_mobile_profile(
    db_pool: asyncpg.Pool,
    user_id: UUID,
    update_data: MobileProfileUpdate,
) -> MobileProfileResponse:
    try:
        async with db_pool.acquire() as conn, conn.transaction():
            await _set_encryption_key(conn)
            current_raw = await conn.fetchval("SELECT preferences FROM users WHERE id = $1", user_id)
            if current_raw is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

            prefs = _normalize_prefs(current_raw)
            mobile = _mobile_blob_from_prefs(prefs)

            patch = update_data.model_dump(exclude_unset=True, exclude_none=True)
            notifications_patch = patch.pop("notifications", None)
            if patch.get("background_content_id") == "":
                patch.pop("background_content_id", None)
                mobile.pop("background_content_id", None)
            if notifications_patch is not None:
                mobile["notifications"] = _deep_merge_dict(
                    mobile.get("notifications") if isinstance(mobile.get("notifications"), dict) else {},
                    notifications_patch,
                )
            mobile = _deep_merge_dict(mobile, patch)
            mobile["updated_at"] = datetime.now(UTC).isoformat()
            prefs[_MOBILE_PROFILE_KEY] = mobile

            prefs_json_str = json.dumps(json.loads(json.dumps(prefs)))
            await conn.execute(
                """
                UPDATE users
                SET preferences = $2::jsonb, updated_at = NOW()
                WHERE id = $1
                """,
                user_id,
                prefs_json_str,
            )
            from api.video_calls.call_target import call_target_from_preferences_blob

            response = MobileProfileResponse.model_validate(mobile)
            return response.model_copy(update={"call_target": call_target_from_preferences_blob(prefs)})
    except HTTPException:
        raise
    except asyncpg.PostgresError as exc:
        logger.exception("Database error in update_mobile_profile: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error updating mobile profile",
        ) from exc
