# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Query object for normalized Marketing Cabinet performance facts: spend, leads/conversions, revenue, and cohorts.
# It keeps SQL aggregation out of FastAPI routers and returns primitive rows for the application service.
# Invariants:
# - All queries are project-scoped and filter nullable campaign/source/geo dimensions consistently.
# - Missing fact tables degrade to an explicit schema diagnostic in the service, not an HTTP 500.
# Related:
# - api/services/marketing_cabinet/project_performance_service.py
# - api/migrations/applied/20260528_01_marketing_performance_facts.sql
# ---
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]


@dataclass(frozen=True)
class MarketingPerformanceQuery:
    """Resolved query filters for performance fact aggregation."""

    project_id: UUID
    date_from: date
    date_to: date
    campaign_ids: tuple[UUID, ...] = ()
    sources: tuple[str, ...] = ()
    geos: tuple[str, ...] = ()

    @property
    def campaign_id_list(self) -> list[UUID]:
        return list(self.campaign_ids)

    @property
    def source_list(self) -> list[str]:
        return list(self.sources)

    @property
    def geo_list(self) -> list[str]:
        return list(self.geos)


class ProjectPerformanceRepository:
    """Reads normalized marketing performance facts from Postgres."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def has_fact_rows(self, query: MarketingPerformanceQuery) -> bool:
        """Return true when any matching normalized fact row exists, even if all values are zero."""
        value = await self._conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM marketing_performance_spend_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND fact_date >= $2
                  AND fact_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                LIMIT 1
            )
            OR EXISTS (
                SELECT 1
                FROM marketing_performance_lead_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                LIMIT 1
            )
            OR EXISTS (
                SELECT 1
                FROM marketing_performance_revenue_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                LIMIT 1
            )
            """,
            query.project_id,
            query.date_from,
            query.date_to,
            query.campaign_id_list,
            query.source_list,
            query.geo_list,
        )
        return bool(value)

    async def fetch_totals(self, query: MarketingPerformanceQuery) -> dict[str, Any]:
        """Aggregate spend, leads/conversions and revenue for the filtered window."""
        row = await self._conn.fetchrow(
            """
            SELECT
                COALESCE((
                    SELECT SUM(amount)
                    FROM marketing_performance_spend_facts
                    WHERE project_id = $1
                      AND deleted_at IS NULL
                      AND fact_date >= $2
                      AND fact_date <= $3
                      AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                      AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                      AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                ), 0) AS spend,
                COALESCE((
                    SELECT SUM(leads_count)
                    FROM marketing_performance_lead_facts
                    WHERE project_id = $1
                      AND deleted_at IS NULL
                      AND event_date >= $2
                      AND event_date <= $3
                      AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                      AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                      AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                ), 0) AS leads,
                COALESCE((
                    SELECT SUM(qualified_leads_count)
                    FROM marketing_performance_lead_facts
                    WHERE project_id = $1
                      AND deleted_at IS NULL
                      AND event_date >= $2
                      AND event_date <= $3
                      AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                      AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                      AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                ), 0) AS qualified_leads,
                COALESCE((
                    SELECT SUM(conversions_count)
                    FROM marketing_performance_lead_facts
                    WHERE project_id = $1
                      AND deleted_at IS NULL
                      AND event_date >= $2
                      AND event_date <= $3
                      AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                      AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                      AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                ), 0) AS conversions,
                COALESCE((
                    SELECT SUM(revenue)
                    FROM marketing_performance_revenue_facts
                    WHERE project_id = $1
                      AND deleted_at IS NULL
                      AND event_date >= $2
                      AND event_date <= $3
                      AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                      AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                      AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                ), 0) AS revenue,
                COALESCE((
                    SELECT SUM(customers_count)
                    FROM marketing_performance_revenue_facts
                    WHERE project_id = $1
                      AND deleted_at IS NULL
                      AND event_date >= $2
                      AND event_date <= $3
                      AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                      AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                      AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                ), 0) AS customers
            """,
            query.project_id,
            query.date_from,
            query.date_to,
            query.campaign_id_list,
            query.source_list,
            query.geo_list,
        )
        return dict(row or {})

    async def fetch_campaigns(self, query: MarketingPerformanceQuery) -> list[dict[str, Any]]:
        """Aggregate performance by campaign, preserving campaigns with no facts as zero rows."""
        rows = await self._conn.fetch(
            """
            WITH spend AS (
                SELECT campaign_id, SUM(amount) AS spend
                FROM marketing_performance_spend_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND fact_date >= $2
                  AND fact_date <= $3
                  AND campaign_id IS NOT NULL
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY campaign_id
            ),
            leads AS (
                SELECT
                    campaign_id,
                    SUM(leads_count) AS leads,
                    SUM(qualified_leads_count) AS qualified_leads,
                    SUM(conversions_count) AS conversions
                FROM marketing_performance_lead_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND campaign_id IS NOT NULL
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY campaign_id
            ),
            revenue AS (
                SELECT campaign_id, SUM(revenue) AS revenue
                FROM marketing_performance_revenue_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND campaign_id IS NOT NULL
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY campaign_id
            )
            SELECT
                c.id AS campaign_id,
                c.name AS campaign_name,
                c.channel,
                c.status,
                COALESCE(spend.spend, 0) AS spend,
                COALESCE(revenue.revenue, 0) AS revenue,
                COALESCE(leads.leads, 0) AS leads,
                COALESCE(leads.qualified_leads, 0) AS qualified_leads,
                COALESCE(leads.conversions, 0) AS conversions
            FROM marketing_campaigns c
            LEFT JOIN spend ON spend.campaign_id = c.id
            LEFT JOIN leads ON leads.campaign_id = c.id
            LEFT JOIN revenue ON revenue.campaign_id = c.id
            WHERE c.project_id = $1
              AND c.deleted_at IS NULL
              AND (cardinality($4::uuid[]) = 0 OR c.id = ANY($4::uuid[]))
            ORDER BY COALESCE(revenue.revenue, 0) DESC, COALESCE(spend.spend, 0) DESC, c.updated_at DESC
            LIMIT 200
            """,
            query.project_id,
            query.date_from,
            query.date_to,
            query.campaign_id_list,
            query.source_list,
            query.geo_list,
        )
        return [dict(row) for row in rows]

    async def fetch_daily_series(self, query: MarketingPerformanceQuery) -> list[dict[str, Any]]:
        """Return one row per UTC calendar day for charting the filtered performance window."""
        rows = await self._conn.fetch(
            """
            WITH days AS (
                SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
            ),
            spend AS (
                SELECT fact_date AS day, SUM(amount) AS spend
                FROM marketing_performance_spend_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND fact_date >= $2
                  AND fact_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY fact_date
            ),
            leads AS (
                SELECT event_date AS day, SUM(leads_count) AS leads, SUM(conversions_count) AS conversions
                FROM marketing_performance_lead_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY event_date
            ),
            revenue AS (
                SELECT event_date AS day, SUM(revenue) AS revenue
                FROM marketing_performance_revenue_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY event_date
            )
            SELECT
                days.day,
                COALESCE(spend.spend, 0) AS spend,
                COALESCE(revenue.revenue, 0) AS revenue,
                COALESCE(leads.leads, 0) AS leads,
                COALESCE(leads.conversions, 0) AS conversions
            FROM days
            LEFT JOIN spend ON spend.day = days.day
            LEFT JOIN leads ON leads.day = days.day
            LEFT JOIN revenue ON revenue.day = days.day
            ORDER BY days.day
            """,
            query.project_id,
            query.date_from,
            query.date_to,
            query.campaign_id_list,
            query.source_list,
            query.geo_list,
        )
        return [dict(row) for row in rows]

    async def fetch_cohorts(self, query: MarketingPerformanceQuery) -> list[dict[str, Any]]:
        """Aggregate conversion/revenue cohorts by cohort date and age in days."""
        rows = await self._conn.fetch(
            """
            WITH lead_cohorts AS (
                SELECT
                    cohort_date,
                    GREATEST(0, event_date - cohort_date) AS age_days,
                    SUM(leads_count) AS leads,
                    SUM(conversions_count) AS conversions
                FROM marketing_performance_lead_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY cohort_date, GREATEST(0, event_date - cohort_date)
            ),
            revenue_cohorts AS (
                SELECT
                    cohort_date,
                    GREATEST(0, event_date - cohort_date) AS age_days,
                    SUM(revenue) AS revenue
                FROM marketing_performance_revenue_facts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND event_date >= $2
                  AND event_date <= $3
                  AND (cardinality($4::uuid[]) = 0 OR campaign_id = ANY($4::uuid[]))
                  AND (cardinality($5::text[]) = 0 OR source = ANY($5::text[]))
                  AND (cardinality($6::text[]) = 0 OR geo = ANY($6::text[]))
                GROUP BY cohort_date, GREATEST(0, event_date - cohort_date)
            )
            SELECT
                COALESCE(l.cohort_date, r.cohort_date) AS cohort_date,
                COALESCE(l.age_days, r.age_days) AS age_days,
                COALESCE(l.leads, 0) AS leads,
                COALESCE(l.conversions, 0) AS conversions,
                COALESCE(r.revenue, 0) AS revenue
            FROM lead_cohorts l
            FULL OUTER JOIN revenue_cohorts r
              ON r.cohort_date = l.cohort_date
             AND r.age_days = l.age_days
            ORDER BY cohort_date DESC, age_days ASC
            LIMIT 120
            """,
            query.project_id,
            query.date_from,
            query.date_to,
            query.campaign_id_list,
            query.source_list,
            query.geo_list,
        )
        return [dict(row) for row in rows]
