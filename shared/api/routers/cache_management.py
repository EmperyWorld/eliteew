# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   🔥 CACHE MANAGEMENT API - Управление и мониторинг кэша
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
🔥 CACHE MANAGEMENT API - Управление и мониторинг кэша

Endpoints:
- GET /api/v1/cache/stats - Статистика кэша
- GET /api/v1/cache/analytics - Аналитика кэша
- GET /api/v1/cache/recommendations - Рекомендации по оптимизации
- POST /api/v1/cache/optimize - Запустить оптимизацию
- POST /api/v1/cache/cleanup - Очистить неиспользуемые ключи
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import-untyped]

from api.core.auth import User  # type: ignore[import-untyped]
from api.core.oauth2_auth import require_oauth2_user
from api.services.cache_analytics_service import get_cache_analytics
from api.services.cache_optimizer_service import get_cache_optimizer
from api.services.cache_version_manager import get_cache_version_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])


def _require_admin(user: User = Depends(require_oauth2_user)) -> User:  # noqa: B008
    """Require admin or emperyworld_admin for destructive cache operations."""
    if user.role not in ("admin", "emperyworld_admin"):
        raise HTTPException(status_code=403, detail="Administrator privileges required")
    return user


@router.get("/stats")
async def get_cache_stats(_admin: User = Depends(_require_admin)) -> dict[str, Any]:
    """
    Получить статистику кэша (только admin/emperyworld_admin).

    Returns:
        Комплексная статистика использования кэша
    """
    try:
        manager = await get_cache_version_manager()
        stats = await manager.get_cache_stats()
        return stats
    except Exception as e:
        logger.exception(f"Ошибка получения статистики кэша: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/analytics")
async def get_cache_analytics_endpoint(_admin: User = Depends(_require_admin)) -> dict[str, Any]:
    """
    Получить аналитику кэша

    Returns:
        Детальная аналитика с метриками и рекомендациями
    """
    try:
        analytics = await get_cache_analytics()
        stats = await analytics.get_comprehensive_stats()
        recommendations = await analytics.get_optimization_recommendations()
        hot_data = await analytics.get_hot_data_analysis()

        return {"stats": stats, "recommendations": recommendations, "hot_data": hot_data}
    except Exception as e:
        logger.exception(f"Ошибка получения аналитики кэша: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/recommendations")
async def get_optimization_recommendations(_admin: User = Depends(_require_admin)) -> dict[str, Any]:
    """
    Получить рекомендации по оптимизации кэша

    Returns:
        Список рекомендаций с приоритетами
    """
    try:
        analytics = await get_cache_analytics()
        recommendations = await analytics.get_optimization_recommendations()

        return {"recommendations": recommendations, "count": len(recommendations)}
    except Exception as e:
        logger.exception(f"Ошибка получения рекомендаций: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/optimize")
async def optimize_cache(
    cache_type: str | None = None,
    _admin: User = Depends(_require_admin),
) -> dict[str, Any]:
    """
    Запустить оптимизацию кэша

    Args:
        cache_type: Тип кэша для оптимизации (опционально)

    Returns:
        Результаты оптимизации
    """
    try:
        optimizer = await get_cache_optimizer()
        result = await optimizer.optimize_ttl_based_on_hit_rate(cache_type)
        memory_result = await optimizer.optimize_memory_usage()

        return {"ttl_optimization": result, "memory_optimization": memory_result}
    except Exception as e:
        logger.exception(f"Ошибка оптимизации кэша: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/cleanup")
async def cleanup_cache(
    max_age_hours: int = 24,
    _admin: User = Depends(_require_admin),  # noqa: B008
) -> dict[str, Any]:
    """
    Очистить неиспользуемые ключи кэша (только admin/emperyworld_admin).

    Args:
        max_age_hours: Максимальный возраст ключа в часах

    Returns:
        Результаты очистки
    """
    try:
        optimizer = await get_cache_optimizer()
        result = await optimizer.cleanup_unused_keys(max_age_hours=max_age_hours)
        return result
    except Exception as e:
        logger.exception(f"Ошибка очистки кэша: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/hot-data")
async def get_hot_data(limit: int = 20, _admin: User = Depends(_require_admin)) -> dict[str, Any]:
    """
    Получить анализ "горячих" данных

    Args:
        limit: Количество топ ключей

    Returns:
        Анализ наиболее часто используемых данных
    """
    try:
        analytics = await get_cache_analytics()
        result = await analytics.get_hot_data_analysis(limit=limit)
        return result
    except Exception as e:
        logger.exception(f"Ошибка получения горячих данных: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
