#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   In-memory кэш AI SDK при отсутствии Redis.
# Invariants:
#   - TTL и last_accessed — UTC naive; JSON timestamp — utc_now_iso().
# Related:
#   - cache_service при наличии Redis
# ------------------------------------------------------------------------------
"""
Simple AI SDK Cache Service
In-memory caching for AI SDK operations (fallback when Redis is not available)
"""

import hashlib
import json
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any

from api.utils.datetime_helpers import utc_now_iso, utc_now_naive

logger = logging.getLogger(__name__)

# =============================================================================
# CACHE DATA STRUCTURES
# =============================================================================


@dataclass
class SimpleCacheEntry:
    """Simple cache entry with metadata"""

    key: str
    value: Any
    created_at: datetime
    expires_at: datetime | None = None
    hit_count: int = 0
    last_accessed: datetime | None = None
    service_type: str = ""
    operation: str = ""
    size_bytes: int = 0

    def is_expired(self) -> bool:
        """Check if cache entry is expired"""
        if self.expires_at is None:
            return False
        return utc_now_naive() > self.expires_at


@dataclass
class CacheMetrics:
    """Cache performance metrics"""

    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    total_size_bytes: int = 0
    avg_response_time: float = 0.0

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate"""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0


# =============================================================================
# SIMPLE CACHE MANAGER
# =============================================================================


class SimpleCacheManager:
    """Simple in-memory cache manager for AI SDK operations"""

    def __init__(self) -> None:
        self.cache: dict[str, SimpleCacheEntry] = {}
        self.connected = True

        # AI SDK specific TTL configurations
        self.ttl_configs = {
            "embeddings": {
                "generate": 3600,  # 1 hour
                "batch_generate": 3600,
                "similarity_search": 1800,  # 30 min
            },
            "agents": {
                "chat_completion": 1800,  # 30 min
                "tool_call": 900,  # 15 min
            },
            "vision": {
                "analyze_image": 3600,  # 1 hour
                "ocr_text": 7200,  # 2 hours
            },
            "objects": {
                "generate_object": 1800,  # 30 min
                "stream_object": 900,  # 15 min
            },
        }

        # Performance metrics
        self.metrics = CacheMetrics()
        self.response_times: list[float] = []

    def _get_cache_key(self, service_type: str, key: str) -> str:
        """Generate namespaced cache key"""
        return f"{service_type}:{key}"

    def _generate_hash_key(self, data: Any) -> str:
        """Generate hash key for complex data"""
        if isinstance(data, dict):
            data_str = json.dumps(data, sort_keys=True, default=str)
        elif isinstance(data, list):
            data_str = json.dumps(sorted(data, key=str), default=str)
        else:
            data_str = str(data)

        return hashlib.md5(data_str.encode()).hexdigest()

    def _calculate_size_bytes(self, data: Any) -> int:
        """Calculate approximate size of data in bytes"""
        return len(json.dumps(data, default=str).encode("utf-8"))

    def _get_ttl_for_operation(self, service_type: str, operation: str) -> int:
        """Get TTL for specific service type and operation"""
        service_config = self.ttl_configs.get(service_type, {})
        return service_config.get(operation, 1800)  # Default 30 minutes

    async def set(self, service_type: str, operation: str, key: str, value: Any, custom_ttl: int | None = None) -> bool:
        """Set cache value"""
        start_time = time.time()

        try:
            cache_key = self._get_cache_key(service_type, key)
            cache_ttl = custom_ttl or self._get_ttl_for_operation(service_type, operation)

            # Calculate data size
            size_bytes = self._calculate_size_bytes(value)

            # Create cache entry
            entry = SimpleCacheEntry(
                key=cache_key,
                value=value,
                created_at=utc_now_naive(),
                expires_at=utc_now_naive() + timedelta(seconds=cache_ttl),
                service_type=service_type,
                operation=operation,
                size_bytes=size_bytes,
            )

            # Store in cache
            self.cache[cache_key] = entry

            # Update metrics
            self.metrics.sets += 1
            self.metrics.total_size_bytes += size_bytes
            self.response_times.append(time.time() - start_time)

            logger.debug(f"AI SDK cached: {service_type}:{operation}:{key}")
            return True

        except Exception as e:
            logger.exception(f"AI SDK cache set failed: {e}")
            return False

    async def get(self, service_type: str, operation: str, key: str) -> Any | None:
        """Get cache value"""
        start_time = time.time()

        try:
            cache_key = self._get_cache_key(service_type, key)
            entry = self.cache.get(cache_key)

            if entry:
                # Check expiration
                if entry.is_expired():
                    await self.delete(service_type, operation, key)
                    self.metrics.misses += 1
                    return None

                # Update hit count and last accessed
                entry.hit_count += 1
                entry.last_accessed = utc_now_naive()

                # Update metrics
                self.metrics.hits += 1
                self.response_times.append(time.time() - start_time)

                logger.debug(f"AI SDK cache hit: {service_type}:{operation}:{key}")
                return entry.value

            # Cache miss
            self.metrics.misses += 1
            self.response_times.append(time.time() - start_time)
            logger.debug(f"AI SDK cache miss: {service_type}:{operation}:{key}")
            return None

        except Exception as e:
            logger.exception(f"AI SDK cache get failed: {e}")
            return None

    async def delete(self, service_type: str, operation: str, key: str) -> bool:
        """Delete cache entry"""
        try:
            cache_key = self._get_cache_key(service_type, key)
            if cache_key in self.cache:
                entry = self.cache[cache_key]
                self.metrics.total_size_bytes -= entry.size_bytes
                del self.cache[cache_key]
                self.metrics.deletes += 1
                logger.debug(f"AI SDK cache deleted: {cache_key}")
                return True
            return False

        except Exception as e:
            logger.exception(f"AI SDK cache delete failed: {e}")
            return False

    async def invalidate_by_service(self, service_type: str) -> int:
        """Invalidate all cache entries for a specific service type"""
        try:
            prefix = f"{service_type}:"
            keys_to_delete = [key for key in self.cache if key.startswith(prefix)]
            deleted_count = 0

            for key in keys_to_delete:
                entry = self.cache[key]
                self.metrics.total_size_bytes -= entry.size_bytes
                del self.cache[key]
                deleted_count += 1

            self.metrics.deletes += deleted_count
            logger.info(f"Invalidated {deleted_count} AI SDK entries for service: {service_type}")
            return deleted_count

        except Exception as e:
            logger.exception(f"AI SDK service invalidation failed: {e}")
            return 0

    def get_cache_stats(self) -> dict[str, Any]:
        """Get comprehensive cache statistics"""
        # Update average response time
        if self.response_times:
            self.metrics.avg_response_time = sum(self.response_times) / len(self.response_times)

        # Clean expired entries
        expired_keys = [k for k, v in self.cache.items() if v.is_expired()]
        for key in expired_keys:
            del self.cache[key]

        # Get service-specific stats
        service_stats = {}
        for service_type in ["embeddings", "agents", "vision", "objects"]:
            service_entries = [v for v in self.cache.values() if v.service_type == service_type]
            service_stats[service_type] = {
                "keys_count": len(service_entries),
                "total_size_mb": sum(e.size_bytes for e in service_entries) / (1024 * 1024),
            }

        return {
            "connected": True,
            "total_keys": len(self.cache),
            "memory_used_mb": sum(e.size_bytes for e in self.cache.values()) / (1024 * 1024),
            "metrics": {**asdict(self.metrics), "hit_rate": round(self.metrics.hit_rate, 2)},
            "service_stats": service_stats,
            "timestamp": utc_now_iso(),
        }

    # =============================================================================
    # AI SDK SPECIFIC CACHE METHODS
    # =============================================================================

    async def cache_embedding(self, model: str, text: str, embedding: list[float]) -> bool:
        """Cache text embedding"""
        key = self._generate_hash_key({"model": model, "text": text})
        return await self.set("embeddings", "generate", key, embedding)

    async def get_cached_embedding(self, model: str, text: str) -> list[float] | None:
        """Get cached embedding"""
        key = self._generate_hash_key({"model": model, "text": text})
        return await self.get("embeddings", "generate", key)

    async def cache_similarity_search(self, collection: str, query: str, results: list[dict[str, Any]]) -> bool:
        """Cache similarity search results"""
        key = self._generate_hash_key({"collection": collection, "query": query})
        return await self.set("embeddings", "similarity_search", key, results)

    async def get_cached_similarity_search(self, collection: str, query: str) -> list[dict[str, Any]] | None:
        """Get cached similarity search results"""
        key = self._generate_hash_key({"collection": collection, "query": query})
        return await self.get("embeddings", "similarity_search", key)

    async def cache_image_analysis(self, image_hash: str, analysis_type: str, result: dict[str, Any]) -> bool:
        """Cache image analysis result"""
        key = f"{image_hash}:{analysis_type}"
        return await self.set("vision", analysis_type, key, result)

    async def get_cached_image_analysis(self, image_hash: str, analysis_type: str) -> dict[str, Any] | None:
        """Get cached image analysis"""
        key = f"{image_hash}:{analysis_type}"
        return await self.get("vision", analysis_type, key)

    async def cache_object_generation(self, schema: dict[str, Any], prompt: str, result: Any) -> bool:
        """Cache object generation result"""
        key = self._generate_hash_key({"schema": schema, "prompt": prompt})
        return await self.set("objects", "generate_object", key, result)

    async def get_cached_object_generation(self, schema: dict[str, Any], prompt: str) -> Any | None:
        """Get cached object generation"""
        key = self._generate_hash_key({"schema": schema, "prompt": prompt})
        return await self.get("objects", "generate_object", key)


# =============================================================================
# SIMPLE RATE LIMITER
# =============================================================================


class SimpleRateLimiter:
    """Simple in-memory rate limiter"""

    def __init__(self) -> None:
        self.requests: dict[str, dict[str, list[float]]] = {}  # {identifier: {operation: [timestamps]}}

        # Rate limit configurations (requests per minute)
        self.rate_limits = {
            "embeddings": {"generate": 1000, "batch_generate": 500, "similarity_search": 2000},
            "agents": {"chat_completion": 500, "tool_call": 1000},
            "vision": {"analyze_image": 100, "ocr_text": 200},
            "objects": {"generate_object": 300, "stream_object": 500},
        }

    async def is_allowed(self, service_type: str, operation: str, identifier: str) -> bool:
        """Check if request is within rate limits"""
        try:
            service_limits = self.rate_limits.get(service_type, {})
            limit_per_minute = service_limits.get(operation, 1000)

            current_time = time.time()
            one_minute_ago = current_time - 60

            # Initialize if not exists
            if identifier not in self.requests:
                self.requests[identifier] = {}
            if operation not in self.requests[identifier]:
                self.requests[identifier][operation] = []

            # Clean old requests
            self.requests[identifier][operation] = [
                ts for ts in self.requests[identifier][operation] if ts > one_minute_ago
            ]

            # Check if under limit
            current_count = len(self.requests[identifier][operation])
            if current_count >= limit_per_minute:
                return False

            # Add current request
            self.requests[identifier][operation].append(current_time)
            return True

        except Exception as e:
            logger.exception(f"Rate limit check failed: {e}")
            return True  # Allow on error

    async def get_remaining_requests(self, service_type: str, operation: str, identifier: str) -> int:
        """Get remaining requests for current minute"""
        try:
            service_limits = self.rate_limits.get(service_type, {})
            limit_per_minute = service_limits.get(operation, 1000)

            current_time = time.time()
            one_minute_ago = current_time - 60

            if identifier in self.requests and operation in self.requests[identifier]:
                current_count = len([ts for ts in self.requests[identifier][operation] if ts > one_minute_ago])
                return max(0, limit_per_minute - current_count)

            return limit_per_minute

        except Exception as e:
            logger.exception(f"Get remaining requests failed: {e}")
            return 999


# =============================================================================
# UNIFIED SIMPLE CACHE SERVICE
# =============================================================================


class SimpleCacheService:
    """Unified simple cache service"""

    def __init__(self) -> None:
        self.cache_manager = SimpleCacheManager()
        self.rate_limiter = SimpleRateLimiter()

    async def start(self) -> bool:
        """Start services"""
        logger.info("Simple AI SDK Cache Service started")
        return True

    async def stop(self) -> None:
        """Stop services"""
        logger.info("Simple AI SDK Cache Service stopped")

    async def check_rate_limit(self, service_type: str, operation: str, identifier: str) -> bool:
        """Check if operation is within rate limits"""
        return await self.rate_limiter.is_allowed(service_type, operation, identifier)

    async def get_service_stats(self) -> dict[str, Any]:
        """Get service statistics"""
        cache_stats = self.cache_manager.get_cache_stats()

        return {
            "cache": cache_stats,
            "rate_limiter": {"connected": True, "rate_limits": self.rate_limiter.rate_limits},
            "timestamp": utc_now_iso(),
        }

    async def invalidate_service_cache(self, service_type: str) -> int:
        """Invalidate all cache for a service type"""
        return await self.cache_manager.invalidate_by_service(service_type)


# =============================================================================
# GLOBAL CACHE SERVICE INSTANCE
# =============================================================================

simple_cache_service = SimpleCacheService()

logger.info("Simple AI SDK Cache Service loaded")
