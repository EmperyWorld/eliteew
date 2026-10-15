# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Terminal-state guarantee helpers: isolated failed persist + orphan reconcile.
# Invariants:
# - Non-terminal idle runs become failed with stage=reconcile_orphan.
# - Isolated persist uses a fresh DB session after rollback of the execute session.
# Related:
# - api/services/music_forge/pipeline_execute.py
# - api/services/music_forge/stale.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge reconcile and terminal failure persistence."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.stale import MUSIC_FORGE_STALE_RUN_SECONDS

logger = logging.getLogger(__name__)

RECONCILE_ORPHAN_ERROR = {
    "stage": "reconcile_orphan",
    "message": "Run left non-terminal; reconciled to failed.",
}


def _json_param(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


async def persist_run_terminal_failed_isolated(
    *,
    run_id: str,
    error_payload: dict[str, Any],
    step_kind: str | None = None,
) -> bool:
    """Записать terminal failed в отдельной сессии (после rollback execute-сессии)."""
    try:
        from api.core.database_manager import get_database_manager

        db_manager = await get_database_manager()
        async with db_manager.get_postgres_session() as db:
            await db.execute(
                text(
                    """
                    UPDATE music_forge_runs
                    SET status = 'failed',
                        error_payload = CAST(:error_payload AS jsonb),
                        updated_at = NOW()
                    WHERE id = CAST(:run_id AS uuid)
                      AND status NOT IN ('completed', 'failed', 'cancelled')
                    """
                ),
                {"run_id": run_id, "error_payload": _json_param(error_payload)},
            )
            if step_kind:
                await db.execute(
                    text(
                        """
                        UPDATE music_forge_run_steps
                        SET status = 'failed',
                            error_payload = CAST(:error_payload AS jsonb),
                            completed_at = COALESCE(completed_at, NOW()),
                            updated_at = NOW()
                        WHERE run_id = CAST(:run_id AS uuid)
                          AND step_kind = :step_kind
                          AND status IN ('pending', 'running')
                        """
                    ),
                    {
                        "run_id": run_id,
                        "step_kind": step_kind,
                        "error_payload": _json_param(error_payload),
                    },
                )
            await db.commit()
        logger.error(
            "[STEP] music_forge_terminal_isolated run_id=%s step=%s",
            run_id,
            step_kind,
        )
        return True
    except Exception:
        logger.exception(
            "[STEP] music_forge_terminal_isolated_fail run_id=%s — enqueue reconcile",
            run_id,
        )
        return False


async def reconcile_orphan_runs(
    db: AsyncSession,
    *,
    stale_after_seconds: int = MUSIC_FORGE_STALE_RUN_SECONDS,
    limit: int = 50,
) -> int:
    """Перевести застрявшие non-terminal runs в failed (stage=reconcile_orphan)."""
    rows = (
        (
            await db.execute(
                text(
                    """
                    SELECT id
                    FROM music_forge_runs
                    WHERE status NOT IN ('completed', 'failed', 'cancelled')
                      AND updated_at < NOW() - make_interval(secs => :stale_secs)
                    ORDER BY updated_at ASC
                    LIMIT :limit
                    """
                ),
                {"stale_secs": int(stale_after_seconds), "limit": int(limit)},
            )
        )
        .mappings()
        .all()
    )
    count = 0
    for row in rows:
        run_id = str(row["id"])
        await db.execute(
            text(
                """
                UPDATE music_forge_runs
                SET status = 'failed',
                    error_payload = CAST(:error_payload AS jsonb),
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                  AND status NOT IN ('completed', 'failed', 'cancelled')
                """
            ),
            {"run_id": run_id, "error_payload": _json_param(RECONCILE_ORPHAN_ERROR)},
        )
        await db.execute(
            text(
                """
                UPDATE music_forge_run_steps
                SET status = 'failed',
                    error_payload = CAST(:error_payload AS jsonb),
                    completed_at = COALESCE(completed_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND status IN ('pending', 'running')
                """
            ),
            {"run_id": run_id, "error_payload": _json_param(RECONCILE_ORPHAN_ERROR)},
        )
        count += 1
        logger.error("[STEP] music_forge_reconcile_orphan run_id=%s", run_id)
    if count:
        await db.commit()
    return count


async def reconcile_orphan_runs_isolated(
    *,
    stale_after_seconds: int = MUSIC_FORGE_STALE_RUN_SECONDS,
    limit: int = 50,
) -> int:
    """Reconcile orphans in a fresh DB session."""
    from api.core.database_manager import get_database_manager

    db_manager = await get_database_manager()
    async with db_manager.get_postgres_session() as db:
        return await reconcile_orphan_runs(db, stale_after_seconds=stale_after_seconds, limit=limit)


__all__ = [
    "RECONCILE_ORPHAN_ERROR",
    "persist_run_terminal_failed_isolated",
    "reconcile_orphan_runs",
    "reconcile_orphan_runs_isolated",
]
