# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Project-scoped Marketing Cabinet read APIs: health, overview, dashboard, live jobs, graph compatibility,
#   and performance analytics.
# Invariants:
#   - Project access is checked before returning project-scoped marketing data.
#   - Legacy dashboard JSON remains stable while new analytics are additive.
# Related:
#   - api/services/marketing_cabinet/project_dashboard_service.py
#   - api/services/marketing_cabinet/project_performance_service.py
# ------------------------------------------------------------------------------
from __future__ import annotations

from datetime import date
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.ai import count_active_marketing_ai_runs
from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.routers.marketing_cabinet.imc import get_imc_service_readonly
from api.routers.marketing_cabinet.summary import (
    build_project_dashboard,
    build_project_graph,
    build_project_health,
    build_project_overview,
)
from api.schemas.marketing_cabinet import (
    MarketingProjectDashboardResponse,
    MarketingProjectGraphResponse,
    MarketingProjectHealthResponse,
    MarketingProjectLiveJobsSummaryResponse,
    MarketingProjectOverviewResponse,
)
from api.schemas.marketing_cabinet.performance import MarketingPerformanceDashboardResponse
from api.services.imc.imc_service import ImcService
from api.services.marketing_cabinet.project_dashboard_service import ProjectDashboardService
from api.services.marketing_cabinet.project_performance_service import ProjectPerformanceService

router = APIRouter(prefix="/projects", tags=["Marketing Cabinet - Projects"])


def _parse_uuid_filters(raw_values: list[str] | None, *, field_name: str) -> list[UUID]:
    parsed: list[UUID] = []
    for raw in raw_values or []:
        for part in str(raw).split(","):
            item = part.strip()
            if not item:
                continue
            try:
                parsed.append(UUID(item))
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field_name} contains an invalid UUID",
                ) from exc
    return parsed


@router.get(
    "/{project_id}/live-jobs-summary",
    response_model=MarketingProjectLiveJobsSummaryResponse,
)
async def get_project_live_jobs_summary(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    imc_svc: ImcService = Depends(get_imc_service_readonly),  # noqa: B008
) -> MarketingProjectLiveJobsSummaryResponse:
    """Счётчики активных AI/IMC runs для rail и Job Center (один round-trip)."""
    await get_accessible_project(db_pool, project_id, user_id)
    ai_active_total = await count_active_marketing_ai_runs(db_pool, project_id=project_id)
    imc_active_total = await imc_svc.count_active_for_project(project_id=project_id)
    return MarketingProjectLiveJobsSummaryResponse(
        ai_active_total=ai_active_total,
        imc_active_total=imc_active_total,
    )


@router.get("/{project_id}/health", response_model=MarketingProjectHealthResponse)
async def get_project_health(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingProjectHealthResponse:
    svc = ProjectDashboardService(db_pool, health_builder=build_project_health)
    return MarketingProjectHealthResponse.model_validate(await svc.build_health(project_id, user_id))


@router.get("/{project_id}/overview", response_model=MarketingProjectOverviewResponse)
async def get_project_overview(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingProjectOverviewResponse:
    svc = ProjectDashboardService(db_pool, overview_builder=build_project_overview)
    return MarketingProjectOverviewResponse.model_validate(await svc.build_overview(project_id, user_id))


@router.get("/{project_id}/dashboard", response_model=MarketingProjectDashboardResponse)
async def get_project_dashboard(
    project_id: UUID,
    include: str | None = Query(
        None,
        description="Comma-separated optional expansions. Use `series` for UTC daily analytics (tasks, alerts, AI).",
    ),
    window_days: int = Query(
        30,
        ge=1,
        le=90,
        description="Calendar window length for series buckets when include contains series.",
    ),
    layout_id: UUID | None = Query(
        None,
        description=(
            "Optional active dashboard layout id: response may include widget_list_slices "
            "(server-side filters/sort/maxItems for list tiles)."
        ),
    ),
    compact_lists: bool = Query(
        False,
        description=(
            "Smaller list payloads (quick summary / background warm); skips widget_list_slices "
            "when combined with omitting layout_id."
        ),
    ),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingProjectDashboardResponse:
    """
    Объединённый endpoint: health + overview в одном запросе.
    Снижает количество round-trips при загрузке обзора.
    """
    parts = {p.strip().lower() for p in (include or "").split(",") if p.strip()}
    include_series = "series" in parts
    svc = ProjectDashboardService(db_pool, dashboard_builder=build_project_dashboard)
    return MarketingProjectDashboardResponse.model_validate(
        await svc.build_dashboard(
            project_id,
            user_id,
            include_series=include_series,
            series_window_days=window_days,
            layout_id=layout_id,
            compact_lists=compact_lists,
        )
    )


@router.get("/{project_id}/performance-dashboard", response_model=MarketingPerformanceDashboardResponse)
async def get_project_performance_dashboard(
    project_id: UUID,
    date_from: date | None = Query(None, description="Inclusive report start date (UTC calendar day)."),
    date_to: date | None = Query(None, description="Inclusive report end date (UTC calendar day)."),
    window_days: int = Query(
        30,
        ge=1,
        le=366,
        description="Fallback rolling window when date_from is omitted.",
    ),
    campaign_ids: list[str] | None = Query(
        None,
        description="Optional repeated or comma-separated campaign_id filters.",
    ),
    sources: list[str] | None = Query(
        None,
        description="Optional repeated or comma-separated traffic source filters.",
    ),
    geos: list[str] | None = Query(
        None,
        description="Optional repeated or comma-separated geo filters.",
    ),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingPerformanceDashboardResponse:
    """Marketer-facing performance report: spend, revenue, ROI/ROMI, CPA/CPL and cohorts."""
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must be less than or equal to date_to",
        )
    svc = ProjectPerformanceService(db_pool)
    return MarketingPerformanceDashboardResponse.model_validate(
        await svc.build_performance_dashboard(
            project_id=project_id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            window_days=window_days,
            campaign_ids=_parse_uuid_filters(campaign_ids, field_name="campaign_ids"),
            sources=sources,
            geos=geos,
        )
    )


@router.get(
    "/{project_id}/graph",
    response_model=MarketingProjectGraphResponse,
    deprecated=True,
)
async def get_project_graph(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingProjectGraphResponse:
    """Deprecated: overview UI uses the interactive dashboard (layouts/widgets API)."""
    return MarketingProjectGraphResponse.model_validate(await build_project_graph(db_pool, project_id, user_id))
