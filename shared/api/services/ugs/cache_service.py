#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Persist UGS generation result cache rows in PostgreSQL (generation_cache): TTL, lookup, stats, invalidation.
# Invariants:
# - Hot-path reads used by UnifiedGenerationService avoid write+commit unless caller opts into access stats.
# - HTTP generation cache keys are user-scoped by UnifiedGenerationService before hitting this global table.
# Related:
# - api/services/ugs/unified_generation_service.py
# - api/models/database_models (GenerationCache)
# ---
"""UGS PostgreSQL-backed generation result cache (TTL + optional hit counters)."""

import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, desc, func, select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.database_models import GenerationCache

logger = logging.getLogger(__name__)


def _utc_now_naive() -> datetime:
    """
    Get current UTC time as timezone-naive datetime.
    PostgreSQL TIMESTAMP WITHOUT TIME ZONE requires timezone-naive datetime.
    """
    return datetime.now(UTC).replace(tzinfo=None)


class CacheService:
    """
    Service for generation result caching in UGS.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.default_ttl = 3600  # 1 час по умолчанию

    async def get(
        self,
        cache_key: str,
        *,
        update_access_stats: bool = False,
    ) -> Any | None:  # noqa: ANN401
        """
        Get value from cache.

        By default, cache hits are read-only (no commit) for lower latency under load.
        Pass ``update_access_stats=True`` to bump access_count / last_accessed (writes + commit).

        Args:
            cache_key: Cache key
            update_access_stats: When True, persist hit counters (extra write transaction).

        Returns:
            Cached value or None
        """
        stmt = select(GenerationCache).where(
            and_(GenerationCache.cache_key == cache_key, GenerationCache.expires_at > _utc_now_naive())
        )
        result = await self.db.execute(stmt)
        cache_entry = result.scalar_one_or_none()

        if cache_entry:
            if update_access_stats:
                cache_entry.access_count += 1  # type: ignore[assignment]
                cache_entry.last_accessed_at = _utc_now_naive()  # type: ignore[assignment]
                await self.db.commit()

            logger.debug("Cache hit for key: %s", cache_key)
            return cache_entry.cached_data
        logger.debug("Cache miss for key: %s", cache_key)
        return None

    async def set(self, cache_key: str, data: Any, ttl: int | None = None) -> bool:  # noqa: ANN401
        """
        Save value to cache

        Args:
            cache_key: Cache key
            data: Data to cache
            ttl: Time to live in seconds (optional)

        Returns:
            bool: True if successfully saved
        """
        if ttl is None:
            ttl = self.default_ttl

        expires_at = _utc_now_naive() + timedelta(seconds=ttl)

        # Проверить существует ли уже запись
        stmt = select(GenerationCache).where(GenerationCache.cache_key == cache_key)
        result = await self.db.execute(stmt)
        existing_entry = result.scalar_one_or_none()

        if existing_entry:
            # Обновить существующую запись
            existing_entry.cached_data = data  # type: ignore[assignment]
            existing_entry.expires_at = expires_at  # type: ignore[assignment]
            existing_entry.updated_at = _utc_now_naive()  # type: ignore[assignment]
            existing_entry.access_count = 0  # type: ignore[assignment]
        else:
            # Создать новую запись
            cache_entry = GenerationCache(cache_key=cache_key, cached_data=data, expires_at=expires_at, access_count=0)
            self.db.add(cache_entry)

        await self.db.commit()
        logger.debug("Cached data for key: %s, TTL: %ss", cache_key, ttl)
        return True

    async def delete(self, cache_key: str) -> bool:
        """
        Delete value from cache

        Args:
            cache_key: Cache key

        Returns:
            bool: True if successfully deleted
        """
        stmt = select(GenerationCache).where(GenerationCache.cache_key == cache_key)
        result = await self.db.execute(stmt)
        cache_entry = result.scalar_one_or_none()

        if cache_entry:
            await self.db.delete(cache_entry)
            await self.db.commit()
            logger.debug("Deleted cache entry: %s", cache_key)
            return True

        return False

    async def clear_expired(self) -> int:
        """
        Clear expired cache entries

        Returns:
            int: Number of deleted entries
        """
        stmt = select(GenerationCache).where(GenerationCache.expires_at <= _utc_now_naive())
        result = await self.db.execute(stmt)
        expired_entries = list(result.scalars().all())

        count = len(expired_entries)
        for entry in expired_entries:
            await self.db.delete(entry)

        await self.db.commit()
        logger.info("Cleared %s expired cache entries", count)
        return count

    async def invalidate_by_pattern(self, pattern: str) -> int:
        """
        Invalidate cache by pattern

        Args:
            pattern: Pattern for key search (e.g. "text_*")

        Returns:
            int: Number of invalidated entries
        """
        # Simple implementation with LIKE
        # In production can use more complex logic
        like_pattern = f"%{pattern}%"

        stmt = select(GenerationCache).where(GenerationCache.cache_key.like(like_pattern))
        result = await self.db.execute(stmt)
        entries_to_delete = list(result.scalars().all())

        count = len(entries_to_delete)
        for entry in entries_to_delete:
            await self.db.delete(entry)

        await self.db.commit()
        logger.info("Invalidated %s cache entries matching pattern: %s", count, pattern)
        return count

    async def get_stats(self) -> dict[str, Any]:
        """
        Get cache statistics

        Returns:
            dict[str, Any] with statistics
        """
        stmt = select(func.count()).select_from(GenerationCache)
        result = await self.db.execute(stmt)
        total_entries = result.scalar() or 0

        stmt = select(func.count()).select_from(GenerationCache).where(GenerationCache.expires_at <= _utc_now_naive())
        result = await self.db.execute(stmt)
        expired_entries = result.scalar() or 0

        active_entries = total_entries - expired_entries

        # Usage statistics
        most_accessed_stmt = (
            select(GenerationCache)
            .where(GenerationCache.access_count > 0)
            .order_by(desc(GenerationCache.access_count))
            .limit(5)
        )
        most_accessed_result = await self.db.execute(most_accessed_stmt)
        most_accessed: list[GenerationCache] = list(most_accessed_result.scalars().all())

        # Cache size (optimized estimate)
        # Use sample of active entries for size estimation
        # Calculate size only for sample, then extrapolate
        sample_size = min(100, active_entries)  # Берем выборку до 100 записей
        if sample_size > 0:
            sample_stmt = (
                select(GenerationCache).where(GenerationCache.expires_at > _utc_now_naive()).limit(sample_size)
            )
            sample_result = await self.db.execute(sample_stmt)
            sample_entries: list[GenerationCache] = list(sample_result.scalars().all())

            sample_total_bytes = 0
            for entry in sample_entries:
                try:
                    sample_total_bytes += len(json.dumps(entry.cached_data).encode("utf-8"))
                except (TypeError, ValueError):  # fmt: skip
                    # Если не удается сериализовать, используем приблизительную оценку
                    sample_total_bytes += 1024  # 1KB по умолчанию

            # Экстраполируем размер на все активные записи
            avg_entry_size = sample_total_bytes / sample_size if sample_size > 0 else 0
            total_size_bytes = int(avg_entry_size * active_entries)
        else:
            total_size_bytes = 0

        return {
            "total_entries": total_entries,
            "active_entries": active_entries,
            "expired_entries": expired_entries,
            "total_size_bytes": total_size_bytes,
            "total_size_mb": round(total_size_bytes / (1024 * 1024), 2),
            "most_accessed": [
                {
                    "key": entry.cache_key,
                    "access_count": entry.access_count,
                    "last_accessed": entry.last_accessed_at.isoformat()
                    if entry.last_accessed_at is not None  # type: ignore[truthy-bool]
                    else None,
                }
                for entry in most_accessed
            ],
            "timestamp": datetime.now(UTC).isoformat(),
        }

    async def warmup_cache(self, generation_type: str, common_inputs: list) -> int:
        """
        Предварительно заполнить кеш для распространенных запросов

        Args:
            generation_type: Тип генерации
            common_inputs: Список распространенных входных данных

        Returns:
            int: Количество добавленных записей
        """
        added_count = 0

        for input_data in common_inputs:
            cache_key = self._generate_cache_key(generation_type, input_data)

            # Check if already exists
            existing = await self.get(cache_key)
            if existing is None:
                # Can call generation for warmup here
                # But for simplicity just create placeholder
                placeholder_data = {
                    "warmup": True,
                    "generation_type": generation_type,
                    "input_data": input_data,
                    "message": "Cache warmup placeholder",
                }

                await self.set(cache_key, placeholder_data, ttl=self.default_ttl)
                added_count += 1

        logger.info("Warmup cache: added %s entries for %s", added_count, generation_type)
        return added_count

    def _generate_cache_key(self, generation_type: str, input_data: dict[str, Any]) -> str:
        """
        Generate cache key based on generation type and input data
        """
        # Create hash from combination of type and input data
        key_data = f"{generation_type}:{json.dumps(input_data, sort_keys=True)}"
        return hashlib.md5(key_data.encode()).hexdigest()  # noqa: S324

    async def get_cache_key_for_generation(self, type_key: str, input_data: dict[str, Any]) -> str:
        """
        Get cache key for specific generation

        Args:
            type_key: Generation type key
            input_data: Input data

        Returns:
            str: Cache key
        """
        return self._generate_cache_key(type_key, input_data)

    async def extend_ttl(self, cache_key: str, additional_seconds: int) -> bool:
        """
        Extend cache entry time to live

        Args:
            cache_key: Cache key
            additional_seconds: Additional time in seconds

        Returns:
            bool: True if successfully extended
        """
        stmt = select(GenerationCache).where(GenerationCache.cache_key == cache_key)
        result = await self.db.execute(stmt)
        cache_entry = result.scalar_one_or_none()

        if cache_entry:
            cache_entry.expires_at = cache_entry.expires_at + timedelta(seconds=additional_seconds)  # type: ignore[assignment]
            cache_entry.updated_at = _utc_now_naive()  # type: ignore[assignment]
            await self.db.commit()
            logger.debug("Extended TTL for cache key: %s", cache_key)
            return True

        return False
