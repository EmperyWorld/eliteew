"""
CACHE ANALYTICS SERVICE — аналитика и оптимизация кэша

Функции:
1. Мониторинг hit/miss rate по типам данных
2. Автоматическая оптимизация TTL на основе статистики
3. Обнаружение "горячих" данных для кэш-прогрева
4. Рекомендации по оптимизации кэша
5. Аналитика использования памяти

Использование:
    from api.services.cache_analytics_service import get_cache_analytics

    analytics = await get_cache_analytics()
    stats = await analytics.get_comprehensive_stats()
    recommendations = await analytics.get_optimization_recommendations()
"""

import logging
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from api.services.redis_service import get_redis_service

logger = logging.getLogger(__name__)


class CacheAnalyticsService:
    """
    Сервис аналитики и оптимизации кэша.

    Собирает метрики, анализирует эффективность и предлагает оптимизации.
    """

    def __init__(self) -> None:
        self.redis_service = None
        # Метрики по типам данных
        self.metrics_by_type: dict[str, dict[str, int]] = defaultdict(
            lambda: {"hits": 0, "misses": 0, "sets": 0, "invalidations": 0, "errors": 0}
        )

    async def _get_redis_service(self):
        """Получить Redis сервис"""
        if not self.redis_service:
            self.redis_service = await get_redis_service()
        return self.redis_service

    async def record_cache_hit(self, cache_type: str) -> None:
        """Записать cache hit"""
        self.metrics_by_type[cache_type]["hits"] += 1

    async def record_cache_miss(self, cache_type: str) -> None:
        """Записать cache miss"""
        self.metrics_by_type[cache_type]["misses"] += 1

    async def record_cache_set(self, cache_type: str) -> None:
        """Записать cache set"""
        self.metrics_by_type[cache_type]["sets"] += 1

    async def record_cache_invalidation(self, cache_type: str) -> None:
        """Записать инвалидацию"""
        self.metrics_by_type[cache_type]["invalidations"] += 1

    async def get_comprehensive_stats(self) -> dict[str, Any]:
        """
        Получить комплексную статистику кэша

        Returns:
            Словарь со статистикой по типам данных, общими метриками и рекомендациями
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                return {"status": "redis_unavailable"}

            async with redis_service.get_redis_client() as client:
                if not client:
                    return {"status": "redis_unavailable"}

                # Получить информацию из Redis
                info = await client.info()
                memory_info = await client.info("memory")
                stats_info = await client.info("stats")

                # Подсчитать ключи по префиксам
                cache_types = {
                    "api": "response_cache:",
                    "content": "content:",
                    "marketing": "marketing:",
                    "user": "user:",
                    "ai_sdk": "ai_sdk:",
                    "dashboard": "dashboard:",
                }

                keys_by_type = {}
                total_keys = 0
                for cache_type, prefix in cache_types.items():
                    count = 0
                    async for _ in client.scan_iter(match=f"{prefix}*"):
                        count += 1
                    keys_by_type[cache_type] = count
                    total_keys += count

                # Вычислить hit rate из Redis stats
                keyspace_hits = int(stats_info.get("keyspace_hits", 0))
                keyspace_misses = int(stats_info.get("keyspace_misses", 0))
                total_requests = keyspace_hits + keyspace_misses
                overall_hit_rate = (keyspace_hits / total_requests * 100) if total_requests > 0 else 0.0

                # Метрики по типам из внутренней статистики
                type_metrics = {}
                for cache_type, metrics in self.metrics_by_type.items():
                    total = metrics["hits"] + metrics["misses"]
                    hit_rate = (metrics["hits"] / total * 100) if total > 0 else 0.0
                    type_metrics[cache_type] = {
                        **metrics,
                        "hit_rate": round(hit_rate, 2),
                        "total_requests": total,
                        "keys_count": keys_by_type.get(cache_type, 0),
                    }

                return {
                    "status": "healthy",
                    "timestamp": datetime.now(UTC).isoformat(),
                    "overall": {
                        "total_keys": total_keys,
                        "keyspace_hits": keyspace_hits,
                        "keyspace_misses": keyspace_misses,
                        "hit_rate": round(overall_hit_rate, 2),
                        "total_requests": total_requests,
                    },
                    "memory": {
                        "used_memory": memory_info.get("used_memory", 0),
                        "used_memory_human": memory_info.get("used_memory_human", "N/A"),
                        "used_memory_peak": memory_info.get("used_memory_peak", 0),
                        "used_memory_peak_human": memory_info.get("used_memory_peak_human", "N/A"),
                        "mem_fragmentation_ratio": memory_info.get("mem_fragmentation_ratio", 0),
                    },
                    "by_type": type_metrics,
                    "keys_by_type": keys_by_type,
                    "redis_info": {
                        "connected_clients": info.get("connected_clients", 0),
                        "total_commands_processed": info.get("total_commands_processed", 0),
                        "instantaneous_ops_per_sec": info.get("instantaneous_ops_per_sec", 0),
                    },
                }

        except Exception as e:
            logger.exception("Ошибка получения статистики кэша: %s", e)
            return {"status": "error", "error": str(e)}

    async def get_optimization_recommendations(self) -> list[dict[str, Any]]:
        """
        Получить рекомендации по оптимизации кэша

        Returns:
            Список рекомендаций с приоритетом и описанием
        """
        recommendations: list[Any] = []
        stats = await self.get_comprehensive_stats()

        if stats.get("status") != "healthy":
            return recommendations

        overall = stats.get("overall", {})
        hit_rate = overall.get("hit_rate", 0)
        memory = stats.get("memory", {})
        by_type = stats.get("by_type", {})

        # Рекомендация 1: Низкий hit rate
        if hit_rate < 70:
            recommendations.append(
                {
                    "priority": "high",
                    "type": "low_hit_rate",
                    "title": "Низкий hit rate кэша",
                    "description": f"Текущий hit rate: {hit_rate:.1f}%. Целевой: >70%",
                    "suggestions": [
                        "Увеличить TTL для стабильных данных",
                        "Улучшить cache warming на старте",
                        "Проверить частоту инвалидации",
                        "Добавить кэширование для часто запрашиваемых данных",
                    ],
                    "impact": "high",
                }
            )

        # Рекомендация 2: Высокое использование памяти
        used_memory = memory.get("used_memory", 0)
        if used_memory > 500 * 1024 * 1024:  # > 500MB
            recommendations.append(
                {
                    "priority": "medium",
                    "type": "high_memory_usage",
                    "title": "Высокое использование памяти Redis",
                    "description": f"Используется: {memory.get('used_memory_human', 'N/A')}",
                    "suggestions": [
                        "Уменьшить TTL для редко используемых данных",
                        "Очистить старые ключи",
                        "Использовать компрессию для больших значений",
                        "Рассмотреть увеличение памяти Redis",
                    ],
                    "impact": "medium",
                }
            )

        # Рекомендация 3: Проблемы по типам данных
        for cache_type, metrics in by_type.items():
            type_hit_rate = metrics.get("hit_rate", 0)
            if type_hit_rate < 60:
                recommendations.append(
                    {
                        "priority": "medium",
                        "type": "low_type_hit_rate",
                        "title": f"Низкий hit rate для {cache_type}",
                        "description": f"Hit rate: {type_hit_rate:.1f}%",
                        "suggestions": [
                            f"Увеличить TTL для {cache_type}",
                            f"Добавить cache warming для {cache_type}",
                            f"Проверить частоту инвалидации {cache_type}",
                        ],
                        "impact": "medium",
                        "cache_type": cache_type,
                    }
                )

        # Рекомендация 4: Фрагментация памяти
        frag_ratio = memory.get("mem_fragmentation_ratio", 1.0)
        if frag_ratio > 1.5:
            recommendations.append(
                {
                    "priority": "low",
                    "type": "memory_fragmentation",
                    "title": "Высокая фрагментация памяти",
                    "description": f"Коэффициент фрагментации: {frag_ratio:.2f}",
                    "suggestions": [
                        "Выполнить MEMORY PURGE (если доступно)",
                        "Перезапустить Redis для дефрагментации",
                        "Мониторить использование памяти",
                    ],
                    "impact": "low",
                }
            )

        return recommendations

    async def get_hot_data_analysis(self, limit: int = 20) -> dict[str, Any]:
        """
        Анализ "горячих" данных для оптимизации cache warming

        Args:
            limit: Количество топ ключей для анализа

        Returns:
            Анализ наиболее часто используемых данных
        """
        try:
            redis_service = await self._get_redis_service()
            if not redis_service or not redis_service.is_available:
                return {"status": "redis_unavailable"}

            # Это упрощенная версия - в реальности нужен Redis с поддержкой
            # OBJECT FREQ или внешний мониторинг
            stats = await self.get_comprehensive_stats()

            by_type = stats.get("by_type", {})

            # Сортируем по количеству запросов
            sorted_types = sorted(by_type.items(), key=lambda x: x[1].get("total_requests", 0), reverse=True)

            hot_data = []
            for cache_type, metrics in sorted_types[:limit]:
                hot_data.append(
                    {
                        "cache_type": cache_type,
                        "total_requests": metrics.get("total_requests", 0),
                        "hit_rate": metrics.get("hit_rate", 0),
                        "keys_count": metrics.get("keys_count", 0),
                        "priority": "high" if metrics.get("total_requests", 0) > 1000 else "medium",
                    }
                )

            return {
                "status": "success",
                "hot_data": hot_data,
                "recommendations": [
                    "Добавить эти типы данных в cache warming",
                    "Увеличить TTL для высокоприоритетных данных",
                    "Мониторить hit rate для этих типов",
                ],
            }

        except Exception as e:
            logger.exception("Ошибка анализа горячих данных: %s", e)
            return {"status": "error", "error": str(e)}


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

_cache_analytics: CacheAnalyticsService | None = None


async def get_cache_analytics() -> CacheAnalyticsService:
    """Получить глобальный экземпляр сервиса аналитики кэша"""
    global _cache_analytics

    if _cache_analytics is None:
        _cache_analytics = CacheAnalyticsService()

    return _cache_analytics
