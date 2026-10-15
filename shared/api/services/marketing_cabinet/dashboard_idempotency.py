"""Idempotency for marketing dashboard mutating endpoints (Redis when available)."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from redis.exceptions import RedisError

from api.schemas.marketing_cabinet.dashboard import WidgetResponse

logger = logging.getLogger(__name__)

_IDEMPOTENCY_TTL_SEC = 86400


def _normalize_idempotency_key(raw: str) -> str:
    t = raw.strip()
    return t[:128] if t else ""


def _redis_key(user_id: str, normalized_key: str) -> str:
    digest = hashlib.sha256(normalized_key.encode("utf-8")).hexdigest()[:40]
    return f"idempotency:mc_dash:add_widget:{user_id}:{digest}"


async def get_widget_create_idempotent_response(user_id: str, idempotency_key: str | None) -> dict[str, Any] | None:
    normalized = _normalize_idempotency_key(idempotency_key or "")
    if not normalized:
        return None
    key = _redis_key(user_id, normalized)
    try:
        from api.core.database_manager import DatabaseConnectionError, get_database_manager  # noqa: PLC0415

        manager = await get_database_manager()
        redis_client = await manager.get_redis_client()
        raw = await redis_client.get(key)
        if not raw:
            return None
        if isinstance(raw, bytes | bytearray):
            raw = raw.decode("utf-8")
        return json.loads(str(raw))
    except (
        DatabaseConnectionError,
        ImportError,
        OSError,
        RuntimeError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as e:
        logger.debug("Dashboard widget idempotency read skipped: %s", e)
    except RedisError as e:
        logger.warning("Dashboard widget idempotency read failed: %s", e, exc_info=True)
    return None


async def remember_widget_create_idempotent_response(
    user_id: str, idempotency_key: str | None, response: WidgetResponse
) -> None:
    normalized = _normalize_idempotency_key(idempotency_key or "")
    if not normalized:
        return
    key = _redis_key(user_id, normalized)
    try:
        payload = json.dumps(response.model_dump(mode="json"))
    except (TypeError, ValueError) as e:
        logger.warning("Dashboard widget idempotency serialize failed: %s", e)
        return
    try:
        from api.core.database_manager import DatabaseConnectionError, get_database_manager  # noqa: PLC0415

        manager = await get_database_manager()
        redis_client = await manager.get_redis_client()
        await redis_client.setex(key, _IDEMPOTENCY_TTL_SEC, payload)
    except (DatabaseConnectionError, ImportError, OSError, RuntimeError, TypeError, ValueError) as e:
        logger.debug("Dashboard widget idempotency write skipped: %s", e)
    except RedisError as e:
        logger.warning("Dashboard widget idempotency write failed: %s", e, exc_info=True)
