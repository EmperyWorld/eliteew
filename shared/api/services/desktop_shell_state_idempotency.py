# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# P2 Redis Idempotency-Key helpers for PATCH /desktop/shell-state (optional header;
# fail-closed when key present and Redis down). Peer of desktop_widget_sync.
# Invariants:
# - No Redis call when Idempotency-Key absent (legacy clients / keepalive).
# - Cached payload is DesktopShellStateOut JSON; replay must recompute ETag headers.
# Related:
# - api/routers/desktop_shell_config.py
# - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
# ---
"""Desktop shell-state PATCH Redis idempotency (P2)."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any
from uuid import UUID

from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

SHELL_STATE_IDEMPOTENCY_TTL_SEC = 86400
SHELL_STATE_IDEMPOTENCY_KEY_MIN_LEN = 8
SHELL_STATE_IDEMPOTENCY_KEY_MAX_LEN = 128
SHELL_STATE_IDEMPOTENCY_REDIS_PREFIX = "desktop_shell_state_patch:"
SHELL_STATE_IN_PROGRESS_MARKER = "in_progress"


class ShellStateRedisUnavailableError(RuntimeError):
    """Redis required for presented Idempotency-Key but unavailable (fail-closed)."""


class ShellStateInProgressError(RuntimeError):
    """Same Idempotency-Key is currently being processed."""


def normalize_shell_state_idempotency_key(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if len(s) < SHELL_STATE_IDEMPOTENCY_KEY_MIN_LEN or len(s) > SHELL_STATE_IDEMPOTENCY_KEY_MAX_LEN:
        return None
    return s


def shell_state_idempotency_redis_key(user_id: UUID, idem_key: str) -> str:
    digest = hashlib.sha256(idem_key.encode("utf-8")).hexdigest()[:40]
    return f"{SHELL_STATE_IDEMPOTENCY_REDIS_PREFIX}{user_id}:{digest}"


async def _redis_client() -> Any:
    from api.core.database_manager import get_database_manager  # noqa: PLC0415

    manager = await get_database_manager()
    return await manager.get_redis_client()


async def get_shell_state_idempotent_response(user_id: UUID, idem_key: str) -> dict[str, Any] | None:
    """Return cached shell-state JSON body, or None on miss."""
    rkey = shell_state_idempotency_redis_key(user_id, idem_key)
    try:
        redis_client = await _redis_client()
        raw = await redis_client.get(rkey)
    except Exception as exc:  # noqa: BLE001 — fail-closed boundary
        logger.warning("shell_state idempotency get failed: %s", exc, exc_info=True)
        raise ShellStateRedisUnavailableError("shell_state idempotency store unavailable") from exc

    if not raw:
        return None
    if isinstance(raw, bytes | bytearray):
        raw = raw.decode("utf-8")
    text = str(raw)
    if text == SHELL_STATE_IN_PROGRESS_MARKER:
        raise ShellStateInProgressError("shell_state Idempotency-Key in progress")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("shell_state idempotency corrupt payload; treating as miss")
        return None
    if not isinstance(parsed, dict):
        return None
    return parsed


async def claim_shell_state_idempotency_key(user_id: UUID, idem_key: str) -> bool:
    """SET NX in_progress. True if claimed; False if key already exists."""
    rkey = shell_state_idempotency_redis_key(user_id, idem_key)
    try:
        redis_client = await _redis_client()
        ok = await redis_client.set(
            rkey,
            SHELL_STATE_IN_PROGRESS_MARKER,
            nx=True,
            ex=SHELL_STATE_IDEMPOTENCY_TTL_SEC,
        )
        return bool(ok)
    except Exception as exc:  # noqa: BLE001
        logger.warning("shell_state idempotency claim failed: %s", exc, exc_info=True)
        raise ShellStateRedisUnavailableError("shell_state idempotency store unavailable") from exc


async def remember_shell_state_idempotent_response(user_id: UUID, idem_key: str, response_body: dict[str, Any]) -> None:
    rkey = shell_state_idempotency_redis_key(user_id, idem_key)
    payload = json.dumps(response_body)
    try:
        redis_client = await _redis_client()
        await redis_client.setex(rkey, SHELL_STATE_IDEMPOTENCY_TTL_SEC, payload)
    except Exception as exc:  # noqa: BLE001
        logger.warning("shell_state idempotency remember failed after commit: %s", exc, exc_info=True)


async def release_shell_state_idempotency_claim(user_id: UUID, idem_key: str) -> None:
    """Delete in_progress marker so a failed attempt can retry with the same key."""
    rkey = shell_state_idempotency_redis_key(user_id, idem_key)
    try:
        redis_client = await _redis_client()
        raw = await redis_client.get(rkey)
        if isinstance(raw, bytes | bytearray):
            raw = raw.decode("utf-8")
        if str(raw) == SHELL_STATE_IN_PROGRESS_MARKER:
            await redis_client.delete(rkey)
    except (RedisError, OSError, RuntimeError, TypeError, ValueError) as exc:
        logger.debug("[STEP] shell_state_idempotency_release_skip: %s", exc)
