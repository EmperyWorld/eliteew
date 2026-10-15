# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sync Marketing Cabinet campaign/funnel entities into normalized performance fact tables.
# The service is idempotent per project and keeps generated facts separate from future external imports.
# Invariants:
# - Only rows with metadata.source = cabinet_entity_sync are deleted/rebuilt.
# - Sync runs outside read-path dashboard requests; callers trigger it after mutations or as an explicit backfill.
# Related:
# - api/services/marketing_cabinet/project_performance_repository.py
# - api/routers/marketing_cabinet/campaigns.py
# - api/routers/marketing_cabinet/funnels.py
# - documentation/product/marketing/MARKETING-CABINET-PERFORMANCE.md
# ---
from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_cabinet.project_dashboard_cache import marketing_dashboard_cache

logger = logging.getLogger(__name__)

SYNC_METADATA_SOURCE = "cabinet_entity_sync"
SYNC_METADATA_VERSION = "2026-06-02-mvp"
UNKNOWN_DIMENSION = "unknown"

_REVENUE_TARGET_METRIC_RE = r"(revenue|выруч|продаж|sales|доход|gmv|arpu|ltv|romi|roi|оборот|выручк)"


@dataclass(frozen=True)
class MarketingPerformanceSyncResult:
    """Rows rebuilt by one project-scoped performance facts sync."""

    project_id: UUID
    deleted_rows: int
    spend_rows: int
    lead_rows: int
    revenue_rows: int

    @property
    def inserted_rows(self) -> int:
        return self.spend_rows + self.lead_rows + self.revenue_rows


def _count_from_status(status: str) -> int:
    parts = str(status or "").split()
    if len(parts) < 2:
        return 0
    try:
        return int(parts[-1])
    except ValueError:
        return 0


async def _delete_generated_facts(conn: asyncpg.Connection, *, project_id: UUID) -> int:
    deleted = 0
    for table in (
        "marketing_performance_spend_facts",
        "marketing_performance_lead_facts",
        "marketing_performance_revenue_facts",
    ):
        status = await conn.execute(
            f"""
            DELETE FROM {table}
            WHERE project_id = $1
              AND metadata->>'source' = $2
            """,  # noqa: S608 - table names are a fixed internal allowlist above.
            project_id,
            SYNC_METADATA_SOURCE,
        )
        deleted += _count_from_status(status)
    return deleted


async def _insert_spend_facts(conn: asyncpg.Connection, *, project_id: UUID) -> int:
    value = await conn.fetchval(
        """
        WITH scoped_campaigns AS (
            SELECT
                c.id AS campaign_id,
                c.project_id,
                c.company_id,
                COALESCE(NULLIF(TRIM(c.channel), ''), 'unknown') AS source,
                'unknown'::text AS geo,
                c.budget::numeric AS budget_amount,
                CASE
                    WHEN c.start_date IS NOT NULL
                     AND c.end_date IS NOT NULL
                     AND c.end_date::date >= c.start_date::date
                    THEN c.start_date::date
                    ELSE COALESCE(c.updated_at::date, c.created_at::date, CURRENT_DATE)
                END AS start_day,
                CASE
                    WHEN c.start_date IS NOT NULL
                     AND c.end_date IS NOT NULL
                     AND c.end_date::date >= c.start_date::date
                    THEN c.end_date::date
                    ELSE COALESCE(c.updated_at::date, c.created_at::date, CURRENT_DATE)
                END AS end_day,
                CASE
                    WHEN c.start_date IS NOT NULL
                     AND c.end_date IS NOT NULL
                     AND c.end_date::date >= c.start_date::date
                    THEN 'campaign_date_range_even_daily'
                    ELSE 'single_day_updated_at_fallback'
                END AS sync_rule
            FROM marketing_campaigns c
            WHERE c.project_id = $1
              AND c.deleted_at IS NULL
              AND c.budget IS NOT NULL
              AND c.budget > 0
        ),
        expanded AS (
            SELECT
                sc.*,
                gs.day::date AS fact_date,
                GREATEST((sc.end_day - sc.start_day + 1), 1)::numeric AS day_count
            FROM scoped_campaigns sc
            CROSS JOIN LATERAL generate_series(sc.start_day, sc.end_day, interval '1 day') AS gs(day)
        ),
        inserted AS (
            INSERT INTO marketing_performance_spend_facts (
                project_id,
                company_id,
                campaign_id,
                source,
                geo,
                fact_date,
                amount,
                currency,
                metadata,
                created_at,
                updated_at
            )
            SELECT
                project_id,
                company_id,
                campaign_id,
                source,
                geo,
                fact_date,
                budget_amount / day_count,
                'USD',
                jsonb_build_object(
                    'source', $2::text,
                    'sync_version', $3::text,
                    'sync_rule', sync_rule,
                    'campaign_budget_total', budget_amount,
                    'campaign_budget_days', day_count
                ),
                NOW(),
                NOW()
            FROM expanded
            RETURNING 1
        )
        SELECT COUNT(*)::int FROM inserted
        """,
        project_id,
        SYNC_METADATA_SOURCE,
        SYNC_METADATA_VERSION,
    )
    return int(value or 0)


