# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AMKA plan phase: background planning, master plan LLM/heuristic; auto-run execute scheduling via marketing driver.
# Invariants:
# - Plan mutations follow existing master_plan and step persistence contracts.
# - Background execute after auto-approved plan uses `schedule_marketing_amka_execute_background` (task key `amka-exec:`).
# Related:
# - shared/api/services/marketing_cabinet/amka_service.py
# - shared/api/services/marketing_cabinet/amka_driver_background_schedule.py
# ---
"""AMKA plan phase: background planning, master plan LLM/heuristic."""

from __future__ import annotations

import asyncio
import logging
from time import perf_counter
from typing import Any
from uuid import UUID, uuid4

from api.services.marketing_cabinet.amka_driver_background_schedule import (
    schedule_marketing_amka_execute_background,
)
from api.services.marketing_cabinet.amka_llm_plan import run_llm_plan_with_meta
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_plan_import_sanitize import (
    sanitize_amka_plan_import_analysis_operations,
)
from api.services.marketing_cabinet.amka_preset_merge import merge_preset_tasks_into_plan_tasks
from api.services.marketing_cabinet.amka_preset_service import fetch_preset_config_for_planning
from api.services.marketing_cabinet.amka_service_support import (
    _json_dict,
    _now_utc,
    _sanitize_amka_imc_plan_tasks,
)

logger = logging.getLogger(__name__)


def _ensure_plan_task_uids(tasks: list[dict[str, Any]]) -> None:
    for t in tasks:
        raw = str(t.get("plan_task_uid") or "").strip()
        valid = False
        if raw:
            try:
                UUID(raw)
                valid = True
            except ValueError:
                valid = False
        if not valid:
            t["plan_task_uid"] = str(uuid4())


def _audit_fallback_count(snapshot: dict[str, Any]) -> int:
    stats = dict(snapshot.get("audit_llm_stats") or {})
    return int(stats.get("fallback") or 0)


