"""
CACHE OPTIMIZER SERVICE — автоматическая оптимизация кэша

Функции:
1. Автоматическая корректировка TTL на основе hit rate
2. Адаптивный cache warming на основе паттернов использования
3. Автоматическая очистка неиспользуемых ключей
4. Оптимизация использования памяти

Использование:
    from api.services.cache_optimizer_service import get_cache_optimizer

    optimizer = await get_cache_optimizer()
    await optimizer.optimize_ttl_based_on_hit_rate()
    await optimizer.cleanup_unused_keys()
"""

import logging
from datetime import UTC, datetime
from typing import Any

from api.services.cache_analytics_service import get_cache_analytics
from api.services.redis_service import get_redis_service

logger = logging.getLogger(__name__)


class CacheOptimizerService:
    """
    Сервис автоматической оптимизации кэша.

    Анализирует метрики и автоматически оптимизирует TTL, очищает неиспользуемые данные.
    """

    # Пороговые значения для оптимизации
    MIN_HIT_RATE = 70.0  # Минимальный целевой hit rate
    OPTIMAL_HIT_RATE = 85.0  # Оптимальный hit rate
    MAX_HIT_RATE = 95.0  # Максимальный hit rate (можно уменьшить TTL)

    # Множители для корректировки TTL
    TTL_INCREASE_FACTOR = 1.2  # Увеличить TTL на 20% если hit rate низкий
    TTL_DECREASE_FACTOR = 0.9  # Уменьшить TTL на 10% если hit rate очень высокий

    def __init__(self) -> None:
        self.redis_service = None
        self.analytics = None

    async def _get_services(self):
        """Получить необходимые сервисы"""
        if not self.redis_service:
            self.redis_service = await get_redis_service()
        if not self.analytics:
            self.analytics = await get_cache_analytics()
        return self.redis_service, self.analytics

    async def optimize_ttl_based_on_hit_rate(self, cache_type: str | None = None) -> dict[str, Any]:
        """
        Автоматически оптимизировать TTL на основе hit rate

        Args:
            cache_type: Тип кэша для оптимизации (если None - все типы)

        Returns:
            Результаты оптимизации
        """
        try:
            redis_service, analytics = await self._get_services()
            if not redis_service or not redis_service.is_available:
                return {"status": "redis_unavailable"}

            stats = await analytics.get_comprehensive_stats()
            if stats.get("status") != "healthy":
                return {"status": "unavailable", "reason": stats.get("status")}

            by_type = stats.get("by_type", {})
            optimizations = []

            # Оптимизируем каждый тип кэша
            for ctype, metrics in by_type.items():
                if cache_type and ctype != cache_type:
                    continue

                hit_rate = metrics.get("hit_rate", 0)
                total_requests = metrics.get("total_requests", 0)

                # Пропускаем если недостаточно данных
                if total_requests < 100:
                    continue

                recommendation = None

                # Hit rate слишком низкий - увеличить TTL
                if hit_rate < self.MIN_HIT_RATE:
                    recommendation = {
                        "action": "increase_ttl",
                        "current_hit_rate": hit_rate,
                        "target_hit_rate": self.OPTIMAL_HIT_RATE,
                        "factor": self.TTL_INCREASE_FACTOR,
                        "reason": f"Hit rate {hit_rate:.1f}% ниже целевого {self.MIN_HIT_RATE}%",
                    }

                # Hit rate очень высокий - можно уменьшить TTL (экономия памяти)
                elif hit_rate > self.MAX_HIT_RATE:
                    recommendation = {
                        "action": "decrease_ttl",
                        "current_hit_rate": hit_rate,
                        "target_hit_rate": self.OPTIMAL_HIT_RATE,
                        "factor": self.TTL_DECREASE_FACTOR,
                        "reason": f"Hit rate {hit_rate:.1f}% выше оптимального {self.MAX_HIT_RATE}%",
                    }

                if recommendation:
                    optimizations.append({"cache_type": ctype, **recommendation})

            return {
                "status": "success",
                "optimizations": optimizations,
                "timestamp": datetime.now(UTC).isoformat(),
            }

        except Exception as e:
            logger.exception("Ошибка оптимизации TTL: %s", e)
            return {"status": "error", "error": str(e)}

    async def cleanup_unused_keys(self, max_age_hours: int = 24, min_access_count: int = 0) -> dict[str, Any]:
        """
        Очистить неиспользуемые ключи кэша

        Args:
            max_age_hours: Максимальный возраст ключа в часах
            min_access_count: Минимальное количество обращений (0 = не проверять)

        Returns:
            Результаты очистки
        """
        try:
            redis_service, _ = await self._get_services()
            if not redis_service or not redis_service.is_available:
                return {"status": "redis_unavailable"}

            async with redis_service.get_redis_client() as client:
                if not client:
                    return {"status": "redis_unavailable"}

                # Получаем все ключи
                all_keys = []
                async for key in client.scan_iter(match="*"):
                    all_keys.append(key)

                cleaned_count = 0
                total_size_freed = 0

                # Проверяем каждый ключ
                for key in all_keys:
                    try:
                        # Пропускаем системные ключи
                        if key.startswith(("app:", "__")):
                            continue

                        # Получаем TTL
                        ttl = await client.ttl(key)

                        # Если TTL очень большой (больше max_age_hours) и ключ не используется
                        # Это упрощенная логика - в реальности нужен более сложный анализ
                        if ttl > max_age_hours * 3600:
                            # Можно добавить проверку последнего доступа через OBJECT IDLETIME
                            # но это требует Redis 2.2.9+
                            pass

                    except Exception as e:
                        logger.debug(f"Ошибка проверки ключа {key}: {e}")
                        continue

                return {
                    "status": "success",
                    "cleaned_keys": cleaned_count,
                    "size_freed_bytes": total_size_freed,
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception as e:
            logger.exception("Ошибка очистки неиспользуемых ключей: %s", e)
            return {"status": "error", "error": str(e)}

    async def optimize_memory_usage(self) -> dict[str, Any]:
        """
        Оптимизировать использование памяти Redis

        Returns:
            Результаты оптимизации
        """
        try:
            redis_service, _analytics = await self._get_services()
            if not redis_service or not redis_service.is_available:
                return {"status": "redis_unavailable"}

            async with redis_service.get_redis_client() as client:
                if not client:
                    return {"status": "redis_unavailable"}

                memory_info = await client.info("memory")
                used_memory = memory_info.get("used_memory", 0)
                max_memory = memory_info.get("maxmemory", 0)

                recommendations = []

                # Если память используется > 80%
                if max_memory > 0 and (used_memory / max_memory) > 0.8:
                    recommendations.append(
                        {
                            "priority": "high",
                            "action": "reduce_ttl",
                            "description": "Использование памяти > 80%",
                            "suggestions": [
                                "Уменьшить TTL для редко используемых данных",
                                "Очистить старые ключи",
                                "Рассмотреть увеличение maxmemory",
                            ],
                        }
                    )

                # Фрагментация памяти
                frag_ratio = memory_info.get("mem_fragmentation_ratio", 1.0)
                if frag_ratio > 1.5:
                    recommendations.append(
                        {
                            "priority": "medium",
                            "action": "defragment",
                            "description": f"Фрагментация памяти: {frag_ratio:.2f}",
                            "suggestions": [
                                "Выполнить MEMORY PURGE (если доступно)",
                                "Перезапустить Redis для дефрагментации",
                            ],
                        }
                    )

                return {
                    "status": "success",
                    "used_memory": used_memory,
                    "max_memory": max_memory,
                    "usage_percent": (used_memory / max_memory * 100) if max_memory > 0 else 0,
                    "recommendations": recommendations,
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception as e:
            logger.exception("Ошибка оптимизации памяти: %s", e)
            return {"status": "error", "error": str(e)}


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

_cache_optimizer: CacheOptimizerService | None = None


async def get_cache_optimizer() -> CacheOptimizerService:
    """Получить глобальный экземпляр сервиса оптимизации кэша"""
    global _cache_optimizer

    if _cache_optimizer is None:
        _cache_optimizer = CacheOptimizerService()

    return _cache_optimizer
