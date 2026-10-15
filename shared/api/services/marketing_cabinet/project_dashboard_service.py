# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Application service boundary for Marketing Cabinet project health, overview, and dashboard bundles.
# Routers validate HTTP input and delegate here; legacy summary builders stay behind this service while repositories are extracted.
# Invariants:
# - Public response shape must remain identical to api.routers.marketing_cabinet.summary builders.
# - Dashboard cache keys are private to user_id + project_id + query shape.
# Related:
# - api/routers/marketing_cabinet/projects.py
# - api/routers/marketing_cabinet/summary.py
# - documentation/product/marketing/MARKETING-CABINET-PERFORMANCE.md
# ---
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.routers.marketing_cabinet.summary import (
    build_project_dashboard,
    build_project_health,
    build_project_overview,
)
from api.services.marketing_cabinet.project_dashboard_cache import (
    MarketingDashboardCacheKey,
    MarketingDashboardInMemoryCache,
    marketing_dashboard_cache,
)

DashboardBuilder = Callable[..., Awaitable[dict[str, object]]]


class ProjectDashboardService:
    """Coordinates project summary/dashboard reads behind the HTTP router."""

    def __init__(
        self,
        db_pool: asyncpg.Pool,
        *,
        cache: MarketingDashboardInMemoryCache | None = None,
        health_builder: DashboardBuilder = build_project_health,
        overview_builder: DashboardBuilder = build_project_overview,
        dashboard_builder: DashboardBuilder = build_project_dashboard,
    ) -> None:
        self._db_pool = db_pool
        self._cache = cache or marketing_dashboard_cache
        self._health_builder = health_builder
        self._overview_builder = overview_builder
        self._dashboard_builder = dashboard_builder

    async def build_health(self, project_id: UUID, user_id: UUID) -> dict[str, object]:
        """Build the lightweight health payload using the existing summary contract."""
        return await self._health_builder(self._db_pool, project_id, user_id)

    async def build_overview(self, project_id: UUID, user_id: UUID) -> dict[str, object]:
        """Build the overview payload using the existing summary contract."""
        return await self._overview_builder(self._db_pool, project_id, user_id)

    async def build_dashboard(
        self,
        project_id: UUID,
        user_id: UUID,
        *,
        include_series: bool = False,
        series_window_days: int = 30,
        layout_id: UUID | None = None,
        compact_lists: bool = False,
    ) -> dict[str, object]:
        """Build and short-cache the combined dashboard payload for one private viewer."""
        key = MarketingDashboardCacheKey(
            user_id=user_id,
            project_id=project_id,
            namespace="project-dashboard",
            parts=(
                ("include_series", str(bool(include_series)).lower()),
                ("series_window_days", str(series_window_days)),
                ("layout_id", str(layout_id or "")),
                ("compact_lists", str(bool(compact_lists)).lower()),
            ),
        )
        cached = await self._cache.get(key)
        if isinstance(cached, dict):
            return cached
        payload = await self._dashboard_builder(
            self._db_pool,
            project_id,
            user_id,
            include_series=include_series,
            series_window_days=series_window_days,
            layout_id=layout_id,
            compact_lists=compact_lists,
        )
        await self._cache.set(key, payload)
        return payload


def dashboard_service_cache_key_for_tests(
    *,
    user_id: UUID,
    project_id: UUID,
    namespace: str,
    parts: tuple[tuple[str, Any], ...],
) -> str:
    """Expose deterministic cache key construction for contract tests."""
    return MarketingDashboardCacheKey(
        user_id=user_id,
        project_id=project_id,
        namespace=namespace,
        parts=tuple((key, str(value)) for key, value in parts),
    ).as_string()
