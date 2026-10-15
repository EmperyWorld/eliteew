# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Reconcile EWA companion async image task runs with UGS terminal states and stale worker hangs.
# Invariants:
# - Only image async intents; never downgrade completed companion runs.
# - UGS completed repairs companion failed/running when output has content_id or image URL.
# Related:
# - api/tasks/companion_image_stale_run_reaper.py
# - api/ewa_platform/companion/orchestration/companion_image_generation.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession

from api.ewa_platform.companion.jobs.music_run_reconcile import _find_latest_ugs_row_for_companion_run
from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
from api.ewa_platform.companion.orchestration.companion_image_generation import (
    IMAGE_ASYNC_INTENT_KINDS,
    IMAGE_EDIT_INTENT,
    IMAGE_GENERATION_INTENT,
    IMAGE_TOOL_MODE_EDIT,
    IMAGE_TOOL_MODE_GENERATE,
    _content_id_from_ugs_result,
    _mime_type_from_ugs_result,
    _public_url_from_ugs_result,
)
from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_task_run_update,
    companion_task_step_update,
    companion_task_steps_list,
)

logger = logging.getLogger(__name__)

_COMPANION_REPAIR_STATUSES: Final[frozenset[str]] = frozenset({"pending", "running", "failed"})


def companion_image_stale_reap_after_seconds() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    return max(300, ewa_getenv_int("EWA_COMPANION_IMAGE_STALE_REAP_AFTER_SEC", default=1800))


def companion_image_reaper_batch_limit() -> int:
    """E8 / V-M7: DB-tunable batch (shared media/universal knob, default 50, max 200)."""

    from api.ewa_platform.settings.access import ewa_getenv_int

    for key in ("EWA_MEDIA_REAPER_BATCH_LIMIT", "EWA_UNIVERSAL_REAPER_BATCH_LIMIT"):
        raw = ewa_getenv_int(key, default=0)
        if raw > 0:
            return max(1, min(200, raw))
    return 50


def _image_result_from_ugs_output(
    output_data: Mapping[str, Any] | None,
    *,
    run: Mapping[str, Any],
) -> dict[str, Any] | None:
    if not isinstance(output_data, Mapping):
        return None
    wrapped = output_data.get("result") if isinstance(output_data.get("result"), Mapping) else output_data
    if not isinstance(wrapped, Mapping):
        wrapped = output_data
    content_id = _content_id_from_ugs_result(wrapped)
    image_url = _public_url_from_ugs_result(wrapped)
    if not content_id and not image_url:
        return None
    plan = run.get("plan_payload")
    plan_map = plan if isinstance(plan, Mapping) else {}
    intent_kind = str(run.get("intent_kind") or IMAGE_GENERATION_INTENT).strip()
    mode = str(plan_map.get("image_tool_mode") or plan_map.get("operation_mode") or "").strip()
    if not mode:
        mode = IMAGE_TOOL_MODE_EDIT if intent_kind == IMAGE_EDIT_INTENT else IMAGE_TOOL_MODE_GENERATE
    prompt = str(plan_map.get("prompt_preview") or run.get("user_message") or "").strip()[:240]
    payload: dict[str, Any] = {
        "image_tool_mode": mode,
        "operation_mode": mode,
        "prompt_preview": prompt,
        "reconciled_from_ugs": True,
    }
    mime = _mime_type_from_ugs_result(wrapped)
    if mime:
        payload["mime_type"] = mime
    if image_url:
        payload["image_url"] = image_url
    if content_id:
        payload["content_id"] = content_id
        payload["unified_content_id"] = content_id
    source_id = str(plan_map.get("source_content_id") or plan_map.get("source_unified_content_id") or "").strip()
    if source_id and mode == IMAGE_TOOL_MODE_EDIT:
        payload["source_content_id"] = source_id
        payload["source_unified_content_id"] = source_id
    aspect = str(plan_map.get("aspect_ratio") or "1:1").strip()
    if mode != IMAGE_TOOL_MODE_EDIT:
        payload["aspect_ratio"] = aspect or "1:1"
    return payload


async def _terminalize_companion_image_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    terminal_status: str,
    message: str,
    stage: str,
    ugs_request_id: str = "",
    result_payload: Mapping[str, Any] | None = None,
) -> bool:
    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    if not run_id or not principal_id:
        return False
    current = str(run.get("status") or "").strip().lower()
    if current == "completed":
        return False
    if terminal_status != "completed" and current in {"failed", "cancelled"}:
        return False

    error_payload: dict[str, Any] = {
        "message": message[:500],
        "stage": stage[:80],
    }
    if ugs_request_id:
        error_payload["ugs_request_id"] = ugs_request_id

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

    intent_kind = str(run.get("intent_kind") or IMAGE_GENERATION_INTENT).strip()
    if terminal_status == "completed":
        await companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            status="completed",
            result_payload=dict(result_payload or {}),
        )
        await publish_task_event_async(
            principal_id=principal_id,
            event_name="task_completed",
            payload={
                "run_id": run_id,
                "status": "completed",
                "intent_kind": intent_kind,
                "result_payload": dict(result_payload or {}),
            },
        )
    else:
        await companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            status=terminal_status,
            error_payload=error_payload,
        )
        await publish_task_event_async(
            principal_id=principal_id,
            event_name="task_failed",
            payload={
                "run_id": run_id,
                "status": terminal_status,
                "intent_kind": intent_kind,
                "error_payload": error_payload,
            },
        )
    logger.info(
        "[STEP] companion_image_run_reconciled run_id=%s status=%s stage=%s ugs=%s",
        run_id,
        terminal_status,
        stage,
        ugs_request_id or "-",
    )
    return True


