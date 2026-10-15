# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Application service for marketer-facing performance analytics: spend, revenue, ROI/ROMI, CPA/CPL and cohorts.
# It validates access, applies safe metric math, and degrades report data gaps without HTTP 500.
# Invariants:
# - Access checks use the same Marketing Cabinet project visibility helper as the legacy dashboard.
# - Ratios return None when their denominator is zero; report diagnostics explain empty or missing datasets.
# Related:
# - api/routers/marketing_cabinet/projects.py
# - api/services/marketing_cabinet/project_performance_repository.py
# - documentation/product/marketing/MARKETING-CABINET.md
# ---
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.routers.marketing_cabinet.common import get_accessible_project
from api.schemas.marketing_cabinet.performance import (
    MarketingPerformanceCampaignOut,
    MarketingPerformanceCohortOut,
    MarketingPerformanceDashboardResponse,
    MarketingPerformanceDiagnosticOut,
    MarketingPerformanceFiltersOut,
    MarketingPerformanceSeriesPointOut,
    MarketingPerformanceTotalsOut,
)
from api.services.marketing_cabinet.project_dashboard_cache import (
    MarketingDashboardCacheKey,
    MarketingDashboardInMemoryCache,
    marketing_dashboard_cache,
)
from api.services.marketing_cabinet.project_performance_projection import (
    ProjectPerformanceProjectionRepository,
)
from api.services.marketing_cabinet.project_performance_repository import (
    MarketingPerformanceQuery,
    ProjectPerformanceRepository,
)


def _float(value: Any) -> float:  # noqa: ANN401
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except TypeError, ValueError:
        return 0.0


def _int(value: Any) -> int:  # noqa: ANN401
    if value is None:
        return 0
    try:
        return int(value)
    except TypeError, ValueError:
        return 0


def _ratio(numerator: float, denominator: float) -> float | None:
    if denominator <= 0:
        return None
    return round(numerator / denominator, 4)


def _percent(numerator: float, denominator: float) -> float | None:
    raw = _ratio(numerator, denominator)
    return None if raw is None else round(raw * 100, 2)


def _normalize_dimension_values(values: list[str] | None) -> tuple[str, ...]:
    cleaned: list[str] = []
    for raw in values or []:
        for part in str(raw).split(","):
            item = part.strip()
            if item and item not in cleaned:
                cleaned.append(item[:80])
    return tuple(cleaned)


