"""
UNIFIED CACHE SERVICE — простой и безопасный API для кэширования

Принципы:
1. Один простой API для всех типов кэша
2. Автоматическое версионирование ключей
3. Безопасность через изоляцию
4. Graceful degradation (работает даже если Redis недоступен)
5. Автоматическая инвалидация при деплое

Использование:
    from api.services.unified_cache_service import cache, get_cache

    # Кэшировать данные
    await cache.set("user:123", {"name": "John"}, ttl=3600)

    # Получить из кэша
    data = await cache.get("user:123")

    # Инвалидировать
    await cache.invalidate("user:123")

    # Инвалидировать по паттерну
    await cache.invalidate_pattern("user:*")
"""

import json
import logging
from collections.abc import Callable
from typing import Any

from api.services.cache_analytics_service import get_cache_analytics
from api.services.cache_compression_service import compress_value, decompress_value, should_compress
from api.services.cache_version_manager import (
    CacheVersionManager,
    get_cache_version_manager,
)

logger = logging.getLogger(__name__)


class UnifiedCacheService:
    """
    Унифицированный сервис кэширования.

    Простой и безопасный API для работы с кэшем.
    Автоматически включает версионирование и изоляцию.
    """

    def __init__(self, version_manager: CacheVersionManager | None = None):
        """
        Инициализация унифицированного сервиса кэша

        Args:
            version_manager: Менеджер версий кэша (если None, создается новый)
        """
        self.version_manager = version_manager
        self._redis_client = None
        self._analytics = None

    async def _get_redis_service(self):
        """Получить существующий Redis сервис"""
        try:
            from api.services.redis_service import get_redis_service

            return await get_redis_service()
        except Exception as e:
            logger.debug(f"Redis сервис недоступен: {e}")
            return None

    def _generate_key(self, key: str, include_version: bool = True) -> str:
        """
        Генерирует версионированный ключ кэша

        Args:
            key: Базовый ключ
            include_version: Включать ли версию (по умолчанию True)

        Returns:
            Версионированный ключ
        """
        if not include_version:
            return key

        manager = self.version_manager
        if manager is None:
            # Если менеджер не инициализирован, используем базовый ключ
            return key

        return manager.get_versioned_cache_key(key, include_version=True)

    async def get(self, key: str, default: Any = None, fetch_func: Callable | None = None) -> Any:
        """
        Получить значение из кэша

        Args:
            key: Ключ кэша
            default: Значение по умолчанию если не найдено
            fetch_func: Функция для получения данных если кэш промах (cache-aside pattern)

        Returns:
            Значение из кэша или результат fetch_func или default
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                # Redis недоступен - выполняем fetch_func или возвращаем default
                if fetch_func:
                    return await fetch_func() if callable(fetch_func) else default
                return default

            cache_key = self._generate_key(key)

            async with redis_service.get_redis_client() as client:
                if not client:
                    if fetch_func:
                        return await fetch_func() if callable(fetch_func) else default
                    return default

                cached_data = await client.get(cache_key)

                if cached_data:
                    try:
                        # Проверяем сжатые данные
                        if isinstance(cached_data, str) and cached_data.startswith("__COMPRESSED_B64__"):
                            # Декодируем из base64 и распаковываем
                            import base64

                            compressed_b64 = cached_data[18:]  # len("__COMPRESSED_B64__") = 18
                            compressed = base64.b64decode(compressed_b64.encode("utf-8"))
                            data = decompress_value(compressed)
                        else:
                            data = json.loads(cached_data)

                        logger.debug(f"Cache HIT: {key}")

                        # Трекинг метрик
                        await self._track_cache_hit(key)

                        return data
                    except (json.JSONDecodeError, ValueError) as e:
                        logger.warning(f"Невалидные данные в кэше для ключа {key}: {e}")
                        await client.delete(cache_key)

                # Cache MISS
                logger.debug(f"Cache MISS: {key}")

                # Трекинг метрик
                await self._track_cache_miss(key)

            # Если есть fetch_func - получаем данные и кэшируем
            if fetch_func:
                try:
                    data = await fetch_func() if callable(fetch_func) else default
                    if data is not None:
                        await self.set(key, data)
                    return data
                except Exception as e:
                    logger.exception(f"Ошибка выполнения fetch_func для {key}: {e}")
                    return default

            return default

        except Exception as e:
            logger.exception(f"Ошибка получения из кэша {key}: {e}")
            # Graceful degradation - возвращаем default или результат fetch_func
            if fetch_func:
                try:
                    return await fetch_func() if callable(fetch_func) else default
                except Exception as nested_exc:
                    logger.debug("[STEP] unified_cache_fetch_func_skip key=%s err=%s", key, nested_exc)
                    return default
            return default

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600,
        include_version: bool = True,
        compress: bool = True,
    ) -> bool:
        """
        Сохранить значение в кэш

        Args:
            key: Ключ кэша
            value: Значение для кэширования
            ttl: Time to live в секундах (по умолчанию 1 час)
            include_version: Включать ли версию в ключ (по умолчанию True)
            compress: Автоматически сжимать большие значения (по умолчанию True)

        Returns:
            True если успешно, False иначе
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                logger.debug(f"Redis недоступен, пропускаем кэширование {key}")
                return False

            cache_key = self._generate_key(key, include_version=include_version)

            # Сериализуем и сжимаем если нужно
            try:
                if compress and should_compress(value):
                    # Сжимаем большие значения
                    compressed = compress_value(value)
                    # Redis хранит байты, но мы используем decode_responses=True
                    # Поэтому конвертируем в base64 строку для хранения
                    import base64

                    serialized = base64.b64encode(compressed).decode("utf-8")
                    # Добавляем маркер что это сжатые данные
                    serialized = f"__COMPRESSED_B64__{serialized}"
                else:
                    serialized = json.dumps(value, default=str)
            except (TypeError, ValueError) as e:
                logger.warning(f"Не удалось сериализовать значение для {key}: {e}")
                return False

            async with redis_service.get_redis_client() as client:
                if not client:
                    return False

                # Сохраняем в Redis с TTL
                await client.setex(cache_key, ttl, serialized)

                logger.debug(f"Cached: {key} (TTL={ttl}s)")

                # Трекинг метрик
                await self._track_cache_set(key)

                return True

        except Exception as e:
            logger.exception(f"Ошибка сохранения в кэш {key}: {e}")
            return False

    async def invalidate(self, key: str, include_version: bool = True) -> bool:
        """
        Инвалидировать ключ кэша

        Args:
            key: Ключ кэша
            include_version: Учитывать ли версию при удалении

        Returns:
            True если успешно
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                return False

            cache_key = self._generate_key(key, include_version=include_version)

            async with redis_service.get_redis_client() as client:
                if not client:
                    return False

                deleted = await client.delete(cache_key)

                if deleted:
                    logger.debug(f"Invalidated: {key}")
                    # Трекинг метрик
                    await self._track_cache_invalidation(key)

                return deleted > 0

        except Exception as e:
            logger.exception(f"Ошибка инвалидации {key}: {e}")
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Инвалидировать все ключи по паттерну

        Args:
            pattern: Паттерн для поиска ключей (например, "user:*")

        Returns:
            Количество удаленных ключей
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                return 0

            async with redis_service.get_redis_client() as client:
                if not client:
                    return 0

                deleted_count = 0
                async for key in client.scan_iter(match=pattern):
                    await client.delete(key)
                    deleted_count += 1

                if deleted_count > 0:
                    logger.info(f"Удалено {deleted_count} ключей по паттерну '{pattern}'")

                return deleted_count

        except Exception as e:
            logger.exception(f"Ошибка инвалидации по паттерну '{pattern}': {e}")
            return 0

    async def clear_all(self) -> bool:
        """
        ОПАСНО: очистить весь кэш.

        Используется только для экстренных случаев.
        Для обычной инвалидации при деплое используйте CacheVersionManager.

        Returns:
            True если успешно
        """
        try:
            manager = await get_cache_version_manager()
            return await manager.invalidate_all_caches()
        except Exception as e:
            logger.exception(f"Ошибка очистки всего кэша: {e}")
            return False

    async def _track_cache_hit(self, key: str) -> None:
        """Трекинг cache hit для аналитики"""
        try:
            if not self._analytics:
                self._analytics = await get_cache_analytics()
            cache_type = self._extract_cache_type(key)
            await self._analytics.record_cache_hit(cache_type)
        except Exception as exc:  # noqa: BLE001 — analytics is optional telemetry
            logger.debug("Cache analytics hit skipped key=%s err=%s", key, exc, exc_info=True)

    async def _track_cache_miss(self, key: str) -> None:
        """Трекинг cache miss для аналитики"""
        try:
            if not self._analytics:
                self._analytics = await get_cache_analytics()
            cache_type = self._extract_cache_type(key)
            await self._analytics.record_cache_miss(cache_type)
        except Exception as exc:  # noqa: BLE001 — analytics is optional telemetry
            logger.debug("Cache analytics miss skipped key=%s err=%s", key, exc, exc_info=True)

    async def _track_cache_set(self, key: str) -> None:
        """Трекинг cache set для аналитики"""
        try:
            if not self._analytics:
                self._analytics = await get_cache_analytics()
            cache_type = self._extract_cache_type(key)
            await self._analytics.record_cache_set(cache_type)
        except Exception as exc:  # noqa: BLE001 — analytics is optional telemetry
            logger.debug("Cache analytics set skipped key=%s err=%s", key, exc, exc_info=True)

    async def _track_cache_invalidation(self, key: str) -> None:
        """Трекинг инвалидации для аналитики"""
        try:
            if not self._analytics:
                self._analytics = await get_cache_analytics()
            cache_type = self._extract_cache_type(key)
            await self._analytics.record_cache_invalidation(cache_type)
        except Exception as exc:  # noqa: BLE001 — analytics is optional telemetry
            logger.debug("Cache analytics invalidation skipped key=%s err=%s", key, exc, exc_info=True)

    def _extract_cache_type(self, key: str) -> str:
        """Извлечь тип кэша из ключа"""
        # Определяем тип по префиксу
        if key.startswith("response_cache:"):
            return "api"
        if key.startswith("content:"):
            return "content"
        if key.startswith("marketing:"):
            return "marketing"
        if key.startswith(("user:", "user_profile:", "user_theme:")):
            return "user"
        if key.startswith("ai_sdk:"):
            return "ai_sdk"
        if key.startswith("dashboard:"):
            return "dashboard"
        return "other"

    async def get_stats(self) -> dict[str, Any]:
        """
        Получить статистику кэша

        Returns:
            Словарь со статистикой
        """
        try:
            manager = await get_cache_version_manager()
            return await manager.get_cache_stats()
        except Exception as e:
            logger.exception(f"Ошибка получения статистики: {e}")
            return {"available": False, "error": str(e)}


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

_unified_cache: UnifiedCacheService | None = None


async def get_unified_cache() -> UnifiedCacheService:
    """
    Получить глобальный экземпляр унифицированного кэша

    Использование:
        cache = await get_unified_cache()
        await cache.set("key", value)
        data = await cache.get("key")
    """
    global _unified_cache

    if _unified_cache is None:
        version_manager = await get_cache_version_manager()
        _unified_cache = UnifiedCacheService(version_manager=version_manager)

    return _unified_cache


# ============================================================================
# CONVENIENCE ALIASES
# ============================================================================


# Для удобства можно использовать напрямую
async def cache() -> UnifiedCacheService:
    """Алиас для get_unified_cache()"""
    return await get_unified_cache()
