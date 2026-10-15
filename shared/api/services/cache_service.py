# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Dashboard/content Redis cache helpers; best-effort invalidators for post-mutation content and dashboard paths.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Cache Service for Dashboard and Content Operations
High-performance caching layer for frequently accessed data

Features:
- Redis-based caching for dashboard statistics
- Cache invalidation on data changes
- TTL-based expiration
- Graceful fallback to database queries

ВАЖНО: перед изменениями прочитайте документацию.
Документация: documentation/platform/REDIS_ARCHITECTURE.md

Этот сервис использует Redis DB 0 для кеширования дашборда и контента.
UserCacheService использует DB 15 ТОЛЬКО для пользователей.
"""

import json
import logging
from typing import Any
from uuid import UUID

from api.services.unified_content.redis_cache_service import RedisCacheService

logger = logging.getLogger(__name__)


class DashboardCacheService:
    """
    Cache service specifically for dashboard operations

    Caches:
    - User statistics (documents, chats, presentations, storage)
    - Activity timelines
    - Popular tags
    - Recent content
    """

    def __init__(self, redis_cache_service: RedisCacheService):
        self.redis_cache = redis_cache_service

    async def get_user_stats(self, user_id: str) -> dict[str, Any] | None:
        """
        Get cached user statistics for dashboard

        Args:
            user_id: User ID

        Returns:
            User stats dict or None if not cached
        """
        try:
            cache_key = f"dashboard:stats:{user_id}"
            await self.redis_cache._ensure_connected()
            if not self.redis_cache.redis_client:
                return None
            assert self.redis_cache.redis_client is not None
            value = await self.redis_cache.redis_client.get(cache_key)
            if value:
                result: dict[str, Any] = json.loads(value)
                return result
            return None
        except Exception as e:
            logger.exception(f"Failed to get cached user stats {user_id}: {e}")
            return None

    async def set_user_stats(self, user_id: str, stats: dict[str, Any], ttl: int = 600) -> bool:
        """
        Cache user statistics

        Args:
            user_id: User ID
            stats: Statistics data
            ttl: Time to live in seconds (default 5 minutes)

        Returns:
            True if cached successfully
        """
        try:
            cache_key = f"dashboard:stats:{user_id}"
            await self.redis_cache._ensure_connected()
            if not self.redis_cache.redis_client:
                return False
            assert self.redis_cache.redis_client is not None
            await self.redis_cache.redis_client.setex(cache_key, ttl, json.dumps(stats, default=str))
            return True
        except Exception as e:
            logger.exception(f"Failed to cache user stats {user_id}: {e}")
            return False

    async def invalidate_user_stats(self, user_id: str) -> None:
        """
        Invalidate user statistics cache so next dashboard request refetches from DB.

        Args:
            user_id: User ID (string or UUID string)
        """
        try:
            cache_key = f"dashboard:stats:{user_id}"
            await self.redis_cache._ensure_connected()
            if self.redis_cache.redis_client:
                await self.redis_cache.redis_client.delete(cache_key)
                logger.debug("Invalidated dashboard stats cache for user %s", user_id)
        except Exception as e:
            logger.warning("Failed to invalidate user stats cache %s: %s", user_id, e)

    async def get_activity_timeline(self, user_id: str, limit: int = 20) -> list[dict[str, Any]] | None:
        """
        Get cached activity timeline

        Args:
            user_id: User ID
            limit: Number of items

        Returns:
            Activity timeline list or None if not cached
        """
        try:
            await self.redis_cache._ensure_connected()
            client = self.redis_cache._get_client()
            cache_key = f"dashboard:activity:{user_id}:{limit}"

            value = await client.get(cache_key)
            if value:
                logger.debug(f"Cache HIT: activity timeline for user {user_id}")
                result: list[dict[str, Any]] = json.loads(value)
                return result

            logger.debug(f"Cache MISS: activity timeline for user {user_id}")
            return None
        except Exception as e:
            logger.exception(f"Failed to get cached activity timeline for user {user_id}: {e}")
            return None

    async def set_activity_timeline(
        self, user_id: str, timeline: list[dict[str, Any]], limit: int = 20, ttl: int = 180
    ) -> bool:
        """
        Cache activity timeline

        Args:
            user_id: User ID
            timeline: Timeline data
            limit: Number of items
            ttl: Time to live in seconds (default 3 minutes)

        Returns:
            True if cached successfully
        """
        try:
            await self.redis_cache._ensure_connected()
            client = self.redis_cache._get_client()
            cache_key = f"dashboard:activity:{user_id}:{limit}"

            value = json.dumps(timeline, default=str)
            await client.setex(cache_key, ttl, value)

            logger.debug(f"Cached activity timeline for user {user_id}")
            return True
        except Exception as e:
            logger.exception(f"Failed to cache activity timeline for user {user_id}: {e}")
            return False

    async def invalidate_activity_timeline(self, user_id: str) -> None:
        """
        Invalidate activity timeline cache for user

        Args:
            user_id: User ID
        """
        # Since we have different limits, we need to find and delete all related keys
        # For simplicity, we'll use a pattern-based invalidation
        try:
            await self.redis_cache._ensure_connected()
            if not self.redis_cache.redis_client:
                return
            assert self.redis_cache.redis_client is not None
            pattern = f"dashboard:activity:{user_id}:*"
            async for key in self.redis_cache.redis_client.scan_iter(pattern):
                await self.redis_cache.redis_client.delete(key)
            logger.debug(f"Invalidated activity timeline cache for user {user_id}")
        except Exception as e:
            logger.exception(f"Failed to invalidate activity timeline cache for user {user_id}: {e}")

    async def get_popular_tags(self, user_id: str, limit: int = 20) -> list[dict[str, Any]] | None:
        """
        Get cached popular tags

        Args:
            user_id: User ID
            limit: Number of tags

        Returns:
            Popular tags list or None if not cached
        """
        try:
            await self.redis_cache._ensure_connected()
            client = self.redis_cache._get_client()
            cache_key = f"dashboard:tags:popular:{user_id}:{limit}"

            value = await client.get(cache_key)
            if value:
                logger.debug(f"Cache HIT: popular tags for user {user_id}")
                result: list[dict[str, Any]] = json.loads(value)
                return result

            logger.debug(f"Cache MISS: popular tags for user {user_id}")
            return None
        except Exception as e:
            logger.exception(f"Failed to get cached popular tags for user {user_id}: {e}")
            return None

    async def set_popular_tags(self, user_id: str, tags: list[dict[str, Any]], limit: int = 20, ttl: int = 600) -> bool:
        """
        Cache popular tags

        Args:
            user_id: User ID
            tags: Tags data
            limit: Number of tags
            ttl: Time to live in seconds (default 10 minutes)

        Returns:
            True if cached successfully
        """
        try:
            await self.redis_cache._ensure_connected()
            client = self.redis_cache._get_client()
            cache_key = f"dashboard:tags:popular:{user_id}:{limit}"

            value = json.dumps(tags, default=str)
            await client.setex(cache_key, ttl, value)

            logger.debug(f"Cached popular tags for user {user_id}")
            return True
        except Exception as e:
            logger.exception(f"Failed to cache popular tags for user {user_id}: {e}")
            return False

    async def get_recent_tags(self, user_id: str, limit: int = 10) -> list[str] | None:
        """
        Get cached recent tags

        Args:
            user_id: User ID
            limit: Number of tags

        Returns:
            Recent tags list or None if not cached
        """
        try:
            await self.redis_cache._ensure_connected()
            client = self.redis_cache._get_client()
            cache_key = f"dashboard:tags:recent:{user_id}:{limit}"

            value = await client.get(cache_key)
            if value:
                logger.debug(f"Cache HIT: recent tags for user {user_id}")
                result: list[str] = json.loads(value)
                return result

            logger.debug(f"Cache MISS: recent tags for user {user_id}")
            return None
        except Exception as e:
            logger.exception(f"Failed to get cached recent tags for user {user_id}: {e}")
            return None

    async def set_recent_tags(self, user_id: str, tags: list[str], limit: int = 10, ttl: int = 600) -> bool:
        """
        Cache recent tags

        Args:
            user_id: User ID
            tags: Tags data
            limit: Number of tags
            ttl: Time to live in seconds (default 10 minutes)

        Returns:
            True if cached successfully
        """
        try:
            await self.redis_cache._ensure_connected()
            client = self.redis_cache._get_client()
            cache_key = f"dashboard:tags:recent:{user_id}:{limit}"

            value = json.dumps(tags, default=str)
            await client.setex(cache_key, ttl, value)

            logger.debug(f"Cached recent tags for user {user_id}")
            return True
        except Exception as e:
            logger.exception(f"Failed to cache recent tags for user {user_id}: {e}")
            return False

    async def invalidate_user_cache(self, user_id: str) -> None:
        """
        Invalidate all dashboard caches for a user

        Args:
            user_id: User ID
        """
        try:
            await self.redis_cache._ensure_connected()
            if not self.redis_cache.redis_client:
                return
            assert self.redis_cache.redis_client is not None
            pattern = f"dashboard:*:{user_id}*"
            async for key in self.redis_cache.redis_client.scan_iter(pattern):
                await self.redis_cache.redis_client.delete(key)
            logger.debug(f"Invalidated all dashboard cache for user {user_id}")
        except Exception as e:
            logger.exception(f"Failed to invalidate dashboard cache for user {user_id}: {e}")


class ContentCacheService:
    """
    Cache service for content operations

    Caches:
    - Content metadata
    - List results
    - Search results
    - Statistics
    """

    def __init__(self, redis_cache_service: RedisCacheService):
        self.redis_cache = redis_cache_service

    async def get_content_metadata(self, content_id: str) -> dict[str, Any] | None:
        """
        Get cached content metadata

        Args:
            content_id: Content UUID

        Returns:
            Content metadata or None if not cached
        """
        try:
            content_uuid = UUID(content_id)
            return await self.redis_cache.get_content_metadata(content_uuid)
        except (ValueError, TypeError):  # fmt: skip
            logger.exception(f"Invalid content_id format: {content_id}")
            return None

    async def set_content_metadata(self, content_id: str, metadata: dict[str, Any], ttl: int = 3600) -> bool:
        """
        Cache content metadata

        Args:
            content_id: Content UUID
            metadata: Content metadata
            ttl: Time to live in seconds (default 1 hour)

        Returns:
            True if cached successfully
        """
        try:
            content_uuid = UUID(content_id)
            return await self.redis_cache.cache_content_metadata(content_uuid, metadata, ttl)
        except (ValueError, TypeError):  # fmt: skip
            logger.exception(f"Invalid content_id format: {content_id}")
            return False

    async def invalidate_content(self, content_id: str) -> None:
        """
        Invalidate content cache

        Args:
            content_id: Content UUID
        """
        try:
            content_uuid = UUID(content_id)
            await self.redis_cache.invalidate_content(content_uuid)
        except (ValueError, TypeError):  # fmt: skip
            logger.exception(f"Invalid content_id format: {content_id}")

    async def get_list_result(self, user_id: str, filters: dict[str, Any]) -> dict[str, Any] | None:
        """
        Get cached list result

        Args:
            user_id: User ID
            filters: Filter parameters

        Returns:
            Cached list result or None
        """
        # Create deterministic cache key from filters
        # Note: This method uses a different caching mechanism than content metadata
        # We'll use direct Redis access instead of get_content_metadata
        try:
            await self.redis_cache._ensure_connected()
            if not self.redis_cache.redis_client:
                return None
            assert self.redis_cache.redis_client is not None
            filter_str = json.dumps(filters, sort_keys=True, default=str)
            cache_key = f"content:list:{user_id}:{hash(filter_str)}"
            value = await self.redis_cache.redis_client.get(cache_key)
            if value:
                result: dict[str, Any] = json.loads(value)
                return result
            return None
        except Exception as e:
            logger.exception(f"Failed to get cached list result: {e}")
            return None

    async def set_list_result(
        self, user_id: str, filters: dict[str, Any], result: dict[str, Any], ttl: int = 600
    ) -> bool:
        """
        Cache list result

        Args:
            user_id: User ID
            filters: Filter parameters
            result: List result data
            ttl: Time to live in seconds (default 5 minutes)

        Returns:
            True if cached successfully
        """
        # Note: This method uses a different caching mechanism than content metadata
        # We'll use direct Redis access instead of cache_content_metadata
        try:
            await self.redis_cache._ensure_connected()
            if not self.redis_cache.redis_client:
                return False
            assert self.redis_cache.redis_client is not None
            filter_str = json.dumps(filters, sort_keys=True, default=str)
            cache_key = f"content:list:{user_id}:{hash(filter_str)}"
            await self.redis_cache.redis_client.setex(cache_key, ttl, json.dumps(result, default=str))
            return True
        except Exception as e:
            logger.exception(f"Failed to cache list result: {e}")
            return False

    async def invalidate_user_lists(self, user_id: str) -> None:
        """
        Invalidate all list caches for a user

        Args:
            user_id: User ID
        """
        try:
            await self.redis_cache._ensure_connected()
            if not self.redis_cache.redis_client:
                return
            assert self.redis_cache.redis_client is not None
            pattern = f"content:list:{user_id}:*"
            async for key in self.redis_cache.redis_client.scan_iter(pattern):
                await self.redis_cache.redis_client.delete(key)
            logger.debug(f"Invalidated content list cache for user {user_id}")
        except Exception as e:
            logger.exception(f"Failed to invalidate content list cache for user {user_id}: {e}")


# Global cache service instances
_dashboard_cache: DashboardCacheService | None = None
_content_cache: ContentCacheService | None = None


async def get_dashboard_cache_service() -> DashboardCacheService:
    """
    Get or create dashboard cache service instance

    ВАЖНО: использует общий Redis (stack1-redis:6379, DB 0) для кешей дашборда.
    UserCacheService использует отдельную DB 15 только для пользователей.
    """
    global _dashboard_cache
    if _dashboard_cache is None:
        from api.core.unified_config import settings

        # Внутренний порт 6379 для Docker сети (не external_port 30001)
        # settings.redis_port может быть 30001 (external), но внутри Docker нужен 6379
        redis_host = settings.redis_host  # stack1-redis
        redis_port = 6379  # Внутренний порт в Docker сети
        redis_db = settings.redis_db  # DB 0 (общий кеш, не DB 15 для пользователей)
        redis_password = settings.redis_password
        # Учитываем необходимость пароля, если Redis сконфигурирован с AUTH
        redis_url = (
            f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
            if redis_password
            else f"redis://{redis_host}:{redis_port}/{redis_db}"
        )
        redis_cache = RedisCacheService(redis_url=redis_url)
        await redis_cache.connect()
        _dashboard_cache = DashboardCacheService(redis_cache)
    return _dashboard_cache


async def get_content_cache_service() -> ContentCacheService:
    """
    Get or create content cache service instance

    ВАЖНО: использует общий Redis (stack1-redis:6379, DB 0) для кешей контента.
    UserCacheService использует отдельную DB 15 только для пользователей.
    """
    global _content_cache
    if _content_cache is None:
        from api.core.unified_config import settings

        # Внутренний порт 6379 для Docker сети (не external_port 30001)
        # settings.redis_port может быть 30001 (external), но внутри Docker нужен 6379
        redis_host = settings.redis_host  # stack1-redis
        redis_port = 6379  # Внутренний порт в Docker сети
        redis_db = settings.redis_db  # DB 0 (общий кеш, не DB 15 для пользователей)
        redis_password = settings.redis_password
        # Учитываем необходимость пароля, если Redis сконфигурирован с AUTH
        redis_url = (
            f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
            if redis_password
            else f"redis://{redis_host}:{redis_port}/{redis_db}"
        )
        redis_cache = RedisCacheService(redis_url=redis_url)
        await redis_cache.connect()
        _content_cache = ContentCacheService(redis_cache)
    return _content_cache


async def best_effort_invalidate_dashboard_user_cache(user_id: str) -> None:
    """Invalidate dashboard Redis keys for a user; never raises (post-mutation best-effort path)."""

    try:
        dashboard_cache = await get_dashboard_cache_service()
        await dashboard_cache.invalidate_user_cache(user_id)
    except Exception as exc:  # noqa: BLE001 — cache miss must not fail primary mutation
        logger.debug(
            "Dashboard cache invalidation skipped (best-effort): user=%s err=%s",
            user_id,
            exc,
            exc_info=True,
        )


async def best_effort_invalidate_content_event_cache(
    user_id: str,
    *,
    operation: str = "create",
    content_id: str | None = None,
) -> None:
    """Fire cache_event_invalidator after content mutation; never raises."""

    try:
        from api.services.cache_event_invalidator import get_event_invalidator

        invalidator = await get_event_invalidator()
        if operation == "update" and content_id:
            await invalidator.invalidate_on_content_update(user_id, content_id)
        else:
            await invalidator.invalidate_on_content_create(user_id)
    except Exception as exc:  # noqa: BLE001
        logger.debug(
            "Content event cache invalidation skipped (best-effort): user=%s operation=%s err=%s",
            user_id,
            operation,
            exc,
            exc_info=True,
        )


async def best_effort_invalidate_after_content_mutation(
    user_id: str,
    *,
    operation: str = "create",
    content_id: str | None = None,
) -> None:
    """Dashboard + event cache invalidators after content CRUD; never raises."""

    await best_effort_invalidate_dashboard_user_cache(user_id)
    await best_effort_invalidate_content_event_cache(
        user_id,
        operation=operation,
        content_id=content_id,
    )


async def invalidate_user_caches(user_id: str) -> None:
    """
    Invalidate all caches for a user

    Args:
        user_id: User ID
    """
    try:
        dashboard_cache = await get_dashboard_cache_service()
        content_cache = await get_content_cache_service()

        await dashboard_cache.invalidate_user_cache(user_id)
        await content_cache.invalidate_user_lists(user_id)

        logger.info(f"Invalidated all caches for user {user_id}")
    except Exception as e:
        logger.exception(f"Failed to invalidate caches for user {user_id}: {e}")