async def build_master_plan(svc, *, snapshot: dict[str, Any], audit_steps: list[dict[str, Any]]) -> dict[str, Any]:
    candidate_tasks = svc._build_candidate_tasks(audit_steps, snapshot)
    fallback_summary = svc._render_master_plan_markdown(candidate_tasks)
    if not candidate_tasks:
        return {
            "tasks": [],
            "summary_markdown": fallback_summary,
            "summary_text": "AMKA не нашёл обязательных шагов.",
            "plan_source": "heuristic",
            "plan_llm_status": "not_applicable",
            "plan_llm_parse_reason": None,
            "plan_llm_response_chars": 0,
            "plan_llm_retried": False,
            "plan_used_llm_tasks": False,
            "plan_llm_build_ms": 0,
            "normalize_plan_ms": 0,
            "plan_llm_repair_attempted": False,
            "plan_llm_repaired": False,
            "plan_structure_errors": [],
        }
    mp_op = dict((snapshot.get("operator_amka") or {}).get("master_plan") or {})
    if mp_op.get("llm_enabled") is False:
        normalized_tasks = _sanitize_amka_imc_plan_tasks(candidate_tasks)
        _ensure_plan_task_uids(normalized_tasks)
        summary_text = "План собран без LLM (настройка оператора)."
        summary_markdown = svc._render_master_plan_markdown(normalized_tasks, summary_text=summary_text)
        return {
            "tasks": normalized_tasks,
            "summary_markdown": summary_markdown,
            "summary_text": summary_text,
            "plan_source": "heuristic",
            "plan_llm_status": "disabled",
            "plan_llm_parse_reason": None,
            "plan_llm_response_chars": 0,
            "plan_llm_retried": False,
            "plan_used_llm_tasks": False,
            "plan_llm_build_ms": 0,
            "normalize_plan_ms": 0,
            "plan_llm_repair_attempted": False,
            "plan_llm_repaired": False,
            "plan_structure_errors": [],
        }
    t_llm = perf_counter()
    llm_payload, llm_meta = await run_llm_plan_with_meta(
        snapshot=snapshot,
        audit_steps=audit_steps,
        candidate_tasks=candidate_tasks,
    )
    plan_llm_build_ms = int((perf_counter() - t_llm) * 1000)
    raw_llm_tasks = llm_payload.get("tasks") if isinstance(llm_payload, dict) else None
    had_llm_task_list = isinstance(raw_llm_tasks, list) and len(raw_llm_tasks) > 0
    plan_source = "llm" if had_llm_task_list else "heuristic"
    t_norm = perf_counter()
    normalized_from_llm = svc._normalize_plan_tasks(
        raw_llm_tasks,
        candidate_tasks,
        health=dict(snapshot.get("health") or {}),
    )
    normalize_plan_ms = int((perf_counter() - t_norm) * 1000)
    normalize_fallback = False
    if not normalized_from_llm:
        normalized_tasks = candidate_tasks
        if had_llm_task_list:
            plan_source = "heuristic"
            normalize_fallback = True
    else:
        normalized_tasks = normalized_from_llm
    plan_used_llm_tasks = bool(normalized_from_llm)
    prior_parse_reason = llm_meta.get("parse_reason")
    prior_llm_status = str(llm_meta.get("plan_llm_status") or "empty")
    plan_llm_status = prior_llm_status
    if normalize_fallback:
        plan_llm_status = "heuristic_fallback"
        logger.info(
            amka_log_line(
                "plan.normalize_fallback",
                run_id=snapshot["run"]["id"],
                prior_plan_llm_status=prior_llm_status,
                prior_parse_reason=str(prior_parse_reason or ""),
                plan_source=plan_source,
            )
        )
    normalized_tasks = _sanitize_amka_imc_plan_tasks(normalized_tasks)
    _ensure_plan_task_uids(normalized_tasks)
    summary_text = (
        str(llm_payload.get("plan_summary") or "").strip() if isinstance(llm_payload, dict) else ""
    ) or "AMKA собрал цепочку mutate-операций по разделам кабинета."
    summary_markdown = svc._render_master_plan_markdown(normalized_tasks, summary_text=summary_text)
    struct_err = llm_meta.get("structure_errors")
    plan_structure_errors = [str(x) for x in struct_err] if isinstance(struct_err, list) else []
    return {
        "tasks": normalized_tasks,
        "summary_markdown": summary_markdown,
        "summary_text": summary_text,
        "plan_source": plan_source,
        "plan_llm_status": plan_llm_status,
        "plan_llm_parse_reason": llm_meta.get("parse_reason"),
        "plan_llm_response_chars": int(llm_meta.get("response_chars") or 0),
        "plan_llm_retried": bool(llm_meta.get("retried")),
        "plan_used_llm_tasks": plan_used_llm_tasks,
        "plan_llm_build_ms": plan_llm_build_ms,
        "normalize_plan_ms": normalize_plan_ms,
        "plan_llm_repair_attempted": bool(llm_meta.get("repair_attempted")),
        "plan_llm_repaired": bool(llm_meta.get("repaired")),
        "plan_structure_errors": plan_structure_errors[:8],
    }


