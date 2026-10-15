# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AMKA execute phase: background execution loop over planned steps; on success schedules the next
# auto-cycle (if configured) via `schedule_marketing_amka_auto_chain_background` (driver boundary).
# Invariants:
# - Early-exit when run status is `cancelled`; per-step approval pauses without scheduling chain.
# - Auto-chain scheduling uses the same task registry as plan/execute (`_spawn_background`).
# Related:
# - shared/api/services/marketing_cabinet/amka_driver_background_schedule.py
# - documentation/product/amka-seed-album/AMKA-BACKGROUND-TASK-KEYS.md
# ---
"""AMKA execute phase: background execution loop over planned steps."""

from __future__ import annotations

import asyncio
import logging
from time import perf_counter
from typing import Any
from uuid import UUID

from api.core.unified_config import unified_settings
from api.services.marketing_cabinet.amka_driver_background_schedule import (
    schedule_marketing_amka_auto_chain_background,
)
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_service_support import (
    _json_dict,
    _now_utc,
    _safe_int,
)

logger = logging.getLogger(__name__)


async def run_execute_background(svc, *, run_id: UUID, user_id: UUID) -> None:
    current_step_id: str | None = None
    exec_started = perf_counter()
    try:
        run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
        if run.get("status") == "cancelled":
            return
        ctx = _json_dict(await svc._fetch_run_value(run_id, "context_payload"))
        per_step = bool(ctx.get("per_step_execution"))
        existing_started = run.get("started_at")
        await svc._update_run(
            run_id,
            status_value="running",
            current_stage="execute",
            started_at=_now_utc() if not existing_started else None,
            progress=max(35, _safe_int(run.get("progress"), 35)),
            progress_message="AMKA: выполняю запланированные шаги…",
            error_payload={},
        )
        exec_snapshot: dict[str, Any] | None = None
        reuse_merged: str | None = None
        while True:
            latest = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
            if latest.get("status") == "cancelled":
                return
            steps_all = await svc._list_steps(run_id)
            exec_lane = [step for step in steps_all if step["stage_kind"] in {"execute_section", "final_assessment"}]
            exec_pending = [step for step in exec_lane if step["status"] in {"pending", "failed"}]
            if not exec_pending:
                break
            total_lane = max(len(exec_lane), 1)
            step = exec_pending[0]
            lane_index = next(
                (i for i, s in enumerate(exec_lane) if s["id"] == step["id"]),
                0,
            )
            progress = 35 + int(55 * (lane_index / total_lane))
            current_step_id = step["id"]
            await svc._update_run(
                run_id,
                progress=progress,
                progress_message=f"AMKA: этап {lane_index + 1}/{total_lane} — {step['title']}",
            )
            await svc._update_step(
                UUID(step["id"]),
                status="running",
                started_at=_now_utc(),
                error_payload={},
            )
            reuse_static = (
                {
                    "operator_amka": exec_snapshot["operator_amka"],
                    "recent_amka_runs_digest": exec_snapshot["recent_amka_runs_digest"],
                    "recent_amka_runs_digest_markdown": exec_snapshot["recent_amka_runs_digest_markdown"],
                }
                if exec_snapshot is not None
                else None
            )
            exec_snapshot = await svc._build_run_snapshot(
                run_id=run_id,
                user_id=user_id,
                reuse_static=reuse_static,
                reuse_merged_project_context=reuse_merged,
            )
            if step["stage_kind"] == "execute_section":
                result = await svc._execute_section_step(
                    run_id=run_id,
                    step=step,
                    user_id=user_id,
                    snapshot=exec_snapshot,
                )
            else:
                result = await svc._execute_final_assessment(run_id=run_id, user_id=user_id)
            await svc._update_step(
                UUID(step["id"]),
                status="completed",
                completed_at=_now_utc(),
                report_markdown=result.get("report_markdown"),
                report_payload=result.get("report_payload"),
                applied_entities=result.get("applied_entities"),
                metrics_before=result.get("metrics_before"),
                metrics_after=result.get("metrics_after"),
                error_payload={},
            )
            me = result.get("metrics_after") or {}
            step_touched = bool(result.get("applied_entities")) or _safe_int(me.get("applied_count"), 0) > 0
            step_touched = step_touched or _safe_int(me.get("imported_sources_count"), 0) > 0
            step_touched = step_touched or bool(me.get("tool_agent_completed"))
            step_touched = step_touched or bool(me.get("ensemble_completed"))
            step_touched = step_touched or bool(me.get("ensemble_fallback_to_tool_agent"))
            if (
                unified_settings.amka_execute_reuse_merged_context_between_steps
                and exec_snapshot is not None
                and not step_touched
            ):
                reuse_merged = str(exec_snapshot.get("project_context_text") or "").strip() or None
            else:
                reuse_merged = None
            if per_step and step["stage_kind"] == "execute_section":
                remaining_execute = [
                    s
                    for s in await svc._list_steps(run_id)
                    if s["stage_kind"] == "execute_section" and s["status"] in {"pending", "failed"}
                ]
                if remaining_execute:
                    await svc._update_run(
                        run_id,
                        status_value="awaiting_step_approval",
                        current_stage="step_approval",
                        progress_message=(
                            "AMKA: этап выполнен. Подтвердите переход к следующему "
                            f"({len(remaining_execute)} осталось)."
                        ),
                        error_payload={},
                    )
                    return
        latest = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
        if latest.get("status") != "cancelled":
            steps_final = await svc._list_steps(run_id)
            completed_exec_steps = [
                s for s in steps_final if s["stage_kind"] == "execute_section" and s["status"] == "completed"
            ]
            exec_section_count = len(completed_exec_steps)
            total_touch = 0
            for s in completed_exec_steps:
                me = s.get("metrics_after") or {}
                ae = len(s.get("applied_entities") or [])
                ac = _safe_int(me.get("applied_count"), 0)
                total_touch += max(ae, ac)
                total_touch += _safe_int(me.get("imported_sources_count"), 0)
            if exec_section_count > 0 and total_touch == 0:
                logger.warning(
                    amka_log_line(
                        "ops.empty_run",
                        run_id=run_id,
                        execute_sections=exec_section_count,
                        applied_hint=0,
                    )
                )
            logger.info(
                amka_log_line(
                    "ops.execute_done",
                    run_id=run_id,
                    touch_score=total_touch,
                    exec_sections=exec_section_count,
                    phase="execute",
                    elapsed_ms=int((perf_counter() - exec_started) * 1000),
                )
            )
            await svc._update_run(
                run_id,
                status_value="completed",
                current_stage="done",
                progress=100,
                progress_message="AMKA: все этапы завершены.",
                completed_at=_now_utc(),
                error_payload={},
            )
            schedule_marketing_amka_auto_chain_background(
                svc._db_pool,
                prev_run_id=run_id,
                user_id=user_id,
            )
    except asyncio.CancelledError:
        logger.info(amka_log_line("execute.cancelled", run_id=run_id))
        raise
    except Exception as exc:
        logger.exception(
            amka_log_line(
                "execute.failed",
                run_id=run_id,
                err=str(exc)[:500],
                phase="execute",
                elapsed_ms=int((perf_counter() - exec_started) * 1000),
            )
        )
        if current_step_id is not None:
            await svc._update_step(
                UUID(current_step_id),
                status="failed",
                completed_at=_now_utc(),
                error_payload={"message": str(exc)},
            )
        await svc._update_run(
            run_id,
            status_value="failed",
            progress_message="AMKA: выполнение остановлено ошибкой. Можно возобновить запуск.",
            completed_at=_now_utc(),
            error_payload={"stage": "execution", "message": str(exc), "step_id": current_step_id},
        )
