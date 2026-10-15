#!/usr/bin/env python3
"""
Redis Cache Service for Unified Content
High-performance caching layer for file metadata and frequently accessed data

Features:
- File metadata caching with TTL
- User quota caching
- Popular tags caching
- Statistics caching
- Cache invalidation on updates
- LRU eviction policy

⚠️ ВАЖНО: ПЕРЕД ИЗМЕНЕНИЯМИ ПРОЧИТАЙТЕ ДОКУМЕНТАЦИЮ
📖 Документация: documentation/platform/REDIS_ARCHITECTURE.md

Этот сервис использует Redis DB 0 для кеширования контента.
UserCacheService использует DB 15 ТОЛЬКО для пользователей.
"""

import hashlib
import json
import logging
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


class RedisCacheService:
    """
    Redis caching service for unified content system

    Cache Keys Structure:
    - content:meta:{content_id} - Content metadata
    - content:list:{user_id}:{hash} - Paginated list results
    - user:quota:{user_id} - User quota information
    - user:stats:{user_id} - User statistics
    - tags:popular:{user_id} - Popular tags
    - tags:recent:{user_id} - Recent tags
    """

    # Cache TTL values (in seconds) - ⚡ OPTIMIZED (2025-11-15)
    TTL_METADATA = 3600  # 1 hour
    TTL_LIST = 600  # 10 minutes (was 5 min) - УВЕЛИЧЕНО для лучшего hit rate
    TTL_QUOTA = 900  # 15 minutes (was 10 min) - УВЕЛИЧЕНО
    TTL_STATS = 600  # 10 minutes (was 5 min) - УВЕЛИЧЕНО
    TTL_TAGS = 900  # 15 minutes (was 10 min) - УВЕЛИЧЕНО
    TTL_BATCH = 1800  # 30 minutes

    def __init__(self, redis_url: str | None = None) -> None:
        """
        Initialize Redis cache service.

        ``redis_url`` is accepted for backward compatibility and ignored; the client
        is always obtained from DatabaseManager via ``get_redis_client``.
        """
        self.redis_client: Any = None

    async def connect(self) -> None:
        """Establish Redis connection from the centralized pool (DatabaseManager)."""
        if not self.redis_client:
            from api.core.database_manager import get_redis_client  # noqa: PLC0415

            self.redis_client = await get_redis_client()
            logger.info("Redis cache service connected (DatabaseManager)")

    async def disconnect(self) -> None:
        """Release Redis reference (pool owned by DatabaseManager)."""
        if self.redis_client:
            self.redis_client = None
            logger.info("Redis cache service disconnected")

    async def _ensure_connected(self) -> None:
        """Ensure Redis connection is established"""
        if not self.redis_client:
            await self.connect()

    def _get_client(self) -> Any:
        """Get Redis client, raising error if not connected."""
        if self.redis_client is None:
            msg = "Redis connection not established. Call connect() first."
            raise RuntimeError(msg)
        return self.redis_client

    # ========================================
    # CONTENT METADATA CACHING
    # ========================================

    async def cache_content_metadata(self, content_id: UUID, metadata: dict[str, Any], ttl: int = TTL_METADATA) -> bool:
        """
        Cache content metadata

        Args:
            content_id: Content UUID
            metadata: Content metadata dict
            ttl: Time to live in seconds

        Returns:
            True if cached successfully
        """
        try:
            await self._ensure_connected()
            client = self._get_client()
            key = f"content:meta:{content_id}"

            # Serialize metadata
            value = json.dumps(metadata, default=str)

            # Set with TTL
            await client.setex(key, ttl, value)

            logger.debug("Cached content metadata: %s", content_id)
            return True

        except Exception:
            logger.exception("Failed to cache content metadata %s", content_id)
            return False

    async def get_content_metadata(self, content_id: UUID) -> dict[str, Any] | None:
        """
        Get cached content metadata

        Args:
            content_id: Content UUID

        Returns:
            Content metadata dict or None if not cached
        """
        try:
            await self._ensure_connected()
            client = self._get_client()
            key = f"content:meta:{content_id}"

            value = await client.get(key)
            if value:
                logger.debug("Cache HIT: content metadata %s", content_id)
                result = json.loads(value)
                return result if isinstance(result, dict) else None  # ⚡ FIX MYPY: Type check

            logger.debug("Cache MISS: content metadata %s", content_id)
            return None

        except Exception:
            logger.exception("Failed to get cached content metadata %s", content_id)
            return None

    async def invalidate_content(self, content_id: UUID) -> None:
        """
        Invalidate all caches related to a content item

        Args:
            content_id: Content UUID
        """
        try:
            await self._ensure_connected()
            client = self._get_client()

            # Delete content metadata
            await client.delete(f"content:meta:{content_id}")

            logger.debug("Invalidated cache for content: %s", content_id)

        except Exception:
            logger.exception("Failed to invalidate cache for content %s", content_id)

    # ========================================
    # BATCH METADATA CACHING
    # ========================================

    async def cache_batch_metadata(self, metadata_dict: dict[str, dict[str, Any]], ttl: int = TTL_BATCH) -> int:
        """
        Cache multiple content metadata in a single operation

        Args:
            metadata_dict: dict[str, Any] mapping content_id -> metadata
            ttl: Time to live in seconds

        Returns:
            Number of items cached successfully
        """
        try:
            await self._ensure_connected()
            client = self._get_client()

            # Use pipeline for atomic operations
            pipeline = client.pipeline()

            for content_id, metadata in metadata_dict.items():
                key = f"content:meta:{content_id}"
                value = json.dumps(metadata, default=str)
                pipeline.setex(key, ttl, value)

            results = await pipeline.execute()
            success_count = sum(1 for r in results if r)

            logger.debug("Cached %s/%s content metadata items", success_count, len(metadata_dict))
            return success_count

        except Exception:
            logger.exception("Failed to cache batch metadata")
            return 0

    async def get_batch_metadata(self, content_ids: list[UUID]) -> dict[str, dict[str, Any] | None]:
        """
        Get multiple cached content metadata in a single operation

        Args:
            content_ids: List of content UUIDs

        Returns:
            (dict[str, Any]) mapping content_id -> metadata (or None if not cached)
        """
        try:
            await self._ensure_connected()
            client = self._get_client()

            if not content_ids:
                return {}

            # Use pipeline for batch retrieval
            pipeline = client.pipeline()
            keys = [f"content:meta:{cid}" for cid in content_ids]

            for key in keys:
                pipeline.get(key)

            values = await pipeline.execute()

            # Build result dict
            result = {}
            hits = 0
            for content_id, value in zip(content_ids, values, strict=False):
                if value:
                    result[str(content_id)] = json.loads(value)
                    hits += 1
                else:
                    result[str(content_id)] = None

            logger.debug("Batch metadata cache: %s/%s hits", hits, len(content_ids))
            return result

        except Exception:
            logger.exception("Failed to get batch metadata")
            return {str(cid): None for cid in content_ids}

    # ========================================
    # LIST CACHING
    # ========================================

    def _generate_list_cache_key(self, user_id: str, filters: dict[str, Any]) -> str:
        """
        Generate cache key for list queries

        Args:
            user_id: User ID
            filters: Query filters dict

        Returns:
            Cache key string
        """
        # Sort filters for consistent key generation
        filter_str = json.dumps(filters, sort_keys=True, default=str)
        filter_hash = hashlib.md5(filter_str.encode()).hexdigest()[:16]

        return f"content:list:{user_id}:{filter_hash}"

    async def cache_list_result(
        self, user_id: str, filters: dict[str, Any], result: dict[str, Any], ttl: int = TTL_LIST
    ) -> bool:
        """
        Cache list query result

        Args:
            user_id: User ID
            filters: Query filters
            result: Query result dict (items + metadata)
            ttl: Time to live in seconds

        Returns:
            True if cached successfully
        """
        try:
            await self._ensure_connected()
            client = self._get_client()
            key = self._generate_list_cache_key(user_id, filters)

            value = json.dumps(result, default=str)
            await client.setex(key, ttl, value)

            logger.debug("Cached list result for user %s", user_id)
            return True

        except Exception:
            logger.exception("Failed to cache list result")
            return False

    async def get_list_result(self, user_id: str, filters: dict[str, Any]) -> dict[str, Any] | None:
        """
        Get cached list query result

        Args:
            user_id: User ID
            filters: Query filters

        Returns:
            Cached result dict or None
        """
        try:
            await self._ensure_connected()
            client = self._get_client()
            key = self._generate_list_cache_key(user_id, filters)

            value = await client.get(key)
            if value:
                logger.debug("Cache HIT: list result for user %s", user_id)
                result = json.loads(value)
                return result if isinstance(result, dict) else None  # ⚡ FIX MYPY: Type check

            logger.debug(f"Cache MISS: list result for user {user_id}")
            return None

        except Exception:
            logger.exception("Failed to get cached list result")
            return None

    async def invalidate_user_lists(self, user_id: str) -> None:
        """
        Invalidate all list caches for a user

        Args:
            user_id: User ID
        """
        try:
            await self._ensure_connected()

            # Delete all list keys for user using pattern matching
            client = self._get_client()
            pattern = f"content:list:{user_id}:*"

            async for key in client.scan_iter(match=pattern):
                await client.delete(key)

            logger.debug(f"Invalidated list cache for user: {user_id}")

        except Exception:
            logger.exception("Failed to invalidate list cache for user %s", user_id)

    # ========================================
    # QUOTA CACHING
    # ========================================

    async def cache_user_quota(self, user_id: str, total_size: int, ttl: int = TTL_QUOTA) -> bool:
        """
        Cache user quota information

        Args:
            user_id: User ID
            total_size: Total size in bytes
            ttl: Time to live in seconds

        Returns:
            True if cached successfully
        """
        try:
            await self._ensure_connected()
            client = self._get_client()
            key = f"user:quota:{user_id}"

            await client.setex(key, ttl, str(total_size))

            logger.debug(f"Cached quota for user {user_id}: {total_size} bytes")
            return True

        except Exception:
            logger.exception("Failed to cache quota for user %s", user_id)
            return False

    async def get_user_quota(self, user_id: str) -> int | None:
        """
        Get cached user quota

        Args:
            user_id: User ID

        Returns:
            Total size in bytes or None if not cached
        """
        try:
            await self._ensure_connected()
            client = self._get_client()
            key = f"user:quota:{user_id}"

            value = await client.get(key)
            if value:
                logger.debug(f"Cache HIT: quota for user {user_id}")
                return int(value)

            logger.debug(f"Cache MISS: quota for user {user_id}")
            return None

        except Exception:
            logger.exception("Failed to get cached quota for user %s", user_id)
            return None

    async def invalidate_user_quota(self, user_id: str) -> None:
        """Invalidate user quota cache"""
        try:
            await self._ensure_connected()
            client = self._get_client()
            await client.delete(f"user:quota:{user_id}")
            logger.debug("Invalidated quota cache for user: %s", user_id)
        except Exception:
            logger.exception("Failed to invalidate quota cache")

    # ========================================
    # STATISTICS CACHING
    # ========================================

    async def cache_user_statistics(self, user_id: str, statistics: dict[str, Any], ttl: int = TTL_STATS) -> bool:
        """
        Cache user statistics

        Args:
            user_id: User ID
            statistics: Statistics dict
            ttl: Time to live in seconds

        Returns:
            True if cached successfully
        """
        try:
            await self._ensure_connected()
            key = f"user:stats:{user_id}"

            value = json.dumps(statistics, default=str)
            client = self._get_client()
            await client.setex(key, ttl, value)

            logger.debug(f"Cached statistics for user {user_id}")
            return True

        except Exception:
            logger.exception("Failed to cache statistics")
            return False

    async def get_user_statistics(self, user_id: str) -> dict[str, Any] | None:
        """Get cached user statistics"""
        try:
            await self._ensure_connected()
            client = self._get_client()
            key = f"user:stats:{user_id}"

            value = await client.get(key)
            if value:
                logger.debug(f"Cache HIT: statistics for user {user_id}")
                result = json.loads(value)
                return result if isinstance(result, dict) else None  # ⚡ FIX MYPY: Type check

            logger.debug(f"Cache MISS: statistics for user {user_id}")
            return None

        except Exception:
            logger.exception("Failed to get cached statistics")
            return None

    # ========================================
    # TAG CACHING
    # ========================================

    async def cache_popular_tags(self, user_id: str, tags: list[dict[str, Any]], ttl: int = TTL_TAGS) -> bool:
        """Cache popular tags for user"""
        try:
            await self._ensure_connected()
            key = f"tags:popular:{user_id}"

            value = json.dumps(tags, default=str)
            client = self._get_client()
            await client.setex(key, ttl, value)

            logger.debug(f"Cached popular tags for user {user_id}")
            return True

        except Exception:
            logger.exception("Failed to cache popular tags")
            return False

    async def get_popular_tags(self, user_id: str) -> list[dict[str, Any]] | None:
        """Get cached popular tags"""
        try:
            await self._ensure_connected()
            key = f"tags:popular:{user_id}"

            client = self._get_client()
            value = await client.get(key)
            if value:
                logger.debug(f"Cache HIT: popular tags for user {user_id}")
                result = json.loads(value)
                return result if isinstance(result, list) else None  # ⚡ FIX MYPY: Type check

            logger.debug(f"Cache MISS: popular tags for user {user_id}")
            return None

        except Exception:
            logger.exception("Failed to get cached popular tags")
            return None

    # ========================================
    # BULK INVALIDATION
    # ========================================

    async def invalidate_user_caches(self, user_id: str) -> None:
        """
        Invalidate all caches for a user

        Args:
            user_id: User ID
        """
        try:
            await self._ensure_connected()

            # Delete all user-related caches
            patterns = [
                f"content:list:{user_id}:*",
                f"user:quota:{user_id}",
                f"user:stats:{user_id}",
                f"tags:popular:{user_id}",
                f"tags:recent:{user_id}",
            ]

            client = self._get_client()
            for pattern in patterns:
                if "*" in pattern:
                    # Use scan for pattern matching
                    async for key in client.scan_iter(match=pattern):
                        await client.delete(key)
                else:
                    # Direct delete
                    await client.delete(pattern)

            logger.info(f"Invalidated all caches for user: {user_id}")

        except Exception:
            logger.exception("Failed to invalidate user caches")

    # ========================================
    # HEALTH CHECK
    # ========================================

    async def health_check(self) -> dict[str, Any]:
        """
        Check Redis cache health

        Returns:
            Health status dict
        """
        try:
            await self._ensure_connected()
            client = self._get_client()

            # Ping Redis
            await client.ping()

            # Get info
            info = await client.info()

            return {
                "status": "healthy",
                "connected": True,
                "used_memory": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "uptime_seconds": info.get("uptime_in_seconds", 0),
            }

        except Exception as e:
            logger.exception("Redis health check failed")
            return {"status": "unhealthy", "connected": False, "error": str(e)}
