#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Server-owned notification-center inbox mutations for in-app Socket.IO events.
# Invariants:
# - Persist only persistent or high/urgent rows (same default as the desktop hub).
# - Upsert/remove are idempotent by notification id; inbox is capped at 200.
# - Tombstones (`dismissed_ids`) win over later PUT rows with the same id.
# - Persist does not resurrect a tombstoned id (same event); a new id is a new row.
# - GET/bootstrap return `dismissed_ids` so a localStorage copy cannot revive a tombstone.
# Related:
# - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
# - api.services.notification_service
# ---

"""Inbox helpers for `user_notification_center` (persist on emit, remove on dismiss)."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from api.schemas.notification_center import NotificationCenterItemSerialized
from api.schemas.notifications import NotificationEvent, NotificationPriority, NotificationType

logger = logging.getLogger(__name__)

NOTIFICATION_CENTER_MAX_ITEMS = 200
NOTIFICATION_CENTER_DISMISSED_MAX = 500


def should_persist_in_notification_center(event: NotificationEvent) -> bool:
    """Match the desktop hub default: persistent or high/urgent, skip already-expired rows."""
    if event.expires_at is not None:
        expires_at = event.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= datetime.now(UTC):
            return False
    if event.persistent:
        return True
    return event.priority in {NotificationPriority.HIGH, NotificationPriority.URGENT}


def notification_event_to_center_item(event: NotificationEvent) -> dict[str, Any]:
    """Map a live Socket.IO event onto the serialized inbox row (no metadata/actions in wave 1)."""
    type_value = event.type.value
    if event.type is NotificationType.SYSTEM:
        type_value = NotificationType.INFO.value
    expires_at = event.expires_at.isoformat() if event.expires_at is not None else None
    item = NotificationCenterItemSerialized.model_validate(
        {
            "id": event.id,
            "type": type_value,
            "title": event.title,
            "message": event.message,
            "timestamp": event.created_at.isoformat(),
            "read": False,
            "persistent": event.persistent,
            "source": event.source,
            "expiresAt": expires_at,
        }
    )
    return item.model_dump(mode="json")


def _parse_items(raw: Any) -> list[dict[str, Any]]:
    parsed: Any = raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw) if raw else []
        except json.JSONDecodeError:
            logger.warning("[STEP] notification_center_items_parse_fail")
            return []
    if not isinstance(parsed, list):
        return []
    out: list[dict[str, Any]] = []
    for row in parsed:
        if isinstance(row, dict):
            out.append(row)
    return out


def _item_timestamp_ms(item: dict[str, Any]) -> float:
    raw = item.get("timestamp")
    if not isinstance(raw, str) or not raw.strip():
        return 0.0
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    return parsed.timestamp()


def _merge_pair(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    primary, secondary = (left, right) if _item_timestamp_ms(left) >= _item_timestamp_ms(right) else (right, left)
    merged = dict(primary)
    merged["read"] = bool(left.get("read")) or bool(right.get("read"))
    merged["persistent"] = bool(left.get("persistent")) or bool(right.get("persistent"))
    if not merged.get("source"):
        merged["source"] = secondary.get("source")
    return merged


def upsert_center_item(existing: list[dict[str, Any]], item: dict[str, Any]) -> list[dict[str, Any]]:
    """Union by id; newer timestamp wins fields; read/persistent are OR; newest 200 kept."""
    serialized = NotificationCenterItemSerialized.model_validate(item).model_dump(mode="json")
    by_id: dict[str, dict[str, Any]] = {}
    for row in existing:
        row_id = row.get("id")
        if not isinstance(row_id, str) or not row_id:
            continue
        prev = by_id.get(row_id)
        by_id[row_id] = _merge_pair(prev, row) if prev else row
    incoming_id = serialized["id"]
    prev = by_id.get(incoming_id)
    by_id[incoming_id] = _merge_pair(prev, serialized) if prev else serialized
    return sorted(by_id.values(), key=_item_timestamp_ms, reverse=True)[:NOTIFICATION_CENTER_MAX_ITEMS]


def remove_center_item(existing: list[dict[str, Any]], notification_id: str) -> list[dict[str, Any]]:
    return [row for row in existing if row.get("id") != notification_id]


def _parse_id_list(raw: Any) -> list[str]:
    parsed: Any = raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw) if raw else []
        except json.JSONDecodeError:
            return []
    if not isinstance(parsed, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in parsed:
        if isinstance(item, str) and item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def merge_dismissed_ids(*groups: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for group in groups:
        for item in group:
            if item and item not in seen:
                seen.add(item)
                out.append(item)
    if len(out) > NOTIFICATION_CENTER_DISMISSED_MAX:
        return out[-NOTIFICATION_CENTER_DISMISSED_MAX:]
    return out


def visible_inbox_items(raw_items: Any, raw_dismissed: Any) -> list[dict[str, Any]]:
    """Rows a GET may return: never include tombstoned ids."""
    items, _dismissed = load_visible_inbox(raw_items, raw_dismissed)
    return items


def load_visible_inbox(raw_items: Any, raw_dismissed: Any) -> tuple[list[dict[str, Any]], list[str]]:
    """Visible items plus the tombstone list a GET/bootstrap client must merge against."""
    dismissed = _parse_id_list(raw_dismissed)
    dismissed_set = set(dismissed)
    items = _parse_items(raw_items)
    if dismissed_set:
        items = [row for row in items if row.get("id") not in dismissed_set]
    return items, dismissed


def apply_client_inbox_snapshot(
    existing_items: list[dict[str, Any]],
    existing_dismissed: list[str],
    incoming_items: list[dict[str, Any]],
    incoming_dismissed: list[str],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Union client PUT with server inbox; tombstones win over re-added rows."""
    dismissed = merge_dismissed_ids(existing_dismissed, incoming_dismissed)
    dismissed_set = set(dismissed)
    merged: list[dict[str, Any]] = list(existing_items)
    for item in incoming_items:
        item_id = item.get("id")
        if isinstance(item_id, str) and item_id in dismissed_set:
            continue
        merged = upsert_center_item(merged, item)
    return visible_inbox_items(merged, dismissed), dismissed


