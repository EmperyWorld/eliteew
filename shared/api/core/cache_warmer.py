"""Cache warming utilities for application startup performance optimization."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import text  # type: ignore[import-not-found]

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import (
        AsyncSession,
    )  # type: ignore[import-not-found]

    from api.services.redis_service import RedisService

logger = logging.getLogger(__name__)


async def _warm_user_profiles(db: AsyncSession, redis_service: RedisService, stats: dict[str, Any]) -> None:
    """Warm user profiles cache."""
    logger.info("Warming user profiles...")

    try:
        result = await db.execute(
            text(
                """
                SELECT id, username, email, full_name, role,
                       avatar_url, created_at, last_login_at
                FROM users
                ORDER BY last_login_at DESC NULLS LAST
                LIMIT 100
            """,
            ),
        )

        users = result.fetchall()

        for user in users:
            user_data = {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "avatar_url": user.avatar_url,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": (user.last_login_at.isoformat() if user.last_login_at else None),
                "cached_at": datetime.now(UTC).isoformat(),
            }

            cache_key = f"user_profile:{user.id}"

            async with redis_service.get_redis_client() as redis:  # type: ignore[assignment]
                if redis:
                    await redis.setex(  # type: ignore[union-attr]
                        cache_key,
                        redis_service.DEFAULT_EXPIRATIONS["user_cache"],
                        json.dumps(user_data, default=str),
                    )
                    stats["users_cached"] += 1

        logger.info("Cached %s user profiles", stats["users_cached"])

    except Exception:
        logger.exception("Failed to warm user profiles")
        stats["errors"] += 1


async def _warm_user_themes(db: AsyncSession, redis_service: RedisService, stats: dict[str, Any]) -> None:
    """Warm user themes cache."""
    logger.info("Warming user themes...")

    try:
        result = await db.execute(
            text(
                """
                SELECT user_id, theme_data, created_at, updated_at
                FROM user_themes
                WHERE is_active = true
            """,
            ),
        )

        themes = result.fetchall()

        for theme in themes:
            theme_dict = {
                "user_id": str(theme.user_id),
                "theme_data": theme.theme_data,
                "created_at": (theme.created_at.isoformat() if theme.created_at else None),
                "updated_at": (theme.updated_at.isoformat() if theme.updated_at else None),
                "cached_at": datetime.now(UTC).isoformat(),
            }

            cache_key = f"user_theme:{theme.user_id}"

            async with redis_service.get_redis_client() as redis:  # type: ignore[assignment]
                if redis:
                    await redis.setex(  # type: ignore[union-attr]
                        cache_key,
                        redis_service.DEFAULT_EXPIRATIONS["user_cache"],
                        json.dumps(theme_dict, default=str),
                    )
                    stats["themes_cached"] += 1

        logger.info("Cached %s user themes", stats["themes_cached"])

    except Exception:
        logger.exception("Failed to warm user themes")
        stats["errors"] += 1


async def _warm_system_configs(db: AsyncSession, redis_service: RedisService, stats: dict[str, Any]) -> None:
    """Warm system configs cache."""
    logger.info("Warming system configs...")

    try:
        result = await db.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'system_settings'
                )
            """,
            ),
        )

        row = result.fetchone()
        table_exists = row[0] if row else False

        if not table_exists:
            result = await db.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = 'system_settings'
                    )
                """,
                ),
            )
            row = result.fetchone()
            table_exists = row[0] if row else False

        if table_exists:
            result = await db.execute(
                text(
                    """
                    SELECT key, value
                    FROM system_settings
                    WHERE is_public = true
                """,
                ),
            )

            configs = result.fetchall()

            for config in configs:
                cache_key = f"system_config:{config.key}"

                async with redis_service.get_redis_client() as redis:  # type: ignore[assignment]
                    if redis:
                        await redis.setex(  # type: ignore[union-attr]
                            cache_key,
                            redis_service.DEFAULT_EXPIRATIONS["api_cache"],
                            str(config.value),
                        )
                        stats["configs_cached"] += 1

            logger.info("Cached %s system configs", stats["configs_cached"])
        else:
            logger.info("system_settings table not found - skipping")

    except Exception:
        logger.exception("Failed to warm system configs")
        stats["errors"] += 1


async def warm_cache_on_startup() -> None:
    """Warm frequently accessed data into Redis cache on application startup.

    Target: Improve hit rate from 36% to >70%.

    Strategy:
    1. Pre-cache user profiles (top 100 active users)
    2. Pre-cache theme data
    3. Pre-cache system configs
    4. Pre-cache frequently accessed API endpoints
    """
    # Циклическая зависимость: избегаем импорт на top-level
    from api.core.database_manager import get_database_manager  # noqa: PLC0415
    from api.services.redis_service import get_redis_service  # noqa: PLC0415

    logger.info("Starting cache warming for performance optimization...")

    start_time = datetime.now(UTC)
    stats = {"users_cached": 0, "themes_cached": 0, "configs_cached": 0, "errors": 0}

    try:
        redis_service = await get_redis_service()
        if not redis_service.is_available:
            success = await redis_service.initialize()
            if not success:
                logger.warning("Redis not available - skipping cache warming")
                return

        # Use single global DatabaseManager (do not create a new instance)
        try:
            db_manager = await get_database_manager()
        except Exception as e:
            logger.warning(
                "Cache warming skipped: DatabaseManager unavailable (%s). "
                "Ensure POSTGRES_USER/POSTGRES_PASSWORD match docker/env_file/.env.stack1",
                e,
            )
            return

        async with db_manager.get_postgres_session() as db:
            await _warm_user_profiles(db, redis_service, stats)
            await _warm_user_themes(db, redis_service, stats)
            await _warm_system_configs(db, redis_service, stats)

        # ===================================================================
        # REPORT CACHE WARMING RESULTS
        # ===================================================================
        duration = (datetime.now(UTC) - start_time).total_seconds()

        # Log only if there's something significant to report or errors occurred
        if (
            stats["errors"] > 0
            or stats["users_cached"] > 0
            or stats["themes_cached"] > 0
            or stats["configs_cached"] > 0
        ):
            logger.info(
                ("Cache warming complete: %d users, %d themes, %d configs cached in %.2fs"),
                stats["users_cached"],
                stats["themes_cached"],
                stats["configs_cached"],
                duration,
            )
        else:
            logger.debug("Cache warming completed (no data to cache)")

    except Exception:
        logger.exception("Cache warming failed critically")


async def get_cache_stats() -> dict[str, Any]:
    """Get cache warming statistics."""
    # Циклическая зависимость: избегаем импорт на top-level
    from api.services.redis_service import get_redis_service  # noqa: PLC0415

    redis_service = await get_redis_service()
    if not redis_service.is_available:
        return {"status": "redis_unavailable"}

    async with redis_service.get_redis_client() as redis:  # type: ignore[assignment]
        if not redis:
            return {"status": "redis_unavailable"}

        try:
            # Count cached items by prefix
            user_profiles: list[str] = await redis.keys("user_profile:*")  # type: ignore[union-attr, assignment]
            user_themes: list[str] = await redis.keys("user_theme:*")  # type: ignore[union-attr, assignment]
            system_configs: list[str] = await redis.keys("system_config:*")  # type: ignore[union-attr, assignment]

            # Get Redis stats
            info: dict[str, Any] = await redis.info("stats")  # type: ignore[union-attr, assignment]

            return {
                "status": "healthy",
                "cached_items": {
                    "user_profiles": len(user_profiles),  # type: ignore[arg-type]
                    "user_themes": len(user_themes),  # type: ignore[arg-type]
                    "system_configs": len(system_configs),  # type: ignore[arg-type]
                    "total": (len(user_profiles) + len(user_themes) + len(system_configs)),  # type: ignore[arg-type]
                },
                "redis_stats": {
                    "keyspace_hits": info.get("keyspace_hits", 0) or 0,  # type: ignore[union-attr]
                    "keyspace_misses": info.get("keyspace_misses", 0) or 0,  # type: ignore[union-attr]
                    "hit_rate": calculate_hit_rate(
                        info.get("keyspace_hits", 0) or 0,  # type: ignore[union-attr]
                        info.get("keyspace_misses", 0) or 0,  # type: ignore[union-attr]
                    ),
                },
            }
        except Exception as exc:
            logger.exception("Failed to get cache stats")
            return {"status": "error", "error": str(exc)}


def calculate_hit_rate(hits: int, misses: int) -> float:
    """Calculate cache hit rate percentage."""
    if hits + misses == 0:
        return 0.0
    return round(hits * 100 / (hits + misses), 2)
