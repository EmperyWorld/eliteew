# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Reconcile EWA companion async music task runs with UGS terminal states and stale worker/HTTP hangs.
# Invariants:
# - Only music async intents; never downgrades completed companion runs.
# - UGS cancel/fail propagates to companion; orphan running runs fail after stale horizon.
# Related:
# - api/tasks/companion_music_stale_run_reaper.py
# - api/services/ugs/unified_generation_service.py (cancel_generation hook)
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

import asyncpg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.ewa_platform.companion.jobs.music_pipeline_progress import (
    publish_music_task_completed,
    publish_music_task_failed,
)
from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_task_run_fetch,
    companion_task_step_update,
    companion_task_steps_list,
)

logger = logging.getLogger(__name__)

MUSIC_ASYNC_INTENT_KINDS: Final[frozenset[str]] = frozenset(
    {
        "music_generation_background",
        "music_generation_xl_base_background",
    }
)

_COMPANION_CORRELATION_KEYS: Final[tuple[str, ...]] = (
    "ewa_companion_run_id",
    "ewa_companion_step_id",
    "ewa_companion_principal_id",
)


def companion_music_stale_reap_after_seconds() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    return max(300, ewa_getenv_int("EWA_COMPANION_MUSIC_STALE_REAP_AFTER_SEC", default=1200))


def companion_music_reaper_batch_limit() -> int:
    """E8 / V-M7: DB-tunable batch (shared media/universal knob, default 50, max 200)."""

    from api.ewa_platform.settings.access import ewa_getenv_int

    for key in ("EWA_MEDIA_REAPER_BATCH_LIMIT", "EWA_UNIVERSAL_REAPER_BATCH_LIMIT"):
        raw = ewa_getenv_int(key, default=0)
        if raw > 0:
            return max(1, min(200, raw))
    return 50


def companion_ugs_correlation_payload(
    *,
    run_id: str,
    step_id: str,
    principal_id: str,
) -> dict[str, str]:
    rid = str(run_id or "").strip()
    sid = str(step_id or "").strip()
    pid = str(principal_id or "").strip()
    out: dict[str, str] = {}
    if rid:
        out["ewa_companion_run_id"] = rid
    if sid:
        out["ewa_companion_step_id"] = sid
    if pid:
        out["ewa_companion_principal_id"] = pid
    return out


def _extract_content_id(output_data: Mapping[str, Any] | None) -> str:
    if not isinstance(output_data, Mapping):
        return ""
    for key in ("content_id",):
        val = str(output_data.get(key) or "").strip()
        if val:
            return val
    result = output_data.get("result")
    if isinstance(result, Mapping):
        val = str(result.get("content_id") or "").strip()
        if val:
            return val
        audio = result.get("audio")
        if isinstance(audio, list) and audio:
            first = audio[0]
            if isinstance(first, Mapping):
                return str(first.get("content_id") or "").strip()
    return ""


async def _find_latest_ugs_row_for_companion_run(
    db: AsyncSession,
    *,
    companion_run_id: str,
) -> dict[str, Any] | None:
    rid = str(companion_run_id or "").strip()
    if not rid:
        return None
    result = await db.execute(
        text(
            """
            SELECT gr.id::text AS request_id,
                   gr.status,
                   gr.error_message,
                   gr.output_data,
                   gt.type_key
            FROM generation_requests gr
            JOIN generation_types gt ON gt.id = gr.type_id
            WHERE gr.deleted_at IS NULL
              AND (
                    gr.input_data->>'ewa_companion_run_id' = :run_id
                 OR gr.request_metadata->>'ewa_companion_run_id' = :run_id
              )
            ORDER BY gr.created_at DESC
            LIMIT 1
            """
        ),
        {"run_id": rid},
    )
    row = result.mappings().first()
    return dict(row) if row is not None else None


async def _cancel_ugs_requests_for_companion_run(
    db: AsyncSession,
    *,
    companion_run_id: str,
    user_id: str | None,
) -> int:
    rid = str(companion_run_id or "").strip()
    if not rid:
        return 0
    result = await db.execute(
        text(
            """
            SELECT gr.id::text AS request_id
            FROM generation_requests gr
            WHERE gr.deleted_at IS NULL
              AND gr.status NOT IN ('completed', 'failed', 'cancelled')
              AND (
                    gr.input_data->>'ewa_companion_run_id' = :run_id
                 OR gr.request_metadata->>'ewa_companion_run_id' = :run_id
              )
            """
        ),
        {"run_id": rid},
    )
    rows = list(result.mappings().all())
    if not rows:
        return 0
    from api.services.ugs.unified_generation_service import UnifiedGenerationService

    ugs = UnifiedGenerationService(db)
    cancelled = 0
    for row in rows:
        req_id = str(row.get("request_id") or "").strip()
        if not req_id:
            continue
        try:
            await ugs.cancel_generation(req_id, user_id=user_id)
            cancelled += 1
        except (ValueError, PermissionError) as exc:
            logger.info(
                "[STEP] companion_music_ugs_cancel_skip request_id=%s run_id=%s err=%s",
                req_id,
                rid,
                exc,
            )
        except Exception:
            logger.exception(
                "[STEP] companion_music_ugs_cancel_failed request_id=%s run_id=%s",
                req_id,
                rid,
            )
    return cancelled