async def _lock_inbox(conn: Any, user_id: UUID) -> None:
    await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", str(user_id))
    await conn.execute(
        """
        INSERT INTO user_notification_center (user_id, items, dismissed_ids, updated_at)
        VALUES ($1, '[]'::jsonb, '[]'::jsonb, NOW())
        ON CONFLICT (user_id) DO NOTHING
        """,
        user_id,
    )


async def _load_locked_inbox(conn: Any, user_id: UUID) -> tuple[list[dict[str, Any]], list[str]]:
    row = await conn.fetchrow(
        """
        SELECT items, dismissed_ids
        FROM user_notification_center
        WHERE user_id = $1
        FOR UPDATE
        """,
        user_id,
    )
    if row is None:
        return [], []
    return _parse_items(row["items"]), _parse_id_list(row["dismissed_ids"])


async def _save_inbox(
    conn: Any,
    user_id: UUID,
    items: list[dict[str, Any]],
    dismissed_ids: list[str],
) -> None:
    await conn.execute(
        """
        UPDATE user_notification_center
        SET items = $2::jsonb, dismissed_ids = $3::jsonb, updated_at = NOW()
        WHERE user_id = $1
        """,
        user_id,
        json.dumps(items),
        json.dumps(dismissed_ids),
    )


async def persist_notification_center_item(pool: Any, user_id: UUID, item: dict[str, Any]) -> None:
    """Insert or merge one inbox row under an advisory lock. Tombstoned ids stay dismissed."""
    serialized = NotificationCenterItemSerialized.model_validate(item).model_dump(mode="json")
    async with pool.acquire() as conn, conn.transaction():
        await _lock_inbox(conn, user_id)
        existing, dismissed = await _load_locked_inbox(conn, user_id)
        if serialized["id"] in set(dismissed):
            return
        merged = upsert_center_item(existing, serialized)
        await _save_inbox(conn, user_id, merged, dismissed)


async def remove_notification_center_item(pool: Any, user_id: UUID, notification_id: str) -> None:
    """Tombstone one inbox id so later PUT/persist cannot bring it back."""
    if not notification_id:
        return
    async with pool.acquire() as conn, conn.transaction():
        await _lock_inbox(conn, user_id)
        existing, dismissed = await _load_locked_inbox(conn, user_id)
        next_items = remove_center_item(existing, notification_id)
        next_dismissed = merge_dismissed_ids(dismissed, [notification_id])
        if next_items == existing and next_dismissed == dismissed:
            return
        await _save_inbox(conn, user_id, next_items, next_dismissed)


async def apply_notification_center_put(
    pool: Any,
    user_id: UUID,
    incoming_items: list[dict[str, Any]],
    incoming_dismissed: list[str],
) -> tuple[list[dict[str, Any]], list[str], datetime]:
    """Merge a client snapshot into the server inbox and return stored items, tombstones, updated_at."""
    async with pool.acquire() as conn, conn.transaction():
        await _lock_inbox(conn, user_id)
        existing, dismissed = await _load_locked_inbox(conn, user_id)
        merged, next_dismissed = apply_client_inbox_snapshot(
            existing,
            dismissed,
            incoming_items,
            incoming_dismissed,
        )
        await _save_inbox(conn, user_id, merged, next_dismissed)
        updated_at = await conn.fetchval(
            "SELECT updated_at FROM user_notification_center WHERE user_id = $1",
            user_id,
        )
        if isinstance(updated_at, datetime):
            return merged, next_dismissed, updated_at
        return merged, next_dismissed, datetime.now(UTC)


async def persist_in_app_notification_best_effort(user_id: str, event: NotificationEvent) -> None:
    """Write qualifying events to inbox; never raise to the Socket.IO path."""
    if not should_persist_in_notification_center(event):
        return
    try:
        uid = UUID(str(user_id))
    except ValueError:
        logger.warning("[STEP] notification_center_persist_skip invalid_user_id")
        return
    try:
        item = notification_event_to_center_item(event)
    except ValidationError:
        logger.exception("[STEP] notification_center_persist_skip invalid_item id=%s", event.id)
        return
    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        await persist_notification_center_item(pool, uid, item)
    except Exception:
        logger.exception(
            "[STEP] notification_center_persist_fail user=%s id=%s",
            str(user_id)[:8],
            event.id,
        )


async def remove_in_app_notification_best_effort(user_id: str, notification_id: str) -> None:
    """Remove a dismissed row from inbox; never raise to the Socket.IO path."""
    if not notification_id:
        return
    try:
        uid = UUID(str(user_id))
    except ValueError:
        logger.warning("[STEP] notification_center_remove_skip invalid_user_id")
        return
    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        await remove_notification_center_item(pool, uid, notification_id)
    except Exception:
        logger.exception(
            "[STEP] notification_center_remove_fail user=%s id=%s",
            str(user_id)[:8],
            notification_id,
        )
