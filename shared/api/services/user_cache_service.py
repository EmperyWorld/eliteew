# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/user_cache_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
USER CACHE SERVICE - REDIS DB 15

Separate Redis service for caching users and tokens.
Uses DB 15 for isolation from other services.

Caches:
- Token validation (payload)
- User objects
- Token check results

TTL based on token exp (exp - 60s for safety).

IMPORTANT: READ DOCUMENTATION BEFORE CHANGES
Documentation: documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
Documentation: documentation/platform/REDIS_ARCHITECTURE.md

This service uses Redis DB 15 ONLY for users and tokens.
DO NOT use this service for other data types!
"""

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis  # type: ignore[import-not-found]
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

# Redis SETEX / EX max seconds (32-bit); avoids "invalid expire time" on overflow
_MAX_SETEX_TTL_SECONDS = 2_147_483_647 - 1


class UserCacheService:
    """
    USER CACHE SERVICE - REDIS DB 15

    IMPORTANT: This service uses a SEPARATE Redis DB (DB 15) ONLY for users and tokens.

    Redis separation:
    - UserCacheService (this class) → same Redis host as DatabaseManager, DB 15 → ONLY users and tokens
    - RedisService (redis_service) → stack1-redis:6379, DB 0 → all other caches (API, sessions, etc.)
    - RedisCacheService (unified_content) → stack1-redis:6379, DB 0 → content caches

    This allows:
    - Isolate user data from general cache
    - Easily clear only user cache when needed
    - Optimize TTL for different data types
    """

    REDIS_DB = 15  # Separate DB only for users and tokens (isolation from general cache)
    # Host, port, password: unified Redis URL via DatabaseManager (see get_redis_client(db=REDIS_DB)).

    # Default TTL (if exp not found)
    DEFAULT_TTL = 3600  # 1 hour

    # Cache keys
    TOKEN_PREFIX = "token:"  # noqa: S105
    USER_PREFIX = "user:"
    TOKEN_HASH_PREFIX = "token_hash:"  # noqa: S105

    def __init__(self) -> None:
        self._client: redis.Redis | None = None
        self._initialized = False

    async def _get_client(self) -> redis.Redis | None:
        """Get Redis client from DatabaseManager (DB 15 for user/token isolation)."""
        if self._client is None:
            try:
                from api.core.database_manager import get_database_manager  # noqa: PLC0415

                manager = await get_database_manager()
                self._client = await manager.get_redis_client(db=self.REDIS_DB)
                if self._client is None:
                    self._initialized = False
                    return None
                await self._client.ping()
                self._initialized = True
                logger.info("User Cache Service initialized (DatabaseManager DB %s)", self.REDIS_DB)
            except (ConnectionError, TimeoutError) as e:
                logger.warning("User Cache Service unavailable: %s", e)
                self._client = None
                self._initialized = False
                return None
            except (ValueError, TypeError, RuntimeError) as e:
                logger.warning("Unexpected error initializing User Cache Service: %s", e)
                self._client = None
                self._initialized = False
                return None

        return self._client

    def _get_token_hash(self, token: str) -> str:
        """Get token hash for cache key"""
        return hashlib.sha256(token.encode()).hexdigest()

    async def get_cached_token_payload(self, token: str) -> dict[str, Any] | None:
        """
        Get cached token payload.

        OPTIMIZATION: Checks token exp before returning from cache.
        If token expired, returns None (new validation needed).

        Args:
            token: JWT token

        Returns:
            Payload if found in cache and not expired, None otherwise
        """
        try:
            client = await self._get_client()
            if not client:
                return None

            token_hash = self._get_token_hash(token)
            cache_key = f"{self.TOKEN_PREFIX}{token_hash}"

            cached_data = await client.get(cache_key)
            if cached_data:
                payload = json.loads(cached_data)

                # EXP CHECK: Ensure token is not expired
                exp = payload.get("exp")
                if exp:
                    expires_at = datetime.fromtimestamp(exp, tz=UTC)
                    now = datetime.now(UTC)
                    if expires_at <= now:
                        # Token expired - delete from cache and return None
                        await client.delete(cache_key)
                        logger.debug("Cached token expired (hash: %s...)", token_hash[:16])
                        return None

                logger.debug("Token payload from cache (hash: %s...)", token_hash[:16])
                return payload

            return None

        except (json.JSONDecodeError, KeyError):  # fmt: skip
            logger.debug("Cache get error (non-critical)")
            return None
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache get error (non-critical)")
            return None

    async def cache_token_payload(self, token: str, payload: dict[str, Any], ttl: int | None = None) -> bool:
        """
        Cache token payload.

        Args:
            token: JWT token
            payload: Token payload
            ttl: TTL in seconds (if None, calculated from exp)

        Returns:
            True if successful, False otherwise
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            exp = payload.get("exp")

            # Calculate TTL from exp if not specified
            if ttl is None:
                if exp:
                    try:
                        expires_at = datetime.fromtimestamp(float(exp), tz=UTC)
                    except (OSError, TypeError, ValueError):  # fmt: skip
                        ttl = self.DEFAULT_TTL
                    else:
                        now = datetime.now(UTC)
                        ttl = int((expires_at - now).total_seconds()) - 60  # 60s buffer
                else:
                    ttl = self.DEFAULT_TTL

            # SETEX rejects ttl=0 and ttl<0 ("invalid expire time")
            if ttl <= 0:
                ttl = 60
            if ttl > _MAX_SETEX_TTL_SECONDS:
                ttl = _MAX_SETEX_TTL_SECONDS

            token_hash = self._get_token_hash(token)
            cache_key = f"{self.TOKEN_PREFIX}{token_hash}"

            await client.setex(cache_key, ttl, json.dumps(payload, default=str))

            # ADDITIONAL CACHING: Cache by user_id + exp for fast lookup
            # This avoids repeated checks of the same user token
            user_id = payload.get("sub")
            if user_id and exp:
                user_token_key = f"{self.USER_PREFIX}{user_id}:token:{exp}"
                # Cache with same TTL as main token
                await client.setex(user_token_key, ttl, json.dumps(payload, default=str))

            logger.debug("Token payload cached (hash: %s..., TTL: %ss)", token_hash[:16], ttl)
            return True

        except (ConnectionError, TimeoutError, RedisError) as e:
            logger.warning("Token cache set error (non-critical): %s", e)
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache set error (non-critical)")
            return False

    async def get_cached_user(self, user_id: str) -> dict[str, Any] | None:
        """
        Get cached user.

        Args:
            user_id: User ID

        Returns:
            User dict if found in cache, None otherwise
        """
        try:
            client = await self._get_client()
            if not client:
                return None

            cache_key = f"{self.USER_PREFIX}{user_id}"
            cached_data = await client.get(cache_key)

            if cached_data:
                user_data = json.loads(cached_data)
                logger.debug("User from cache: %s", user_id)
                return user_data

            return None

        except (json.JSONDecodeError, KeyError):  # fmt: skip
            logger.debug("Cache get error (non-critical)")
            return None
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache get error (non-critical)")
            return None

    async def cache_user(self, user_id: str, user_data: dict[str, Any], ttl: int = 3600) -> bool:
        """
        Cache user.

        Args:
            user_id: User ID
            user_data: User data
            ttl: TTL in seconds (default 1 hour)

        Returns:
            True if successful, False otherwise
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            cache_key = f"{self.USER_PREFIX}{user_id}"

            await client.setex(cache_key, ttl, json.dumps(user_data, default=str))

            logger.debug("User cached: %s (TTL: %ss)", user_id, ttl)
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache set error (non-critical)")
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache set error (non-critical)")
            return False

    async def invalidate_token(self, token: str) -> bool:
        """
        Invalidate token cache.

        Args:
            token: JWT token

        Returns:
            True if successful, False otherwise
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            token_hash = self._get_token_hash(token)
            cache_key = f"{self.TOKEN_PREFIX}{token_hash}"

            await client.delete(cache_key)
            logger.debug("Token cache invalidated (hash: %s...)", token_hash[:16])
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache delete error (non-critical)")
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache delete error (non-critical)")
            return False

    async def invalidate_user(self, user_id: str) -> bool:
        """
        Invalidate user cache.

        Args:
            user_id: User ID

        Returns:
            True if successful, False otherwise
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            cache_key = f"{self.USER_PREFIX}{user_id}"
            await client.delete(cache_key)
            logger.debug("User cache invalidated: %s", user_id)
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache delete error (non-critical)")
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache delete error (non-critical)")
            return False

    async def clear_all(self) -> bool:
        """
        Clear all user cache (for testing/debugging).

        Returns:
            True if successful, False otherwise
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            # Delete all keys with prefixes
            token_keys = await client.keys(f"{self.TOKEN_PREFIX}*")
            user_keys = await client.keys(f"{self.USER_PREFIX}*")

            if token_keys:
                await client.delete(*token_keys)
            if user_keys:
                await client.delete(*user_keys)

            logger.info("User cache cleared (%s tokens, %s users)", len(token_keys), len(user_keys))
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.exception("Cache clear error")
            return False
        except Exception:
            logger.exception("Unexpected cache clear error")
            return False

    async def get_stats(self) -> dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            dict[str, Any] with statistics
        """
        try:
            client = await self._get_client()
            if not client:
                return {"available": False}

            token_keys = await client.keys(f"{self.TOKEN_PREFIX}*")
            user_keys = await client.keys(f"{self.USER_PREFIX}*")

            return {
                "available": True,
                "tokens_cached": len(token_keys),
                "users_cached": len(user_keys),
                "db": self.REDIS_DB,
            }

        except (ConnectionError, TimeoutError) as e:
            logger.exception("Cache stats error")
            return {"available": False, "error": str(e)}
        except Exception as e:
            logger.exception("Unexpected cache stats error")
            return {"available": False, "error": str(e)}

    # ========================================
    # CONTENT OPTIMIZATION FOR USERS (Redis 8.2++)
    # ========================================

    CONTENT_LIST_PREFIX = "user:content:list:"
    CONTENT_STATS_PREFIX = "user:content:stats:"
    CONTENT_TAGS_PREFIX = "user:content:tags:"

    # TTL for user content data
    TTL_CONTENT_LIST = 300  # 5 minutes - content lists
    TTL_CONTENT_STATS = 600  # 10 minutes - statistics
    TTL_CONTENT_TAGS = 900  # 15 minutes - popular tags

    async def cache_user_content_list(
        self,
        user_id: str,
        filters: dict[str, Any],
        content_list: list[dict[str, Any]],
        total: int,
        ttl: int = TTL_CONTENT_LIST,
    ) -> bool:
        """
        Cache user content list

        Args:
            user_id: User ID
            filters: Request filters (for key generation)
            content_list: Content list
            total: Total count
            ttl: TTL in seconds

        Returns:
            True if successful
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            # Generate key based on filters
            filter_str = json.dumps(filters, sort_keys=True, default=str)
            filter_hash = hashlib.sha256(filter_str.encode()).hexdigest()[:16]  # Use SHA256 instead of MD5
            cache_key = f"{self.CONTENT_LIST_PREFIX}{user_id}:{filter_hash}"

            cache_data = {
                "items": content_list,
                "total": total,
                "filters": filters,
                "cached_at": datetime.now(UTC).isoformat(),
                "requested_user_id": user_id,  # list can contain other users' content (public/shared/friends)
            }

            await client.setex(cache_key, ttl, json.dumps(cache_data, default=str))

            logger.debug("User content list cached: %s (filters: %s...)", user_id, filter_hash[:8])
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache content list error (non-critical)")
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache content list error (non-critical)")
            return False

    async def get_user_content_list(
        self, user_id: str, filters: dict[str, Any]
    ) -> tuple[list[dict[str, Any]], int] | None:
        """
        Получить кэшированный список контента пользователя

        Args:
            user_id: ID пользователя
            filters: Фильтры запроса

        Returns:
            (content_list, total) или None если не найдено
        """
        try:
            client = await self._get_client()
            if not client:
                return None

            filter_str = json.dumps(filters, sort_keys=True, default=str)
            filter_hash = hashlib.sha256(filter_str.encode()).hexdigest()[:16]  # Use SHA256 instead of MD5
            cache_key = f"{self.CONTENT_LIST_PREFIX}{user_id}:{filter_hash}"

            cached_data = await client.get(cache_key)
            if cached_data:
                try:
                    data = json.loads(cached_data)
                    items = data.get("items", [])
                    total = data.get("total", 0)

                    # Check that this cache entry was stored for this user (key is per-user, payload must match)
                    cached_for = data.get("requested_user_id")
                    if cached_for is not None and str(cached_for) != str(user_id):
                        logger.warning(
                            "[CACHE MISMATCH] Cached data was for user_id=%s but requested user_id=%s. "
                            "Invalidating cache key: %s",
                            cached_for,
                            user_id,
                            cache_key,
                        )
                        await client.delete(cache_key)
                        return None

                    # Check that data is valid
                    if isinstance(items, list) and isinstance(total, (int, float)):
                        logger.debug(
                            "User content list from cache: %s (%s items, total: %s)",
                            user_id,
                            len(items),
                            total,
                        )
                        return items, int(total)
                    logger.warning("Invalid cache data format for user %s, returning None", user_id)
                    return None
                except (json.JSONDecodeError, KeyError):  # fmt: skip
                    logger.warning("Failed to parse cached data for user %s", user_id)
                    # Delete corrupted cache
                    await client.delete(cache_key)
                    return None

            return None

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache get content list error (non-critical)")
            return None
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache get content list error (non-critical)")
            return None

    async def cache_user_content_stats(self, user_id: str, stats: dict[str, Any], ttl: int = TTL_CONTENT_STATS) -> bool:
        """
        Cache user content statistics

        Args:
            user_id: User ID
            stats: Statistics
            ttl: TTL in seconds

        Returns:
            True if successful
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            cache_key = f"{self.CONTENT_STATS_PREFIX}{user_id}"

            cache_data = {**stats, "cached_at": datetime.now(UTC).isoformat()}

            await client.setex(cache_key, ttl, json.dumps(cache_data, default=str))

            logger.debug("User content stats cached: %s", user_id)
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache content stats error (non-critical)")
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache content stats error (non-critical)")
            return False

    async def get_user_content_stats(self, user_id: str) -> dict[str, Any] | None:
        """
        Get cached user content statistics

        Args:
            user_id: User ID

        Returns:
            Statistics or None
        """
        try:
            client = await self._get_client()
            if not client:
                return None

            cache_key = f"{self.CONTENT_STATS_PREFIX}{user_id}"
            cached_data = await client.get(cache_key)

            if cached_data:
                stats = json.loads(cached_data)
                logger.debug("User content stats from cache: %s", user_id)
                return stats

            return None

        except (json.JSONDecodeError, KeyError):  # fmt: skip
            logger.debug("Cache get content stats error (non-critical)")
            return None
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache get content stats error (non-critical)")
            return None

    async def cache_user_popular_tags(
        self, user_id: str, tags: list[dict[str, Any]], ttl: int = TTL_CONTENT_TAGS
    ) -> bool:
        """
        Cache user popular tags

        Args:
            user_id: User ID
            tags: List of tags with counts
            ttl: TTL in seconds

        Returns:
            True if successful
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            cache_key = f"{self.CONTENT_TAGS_PREFIX}{user_id}"

            await client.setex(cache_key, ttl, json.dumps(tags, default=str))

            logger.debug("User popular tags cached: %s", user_id)
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache popular tags error (non-critical)")
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache popular tags error (non-critical)")
            return False

    async def get_user_popular_tags(self, user_id: str) -> list[dict[str, Any]] | None:
        """
        Get cached user popular tags

        Args:
            user_id: User ID

        Returns:
            List of tags or None
        """
        try:
            client = await self._get_client()
            if not client:
                return None

            cache_key = f"{self.CONTENT_TAGS_PREFIX}{user_id}"
            cached_data = await client.get(cache_key)

            if cached_data:
                tags = json.loads(cached_data)
                logger.debug("User popular tags from cache: %s", user_id)
                return tags if isinstance(tags, list) else None

            return None

        except (json.JSONDecodeError, KeyError):  # fmt: skip
            logger.debug("Cache get popular tags error (non-critical)")
            return None
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache get popular tags error (non-critical)")
            return None

    async def invalidate_user_content_caches(self, user_id: str) -> bool:
        """
        Invalidate all user content caches

        Args:
            user_id: User ID

        Returns:
            True if successful
        """
        try:
            client = await self._get_client()
            if not client:
                return False

            patterns = [
                f"{self.CONTENT_LIST_PREFIX}{user_id}:*",
                f"{self.CONTENT_STATS_PREFIX}{user_id}",
                f"{self.CONTENT_TAGS_PREFIX}{user_id}",
            ]

            for pattern in patterns:
                if "*" in pattern:
                    async for key in client.scan_iter(match=pattern):
                        await client.delete(key)
                else:
                    await client.delete(pattern)

            logger.debug("User content caches invalidated: %s", user_id)
            return True

        except (ConnectionError, TimeoutError):  # fmt: skip
            logger.debug("Cache invalidation error (non-critical)")
            return False
        except (ValueError, TypeError, RuntimeError):  # fmt: skip
            logger.debug("Unexpected cache invalidation error (non-critical)")
            return False

    async def close(self) -> None:
        """Release cached client handle; pool/connection lifecycle is owned by DatabaseManager."""
        self._client = None
        self._initialized = False
        logger.info("User Cache Service handle released (Redis managed by DatabaseManager)")


# Singleton instance
_user_cache_service: UserCacheService | None = None


async def get_user_cache_service() -> UserCacheService:
    """Get singleton instance UserCacheService"""
    global _user_cache_service  # noqa: PLW0603

    if _user_cache_service is None:
        _user_cache_service = UserCacheService()

    return _user_cache_service