async def _terminalize_companion_music_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    terminal_status: str,
    message: str,
    stage: str,
    ugs_request_id: str = "",
    result_payload: Mapping[str, Any] | None = None,
    force: bool = False,
) -> bool:
    """Terminalize music run. User cancel: OCC (force=False). Reaper/UGS: force=True."""

    from api.ewa_platform.companion.orchestration.run_lifecycle import apply_companion_run_terminal

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    if not run_id or not principal_id:
        return False
    current = str(run.get("status") or "").strip().lower()
    if current in {"completed", "failed", "cancelled"}:
        return False

    error_payload: dict[str, Any] = {
        "message": message[:500],
        "stage": stage[:80],
    }
    if ugs_request_id:
        error_payload["ugs_request_id"] = ugs_request_id

    completed_payload: dict[str, Any] | None = None
    if terminal_status == "completed":
        completed_payload = dict(result_payload) if result_payload is not None else {}
    updated = await apply_companion_run_terminal(
        pool,
        run=run,
        status=terminal_status,
        context=f"music_reconcile:{stage}",
        result_payload=completed_payload,
        error_payload=None if terminal_status == "completed" else error_payload,
        force=force,
    )
    if updated is None:
        return False

    steps = await companion_task_steps_list(pool, run_id=run_id)
    for step in steps:
        step_status = str(step.get("status") or "").strip().lower()
        if step_status in {"completed", "failed", "cancelled"}:
            continue
        step_id = str(step.get("id") or "").strip()
        if not step_id:
            continue
        if terminal_status == "completed":
            await companion_task_step_update(
                pool,
                step_id=step_id,
                status="completed",
                output_payload=dict(result_payload or {}),
            )
        else:
            await companion_task_step_update(
                pool,
                step_id=step_id,
                status=terminal_status,
                error_payload=error_payload,
            )

    if terminal_status == "completed":
        await publish_music_task_completed(
            principal_id=principal_id,
            run_id=run_id,
            result_payload=result_payload,
        )
    else:
        await publish_music_task_failed(
            principal_id=principal_id,
            run_id=run_id,
            error_payload=error_payload,
            stage=stage,
        )
    logger.info(
        "[STEP] companion_music_run_reconciled run_id=%s status=%s stage=%s ugs=%s",
        run_id,
        terminal_status,
        stage,
        ugs_request_id or "-",
    )
    return True


async def reconcile_companion_music_run_with_ugs(
    pool: asyncpg.Pool,
    db: AsyncSession,
    *,
    run: Mapping[str, Any],
    ugs_row: Mapping[str, Any] | None,
    force_stale: bool = False,
) -> bool:
    """Apply UGS terminal state (or stale timeout) to one companion music run."""

    run_id = str(run.get("id") or "").strip()
    if not run_id:
        return False
    if str(run.get("intent_kind") or "").strip() not in MUSIC_ASYNC_INTENT_KINDS:
        return False
    if str(run.get("status") or "").strip().lower() in {"completed", "failed", "cancelled"}:
        return False

    if ugs_row is None:
        ugs_row = await _find_latest_ugs_row_for_companion_run(db, companion_run_id=run_id)

    if ugs_row:
        ugs_status = str(ugs_row.get("status") or "").strip().lower()
        ugs_id = str(ugs_row.get("request_id") or "").strip()
        if ugs_status == "cancelled":
            return await _terminalize_companion_music_run(
                pool,
                run=run,
                terminal_status="cancelled",
                message="music_generation_ugs_cancelled",
                stage="ugs-cancelled",
                ugs_request_id=ugs_id,
                force=True,
            )
        if ugs_status == "failed":
            err = str(ugs_row.get("error_message") or "music_generation_ugs_failed").strip()
            return await _terminalize_companion_music_run(
                pool,
                run=run,
                terminal_status="failed",
                message=err[:500],
                stage="ugs-failed",
                ugs_request_id=ugs_id,
                force=True,
            )
        if ugs_status == "completed":
            output_raw = ugs_row.get("output_data")
            output_map = output_raw if isinstance(output_raw, Mapping) else {}
            content_id = _extract_content_id(output_map)
            if content_id:
                return await _terminalize_companion_music_run(
                    pool,
                    run=run,
                    terminal_status="completed",
                    message="music_generation_ugs_completed_reconcile",
                    stage="ugs-completed",
                    ugs_request_id=ugs_id,
                    result_payload={"content_id": content_id, "reconciled_from_ugs": True},
                    force=True,
                )
        if not force_stale and ugs_status in {"pending", "processing", "queued", "running"}:
            return False

    if force_stale:
        return await _terminalize_companion_music_run(
            pool,
            run=run,
            terminal_status="failed",
            message="stale_music_pipeline_timeout",
            stage="stale-reaper",
            force=True,
        )
    return False