async def _insert_lead_facts(conn: asyncpg.Connection, *, project_id: UUID) -> int:
    value = await conn.fetchval(
        """
        WITH first_stage AS (
            SELECT DISTINCT ON (fs.funnel_id)
                fs.funnel_id,
                fs.stage_name,
                fs.stage_order,
                COALESCE(fs.visitors, 0)::bigint AS visitors
            FROM marketing_funnel_stages fs
            WHERE fs.deleted_at IS NULL
            ORDER BY fs.funnel_id, fs.stage_order ASC, fs.created_at ASC
        ),
        last_stage AS (
            SELECT DISTINCT ON (fs.funnel_id)
                fs.funnel_id,
                fs.stage_name,
                fs.stage_order,
                COALESCE(fs.conversions, 0)::bigint AS conversions
            FROM marketing_funnel_stages fs
            WHERE fs.deleted_at IS NULL
            ORDER BY fs.funnel_id, fs.stage_order DESC, fs.created_at DESC
        ),
        scoped_funnels AS (
            SELECT
                f.id AS funnel_id,
                f.project_id,
                f.company_id,
                COALESCE(f.updated_at::date, f.created_at::date, CURRENT_DATE) AS event_date,
                COALESCE(first_stage.visitors, 0)::bigint AS leads_count,
                COALESCE(last_stage.conversions, 0)::bigint AS conversions_count,
                first_stage.stage_name AS first_stage_name,
                last_stage.stage_name AS last_stage_name
            FROM marketing_funnels f
            LEFT JOIN first_stage ON first_stage.funnel_id = f.id
            LEFT JOIN last_stage ON last_stage.funnel_id = f.id
            WHERE f.project_id = $1
              AND f.deleted_at IS NULL
              AND (COALESCE(first_stage.visitors, 0) > 0 OR COALESCE(last_stage.conversions, 0) > 0)
        ),
        inserted AS (
            INSERT INTO marketing_performance_lead_facts (
                project_id,
                company_id,
                campaign_id,
                source,
                geo,
                cohort_date,
                event_date,
                leads_count,
                qualified_leads_count,
                conversions_count,
                metadata,
                created_at,
                updated_at
            )
            SELECT
                project_id,
                company_id,
                NULL::uuid,
                'unknown',
                'unknown',
                event_date,
                event_date,
                leads_count,
                0,
                conversions_count,
                jsonb_build_object(
                    'source', $2::text,
                    'sync_version', $3::text,
                    'sync_rule', 'funnel_stage_proxy',
                    'lead_proxy', 'first_stage_visitors',
                    'conversion_proxy', 'last_stage_conversions',
                    'funnel_id', funnel_id,
                    'first_stage_name', first_stage_name,
                    'last_stage_name', last_stage_name
                ),
                NOW(),
                NOW()
            FROM scoped_funnels
            RETURNING 1
        )
        SELECT COUNT(*)::int FROM inserted
        """,
        project_id,
        SYNC_METADATA_SOURCE,
        SYNC_METADATA_VERSION,
    )
    return int(value or 0)


