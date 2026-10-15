# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ops metrics and lightweight probes for Professional Worlds admin dashboard.
# Invariants:
# - Read-only SQL aggregates; no mutation side effects.
# Related:
# - api/services/professional_worlds/admin_service.py
# - api/routers/professional_worlds_admin.py
# ---

from __future__ import annotations

import logging
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


async def load_runtime_overview(db: AsyncSession) -> dict[str, Any]:
    """Aggregate 24h Professional Worlds runtime counters."""
    result = await db.execute(
        text(
            """
            SELECT
                (SELECT count(*) FROM professional_ai_playbook_runs
                 WHERE created_at >= now() - interval '24 hours') AS playbook_runs_24h,
                (SELECT count(*) FROM professional_ai_playbook_runs
                 WHERE created_at >= now() - interval '24 hours'
                   AND status IN ('failed', 'cancelled', 'error')) AS playbook_runs_failed_24h,
                (SELECT count(*) FROM professional_artifacts
                 WHERE created_at >= now() - interval '24 hours') AS artifacts_24h,
                COALESCE((
                    SELECT sum(gr.credits_used)
                    FROM generation_requests gr
                    INNER JOIN professional_artifacts pa ON pa.ugs_request_id = gr.id
                    WHERE pa.created_at >= now() - interval '24 hours'
                ), 0) AS credits_used_24h,
                (SELECT count(*) FROM realtor_media_enhancement_jobs
                 WHERE created_at >= now() - interval '24 hours'
                   AND status IN ('failed', 'error', 'cancelled')) AS media_job_errors_24h,
                COALESCE((
                    SELECT CASE
                        WHEN total_requests = 0 THEN 0.0
                        ELSE ROUND(
                            100.0 * failed_requests::numeric / total_requests::numeric,
                            2
                        )
                    END
                    FROM (
                        SELECT
                            count(*) FILTER (
                                WHERE gr.status IN ('failed', 'error', 'cancelled')
                            ) AS failed_requests,
                            count(*) AS total_requests
                        FROM generation_requests gr
                        INNER JOIN generation_types gt ON gt.id = gr.type_id
                        WHERE gr.created_at >= now() - interval '24 hours'
                          AND gt.type_key LIKE 'professional_worlds%'
                    ) api_window
                ), 0.0) AS api_error_rate_24h
            """
        )
    )
    row = dict(result.mappings().one())
    row["credits_used_24h"] = float(row.get("credits_used_24h") or 0)
    failed_24h = int(row.get("playbook_runs_failed_24h") or 0)
    row["failed_playbook_runs_24h"] = failed_24h
    row["media_job_errors_24h"] = int(row.get("media_job_errors_24h") or 0)
    row["api_error_rate_24h"] = float(row.get("api_error_rate_24h") or 0)
    return row


async def load_usage_by_vertical(db: AsyncSession) -> list[dict[str, Any]]:
    """Playbook runs grouped by vertical for the last 24 hours."""
    result = await db.execute(
        text(
            """
            SELECT vertical_slug,
                   count(*) AS runs_24h,
                   count(*) FILTER (
                       WHERE status IN ('failed', 'cancelled', 'error')
                   ) AS failed_24h
            FROM professional_ai_playbook_runs
            WHERE created_at >= now() - interval '24 hours'
            GROUP BY vertical_slug
            ORDER BY runs_24h DESC
            """
        )
    )
    return [dict(item) for item in result.mappings().all()]


async def _probe_postgres(db: AsyncSession) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        return {
            "id": "postgres",
            "ok": True,
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "message": "DB reachable",
        }
    except Exception as exc:
        logger.warning("professional_worlds.ops_probe postgres_failed error=%s", exc)
        return {
            "id": "postgres",
            "ok": False,
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "message": str(exc)[:240],
        }


async def _probe_ugs_catalog(db: AsyncSession) -> dict[str, Any]:
    """Lightweight UGS readiness probe for admin ops and integrations tab."""
    started = time.perf_counter()
    try:
        catalog = await db.execute(
            text(
                """
                SELECT count(*) AS type_count
                FROM generation_types
                WHERE type_key LIKE 'professional_worlds%'
                """
            )
        )
        type_count = int(dict(catalog.mappings().one()).get("type_count") or 0)
        healthy = False
        message = "UGS catalog reachable"
        try:
            health = await db.execute(
                text(
                    """
                    SELECT
                        count(*) AS provider_count,
                        count(*) FILTER (WHERE NOT recent.is_healthy) AS unhealthy_count
                    FROM (
                        SELECT DISTINCT ON (phl.provider_name)
                            phl.provider_name,
                            phl.is_healthy
                        FROM provider_health_log phl
                        INNER JOIN generation_providers gp
                            ON gp.provider_name = phl.provider_name
                           AND gp.enabled = TRUE
                        WHERE phl.checked_at >= now() - interval '30 minutes'
                        ORDER BY phl.provider_name, phl.checked_at DESC
                    ) recent
                    """
                )
            )
            health_row = dict(health.mappings().one())
            provider_count = int(health_row.get("provider_count") or 0)
            unhealthy_count = int(health_row.get("unhealthy_count") or 0)
            if provider_count == 0:
                if type_count > 0:
                    healthy = True
                    message = f"UGS catalog has {type_count} PW types (no recent enabled-provider health rows)"
                else:
                    healthy = False
                    message = "No professional_worlds generation types registered"
            else:
                healthy = unhealthy_count == 0
                message = "UGS providers healthy" if healthy else "UGS providers degraded — check provider health log"
        except Exception as health_exc:
            logger.debug(
                "professional_worlds.ops_probe ugs_health_log_skip error=%s",
                health_exc,
            )
            healthy = type_count > 0
            if not healthy:
                message = "UGS catalog empty for Professional Worlds"
        return {
            "id": "ugs",
            "ok": healthy,
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "message": message,
        }
    except Exception as exc:
        logger.warning("professional_worlds.ops_probe ugs_failed error=%s", exc)
        return {
            "id": "ugs",
            "ok": False,
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "message": str(exc)[:240],
        }


async def build_ops_probes(db: AsyncSession) -> list[dict[str, Any]]:
    """Run lightweight health probes for PW admin ops tab."""
    return [await _probe_postgres(db), await _probe_ugs_catalog(db)]


async def load_ugs_provider_health(db: AsyncSession) -> dict[str, Any]:
    """Desktop workspace degrade signal derived from the UGS ops probe."""
    ugs_probe = await _probe_ugs_catalog(db)
    ugs_ok = bool(ugs_probe.get("ok"))
    return {
        "ugs_ok": ugs_ok,
        "degraded": not ugs_ok,
        "message": str(ugs_probe.get("message") or ""),
    }


async def build_ops_metrics(db: AsyncSession) -> dict[str, Any]:
    """Full ops metrics payload."""
    runtime = await load_runtime_overview(db)
    return {
        "probes": await build_ops_probes(db),
        "runtime": runtime,
        "by_vertical": await load_usage_by_vertical(db),
    }
