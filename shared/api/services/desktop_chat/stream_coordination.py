# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve Desktop AI Chat stream lock mode and Postgres advisory-lock fallback when Redis is down.
# Invariants:
# - strict mode raises StreamCoordinationUnavailable instead of fail-open.
# - pg_fallback holds one pool connection per active stream until release.
# Related:
# - api/services/desktop_chat/stream_lock.py
# - api/routers/desktop_ai_chat.py
# ---
"""Stream coordination policy: Redis primary, optional PG advisory fallback, strict/degrade modes."""

from __future__ import annotations

import hashlib
import logging
import os
from enum import StrEnum
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

_LOCK_KEY_PREFIX = "dai:stream:lock:"
_IDEM_KEY_PREFIX = "dai:stream:idem:"


class StreamCoordinationMode(StrEnum):
    STRICT = "strict"
    DEGRADE = "degrade"
    PG_FALLBACK = "pg_fallback"


class StreamCoordinationUnavailable(Exception):
    """Redis/coordination unavailable in strict mode."""


def resolve_stream_coordination_mode() -> StreamCoordinationMode:
    raw = (os.environ.get("DESKTOP_AI_CHAT_STREAM_LOCK_MODE") or "pg_fallback").strip().lower()
    match raw:
        case "strict":
            return StreamCoordinationMode.STRICT
        case "degrade" | "fail_open" | "fail-open":
            return StreamCoordinationMode.DEGRADE
        case _:
            return StreamCoordinationMode.PG_FALLBACK


def advisory_lock_keys(scope: str) -> tuple[int, int]:
    digest = hashlib.sha256(scope.encode("utf-8")).digest()
    k1 = int.from_bytes(digest[0:4], byteorder="big", signed=True)
    k2 = int.from_bytes(digest[4:8], byteorder="big", signed=True)
    return k1, k2


def chat_lock_scope(chat_id: UUID) -> str:
    return f"{_LOCK_KEY_PREFIX}{chat_id}"


def idempotency_scope(user_id: UUID, client_request_id: UUID) -> str:
    return f"{_IDEM_KEY_PREFIX}{user_id}:{client_request_id}"


def observe_coordination_degraded(*, reason: str, operation: str) -> None:
    from api.monitoring.metrics import observe_desktop_stream_coordination

    mode = resolve_stream_coordination_mode().value
    observe_desktop_stream_coordination(event="degraded", mode=mode, reason=reason, operation=operation)
    logger.warning(
        "[STEP] desktop_ai_chat stream_lock_fail_open reason=%s mode=%s operation=%s",
        reason,
        mode,
        operation,
    )


async def try_pg_advisory_lock(pool: Any, scope: str) -> tuple[bool, Any | None]:
    """Acquire session-scoped advisory lock; returns (ok, connection to release later)."""
    if pool is None:
        return False, None
    conn = await pool.acquire()
    k1, k2 = advisory_lock_keys(scope)
    try:
        locked = await conn.fetchval("SELECT pg_try_advisory_lock($1, $2)", k1, k2)
        if locked:
            return True, conn
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] desktop_ai_chat pg_advisory_lock_failed scope=%s detail=%s", scope[:48], exc)
    await pool.release(conn)
    return False, None


async def release_pg_advisory_lock(pool: Any, conn: Any, scope: str) -> None:
    if pool is None or conn is None:
        return
    k1, k2 = advisory_lock_keys(scope)
    try:
        await conn.execute("SELECT pg_advisory_unlock($1, $2)", k1, k2)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] desktop_ai_chat pg_advisory_unlock_failed scope=%s detail=%s", scope[:48], exc)
    finally:
        await pool.release(conn)


__all__ = (
    "StreamCoordinationMode",
    "StreamCoordinationUnavailable",
    "advisory_lock_keys",
    "chat_lock_scope",
    "idempotency_scope",
    "observe_coordination_degraded",
    "release_pg_advisory_lock",
    "resolve_stream_coordination_mode",
    "try_pg_advisory_lock",
)