class ProjectPerformanceService:
    """Builds the additive performance dashboard response for one project and viewer."""

    def __init__(
        self,
        db_pool: asyncpg.Pool,
        *,
        cache: MarketingDashboardInMemoryCache | None = None,
    ) -> None:
        self._db_pool = db_pool
        self._cache = cache or marketing_dashboard_cache

    async def build_performance_dashboard(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        date_from: date | None = None,
        date_to: date | None = None,
        window_days: int = 30,
        campaign_ids: list[UUID] | None = None,
        sources: list[str] | None = None,
        geos: list[str] | None = None,
    ) -> MarketingPerformanceDashboardResponse:
        """Return performance analytics with safe denominators and private short-cache."""
        resolved_to = date_to or datetime.now(UTC).date()
        resolved_window = max(1, min(int(window_days), 366))
        resolved_from = date_from or (resolved_to - timedelta(days=resolved_window - 1))
        normalized_sources = _normalize_dimension_values(sources)
        normalized_geos = _normalize_dimension_values(geos)
        normalized_campaigns = tuple(campaign_ids or ())
        key = MarketingDashboardCacheKey(
            user_id=user_id,
            project_id=project_id,
            namespace="performance-dashboard",
            parts=(
                ("date_from", resolved_from.isoformat()),
                ("date_to", resolved_to.isoformat()),
                ("campaign_ids", ",".join(str(item) for item in normalized_campaigns)),
                ("sources", ",".join(normalized_sources)),
                ("geos", ",".join(normalized_geos)),
            ),
        )
        cached = await self._cache.get(key)
        if isinstance(cached, MarketingPerformanceDashboardResponse):
            return cached

        await get_accessible_project(self._db_pool, project_id, user_id)
        async with self._db_pool.acquire() as conn:
            repository = ProjectPerformanceRepository(conn)
            query = MarketingPerformanceQuery(
                project_id=project_id,
                date_from=resolved_from,
                date_to=resolved_to,
                campaign_ids=normalized_campaigns,
                sources=normalized_sources,
                geos=normalized_geos,
            )
            try:
                has_matching_facts = await repository.has_fact_rows(query)
                totals_raw = await repository.fetch_totals(query)
                campaigns_raw = await repository.fetch_campaigns(query)
                series_raw = await repository.fetch_daily_series(query)
                cohorts_raw = await repository.fetch_cohorts(query)
            except asyncpg.UndefinedTableError:
                response = self._empty_response(
                    project_id=project_id,
                    query=query,
                    diagnostics=[
                        MarketingPerformanceDiagnosticOut(
                            code="performance_schema_missing",
                            severity="warning",
                            message="Performance fact tables are not migrated yet.",
                        )
                    ],
                )
                await self._cache.set(key, response)
                return response

            response = self._response_from_rows(
                project_id=project_id,
                query=query,
                totals_raw=totals_raw,
                campaigns_raw=campaigns_raw,
                series_raw=series_raw,
                cohorts_raw=cohorts_raw,
            )
            if self._needs_entity_projection(response, has_matching_facts=has_matching_facts):
                projection_repo = ProjectPerformanceProjectionRepository(conn)
                projected_totals = await projection_repo.fetch_totals(query)
                projected_campaigns = await projection_repo.fetch_campaigns(query)
                projected_series = await projection_repo.fetch_daily_series(query)
                projected_cohorts = await projection_repo.fetch_cohorts(query)
                if self._projection_has_signal(projected_totals):
                    response = self._response_from_rows(
                        project_id=project_id,
                        query=query,
                        totals_raw=projected_totals,
                        campaigns_raw=projected_campaigns,
                        series_raw=projected_series,
                        cohorts_raw=projected_cohorts,
                        extra_diagnostics=[
                            MarketingPerformanceDiagnosticOut(
                                code="performance_projection_from_cabinet_entities",
                                severity="info",
                                message=(
                                    "Normalized performance facts are empty; metrics are projected from "
                                    "campaign budgets, funnel stages, and campaign actual_metric fields."
                                ),
                            )
                        ],
                    )
        await self._cache.set(key, response)
        return response

    @staticmethod
    def _needs_entity_projection(
        response: MarketingPerformanceDashboardResponse,
        *,
        has_matching_facts: bool = False,
    ) -> bool:
        if has_matching_facts:
            return False
        totals = response.totals
        if totals.spend > 0 or totals.revenue > 0 or totals.leads > 0 or totals.conversions > 0:
            return False
        return all(item.code != "performance_schema_missing" for item in response.diagnostics)

    @staticmethod
    def _projection_has_signal(totals_raw: dict[str, Any]) -> bool:
        return (
            _float(totals_raw.get("spend")) > 0
            or _float(totals_raw.get("revenue")) > 0
            or _int(totals_raw.get("leads")) > 0
            or _int(totals_raw.get("conversions")) > 0
        )

    def _empty_response(
        self,
        *,
        project_id: UUID,
        query: MarketingPerformanceQuery,
        diagnostics: list[MarketingPerformanceDiagnosticOut],
    ) -> MarketingPerformanceDashboardResponse:
        return MarketingPerformanceDashboardResponse(
            project_id=str(project_id),
            generated_at=datetime.now(UTC),
            filters=self._filters(query),
            totals=MarketingPerformanceTotalsOut(),
            campaigns=[],
            series=[],
            cohorts=[],
            diagnostics=diagnostics,
        )

    def _response_from_rows(
        self,
        *,
        project_id: UUID,
        query: MarketingPerformanceQuery,
        totals_raw: dict[str, Any],
        campaigns_raw: list[dict[str, Any]],
        series_raw: list[dict[str, Any]],
        cohorts_raw: list[dict[str, Any]],
        extra_diagnostics: list[MarketingPerformanceDiagnosticOut] | None = None,
    ) -> MarketingPerformanceDashboardResponse:
        spend = _float(totals_raw.get("spend"))
        revenue = _float(totals_raw.get("revenue"))
        leads = _int(totals_raw.get("leads"))
        qualified_leads = _int(totals_raw.get("qualified_leads"))
        conversions = _int(totals_raw.get("conversions"))
        customers = _int(totals_raw.get("customers"))
        gross_profit = revenue - spend
        diagnostics: list[MarketingPerformanceDiagnosticOut] = []
        if spend <= 0 and revenue <= 0 and leads <= 0 and conversions <= 0:
            diagnostics.append(
                MarketingPerformanceDiagnosticOut(
                    code="performance_data_empty",
                    severity="info",
                    message="No spend, lead, conversion or revenue facts matched the selected filters.",
                )
            )
        if extra_diagnostics:
            diagnostics.extend(extra_diagnostics)
            diagnostics = [item for item in diagnostics if item.code != "performance_data_empty"]
        totals = MarketingPerformanceTotalsOut(
            spend=round(spend, 2),
            revenue=round(revenue, 2),
            gross_profit=round(gross_profit, 2),
            leads=leads,
            qualified_leads=qualified_leads,
            conversions=conversions,
            customers=customers,
            cpl=_ratio(spend, float(leads)),
            cpa=_ratio(spend, float(conversions)),
            roi=_ratio(gross_profit, spend),
            romi=_percent(gross_profit, spend),
            conversion_rate=_percent(float(conversions), float(leads)),
        )
        return MarketingPerformanceDashboardResponse(
            project_id=str(project_id),
            generated_at=datetime.now(UTC),
            filters=self._filters(query),
            totals=totals,
            campaigns=[self._campaign(row) for row in campaigns_raw],
            series=[self._series_point(row) for row in series_raw],
            cohorts=[self._cohort(row) for row in cohorts_raw],
            diagnostics=diagnostics,
        )

    def _filters(self, query: MarketingPerformanceQuery) -> MarketingPerformanceFiltersOut:
        return MarketingPerformanceFiltersOut(
            date_from=query.date_from,
            date_to=query.date_to,
            campaign_ids=[str(item) for item in query.campaign_ids],
            sources=list(query.sources),
            geos=list(query.geos),
        )

    def _campaign(self, row: dict[str, Any]) -> MarketingPerformanceCampaignOut:
        spend = _float(row.get("spend"))
        revenue = _float(row.get("revenue"))
        leads = _int(row.get("leads"))
        conversions = _int(row.get("conversions"))
        gross_profit = revenue - spend
        campaign_id = row.get("campaign_id")
        return MarketingPerformanceCampaignOut(
            campaign_id=str(campaign_id) if campaign_id else None,
            campaign_name=str(row.get("campaign_name") or "Unassigned"),
            channel=row.get("channel"),
            status=row.get("status"),
            spend=round(spend, 2),
            revenue=round(revenue, 2),
            leads=leads,
            qualified_leads=_int(row.get("qualified_leads")),
            conversions=conversions,
            cpl=_ratio(spend, float(leads)),
            cpa=_ratio(spend, float(conversions)),
            roi=_ratio(gross_profit, spend),
            romi=_percent(gross_profit, spend),
            conversion_rate=_percent(float(conversions), float(leads)),
        )

    def _series_point(self, row: dict[str, Any]) -> MarketingPerformanceSeriesPointOut:
        return MarketingPerformanceSeriesPointOut(
            date=row["day"],
            spend=round(_float(row.get("spend")), 2),
            revenue=round(_float(row.get("revenue")), 2),
            leads=_int(row.get("leads")),
            conversions=_int(row.get("conversions")),
        )

    def _cohort(self, row: dict[str, Any]) -> MarketingPerformanceCohortOut:
        leads = _int(row.get("leads"))
        conversions = _int(row.get("conversions"))
        revenue = _float(row.get("revenue"))
        return MarketingPerformanceCohortOut(
            cohort_date=row["cohort_date"],
            age_days=_int(row.get("age_days")),
            leads=leads,
            conversions=conversions,
            revenue=round(revenue, 2),
            conversion_rate=_percent(float(conversions), float(leads)),
            revenue_per_lead=_ratio(revenue, float(leads)),
        )
