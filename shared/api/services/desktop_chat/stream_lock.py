# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Per-chat stream lock and client_request_id idempotency (Redis + optional PG advisory fallback).
# Invariants:
# - Mode from DESKTOP_AI_CHAT_STREAM_LOCK_MODE: strict | degrade | pg_fallback (default).
# - strict raises StreamCoordinationUnavailable when Redis unavailable.
# Related:
# - api/services/desktop_chat/stream_coordination.py
# - api/routers/desktop_ai_chat.py
# ---
"""Per-chat stream lock and optional client_request_id idempotency."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Any
from uuid import UUID

from api.core.database_manager import get_redis_client
from api.services.desktop_chat.stream_coordination import (
    StreamCoordinationMode,
    StreamCoordinationUnavailable,
    chat_lock_scope,
    idempotency_scope,
    observe_coordination_degraded,
    release_pg_advisory_lock,
    resolve_stream_coordination_mode,
    try_pg_advisory_lock,
)

logger = logging.getLogger(__name__)

_LOCK_PREFIX = "dai:stream:lock:"
_LOCK_TTL_SEC = 240
_REFRESH_INTERVAL_SEC = 45.0
_IDEM_PREFIX = "dai:stream:idem:"
_IDEM_TTL_SEC = 3600

_pg_chat_locks: dict[str, tuple[Any, Any]] = {}
_pg_idem_locks: dict[str, tuple[Any, Any]] = {}


async def _redis() -> Any:
    try:
        return await get_redis_client()
    except Exception:  # noqa: BLE001
        observe_coordination_degraded(reason="redis_unavailable", operation="connect")
        return None


async def acquire_stream_lock(
    chat_id: UUID,
    user_id: UUID,
    *,
    db_pool: Any | None = None,
) -> bool:
    """Return True if lock acquired. Behavior depends on DESKTOP_AI_CHAT_STREAM_LOCK_MODE."""
    mode = resolve_stream_coordination_mode()
    r = await _redis()
    if r:
        key = f"{_LOCK_PREFIX}{chat_id}"
        try:
            ok = await r.set(key, str(user_id), nx=True, ex=_LOCK_TTL_SEC)
            return bool(ok)
        except Exception as e:  # noqa: BLE001
            observe_coordination_degraded(reason="acquire_exception", operation="chat_lock")
            if mode == StreamCoordinationMode.STRICT:
                raise StreamCoordinationUnavailable("acquire_exception") from e
            if mode == StreamCoordinationMode.DEGRADE:
                return True
    else:
        if mode == StreamCoordinationMode.STRICT:
            raise StreamCoordinationUnavailable("redis_unavailable")
        if mode == StreamCoordinationMode.DEGRADE:
            return True

    if mode == StreamCoordinationMode.PG_FALLBACK and db_pool is not None:
        scope = chat_lock_scope(chat_id)
        ok, conn = await try_pg_advisory_lock(db_pool, scope)
        if ok and conn is not None:
            _pg_chat_locks[str(chat_id)] = (db_pool, conn)
            observe_coordination_degraded(reason="redis_unavailable", operation="pg_chat_lock")
            return True
        return False

    if mode == StreamCoordinationMode.DEGRADE:
        return True
    raise StreamCoordinationUnavailable("coordination_unavailable")


async def release_stream_lock(chat_id: UUID) -> None:
    r = await _redis()
    if r:
        try:
            await r.delete(f"{_LOCK_PREFIX}{chat_id}")
        except Exception as e:  # noqa: BLE001
            logger.warning("release_stream_lock failed: %s", e)

    entry = _pg_chat_locks.pop(str(chat_id), None)
    if entry is not None:
        pool, conn = entry
        await release_pg_advisory_lock(pool, conn, chat_lock_scope(chat_id))


async def peek_stream_lock(chat_id: UUID) -> dict[str, Any]:
    """Read-only lock status for collaboration polling (no acquire)."""
    r = await _redis()
    if not r:
        # PG fallback locks are process-local; without Redis report unlocked for poll UX.
        locked_pg = str(chat_id) in _pg_chat_locks
        return {
            "locked": locked_pg,
            "holder_user_id": None,
            "ttl_sec": None,
        }
    key = f"{_LOCK_PREFIX}{chat_id}"
    try:
        holder = await r.get(key)
        if holder is None:
            return {"locked": False, "holder_user_id": None, "ttl_sec": None}
        holder_s = holder.decode("utf-8", errors="replace") if isinstance(holder, bytes) else str(holder)
        ttl = await r.ttl(key)
        return {
            "locked": True,
            "holder_user_id": holder_s,
            "ttl_sec": int(ttl) if isinstance(ttl, int) and ttl >= 0 else None,
        }
    except Exception as e:  # noqa: BLE001
        logger.debug("[STEP] desktop_ai_chat stream_lock_peek_skip reason=%s", e)
        return {"locked": False, "holder_user_id": None, "ttl_sec": None}


async def _refresh_stream_lock_loop(chat_id: UUID) -> None:
    try:
        while True:
            await asyncio.sleep(_REFRESH_INTERVAL_SEC)
            r = await _redis()
            if not r:
                continue
            try:
                key = f"{_LOCK_PREFIX}{chat_id}"
                n = await r.expire(key, _LOCK_TTL_SEC)
                if not n:
                    break
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[STEP] desktop_ai_chat stream_lock_refresh_failed detail=%s",
                    e,
                )
    except asyncio.CancelledError:
        raise


async def try_register_idempotency(
    user_id: UUID,
    client_request_id: UUID,
    *,
    db_pool: Any | None = None,
) -> bool:
    """Return True if first use of idempotency key."""
    mode = resolve_stream_coordination_mode()
    r = await _redis()
    if r:
        key = f"{_IDEM_PREFIX}{user_id}:{client_request_id}"
        try:
            ok = await r.set(key, "1", nx=True, ex=_IDEM_TTL_SEC)
            return bool(ok)
        except Exception as e:  # noqa: BLE001
            observe_coordination_degraded(reason="idempotency_exception", operation="idem")
            if mode == StreamCoordinationMode.STRICT:
                raise StreamCoordinationUnavailable("idempotency_exception") from e
            if mode == StreamCoordinationMode.DEGRADE:
                return True
    else:
        if mode == StreamCoordinationMode.STRICT:
            raise StreamCoordinationUnavailable("redis_unavailable")
        if mode == StreamCoordinationMode.DEGRADE:
            return True

    if mode == StreamCoordinationMode.PG_FALLBACK and db_pool is not None:
        scope = idempotency_scope(user_id, client_request_id)
        idem_key = f"{user_id}:{client_request_id}"
        ok, conn = await try_pg_advisory_lock(db_pool, scope)
        if ok and conn is not None:
            _pg_idem_locks[idem_key] = (db_pool, conn)
            return True
        return False

    if mode == StreamCoordinationMode.DEGRADE:
        return True
    raise StreamCoordinationUnavailable("coordination_unavailable")


async def release_idempotency(user_id: UUID, client_request_id: UUID) -> None:
    r = await _redis()
    if r:
        try:
            await r.delete(f"{_IDEM_PREFIX}{user_id}:{client_request_id}")
        except Exception as e:  # noqa: BLE001
            logger.warning("release_idempotency failed: %s", e)

    idem_key = f"{user_id}:{client_request_id}"
    entry = _pg_idem_locks.pop(idem_key, None)
    if entry is not None:
        pool, conn = entry
        await release_pg_advisory_lock(pool, conn, idempotency_scope(user_id, client_request_id))


async def wrap_stream_with_lock_and_idem(
    gen: AsyncIterator[str],
    *,
    chat_id: UUID,
    user_id: UUID,
    client_request_id: UUID | None,
) -> AsyncIterator[str]:
    """Release lock when stream ends; drop idempotency key on failure so client can retry."""
    refresh_task = asyncio.create_task(_refresh_stream_lock_loop(chat_id))
    ok_finish = False
    try:
        async for chunk in gen:
            yield chunk
        ok_finish = True
    finally:
        refresh_task.cancel()
        with suppress(asyncio.CancelledError):
            await refresh_task
        if client_request_id and not ok_finish:
            await release_idempotency(user_id, client_request_id)
        await release_stream_lock(chat_id)
        try:
            from api.routers.socketio_emit_desktop_ai_chat import emit_desktop_ai_chat_turn_done

            await emit_desktop_ai_chat_turn_done(chat_id=chat_id, actor_user_id=user_id)
        except Exception:
            logger.debug("[STEP] desktop_ai_chat turn_done_emit_skip chat=%s", chat_id, exc_info=True)
