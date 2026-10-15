"""
CENTRALIZED CACHE VERSION MANAGER

Автоматическая инвалидация кэша при деплое нового билда (hot reload для кэша)

Принципы:
1. Версионирование кэша через версию приложения
2. Автоматическая проверка версии при старте
3. Централизованная инвалидация всех кэшей
4. Безопасность через изоляцию и валидацию
5. Простота использования
6. Интеграция с существующим redis_service

Использование:
- При старте приложения автоматически проверяется версия
- Если версия изменилась - все кэши инвалидируются
- Ключи кэша автоматически включают версию приложения
"""

import hashlib
import logging
from typing import Any

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)


class CacheVersionManager:
    """
    Централизованный менеджер версий кэша.

    Автоматически инвалидирует кэш при изменении версии приложения.
    Все ключи кэша включают версию приложения для автоматической изоляции.
    """

    # Redis ключ для хранения текущей версии кэша
    CACHE_VERSION_KEY = "app:cache_version"

    # Префиксы для разных типов кэша (для избирательной инвалидации)
    CACHE_PREFIXES = {
        "api": "response_cache:",
        "content": "content:",
        "marketing": "marketing:",
        "user": "user:",
        "ai_sdk": "ai_sdk:",
        "dashboard": "dashboard:",
    }

    def __init__(self) -> None:
        """
        Инициализация менеджера версий кэша

        Использует существующий redis_service для совместимости с архитектурой.
        """
        self.app_version = unified_settings.app_version
        self._current_cache_version: str | None = None

    async def _get_redis_service(self):
        """Получить существующий Redis сервис"""
        try:
            from api.services.redis_service import get_redis_service

            return await get_redis_service()
        except Exception as e:
            logger.warning("Redis сервис недоступен для версионирования кэша: %s", e)
            return None

    async def get_current_cache_version(self) -> str | None:
        """
        Получить текущую версию кэша из Redis

        Returns:
            Версия кэша или None если не установлена
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                return None

            async with redis_service.get_redis_client() as client:
                if not client:
                    return None

                version = await client.get(self.CACHE_VERSION_KEY)
                if version:
                    self._current_cache_version = version
                    return version
                return None
        except Exception as e:
            logger.warning("Ошибка получения версии кэша: %s", e)
            return None

    async def set_cache_version(self, version: str) -> bool:
        """
        Установить версию кэша в Redis

        Args:
            version: Версия приложения

        Returns:
            True если успешно
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                return False

            async with redis_service.get_redis_client() as client:
                if not client:
                    return False

                # Устанавливаем версию без TTL (постоянно)
                await client.set(self.CACHE_VERSION_KEY, version)
                self._current_cache_version = version

                logger.info("Версия кэша установлена: %s", version)
                return True
        except Exception as e:
            logger.exception("Ошибка установки версии кэша: %s", e)
            return False

    async def check_and_invalidate_if_needed(self) -> bool:
        """
        Главная функция: проверяет версию и инвалидирует кэш при необходимости.

        Вызывается при старте приложения.

        Returns:
            True если была инвалидация, False если версия совпадает
        """
        try:
            current_version = await self.get_current_cache_version()

            # Если версия не установлена или изменилась - инвалидируем кэш
            if current_version != self.app_version:
                logger.info(
                    "Версия приложения изменилась: %s -> %s. Инвалидация кэша.",
                    current_version,
                    self.app_version,
                )

                # Инвалидируем все кэши
                invalidated = await self.invalidate_all_caches()

                # Устанавливаем новую версию
                await self.set_cache_version(self.app_version)

                if invalidated:
                    logger.info("Кэш инвалидирован и обновлен до версии %s", self.app_version)
                else:
                    logger.warning("Инвалидация кэша завершилась с предупреждениями")

                return True
            logger.debug("Версия кэша актуальна: %s", self.app_version)
            return False

        except Exception as e:
            logger.exception("Ошибка проверки версии кэша: %s", e)
            # В случае ошибки продолжаем работу (graceful degradation)
            return False

    async def invalidate_all_caches(self) -> bool:
        """
        Инвалидирует все кэши в системе

        ВНИМАНИЕ: удаляет все данные из кэша.
        Используется только при деплое нового билда.

        Returns:
            True если успешно
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                logger.warning("Redis недоступен, пропускаем инвалидацию")
                return False

            async with redis_service.get_redis_client() as client:
                if not client:
                    return False

                total_deleted = 0

                # Инвалидируем кэши по префиксам
                for cache_type, prefix in self.CACHE_PREFIXES.items():
                    try:
                        # Используем SCAN для безопасного поиска ключей
                        deleted_count = 0
                        async for key in client.scan_iter(match=f"{prefix}*"):
                            await client.delete(key)
                            deleted_count += 1

                        if deleted_count > 0:
                            logger.info("Удалено %s ключей из кэша '%s'", deleted_count, cache_type)
                            total_deleted += deleted_count

                    except Exception as e:
                        logger.warning("Ошибка инвалидации кэша '%s': %s", cache_type, e)
                        continue

                logger.info("Инвалидация завершена. Всего удалено: %s ключей", total_deleted)
                return True

        except Exception as e:
            logger.exception("Ошибка инвалидации всех кэшей: %s", e)
            return False

    async def invalidate_cache_by_prefix(self, prefix: str) -> int:
        """
        Инвалидирует кэш по префиксу (избирательная инвалидация)

        Args:
            prefix: Префикс ключей для удаления (например, "content:meta:")

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
                async for key in client.scan_iter(match=f"{prefix}*"):
                    await client.delete(key)
                    deleted_count += 1

                if deleted_count > 0:
                    logger.info("Удалено %s ключей с префиксом '%s'", deleted_count, prefix)

                return deleted_count

        except Exception as e:
            logger.warning("Ошибка инвалидации кэша по префиксу '%s': %s", prefix, e)
            return 0

    def get_versioned_cache_key(self, base_key: str, include_version: bool = True) -> str:
        """
        Генерирует ключ кэша с версией приложения

        Args:
            base_key: Базовый ключ кэша
            include_version: Включать ли версию в ключ (по умолчанию True)

        Returns:
            Версионированный ключ кэша
        """
        if not include_version:
            return base_key

        # Создаем хеш версии для компактности
        version_hash = hashlib.md5(self.app_version.encode()).hexdigest()[:8]
        return f"{base_key}:v{version_hash}"

    async def get_cache_stats(self) -> dict[str, Any]:
        """
        Получить статистику кэша

        Returns:
            Словарь со статистикой
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                return {"available": False, "error": "Redis недоступен"}

            async with redis_service.get_redis_client() as client:
                if not client:
                    return {"available": False, "error": "Redis клиент недоступен"}

                stats = {
                    "available": True,
                    "app_version": self.app_version,
                    "cache_version": await self.get_current_cache_version(),
                    "version_match": self._current_cache_version == self.app_version,
                    "cache_types": {},
                }

                # Подсчитываем ключи по типам
                for cache_type, prefix in self.CACHE_PREFIXES.items():
                    count = 0
                    async for _ in client.scan_iter(match=f"{prefix}*"):
                        count += 1
                    stats["cache_types"][cache_type] = count

                return stats

        except Exception as e:
            logger.exception("Ошибка получения статистики кэша: %s", e)
            return {"available": False, "error": str(e)}


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

_cache_version_manager: CacheVersionManager | None = None


async def get_cache_version_manager() -> CacheVersionManager:
    """Получить глобальный экземпляр менеджера версий кэша"""
    global _cache_version_manager

    if _cache_version_manager is None:
        _cache_version_manager = CacheVersionManager()

    return _cache_version_manager


# ============================================================================
# STARTUP FUNCTION
# ============================================================================


async def initialize_cache_version_on_startup() -> None:
    """
    Инициализация при старте приложения.

    Вызывается в startup event FastAPI ПОСЛЕ инициализации redis_service.
    Автоматически проверяет версию и инвалидирует кэш если нужно.
    """
    try:
        # Убеждаемся что redis_service инициализирован
        from api.services.redis_service import get_redis_service

        redis_service = await get_redis_service()

        # Инициализируем если еще не инициализирован
        if not redis_service.is_available:
            logger.info("Инициализация Redis сервиса для проверки версии кэша...")
            success = await redis_service.initialize()
            if not success:
                logger.warning("Redis недоступен, пропускаем проверку версии кэша")
                return

        # Проверяем версию и инвалидируем если нужно
        manager = await get_cache_version_manager()
        await manager.check_and_invalidate_if_needed()
    except Exception as e:
        logger.exception("Ошибка инициализации версии кэша при старте: %s", e)
        # Не прерываем запуск приложения при ошибке кэша
