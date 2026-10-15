"""
CACHE EVENT INVALIDATOR — инвалидация кэша по событиям

Функции:
1. Инвалидация кэша при изменениях в БД (через события)
2. Подписка на события обновления данных
3. Автоматическая инвалидация связанных ключей
4. Групповая инвалидация по паттернам

Использование:
    from api.services.cache_event_invalidator import get_event_invalidator

    invalidator = await get_event_invalidator()
    await invalidator.invalidate_on_user_update(user_id)
    await invalidator.invalidate_on_content_create(user_id)
"""

import logging

from api.services.cache_version_manager import get_cache_version_manager
from api.services.unified_cache_service import get_unified_cache

logger = logging.getLogger(__name__)


class CacheEventInvalidator:
    """
    Инвалидатор кэша по событиям.

    Автоматически инвалидирует кэш при изменениях данных.
    """

    def __init__(self) -> None:
        self.cache = None
        self.version_manager = None

    async def _get_services(self):
        """Получить необходимые сервисы"""
        if not self.cache:
            self.cache = await get_unified_cache()
        if not self.version_manager:
            self.version_manager = await get_cache_version_manager()
        return self.cache, self.version_manager

    async def invalidate_on_user_update(self, user_id: str) -> bool:
        """
        Инвалидировать кэш при обновлении пользователя

        Args:
            user_id: ID пользователя

        Returns:
            True если успешно
        """
        try:
            cache, _ = await self._get_services()

            # Инвалидируем все связанные ключи (DB 0: cache_warmer и response_cache)
            # user_profile:* и user_theme:* — фактические ключи из cache_warmer (api/core/cache_warmer.py)
            patterns = [
                f"user:{user_id}",
                f"user:{user_id}:*",
                f"user_profile:{user_id}",
                f"user_theme:{user_id}",
                f"user:profile:{user_id}",
                f"user:theme:{user_id}",
                f"user:stats:{user_id}",
                f"dashboard:stats:{user_id}",
                f"dashboard:activity:{user_id}:*",
                f"content:list:{user_id}:*",
            ]

            total_invalidated = 0
            for pattern in patterns:
                count = await cache.invalidate_pattern(pattern)
                total_invalidated += count

            logger.info("Инвалидировано %s ключей для пользователя %s", total_invalidated, user_id)
            return True

        except Exception as e:
            logger.exception("Ошибка инвалидации кэша пользователя %s: %s", user_id, e)
            return False

    async def invalidate_on_content_create(self, user_id: str) -> bool:
        """
        Инвалидировать кэш при создании контента

        Args:
            user_id: ID пользователя

        Returns:
            True если успешно
        """
        try:
            cache, _ = await self._get_services()

            # Инвалидируем списки контента
            patterns = [
                f"content:list:{user_id}:*",
                f"dashboard:stats:{user_id}",
                f"user:stats:{user_id}",
            ]

            total_invalidated = 0
            for pattern in patterns:
                count = await cache.invalidate_pattern(pattern)
                total_invalidated += count

            logger.debug(
                "Инвалидировано %s ключей после создания контента для %s",
                total_invalidated,
                user_id,
            )
            return True

        except Exception as e:
            logger.exception("Ошибка инвалидации кэша после создания контента: %s", e)
            return False

    async def invalidate_on_content_update(self, user_id: str, content_id: str) -> bool:
        """
        Инвалидировать кэш при обновлении контента

        Args:
            user_id: ID пользователя
            content_id: ID контента

        Returns:
            True если успешно
        """
        try:
            cache, _ = await self._get_services()

            # Инвалидируем конкретный контент и списки
            await cache.invalidate(f"content:meta:{content_id}")

            patterns = [
                f"content:list:{user_id}:*",
                f"dashboard:stats:{user_id}",
            ]

            total_invalidated = 1  # Уже инвалидировали meta
            for pattern in patterns:
                count = await cache.invalidate_pattern(pattern)
                total_invalidated += count

            logger.debug(
                "Инвалидировано %s ключей после обновления контента %s",
                total_invalidated,
                content_id,
            )
            return True

        except Exception as e:
            logger.exception("Ошибка инвалидации кэша после обновления контента: %s", e)
            return False


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

_event_invalidator: CacheEventInvalidator | None = None


async def get_event_invalidator() -> CacheEventInvalidator:
    """Получить глобальный экземпляр инвалидатора по событиям"""
    global _event_invalidator

    if _event_invalidator is None:
        _event_invalidator = CacheEventInvalidator()

    return _event_invalidator