async def run_plan_background(svc, *, run_id: UUID, user_id: UUID) -> None:
    plan_started = perf_counter()
    snapshot_build_ms = 0
    audit_phase_ms = 0
    master_plan_ms = 0
    persist_steps_ms = 0
    try:
        t_snap = perf_counter()
        await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
        snapshot = await svc._build_run_snapshot(run_id=run_id, user_id=user_id)
        snapshot_build_ms = int((perf_counter() - t_snap) * 1000)
        t_audit = perf_counter()
        audit_steps = await svc._build_section_audits(snapshot)
        audit_phase_ms = int((perf_counter() - t_audit) * 1000)
        metrics_before = dict(snapshot["health"])
        await svc._replace_steps(
            run_id,
            [
                {
                    "ordinal": index + 1,
                    "stage_kind": "section_audit",
                    "section_key": step["section_key"],
                    "title": step["title"],
                    "status": "completed",
                    "plan_payload": {},
                    "report_markdown": step["report_markdown"],
                    "report_payload": step["report_payload"],
                    "applied_entities": [],
                    "metrics_before": step["metrics_before"],
                    "metrics_after": step["metrics_after"],
                    "error_payload": {},
                }
                for index, step in enumerate(audit_steps)
            ],
        )
        t_master = perf_counter()
        master_plan = await build_master_plan(svc, snapshot=snapshot, audit_steps=audit_steps)
        master_plan_ms = int((perf_counter() - t_master) * 1000)
        t_persist = perf_counter()
        run_row = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
        pid_raw = run_row.get("preset_id")
        if not pid_raw:
            ctx0 = _json_dict(await svc._fetch_run_value(run_id, "context_payload"))
            pid_raw = ctx0.get("preset_id")
        preset_cfg = None
        if pid_raw:
            try:
                puuid = UUID(str(pid_raw).strip())
                preset_cfg = await fetch_preset_config_for_planning(
                    svc._db_pool,
                    preset_id=puuid,
                    project_id=UUID(str(run_row["project_id"])),
                )
            except Exception:
                logger.exception(amka_log_line("plan.preset_load_failed", run_id=run_id, preset_id=pid_raw))
                raise
        if preset_cfg is not None:
            merged_tasks = merge_preset_tasks_into_plan_tasks(
                list(master_plan["tasks"]),
                preset_cfg,
            )
            master_plan = {**master_plan, "tasks": merged_tasks}
        _ensure_plan_task_uids(list(master_plan["tasks"]))
        master_plan["tasks"] = await sanitize_amka_plan_import_analysis_operations(
            svc._db_pool,
            tasks=list(master_plan["tasks"]),
            project_id=UUID(str(run_row["project_id"])),
            run_id=run_id,
        )
        current_steps = await svc._list_steps(run_id)
        ordinal = len(current_steps) + 1
        await svc._insert_step(
            run_id=run_id,
            ordinal=ordinal,
            stage_kind="master_plan",
            section_key=None,
            title="Сводный план AMKA",
            status="completed",
            plan_payload={"tasks": master_plan["tasks"]},
            report_markdown=master_plan["summary_markdown"],
            report_payload={
                "tasks": master_plan["tasks"],
                "plan_source": master_plan.get("plan_source"),
                "plan_llm_status": master_plan.get("plan_llm_status"),
                "plan_llm_parse_reason": master_plan.get("plan_llm_parse_reason"),
                "plan_used_llm_tasks": master_plan.get("plan_used_llm_tasks"),
                "plan_llm_build_ms": master_plan.get("plan_llm_build_ms"),
                "normalize_plan_ms": master_plan.get("normalize_plan_ms"),
                "plan_llm_repair_attempted": master_plan.get("plan_llm_repair_attempted"),
                "plan_llm_repaired": master_plan.get("plan_llm_repaired"),
                "plan_structure_errors": master_plan.get("plan_structure_errors"),
            },
            applied_entities=[],
            metrics_before={},
            metrics_after={
                "plan_llm_status": master_plan.get("plan_llm_status"),
                "plan_llm_retried": master_plan.get("plan_llm_retried"),
                "plan_llm_response_chars": master_plan.get("plan_llm_response_chars"),
                "plan_used_llm_tasks": master_plan.get("plan_used_llm_tasks"),
                "plan_llm_build_ms": master_plan.get("plan_llm_build_ms"),
                "normalize_plan_ms": master_plan.get("normalize_plan_ms"),
                "plan_llm_repaired": master_plan.get("plan_llm_repaired"),
            },
            error_payload={},
        )
        ordinal += 1
        for task in master_plan["tasks"]:
            await svc._insert_step(
                run_id=run_id,
                ordinal=ordinal,
                stage_kind="execute_section",
                section_key=task["section_key"],
                title=task["title"],
                status="pending",
                plan_payload=task,
                report_markdown=None,
                report_payload={},
                applied_entities=[],
                metrics_before={},
                metrics_after={},
                error_payload={},
            )
            ordinal += 1
        await svc._insert_step(
            run_id=run_id,
            ordinal=ordinal,
            stage_kind="final_assessment",
            section_key=None,
            title="Финальная переоценка AMKA",
            status="pending",
            plan_payload={},
            report_markdown=None,
            report_payload={},
            applied_entities=[],
            metrics_before={},
            metrics_after={},
            error_payload={},
        )
        persist_steps_ms = int((perf_counter() - t_persist) * 1000)
        plan_ctx_payload = {
            "user_instruction": snapshot["user_instruction"],
            "project_context_text": snapshot["project_context_text"],
            "section_audits": [step["report_payload"] for step in audit_steps],
            "plan_source": master_plan.get("plan_source"),
            "audit_llm_stats": dict(snapshot.get("audit_llm_stats") or {}),
            "plan_llm_status": master_plan.get("plan_llm_status"),
            "plan_llm_parse_reason": master_plan.get("plan_llm_parse_reason"),
            "plan_llm_response_chars": master_plan.get("plan_llm_response_chars"),
            "plan_llm_retried": master_plan.get("plan_llm_retried"),
            "plan_used_llm_tasks": master_plan.get("plan_used_llm_tasks"),
            "plan_llm_build_ms": master_plan.get("plan_llm_build_ms"),
            "normalize_plan_ms": master_plan.get("normalize_plan_ms"),
            "plan_llm_repair_attempted": master_plan.get("plan_llm_repair_attempted"),
            "plan_llm_repaired": master_plan.get("plan_llm_repaired"),
            "plan_structure_errors": master_plan.get("plan_structure_errors"),
        }
        existing_ctx = _json_dict(await svc._fetch_run_value(run_id, "context_payload"))
        run_mode = str(existing_ctx.get("run_mode") or "semi_auto").strip()
        if run_mode == "auto":
            await svc._update_run(
                run_id,
                status_value="queued",
                current_stage="execute",
                progress=35,
                progress_message="AMKA: план принят автоматически, начинаю выполнение шагов…",
                master_plan=master_plan["tasks"],
                master_plan_summary=master_plan["summary_text"],
                metrics_before=metrics_before,
                context_payload=plan_ctx_payload,
                error_payload={},
                approved_at=_now_utc(),
            )
            await svc._skip_execute_section_steps(run_id=run_id, skip_section_keys=set())
            schedule_marketing_amka_execute_background(
                svc._db_pool,
                run_id=run_id,
                user_id=user_id,
            )
        else:
            await svc._update_run(
                run_id,
                status_value="awaiting_approval",
                current_stage="approval",
                progress=30,
                progress_message="AMKA: план готов. Проверьте шаги и подтвердите запуск.",
                master_plan=master_plan["tasks"],
                master_plan_summary=master_plan["summary_text"],
                metrics_before=metrics_before,
                context_payload=plan_ctx_payload,
                error_payload={},
            )
        logger.info(
            amka_log_line(
                "ops.planning_done",
                run_id=run_id,
                audit_sections=len(audit_steps),
                plan_source=master_plan.get("plan_source"),
                tasks=len(master_plan["tasks"]),
                run_mode=run_mode,
                phase="plan",
                elapsed_ms=int((perf_counter() - plan_started) * 1000),
                audit_llm_fallback=_audit_fallback_count(snapshot),
                snapshot_build_ms=snapshot_build_ms,
                audit_phase_ms=audit_phase_ms,
                master_plan_ms=master_plan_ms,
                persist_steps_ms=persist_steps_ms,
                plan_llm_status=master_plan.get("plan_llm_status"),
                plan_used_llm_tasks=master_plan.get("plan_used_llm_tasks"),
                master_plan_llm_ms=master_plan.get("plan_llm_build_ms"),
                normalize_plan_ms=master_plan.get("normalize_plan_ms"),
                plan_llm_repaired=master_plan.get("plan_llm_repaired"),
            )
        )
    except asyncio.CancelledError:
        logger.info(
            amka_log_line(
                "plan.cancelled",
                run_id=run_id,
                phase="plan",
                elapsed_ms=int((perf_counter() - plan_started) * 1000),
            )
        )
        raise
    except Exception as exc:
        logger.exception(
            amka_log_line(
                "plan.failed",
                run_id=run_id,
                err=str(exc)[:500],
                phase="plan",
                elapsed_ms=int((perf_counter() - plan_started) * 1000),
            )
        )
        await svc._update_run(
            run_id,
            status_value="failed",
            progress_message="AMKA: не удалось собрать план. Проверьте детали запуска.",
            completed_at=_now_utc(),
            error_payload={"stage": "planning", "message": str(exc)},
        )
