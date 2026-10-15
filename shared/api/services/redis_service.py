#!/usr/bin/env python3
"""
EliteEW Redis service: structured caching, session management, and real-time data.
"""

import hashlib
import json
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

try:
    from redis.asyncio import Redis  # type: ignore[import-untyped]

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    Redis = Any  # type: ignore[assignment, misc]
    logging.warning("redis.asyncio not available - Redis functionality disabled")

from api.core.database_manager import (  # type: ignore[import-untyped]
    get_database_manager,
)

logger = logging.getLogger(__name__)


class RedisKeyManager:
    """Structured key naming conventions for organized Redis storage."""

    # Key prefixes for different data types
    SESSION_PREFIX = "session"
    USER_PREFIX = "user"
    CHAT_PREFIX = "chat"
    API_CACHE_PREFIX = "api_cache"
    RATE_LIMIT_PREFIX = "rate_limit"
    WEBSOCKET_PREFIX = "ws"
    TASK_PREFIX = "task"
    TEMP_PREFIX = "temp"
    METRICS_PREFIX = "metrics"

    @staticmethod
    def session_key(token_hash: str) -> str:
        """JWT session key"""
        return f"{RedisKeyManager.SESSION_PREFIX}:token:{token_hash}"

    @staticmethod
    def user_sessions_key(user_id: str) -> str:
        """All sessions for a user"""
        return f"{RedisKeyManager.SESSION_PREFIX}:user:{user_id}"

    @staticmethod
    def user_cache_key(user_id: str, cache_type: str) -> str:
        """User-specific cache"""
        return f"{RedisKeyManager.USER_PREFIX}:{user_id}:{cache_type}"

    @staticmethod
    def chat_cache_key(session_id: str) -> str:
        """Chat session cache"""
        return f"{RedisKeyManager.CHAT_PREFIX}:session:{session_id}"

    @staticmethod
    def chat_messages_key(session_id: str) -> str:
        """Chat messages cache"""
        return f"{RedisKeyManager.CHAT_PREFIX}:messages:{session_id}"

    @staticmethod
    def api_cache_key(endpoint: str, params_hash: str) -> str:
        """API response cache"""
        return f"{RedisKeyManager.API_CACHE_PREFIX}:{endpoint}:{params_hash}"

    @staticmethod
    def rate_limit_key(user_id: str, endpoint: str) -> str:
        """Rate limiting key"""
        return f"{RedisKeyManager.RATE_LIMIT_PREFIX}:{user_id}:{endpoint}"

    @staticmethod
    def websocket_key(connection_id: str) -> str:
        """WebSocket connection data"""
        return f"{RedisKeyManager.WEBSOCKET_PREFIX}:conn:{connection_id}"

    @staticmethod
    def websocket_room_key(room_id: str) -> str:
        """WebSocket room members"""
        return f"{RedisKeyManager.WEBSOCKET_PREFIX}:room:{room_id}"

    @staticmethod
    def task_queue_key(queue_name: str) -> str:
        """Background task queue"""
        return f"{RedisKeyManager.TASK_PREFIX}:queue:{queue_name}"

    @staticmethod
    def task_result_key(task_id: str) -> str:
        """Background task result"""
        return f"{RedisKeyManager.TASK_PREFIX}:result:{task_id}"

    @staticmethod
    def temp_data_key(data_id: str) -> str:
        """Temporary data storage"""
        return f"{RedisKeyManager.TEMP_PREFIX}:{data_id}"

    @staticmethod
    def metrics_key(metric_name: str, timestamp: str) -> str:
        """Real-time metrics"""
        return f"{RedisKeyManager.METRICS_PREFIX}:{metric_name}:{timestamp}"


