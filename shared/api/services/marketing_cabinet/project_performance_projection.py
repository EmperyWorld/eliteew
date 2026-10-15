# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fallback projection for Marketing performance dashboard when normalized fact tables are empty.
# Derives spend/leads/conversions/revenue from campaign budgets, funnel stages, and campaign metrics.
# Invariants:
# - Projection is read-only; never writes to marketing_performance_*_facts.
# - Campaign channel maps to performance "source"; geo stays unknown unless metadata provides it.
# Related:
# - api/services/marketing_cabinet/project_performance_repository.py
# - api/services/marketing_cabinet/project_performance_service.py
# ---
from __future__ import annotations

from datetime import date
from typing import Any

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_cabinet.project_performance_repository import MarketingPerformanceQuery


class ProjectPerformanceProjectionRepository:
    """Reads cabinet entity fields as a performance fallback when fact tables have no rows."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def fetch_totals(self, query: MarketingPerformanceQuery) -> dict[str, Any]:
        row = await self._conn.fetchrow(
            """
            WITH scoped_campaigns AS (
                SELECT c.id, c.budget, c.channel, c.actual_metric, c.target_metric_name, c.metadata
                FROM marketing_campaigns c
                WHERE c.project_id = $1
                  AND c.deleted_at IS NULL
                  AND (cardinality($4::uuid[]) = 0 OR c.id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR c.channel = ANY($5::text[]))
                  AND (
                      c.start_date IS NULL
                      OR c.start_date::date <= $3
                  )
                  AND (
                      c.end_date IS NULL
                      OR c.end_date::date >= $2
                  )
            ),
            spend AS (
                SELECT COALESCE(SUM(budget), 0) AS spend
                FROM scoped_campaigns
                WHERE budget IS NOT NULL AND budget > 0
            ),
            revenue AS (
                SELECT COALESCE(SUM(actual_metric), 0) AS revenue
                FROM scoped_campaigns
                WHERE actual_metric IS NOT NULL
                  AND actual_metric > 0
                  AND target_metric_name IS NOT NULL
                  AND lower(target_metric_name) ~ '(revenue|выруч|продаж|sales|доход|gmv|arpu|ltv|romi|roi|оборот|выручк)'
            ),
            funnel_leads AS (
                SELECT COALESCE(SUM(fs.visitors), 0) AS leads
                FROM marketing_funnel_stages fs
                JOIN marketing_funnels f ON f.id = fs.funnel_id
                WHERE f.project_id = $1
                  AND f.deleted_at IS NULL
                  AND fs.deleted_at IS NULL
                  AND fs.stage_order = (
                      SELECT MIN(inner_fs.stage_order)
                      FROM marketing_funnel_stages inner_fs
                      WHERE inner_fs.funnel_id = f.id
                        AND inner_fs.deleted_at IS NULL
                  )
            ),
            funnel_conversions AS (
                SELECT COALESCE(SUM(fs.conversions), 0) AS conversions
                FROM marketing_funnel_stages fs
                JOIN marketing_funnels f ON f.id = fs.funnel_id
                WHERE f.project_id = $1
                  AND f.deleted_at IS NULL
                  AND fs.deleted_at IS NULL
                  AND fs.stage_order = (
                      SELECT MAX(inner_fs.stage_order)
                      FROM marketing_funnel_stages inner_fs
                      WHERE inner_fs.funnel_id = f.id
                        AND inner_fs.deleted_at IS NULL
                  )
            )
            SELECT
                (SELECT spend FROM spend) AS spend,
                (SELECT revenue FROM revenue) AS revenue,
                (SELECT leads FROM funnel_leads) AS leads,
                0::bigint AS qualified_leads,
                (SELECT conversions FROM funnel_conversions) AS conversions,
                0::bigint AS customers
            """,
            query.project_id,
            query.date_from,
            query.date_to,
            query.campaign_id_list,
            query.source_list,
        )
        return dict(row or {})

    async def fetch_campaigns(self, query: MarketingPerformanceQuery) -> list[dict[str, Any]]:
        rows = await self._conn.fetch(
            """
            SELECT
                c.id AS campaign_id,
                c.name AS campaign_name,
                c.channel,
                c.status,
                COALESCE(c.budget, 0) AS spend,
                CASE
                    WHEN c.actual_metric IS NOT NULL
                     AND c.actual_metric > 0
                     AND c.target_metric_name IS NOT NULL
                     AND lower(c.target_metric_name) ~ '(revenue|выруч|продаж|sales|доход|gmv|arpu|ltv|romi|roi|оборот|выручк)'
                    THEN c.actual_metric
                    ELSE 0
                END AS revenue,
                0::bigint AS leads,
                0::bigint AS qualified_leads,
                0::bigint AS conversions
            FROM marketing_campaigns c
            WHERE c.project_id = $1
              AND c.deleted_at IS NULL
              AND (cardinality($4::uuid[]) = 0 OR c.id = ANY($4::uuid[]))
              AND (cardinality($5::text[]) = 0 OR c.channel = ANY($5::text[]))
              AND (
                  c.start_date IS NULL
                  OR c.start_date::date <= $3
              )
              AND (
                  c.end_date IS NULL
                  OR c.end_date::date >= $2
              )
            ORDER BY COALESCE(c.budget, 0) DESC, c.updated_at DESC
            LIMIT 200
            """,
            query.project_id,
            query.date_from,
            query.date_to,
            query.campaign_id_list,
            query.source_list,
        )
        return [dict(row) for row in rows]

    async def fetch_daily_series(self, query: MarketingPerformanceQuery) -> list[dict[str, Any]]:
        """Flat projection: distribute totals evenly across the window for chart continuity."""
        totals = await self.fetch_totals(query)
        spend = float(totals.get("spend") or 0)
        revenue = float(totals.get("revenue") or 0)
        leads = int(totals.get("leads") or 0)
        conversions = int(totals.get("conversions") or 0)
        if spend <= 0 and revenue <= 0 and leads <= 0 and conversions <= 0:
            return []
        days = (query.date_to - query.date_from).days + 1
        if days <= 0:
            return []
        per_day_spend = round(spend / days, 2)
        per_day_revenue = round(revenue / days, 2)
        per_day_leads = leads // days
        per_day_conversions = conversions // days
        series: list[dict[str, Any]] = []
        current = query.date_from
        while current <= query.date_to:
            series.append(
                {
                    "day": current,
                    "spend": per_day_spend,
                    "revenue": per_day_revenue,
                    "leads": per_day_leads,
                    "conversions": per_day_conversions,
                }
            )
            current = date.fromordinal(current.toordinal() + 1)
        return series

    async def fetch_cohorts(self, query: MarketingPerformanceQuery) -> list[dict[str, Any]]:
        return []


__all__ = ["ProjectPerformanceProjectionRepository"]
