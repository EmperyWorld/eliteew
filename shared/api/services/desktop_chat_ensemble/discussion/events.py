# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Redis stream publishers/readers for Discussion live events (PG remains durable SoT).
# Invariants:
# - Event payloads never include prompts or secrets.
# - Stream is bounded (MAXLEN ~); reload always rehydrates from PostgreSQL turns.
# - Redis XREAD fields: accept str keys (decode_responses) and bytes keys.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion Redis event stream helpers."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from api.services.desktop_chat_ensemble.discussion.contracts import EVENT_STREAM_MAXLEN, DiscussionEventType

logger = logging.getLogger(__name__)


def event_stream_key(session_id: UUID | str) -> str:
    return f"dai:discussion:events:{session_id}"


def _stream_field(fields: Any, name: str) -> Any:
    """Redis XREAD fields may be str (decode_responses=True) or bytes."""
    if not isinstance(fields, dict):
        return None
    if name in fields:
        return fields[name]
    return fields.get(name.encode("utf-8"))


async def publish_discussion_event(
    *,
    session_id: UUID,
    event_type: DiscussionEventType | str,
    payload: dict[str, Any],
) -> str | None:
    """XADD one event; returns stream entry id or None on degrade."""
    try:
        from api.services.redis_service import get_redis_service

        service = await get_redis_service()
        async with service.get_redis_client() as redis:
            body = {
                "type": str(event_type),
                "payload": json.dumps(payload, ensure_ascii=False, default=str),
            }
            entry_id = await redis.xadd(
                event_stream_key(session_id),
                body,
                maxlen=EVENT_STREAM_MAXLEN,
                approximate=True,
            )
            return str(entry_id) if entry_id else None
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] discussion_event_publish_skip session_id=%s type=%s err=%s",
            session_id,
            event_type,
            exc,
        )
        return None


async def read_discussion_events(
    *,
    session_id: UUID,
    last_id: str = "0-0",
    block_ms: int = 15_000,
    count: int = 32,
) -> list[tuple[str, dict[str, Any]]]:
    """Blocking XREAD; returns [(id, {type, payload_dict})]."""
    rows: Any = None
    try:
        from api.services.redis_service import get_redis_service

        service = await get_redis_service()
        async with service.get_redis_client() as redis:
            rows = await redis.xread(
                {event_stream_key(session_id): last_id or "0-0"},
                count=max(1, min(int(count), 100)),
                block=max(0, int(block_ms)),
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] discussion_event_read_skip session_id=%s err=%s",
            session_id,
            exc,
        )
        return []

    out: list[tuple[str, dict[str, Any]]] = []
    if not rows:
        return out
    for _key, entries in rows:
        for entry_id, fields in entries:
            raw_type = _stream_field(fields, "type")
            raw_payload = _stream_field(fields, "payload")
            if isinstance(raw_type, bytes):
                raw_type = raw_type.decode("utf-8", errors="replace")
            if isinstance(raw_payload, bytes):
                raw_payload = raw_payload.decode("utf-8", errors="replace")
            parsed: dict[str, Any]
            try:
                parsed = json.loads(raw_payload) if raw_payload else {}
            except TypeError, json.JSONDecodeError:
                parsed = {"raw": raw_payload}
            eid = entry_id.decode("utf-8") if isinstance(entry_id, bytes) else str(entry_id)
            out.append((eid, {"type": str(raw_type or ""), "payload": parsed}))
    return out


async def iter_discussion_sse(
    *,
    session_id: UUID,
    last_id: str = "0-0",
) -> AsyncIterator[tuple[str, str, dict[str, Any]]]:
    """Yield (sse_event_name, stream_id, payload) until cancelled by caller."""
    cursor = last_id or "0-0"
    while True:
        batch = await read_discussion_events(session_id=session_id, last_id=cursor, block_ms=12_000)
        if not batch:
            yield ("keepalive", cursor, {})
            continue
        for eid, item in batch:
            cursor = eid
            yield (str(item.get("type") or "message"), eid, dict(item.get("payload") or {}))