async def reconcile_companion_image_run_with_ugs(
    pool: asyncpg.Pool,
    db: AsyncSession,
    *,
    run: Mapping[str, Any],
    ugs_row: Mapping[str, Any] | None,
    force_stale: bool = False,
) -> bool:
    run_id = str(run.get("id") or "").strip()
    if not run_id:
        return False
    if str(run.get("intent_kind") or "").strip() not in IMAGE_ASYNC_INTENT_KINDS:
        return False
    companion_status = str(run.get("status") or "").strip().lower()
    if companion_status == "completed":
        return False
    if companion_status not in _COMPANION_REPAIR_STATUSES and not force_stale:
        return False

    if ugs_row is None:
        ugs_row = await _find_latest_ugs_row_for_companion_run(db, companion_run_id=run_id)

    if ugs_row:
        ugs_status = str(ugs_row.get("status") or "").strip().lower()
        ugs_id = str(ugs_row.get("request_id") or "").strip()
        if ugs_status == "cancelled":
            return await _terminalize_companion_image_run(
                pool,
                run=run,
                terminal_status="cancelled",
                message="image_generation_ugs_cancelled",
                stage="ugs-cancelled",
                ugs_request_id=ugs_id,
            )
        if ugs_status == "failed":
            err = str(ugs_row.get("error_message") or "image_generation_ugs_failed").strip()
            return await _terminalize_companion_image_run(
                pool,
                run=run,
                terminal_status="failed",
                message=err[:500],
                stage="ugs-failed",
                ugs_request_id=ugs_id,
            )
        if ugs_status == "completed":
            output_raw = ugs_row.get("output_data")
            output_map = output_raw if isinstance(output_raw, Mapping) else {}
            result_payload = _image_result_from_ugs_output(output_map, run=run)
            if result_payload:
                return await _terminalize_companion_image_run(
                    pool,
                    run=run,
                    terminal_status="completed",
                    message="image_generation_ugs_completed_reconcile",
                    stage="ugs-completed",
                    ugs_request_id=ugs_id,
                    result_payload=result_payload,
                )
        if not force_stale and ugs_status in {"pending", "processing", "queued", "running"}:
            return False

    if force_stale:
        return await _terminalize_companion_image_run(
            pool,
            run=run,
            terminal_status="failed",
            message="stale_image_pipeline_timeout",
            stage="stale-reaper",
        )
    return False


async def reap_stale_companion_image_runs() -> int:
    from api.core.database_manager import DatabaseConnectionError, get_database_manager
    from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool

    stale_sec = companion_image_stale_reap_after_seconds()

    try:
        manager = await get_database_manager()
    except DatabaseConnectionError:
        logger.warning("[COMPANION_IMAGE_STALE_REAPER] database manager unavailable")
        return 0

    if not manager.postgres_session_factory:
        logger.warning("[COMPANION_IMAGE_STALE_REAPER] postgres session factory missing")
        return 0

    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.warning("[COMPANION_IMAGE_STALE_REAPER] EWA_DATABASE_URL unset")
        return 0

    # Process-level pool (E4): do not close after each sweep.
    reconciled = 0
    batch_limit = companion_image_reaper_batch_limit()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM ewa_companion_task_runs
            WHERE execution_mode = 'async'
              AND intent_kind = ANY($1::text[])
              AND status IN ('pending', 'running', 'failed')
              AND updated_at < NOW() - ($2::int * INTERVAL '1 second')
            ORDER BY updated_at ASC
            LIMIT $3
            """,
            list(IMAGE_ASYNC_INTENT_KINDS),
            stale_sec,
            batch_limit,
        )
    if not rows:
        return 0

    async with manager.get_postgres_session() as db:
        for row in rows:
            run = dict(row)
            status = str(run.get("status") or "").strip().lower()
            ugs_row = await _find_latest_ugs_row_for_companion_run(
                db,
                companion_run_id=str(run.get("id") or ""),
            )
            if status == "failed" and ugs_row and str(ugs_row.get("status") or "").lower() == "completed":
                if await reconcile_companion_image_run_with_ugs(pool, db, run=run, ugs_row=ugs_row):
                    reconciled += 1
                continue
            if status in _COMPANION_REPAIR_STATUSES and await reconcile_companion_image_run_with_ugs(
                pool,
                db,
                run=run,
                ugs_row=ugs_row,
                force_stale=True,
            ):
                reconciled += 1
    return reconciled