async def reconcile_companion_run_after_ugs_request(
    pool: asyncpg.Pool,
    db: AsyncSession,
    *,
    ugs_request_id: str,
    ugs_status: str,
) -> bool:
    """Best-effort sync when UGS request reaches a terminal state (e.g. user cancel in UGS UI)."""

    req_id = str(ugs_request_id or "").strip()
    if not req_id:
        return False
    result = await db.execute(
        text(
            """
            SELECT COALESCE(
                input_data->>'ewa_companion_run_id',
                request_metadata->>'ewa_companion_run_id'
            ) AS companion_run_id
            FROM generation_requests
            WHERE id = CAST(:req_id AS uuid)
            LIMIT 1
            """
        ),
        {"req_id": req_id},
    )
    row = result.mappings().first()
    if row is None:
        return False
    companion_run_id = str(row.get("companion_run_id") or "").strip()
    if not companion_run_id:
        return False
    run = await companion_task_run_fetch(pool, run_id=companion_run_id)
    if run is None:
        return False
    ugs_row = {
        "request_id": req_id,
        "status": ugs_status,
        "error_message": "music_generation_ugs_cancelled" if ugs_status == "cancelled" else "",
        "output_data": {},
    }
    return await reconcile_companion_music_run_with_ugs(pool, db, run=run, ugs_row=ugs_row)


async def cancel_companion_music_run_for_user(
    pool: asyncpg.Pool,
    db: AsyncSession,
    *,
    run: Mapping[str, Any],
    oauth_user_id: str | None,
) -> dict[str, Any]:
    """User-initiated cancel: terminalize companion run and cancel linked in-flight UGS rows."""

    run_id = str(run.get("id") or "").strip()
    if str(run.get("intent_kind") or "").strip() not in MUSIC_ASYNC_INTENT_KINDS:
        return {"ok": False, "reason": "not_music_run"}
    status = str(run.get("status") or "").strip().lower()
    if status in {"completed", "failed", "cancelled"}:
        return {"ok": True, "reason": "already_terminal", "status": status}

    ugs_cancelled = await _cancel_ugs_requests_for_companion_run(
        db,
        companion_run_id=run_id,
        user_id=oauth_user_id,
    )
    changed = await _terminalize_companion_music_run(
        pool,
        run=run,
        terminal_status="cancelled",
        message="music_generation_cancelled_by_user",
        stage="user-cancel",
    )
    return {
        "ok": True,
        "cancelled": changed,
        "ugs_requests_cancelled": ugs_cancelled,
        "run_id": run_id,
    }


async def reap_stale_companion_music_runs() -> int:
    """Find orphan async music runs and reconcile with UGS or fail on stale timeout."""

    from api.core.database_manager import DatabaseConnectionError, get_database_manager
    from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool

    stale_sec = companion_music_stale_reap_after_seconds()

    try:
        manager = await get_database_manager()
    except DatabaseConnectionError:
        logger.warning("[COMPANION_MUSIC_STALE_REAPER] database manager unavailable")
        return 0

    if not manager.postgres_session_factory:
        logger.warning("[COMPANION_MUSIC_STALE_REAPER] postgres session factory missing")
        return 0

    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.warning("[COMPANION_MUSIC_STALE_REAPER] EWA_DATABASE_URL unset")
        return 0

    # Process-level pool (E4): do not close after each sweep.
    reconciled = 0
    batch_limit = companion_music_reaper_batch_limit()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM ewa_companion_task_runs
            WHERE execution_mode = 'async'
              AND intent_kind = ANY($1::text[])
              AND status IN ('pending', 'running')
              AND updated_at < NOW() - ($2::int * INTERVAL '1 second')
            ORDER BY updated_at ASC
            LIMIT $3
            """,
            list(MUSIC_ASYNC_INTENT_KINDS),
            stale_sec,
            batch_limit,
        )
    if not rows:
        return 0

    async with manager.get_postgres_session() as db:
        for row in rows:
            run = dict(row)
            ugs_row = await _find_latest_ugs_row_for_companion_run(
                db,
                companion_run_id=str(run.get("id") or ""),
            )
            changed = await reconcile_companion_music_run_with_ugs(
                pool,
                db,
                run=run,
                ugs_row=ugs_row,
                force_stale=True,
            )
            if changed:
                reconciled += 1

    if reconciled:
        logger.warning(
            "[COMPANION_MUSIC_STALE_REAPER] reconciled=%s stale_sec=%s",
            reconciled,
            stale_sec,
        )
    return reconciled


__all__ = (
    "MUSIC_ASYNC_INTENT_KINDS",
    "cancel_companion_music_run_for_user",
    "companion_music_reaper_batch_limit",
    "companion_music_stale_reap_after_seconds",
    "companion_ugs_correlation_payload",
    "reap_stale_companion_music_runs",
    "reconcile_companion_run_after_ugs_request",
    "reconcile_companion_music_run_with_ugs",
)
