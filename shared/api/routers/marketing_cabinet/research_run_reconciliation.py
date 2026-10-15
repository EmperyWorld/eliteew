# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Reconcile stuck evidence research_projects rows with marketing_ai_runs / UGS finalizers.
# Invariants:
# - processing without registered ai_run is failed only after orphan grace (no active in-flight window).
# - Active ai_run rows are reconciled via ai_run_reconciliation before list responses.
# Related:
# - researches.py, ai_run_reconciliation.py
# ---
from __future__ import annotations

import logging
import os
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService

logger = logging.getLogger(__name__)

_ACTIVE_AI_RUN_STATUSES = frozenset({"queued", "processing"})
_TERMINAL_AI_RUN_STATUSES = frozenset({"completed", "failed", "cancelled"})
_RESEARCH_ACTIVE_STATUSES = frozenset({"processing"})

_STALE_ORPHAN_MESSAGE = "Генерация прервана: фоновая задача не была зарегистрирована. Запустите исследование снова."


def research_orphan_grace_minutes() -> int:
    raw = os.getenv("MARKETING_RESEARCH_ORPHAN_GRACE_MINUTES", "2").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 2


async def _fetch_latest_research_ai_run(
    conn: asyncpg.Connection,
    *,
    research_id: UUID,
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT *
        FROM marketing_ai_runs
        WHERE deleted_at IS NULL
          AND tool_key = 'research_run'
          AND metadata->>'research_id' = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        str(research_id),
    )


async def _fail_stale_orphan_researches_for_project(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    grace_minutes: int,
) -> int:
    rows = await conn.fetch(
        """
        UPDATE research_projects rp
        SET
            status = 'failed'::research_status,
            result_summary = COALESCE(NULLIF(TRIM(rp.result_summary), ''), $3),
            updated_at = NOW()
        WHERE rp.project_id = $1
          AND rp.deleted_at IS NULL
          AND rp.status = 'processing'::research_status
          AND rp.updated_at < NOW() - ($2::text || ' minutes')::interval
          AND NOT EXISTS (
            SELECT 1
            FROM marketing_ai_runs mar
            WHERE mar.deleted_at IS NULL
              AND mar.tool_key = 'research_run'
              AND mar.metadata->>'research_id' = rp.id::text
          )
        RETURNING rp.id
        """,
        project_id,
        str(grace_minutes),
        _STALE_ORPHAN_MESSAGE,
    )
    if rows:
        logger.info(
            "[STEP] research_run.fail_stale_orphans project_id=%s count=%s grace_min=%s",
            project_id,
            len(rows),
            grace_minutes,
        )
    return len(rows)


async def _reconcile_processing_research(
    db_pool: asyncpg.Pool,
    *,
    research_id: UUID,
    ai_service: MarketingCabinetAIService,
) -> None:
    from .ai_run_reconciliation import (
        _finalize_completed_research_run,
        _update_research_status,
        reconcile_marketing_ai_run,
    )
    from .researches import normalize_research_status_for_db

    async with db_pool.acquire() as conn:
        research_row = await conn.fetchrow(
            """
            SELECT *
            FROM research_projects
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            research_id,
        )
        if research_row is None:
            return
        if str(research_row.get("status") or "") not in _RESEARCH_ACTIVE_STATUSES:
            return
        ai_run_row = await _fetch_latest_research_ai_run(conn, research_id=research_id)

    if ai_run_row is None:
        return

    ai_status = str(ai_run_row.get("status") or "").strip().lower()
    if ai_status in _ACTIVE_AI_RUN_STATUSES:
        await reconcile_marketing_ai_run(
            db_pool,
            row=ai_run_row,
            ai_service=ai_service,
        )
        return

    if ai_status == "completed":
        request_id = str(ai_run_row.get("request_id") or "").strip()
        if not request_id:
            await _update_research_status(
                db_pool,
                research_id=research_id,
                status_value="failed",
                result_summary=_STALE_ORPHAN_MESSAGE,
            )
            return
        try:
            generation = await ai_service.ugs_service.get_result(request_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "research_run terminal finalize fetch failed research_id=%s run_id=%s: %s",
                research_id,
                ai_run_row.get("id"),
                exc,
            )
            return
        if str(generation.get("status") or "").strip().lower() != "completed":
            return
        try:
            await _finalize_completed_research_run(
                db_pool,
                row=ai_run_row,
                generation=generation,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "research_run terminal finalize failed research_id=%s run_id=%s: %s",
                research_id,
                ai_run_row.get("id"),
                exc,
            )
            await _update_research_status(
                db_pool,
                research_id=research_id,
                status_value="failed",
                result_summary=str(exc),
            )
        return

    if ai_status in _TERMINAL_AI_RUN_STATUSES:
        await _update_research_status(
            db_pool,
            research_id=research_id,
            status_value=normalize_research_status_for_db(ai_status),
            result_summary=None,
        )


async def reconcile_research_projects_for_project(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    ai_service: MarketingCabinetAIService,
) -> None:
    grace = research_orphan_grace_minutes()
    async with db_pool.acquire() as conn:
        await _fail_stale_orphan_researches_for_project(
            conn,
            project_id=project_id,
            grace_minutes=grace,
        )
        processing_rows = await conn.fetch(
            """
            SELECT id
            FROM research_projects
            WHERE project_id = $1
              AND deleted_at IS NULL
              AND status = 'processing'::research_status
            """,
            project_id,
        )

    for row in processing_rows:
        await _reconcile_processing_research(
            db_pool,
            research_id=UUID(str(row["id"])),
            ai_service=ai_service,
        )


async def enrich_research_items_with_active_ai_run(
    db_pool: asyncpg.Pool,
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    processing_ids = [str(item["id"]) for item in items if str(item.get("status") or "") == "processing"]
    if not processing_ids:
        return items

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (metadata->>'research_id')
                metadata->>'research_id' AS research_id,
                id::text AS run_id
            FROM marketing_ai_runs
            WHERE deleted_at IS NULL
              AND tool_key = 'research_run'
              AND metadata->>'research_id' = ANY($1::text[])
              AND status = ANY($2::text[])
            ORDER BY metadata->>'research_id', created_at DESC
            """,
            processing_ids,
            list(_ACTIVE_AI_RUN_STATUSES),
        )

    run_by_research = {str(row["research_id"]): str(row["run_id"]) for row in rows if row.get("research_id")}
    enriched: list[dict[str, Any]] = []
    for item in items:
        payload = dict(item)
        run_id = run_by_research.get(str(item.get("id") or ""))
        if run_id:
            payload["active_ai_run_id"] = run_id
        enriched.append(payload)
    return enriched
