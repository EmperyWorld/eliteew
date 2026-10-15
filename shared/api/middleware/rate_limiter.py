#!/usr/bin/env python3
"""
Rate Limiting для Marketing Cabinet и других API endpoints
Использует slowapi для контроля частоты запросов
"""

import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from fastapi import FastAPI  # type: ignore[import-untyped]
from slowapi import (  # type: ignore[import-not-found]
    Limiter,
    _rate_limit_exceeded_handler,
)
from slowapi.errors import RateLimitExceeded  # type: ignore[import-not-found]
from slowapi.util import get_remote_address  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings

T = TypeVar("T")

logger = logging.getLogger(__name__)

# Создаём limiter с дефолтными лимитами  # noqa: RUF003
# Redis optional - если недоступен, будет использовать in-memory storage
redis_url = unified_settings.redis_url

if redis_url:
    try:
        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=["100/minute"],
            storage_uri=redis_url,
            strategy="fixed-window",
        )
        logger.info("Rate limiter initialized with Redis backend")
    except (ConnectionError, OSError, ValueError) as e:
        logger.warning("Redis unavailable for rate limiting, using in-memory: %s", e)
        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=["100/minute"],
            strategy="fixed-window",
        )
else:
    # Fallback: in-memory storage (не рекомендуется для production с несколькими воркерами)  # noqa: RUF003
    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"], strategy="fixed-window")
    logger.warning("Rate limiter using in-memory storage (not distributed)")


def setup_rate_limiter(app: FastAPI) -> None:
    """
    Настройка rate limiting для FastAPI приложения

    Args:
        app: FastAPI application instance
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("Rate limiting configured and active")


# Custom rate limit decorator для особо защищённых endpoints  # noqa: RUF003
def strict_rate_limit(
    limit: str,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """
    Decorator для строгих rate limits на критичных endpoints

    Args:
        limit: Rate limit в формате "N/period" (например, "5/minute")

    Example:
        @router.post("/expensive-operation")
        @strict_rate_limit("3/minute")
        async def expensive_endpoint():
            ...
    """

    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        return limiter.limit(limit)(func)  # type: ignore[return-value]

    return decorator