class RedisService:
    """
    Enterprise-grade Redis service with:
    - Structured caching with automatic expiration
    - Session management for JWT tokens
    - Real-time data for WebSocket connections
    - Rate limiting and throttling
    - Background task result storage
    - Health monitoring and circuit breaker

    IMPORTANT: this service uses shared Redis (stack1-redis:6379, DB 0) for all caches.

    Split:
    - UserCacheService → stack1-redis:6379, DB 15 — users and tokens only
    - RedisService (this class) → stack1-redis:6379, DB 0 — API, sessions, and other caches
    - RedisCacheService (unified_content) → stack1-redis:6379, DB 0 — content caches

    Read documentation before making changes. Documentation: documentation/platform/REDIS_ARCHITECTURE.md

    Do not use DB 15 for non-user data.
    """

    def __init__(self) -> None:
        self.redis_pool: Redis | None = None  # type: ignore[assignment]
        self.is_available = False
        self.circuit_breaker_failures = 0
        self.circuit_breaker_last_failure: datetime | None = None
        self.circuit_breaker_threshold = 5
        self.circuit_breaker_timeout = 60  # seconds

        # Default expiration times (in seconds)
        # TTL values tuned for hit rate (2025-11-15)
        # Увеличены TTL для лучшего hit rate и ускорения загрузки
        self.DEFAULT_EXPIRATIONS = {
            "session": 1800,  # 30 minutes
            "api_cache": 1800,  # 30 minutes (was 15 min) - УВЕЛИЧЕНО для лучшего hit rate
            "user_cache": 3600,  # 1 hour (was 30 min) - УВЕЛИЧЕНО для стабильных данных пользователя
            "chat_cache": 3600,  # 1 hour
            "rate_limit": 60,  # 1 minute
            "websocket": 86400,  # 24 hours
            "temp": 300,  # 5 minutes
            "metrics": 3600,  # 1 hour
        }

    async def initialize(self) -> bool:
        """Initialize Redis connection"""
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available - running without cache")
            return False

        try:
            manager = await get_database_manager()
            self.redis_pool = await manager.get_redis_client()
            if self.redis_pool:
                await self.redis_pool.ping()
            self.is_available = True
            self.circuit_breaker_failures = 0
            logger.info("Redis service initialized (DatabaseManager pool)")
            return True

        except Exception as e:
            logger.exception("Redis initialization failed: %s", e)
            self.is_available = False
            self._record_circuit_breaker_failure()
            return False

    def _record_circuit_breaker_failure(self) -> None:
        """Record circuit breaker failure"""
        self.circuit_breaker_failures += 1
        self.circuit_breaker_last_failure = datetime.now(UTC)

    def _is_circuit_breaker_open(self) -> bool:
        """Check if circuit breaker is open"""
        if self.circuit_breaker_failures < self.circuit_breaker_threshold:
            return False

        if not self.circuit_breaker_last_failure:
            return False

        time_since_failure = (datetime.now(UTC) - self.circuit_breaker_last_failure).total_seconds()
        return bool(time_since_failure < self.circuit_breaker_timeout)

    async def _reconnect(self) -> bool:
        """Refresh Redis client from DatabaseManager and ping (pool owned by DatabaseManager)."""
        try:
            manager = await get_database_manager()
            self.redis_pool = await manager.get_redis_client()
            if self.redis_pool:
                await self.redis_pool.ping()
                self.is_available = True
                self.circuit_breaker_failures = 0
                logger.info("Redis reconnected (DatabaseManager pool)")
                return True
        except Exception as e:
            logger.warning("Redis reconnect failed: %s", e)
            self._record_circuit_breaker_failure()
        return False

    @asynccontextmanager  # type: ignore[arg-type]
    async def get_redis_client(self) -> Any:
        """Get Redis client with circuit breaker protection and auto-reconnect"""
        if self._is_circuit_breaker_open():
            yield None
            return

        # Try to reconnect if not available
        if not self.is_available or not self.redis_pool:
            await self._reconnect()
            if not self.is_available:
                yield None
                return

        try:
            if self.redis_pool:
                # Test connection before yielding
                try:
                    await self.redis_pool.ping()
                except Exception:
                    # Connection lost, try to reconnect
                    if await self._reconnect():
                        yield self.redis_pool
                    else:
                        yield None
                    return

                yield self.redis_pool
                # Reset circuit breaker on successful operation
                self.circuit_breaker_failures = 0
            else:
                yield None
        except Exception as e:
            logger.warning("Redis operation failed: %s", e)
            self._record_circuit_breaker_failure()
            await self._reconnect()
            # Do not yield after exception — generator must stop after athrow()
            return

    # =================================================================
    # SESSION MANAGEMENT
    # =================================================================

    async def store_session(self, token_hash: str, session_data: dict[str, Any], expires_in: int | None = None) -> bool:
        """Store JWT session data"""
        async with self.get_redis_client() as redis:
            if not redis:
                return False

            try:
                key = RedisKeyManager.session_key(token_hash)
                expiration = expires_in or self.DEFAULT_EXPIRATIONS["session"]

                await redis.setex(key, expiration, json.dumps(session_data, default=str))

                # Add to user sessions set
                if "user_id" in session_data:
                    user_sessions_key = RedisKeyManager.user_sessions_key(session_data["user_id"])
                    await redis.sadd(user_sessions_key, token_hash)
                    await redis.expire(user_sessions_key, expiration)

                logger.debug("Session stored: %s", key)
                return True

            except Exception as e:
                logger.exception("Failed to store session: %s", e)
                return False

    async def get_session(self, token_hash: str) -> dict[str, Any] | None:
        """Retrieve JWT session data"""
        async with self.get_redis_client() as redis:
            if not redis:
                return None

            try:
                key = RedisKeyManager.session_key(token_hash)
                data = await redis.get(key)

                if data:
                    # Update last used timestamp
                    await redis.touch(key)
                    result: dict[str, Any] = json.loads(data)
                    return result

                return None

            except Exception as e:
                logger.exception("Failed to get session: %s", e)
                return None

    async def delete_session(self, token_hash: str, user_id: str | None = None) -> bool:
        """Delete JWT session"""
        async with self.get_redis_client() as redis:
            if not redis:
                return False

            try:
                key = RedisKeyManager.session_key(token_hash)
                await redis.delete(key)

                # Remove from user sessions set
                if user_id:
                    user_sessions_key = RedisKeyManager.user_sessions_key(user_id)
                    await redis.srem(user_sessions_key, token_hash)

                logger.debug("Session deleted: %s", key)
                return True

            except Exception as e:
                logger.exception("Failed to delete session: %s", e)
                return False

    async def get_user_sessions(self, user_id: str) -> list[str]:
        """Get all session tokens for a user"""
        async with self.get_redis_client() as redis:
            if not redis:
                return []

            try:
                user_sessions_key = RedisKeyManager.user_sessions_key(user_id)
                sessions = await redis.smembers(user_sessions_key)
                return [s.decode() if isinstance(s, bytes) else s for s in sessions]

            except Exception as e:
                logger.exception("Failed to get user sessions: %s", e)
                return []

    # =================================================================
    # API RESPONSE CACHING
    # =================================================================

    async def cache_api_response(
        self,
        endpoint: str,
        params: dict[str, Any],
        response_data: Any,
        expires_in: int | None = None,
    ) -> bool:
        """Cache API response"""
        async with self.get_redis_client() as redis:
            if not redis:
                return False

            try:
                # Create hash of parameters for cache key (SHA256 for security)
                params_str = json.dumps(params, sort_keys=True, default=str)
                params_hash = hashlib.sha256(params_str.encode()).hexdigest()[:16]

                key = RedisKeyManager.api_cache_key(endpoint, params_hash)
                expiration = expires_in or self.DEFAULT_EXPIRATIONS["api_cache"]

                # Store with metadata
                cache_data = {
                    "data": response_data,
                    "cached_at": datetime.now(UTC).isoformat(),
                    "endpoint": endpoint,
                    "params": params,
                }

                await redis.setex(key, expiration, json.dumps(cache_data, default=str))

                logger.debug("API response cached: %s", endpoint)
                return True

            except Exception as e:
                logger.exception("Failed to cache API response: %s", e)
                return False

    async def get_cached_api_response(self, endpoint: str, params: dict[str, Any]) -> Any | None:
        """Get cached API response"""
        async with self.get_redis_client() as redis:
            if not redis:
                return None

            try:
                # Create hash of parameters for cache key (SHA256 for security)
                params_str = json.dumps(params, sort_keys=True, default=str)
                params_hash = hashlib.sha256(params_str.encode()).hexdigest()[:16]

                key = RedisKeyManager.api_cache_key(endpoint, params_hash)
                data = await redis.get(key)

                if data:
                    cache_data = json.loads(data)
                    logger.debug("Cache hit: %s", endpoint)
                    return cache_data["data"]

                logger.debug("Cache miss: %s", endpoint)
                return None

            except Exception as e:
                logger.exception("Failed to get cached response: %s", e)
                return None

    # =================================================================
    # RATE LIMITING
    # =================================================================

    async def check_rate_limit(
        self, user_id: str, endpoint: str, max_requests: int = 60, window_seconds: int = 60
    ) -> dict[str, Any]:
        """Check and update rate limit"""
        async with self.get_redis_client() as redis:
            if not redis:
                # Without Redis, allow all requests
                return {"allowed": True, "remaining": max_requests, "reset_at": None}

            try:
                key = RedisKeyManager.rate_limit_key(user_id, endpoint)
                current_time = datetime.now(UTC)

                # Use sliding window rate limiting with pipeline
                pipe = redis.pipeline()
                pipe.zremrangebyscore(key, 0, current_time.timestamp() - window_seconds)
                pipe.zcard(key)
                pipe.zadd(key, {str(current_time.timestamp()): current_time.timestamp()})
                pipe.expire(key, window_seconds)

                results = await pipe.execute()
                current_requests = results[1]

                if current_requests < max_requests:
                    return {
                        "allowed": True,
                        "remaining": max_requests - current_requests - 1,
                        "reset_at": (current_time + timedelta(seconds=window_seconds)).isoformat(),
                    }
                # Remove the added request since it's not allowed
                await redis.zrem(key, str(current_time.timestamp()))
                return {
                    "allowed": False,
                    "remaining": 0,
                    "reset_at": (current_time + timedelta(seconds=window_seconds)).isoformat(),
                }

            except Exception as e:
                logger.exception("Rate limit check failed: %s", e)
                # On error, allow the request
                return {"allowed": True, "remaining": max_requests, "reset_at": None}

    # =================================================================
    # WEBSOCKET REAL-TIME DATA
    # =================================================================

    async def store_websocket_connection(self, connection_id: str, connection_data: dict[str, Any]) -> bool:
        """Store WebSocket connection data"""
        async with self.get_redis_client() as redis:
            if not redis:
                return False

            try:
                key = RedisKeyManager.websocket_key(connection_id)
                expiration = self.DEFAULT_EXPIRATIONS["websocket"]

                await redis.setex(key, expiration, json.dumps(connection_data, default=str))

                logger.debug("WebSocket connection stored: %s", connection_id)
                return True

            except Exception as e:
                logger.exception("Failed to store WebSocket connection: %s", e)
                return False

    async def get_websocket_connection(self, connection_id: str) -> dict[str, Any] | None:
        """Get WebSocket connection data"""
        async with self.get_redis_client() as redis:
            if not redis:
                return None

            try:
                key = RedisKeyManager.websocket_key(connection_id)
                data = await redis.get(key)

                if data:
                    result: dict[str, Any] = json.loads(data)
                    return result
                return None

            except Exception as e:
                logger.exception("Failed to get WebSocket connection: %s", e)
                return None

    async def delete_websocket_connection(self, connection_id: str) -> bool:
        """Delete WebSocket connection data"""
        async with self.get_redis_client() as redis:
            if not redis:
                return False

            try:
                key = RedisKeyManager.websocket_key(connection_id)
                await redis.delete(key)

                logger.debug("WebSocket connection deleted: %s", connection_id)
                return True

            except Exception as e:
                logger.exception("Failed to delete WebSocket connection: %s", e)
                return False

    # =================================================================
    # CHAT CACHING
    # =================================================================

    async def cache_chat_messages(
        self, session_id: str, messages: list[dict[str, Any]], expires_in: int | None = None
    ) -> bool:
        """Cache chat messages for faster loading"""
        async with self.get_redis_client() as redis:
            if not redis:
                return False

            try:
                key = RedisKeyManager.chat_messages_key(session_id)
                expiration = expires_in or self.DEFAULT_EXPIRATIONS["chat_cache"]

                await redis.setex(key, expiration, json.dumps(messages, default=str))

                logger.debug("Chat messages cached: %s", session_id)
                return True

            except Exception as e:
                logger.exception("Failed to cache chat messages: %s", e)
                return False

    async def get_cached_chat_messages(self, session_id: str) -> list[dict[str, Any]] | None:
        """Get cached chat messages"""
        async with self.get_redis_client() as redis:
            if not redis:
                return None

            try:
                key = RedisKeyManager.chat_messages_key(session_id)
                data = await redis.get(key)

                if data:
                    result: list[dict[str, Any]] = json.loads(data)
                    return result
                return None

            except Exception as e:
                logger.exception("Failed to get cached chat messages: %s", e)
                return None

    # =================================================================
    # HEALTH AND STATISTICS
    # =================================================================

    async def get_health_status(self) -> dict[str, Any]:
        """Get Redis service health status"""
        if not self.is_available:
            return {
                "status": "unavailable",
                "circuit_breaker": {
                    "failures": self.circuit_breaker_failures,
                    "is_open": self._is_circuit_breaker_open(),
                    "last_failure": self.circuit_breaker_last_failure.isoformat()
                    if self.circuit_breaker_last_failure
                    else None,
                },
            }

        async with self.get_redis_client() as redis:
            if not redis:
                return {"status": "down", "error": "Connection failed"}

            try:
                # Get Redis info
                info = await redis.info()
                memory_info = await redis.info("memory")

                return {
                    "status": "healthy",
                    "version": info.get("redis_version"),
                    "connected_clients": info.get("connected_clients"),
                    "used_memory": memory_info.get("used_memory_human"),
                    "total_connections_received": info.get("total_connections_received"),
                    "total_commands_processed": info.get("total_commands_processed"),
                    "circuit_breaker": {
                        "failures": self.circuit_breaker_failures,
                        "is_open": False,
                    },
                }

            except Exception as e:
                logger.exception("Redis health check failed: %s", e)
                return {"status": "error", "error": str(e)}

    async def clear_all_cache(self, pattern: str = "*") -> bool:
        """Clear cache by pattern (use with caution!)"""
        async with self.get_redis_client() as redis:
            if not redis:
                return False

            try:
                # Use scan_iter instead of keys() for better performance (non-blocking)
                keys_to_delete = []
                async for key in redis.scan_iter(match=pattern):
                    keys_to_delete.append(key)
                    # Delete in batches of 100 to avoid memory issues
                    if len(keys_to_delete) >= 100:
                        await redis.delete(*keys_to_delete)
                        keys_to_delete = []

                # Delete remaining keys
                if keys_to_delete:
                    await redis.delete(*keys_to_delete)

                logger.info("Cleared cache entries matching pattern: %s", pattern)

                return True

            except Exception as e:
                logger.exception("Failed to clear cache: %s", e)
                return False

    async def close(self) -> None:
        """Close Redis connections"""
        if self.redis_pool:
            await self.redis_pool.close()
            logger.info("Redis connections closed")


# GLOBAL REDIS SERVICE INSTANCE (lazy initialization)
_redis_service: RedisService | None = None


async def get_redis_service() -> RedisService:
    """Return the global Redis service instance."""
    global _redis_service

    if _redis_service is None:
        _redis_service = RedisService()
        await _redis_service.initialize()

    if not _redis_service.is_available:
        await _redis_service.initialize()

    return _redis_service


# Convenience functions for dependency injection
async def get_redis_client() -> Any:
    """Dependency для получения Redis client"""
    service = await get_redis_service()
    async with service.get_redis_client() as client:
        yield client


# USAGE EXAMPLE
if __name__ == "__main__":
    import asyncio

    async def main() -> None:
        service = RedisService()
        success = await service.initialize()

        if success:
            # Test session storage
            session_data = {"user_id": "test", "role": "admin"}
            await service.store_session("test_token", session_data)

            await service.get_session("test_token")

            # Test rate limiting
            await service.check_rate_limit("test_user", "/api/test")

            # Health check
            await service.get_health_status()

        await service.close()

    asyncio.run(main())
