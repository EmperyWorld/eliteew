# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS router-local helpers: SSE framing, non-critical error classification, and infrastructure health probes.
# Invariants:
#   - Health helpers are best-effort strings for the public ``/api/v1/ugs/health`` aggregate payload.
# Related:
#   - api/routers/ugs/generation.py (SSE + workflow execute detail classification)
#   - api/routers/ugs/health_metrics.py
# ---
"""Shared helpers for UGS HTTP routes."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import text  # type: ignore[import-not-found]

from api.core.database_manager import get_database_manager

logger = logging.getLogger(__name__)


def _sse_message(event: str, data: dict[str, Any]) -> str:
    """Format one SSE message (event + data)."""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def _is_not_found_or_denied_detail(detail: str) -> bool:
    normalized = detail.lower()
    return any(needle in normalized for needle in ("not found", "access denied", "не найден", "доступ запрещ"))


def _is_non_critical_error(error: Exception) -> bool:
    """
    Check if error is non-critical (RabbitMQ channel/connection errors).
    These errors don't prevent task retrieval from database.
    """
    error_msg = str(error).lower()
    error_type = type(error).__name__

    non_critical_patterns = [
        "channelclosed",
        "channel closed",
        "connection closed",
        "connection is closed",
        "connectionclosed",
        "connection refused",
        "connectionforced",
        "connection_reset",
        "amqpconnectionerror",
        "connection lost",
    ]

    if any(pattern in error_type.lower() for pattern in non_critical_patterns):
        return True

    return any(pattern in error_msg for pattern in non_critical_patterns)


async def get_database_health() -> str:
    """Check database connectivity and basic functionality"""
    try:
        manager = await get_database_manager()
        async with manager.get_postgres_session() as db:
            await db.execute(text("SELECT 1"))
    except (OSError, RuntimeError):  # fmt: skip
        logger.exception("Database health check failed")
        return "unhealthy"
    else:
        return "healthy"


async def get_cache_health() -> str:
    """Check Redis/cache connectivity"""
    try:
        manager = await get_database_manager()
        redis_client = await manager.get_redis_client()
        await redis_client.ping()
    except (OSError, RuntimeError):  # fmt: skip
        logger.exception("Cache health check failed")
        return "unhealthy"
    else:
        return "healthy"


MAX_QUEUE_SIZE = 1000  # Maximum queue size for healthy status


async def get_queue_health() -> str:
    """Check queue system health"""
    try:
        manager = await get_database_manager()
        async with manager.get_postgres_session() as db:
            result = await db.execute(
                text("""
                SELECT COUNT(*)
                FROM generation_queue gq
                JOIN generation_requests gr ON gr.id = gq.request_id
                WHERE gr.status = 'pending'
            """)
            )
            queue_size = result.scalar() or 0
            if queue_size < MAX_QUEUE_SIZE:
                return "healthy"
            return "degraded"
    except (OSError, RuntimeError):  # fmt: skip
        logger.exception("Queue health check failed")
        return "unhealthy"
