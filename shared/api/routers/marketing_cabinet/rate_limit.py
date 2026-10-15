# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Marketing Cabinet: rate limit for AI endpoints (chat, extract, swot).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Marketing Cabinet: rate limit for AI endpoints (chat, extract, swot).
Prefers Redis (shared across API replicas); falls back to in-memory token bucket.
"""

from __future__ import annotations

import logging
import time

from api.core.marketing_cabinet_rate_limit import (
    clamp_marketing_cabinet_ai_per_minute,
    clamp_marketing_dashboard_write_per_minute,
)
from api.core.unified_config import unified_settings
from api.services.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

_MC_RATE_LIMITER: RateLimiter | None = None
_MC_DASHBOARD_WRITE_LIMITER: RateLimiter | None = None


def _memory_limiter_per_minute() -> int:
    return clamp_marketing_cabinet_ai_per_minute(unified_settings.marketing_cabinet_ai_rate_limit_per_minute)


def _dashboard_write_per_minute() -> int:
    return clamp_marketing_dashboard_write_per_minute(unified_settings.marketing_dashboard_write_rate_limit_per_minute)


def get_marketing_cabinet_ai_rate_limiter() -> RateLimiter:
    """Singleton in-memory limiter (fallback when Redis unavailable)."""
    global _MC_RATE_LIMITER
    if _MC_RATE_LIMITER is None:
        per_min = _memory_limiter_per_minute()
        _MC_RATE_LIMITER = RateLimiter(
            requests_per_minute=per_min,
            burst_capacity=per_min,
            cleanup_interval=120,
        )
    return _MC_RATE_LIMITER


async def check_marketing_cabinet_ai_rate_limit(user_id: str) -> tuple[bool, float | None]:
    """
    Returns (allowed, retry_after_seconds).
    Uses Redis INCR per minute bucket when DatabaseManager Redis is available.
    """
    per_min = _memory_limiter_per_minute()
    minute_bucket = int(time.time() // 60)
    key = f"rate_limit:marketing_cabinet_ai:{user_id}:{minute_bucket}"

    try:
        from api.core.database_manager import DatabaseConnectionError, get_database_manager  # noqa: PLC0415

        manager = await get_database_manager()
        redis_client = await manager.get_redis_client()
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, 120)
        if current > per_min:
            await redis_client.decr(key)
            retry = max(1.0, 60.0 - (time.time() % 60))
            return False, retry
        return True, None
    except (DatabaseConnectionError, ImportError, OSError, RuntimeError, TypeError, ValueError) as e:
        logger.debug("Marketing cabinet AI rate limit: Redis unavailable, using memory: %s", e)
    except Exception:
        logger.warning("Marketing cabinet AI rate limit: Redis error, using memory", exc_info=True)

    limiter = get_marketing_cabinet_ai_rate_limiter()
    return limiter.check_rate_limit(user_id)


async def check_marketing_dashboard_write_rate_limit(
    user_id: str, *, route: str = "default"
) -> tuple[bool, float | None]:
    """
    Лимит мутаций дашборда (сетка, виджеты). Отдельный ключ от AI-limiter.
    Один счётчик на пользователя в минуту (общий бакет); ``route`` — для диагностики в логах при 429.
    Returns (allowed, retry_after_seconds).
    """
    per_min = _dashboard_write_per_minute()
    minute_bucket = int(time.time() // 60)
    key = f"rate_limit:marketing_dashboard_write:{user_id}:{minute_bucket}"

    try:
        from api.core.database_manager import DatabaseConnectionError, get_database_manager  # noqa: PLC0415

        manager = await get_database_manager()
        redis_client = await manager.get_redis_client()
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, 120)
        if current > per_min:
            await redis_client.decr(key)
            retry = max(1.0, 60.0 - (time.time() % 60))
            logger.info(
                "Marketing dashboard write rate limited (redis) user=%s route=%s",
                user_id,
                route,
            )
            return False, retry
        return True, None
    except (DatabaseConnectionError, ImportError, OSError, RuntimeError, TypeError, ValueError) as e:
        logger.debug("Marketing dashboard write rate limit: Redis unavailable, using memory: %s", e)
    except Exception:
        logger.warning(
            "Marketing dashboard write rate limit: Redis error, using memory",
            exc_info=True,
        )

    global _MC_DASHBOARD_WRITE_LIMITER  # noqa: PLW0603
    if _MC_DASHBOARD_WRITE_LIMITER is None:
        _MC_DASHBOARD_WRITE_LIMITER = RateLimiter(
            requests_per_minute=per_min,
            burst_capacity=max(20, per_min // 2),
            cleanup_interval=120,
        )
    allowed, retry = _MC_DASHBOARD_WRITE_LIMITER.check_rate_limit(f"dash_write:{user_id}")
    if not allowed:
        logger.info(
            "Marketing dashboard write rate limited (memory) user=%s route=%s",
            user_id,
            route,
        )
    return allowed, retry