async def _insert_revenue_facts(conn: asyncpg.Connection, *, project_id: UUID) -> int:
    value = await conn.fetchval(
        """
        WITH scoped_campaigns AS (
            SELECT
                c.id AS campaign_id,
                c.project_id,
                c.company_id,
                COALESCE(NULLIF(TRIM(c.channel), ''), 'unknown') AS source,
                'unknown'::text AS geo,
                c.actual_metric::numeric AS revenue,
                COALESCE(c.start_date::date, c.updated_at::date, c.created_at::date, CURRENT_DATE) AS cohort_date,
                COALESCE(c.end_date::date, c.updated_at::date, c.created_at::date, CURRENT_DATE) AS event_date,
                c.target_metric_name
            FROM marketing_campaigns c
            WHERE c.project_id = $1
              AND c.deleted_at IS NULL
              AND c.actual_metric IS NOT NULL
              AND c.actual_metric > 0
              AND c.target_metric_name IS NOT NULL
              AND lower(c.target_metric_name) ~ $4
        ),
        inserted AS (
            INSERT INTO marketing_performance_revenue_facts (
                project_id,
                company_id,
                campaign_id,
                source,
                geo,
                cohort_date,
                event_date,
                revenue,
                currency,
                customers_count,
                metadata,
                created_at,
                updated_at
            )
            SELECT
                project_id,
                company_id,
                campaign_id,
                source,
                geo,
                cohort_date,
                event_date,
                revenue,
                'USD',
                0,
                jsonb_build_object(
                    'source', $2::text,
                    'sync_version', $3::text,
                    'sync_rule', 'campaign_actual_metric_revenue_like',
                    'target_metric_name', target_metric_name
                ),
                NOW(),
                NOW()
            FROM scoped_campaigns
            RETURNING 1
        )
        SELECT COUNT(*)::int FROM inserted
        """,
        project_id,
        SYNC_METADATA_SOURCE,
        SYNC_METADATA_VERSION,
        _REVENUE_TARGET_METRIC_RE,
    )
    return int(value or 0)


async def sync_marketing_performance_facts(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
) -> MarketingPerformanceSyncResult:
    """Rebuild generated performance facts for one Marketing Cabinet project."""
    async with db_pool.acquire() as conn, conn.transaction():
        deleted_rows = await _delete_generated_facts(conn, project_id=project_id)
        spend_rows = await _insert_spend_facts(conn, project_id=project_id)
        lead_rows = await _insert_lead_facts(conn, project_id=project_id)
        revenue_rows = await _insert_revenue_facts(conn, project_id=project_id)

    invalidated = await marketing_dashboard_cache.invalidate_project_namespace(
        project_id=project_id,
        namespace="performance-dashboard",
    )
    result = MarketingPerformanceSyncResult(
        project_id=project_id,
        deleted_rows=deleted_rows,
        spend_rows=spend_rows,
        lead_rows=lead_rows,
        revenue_rows=revenue_rows,
    )
    logger.info(
        "Marketing performance facts synced project_id=%s deleted=%s inserted=%s cache_invalidated=%s",
        project_id,
        result.deleted_rows,
        result.inserted_rows,
        invalidated,
    )
    return result


async def sync_marketing_performance_facts_best_effort(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
) -> MarketingPerformanceSyncResult | None:
    """Run sync from user mutations without making fact-table outages break CRUD flows."""
    try:
        return await sync_marketing_performance_facts(db_pool, project_id=project_id)
    except asyncpg.UndefinedTableError:
        logger.warning("Marketing performance facts sync skipped: fact tables missing project_id=%s", project_id)
        return None
    except Exception:
        logger.exception("Marketing performance facts sync failed project_id=%s", project_id)
        return None


__all__ = [
    "MarketingPerformanceSyncResult",
    "SYNC_METADATA_SOURCE",
    "sync_marketing_performance_facts",
    "sync_marketing_performance_facts_best_effort",
]
