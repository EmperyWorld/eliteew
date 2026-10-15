# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Owns the Marketing Cabinet AMKA run lifecycle: list/detail/create, approve/resume/cancel, and auto-cycle.
# It remains the production facade while standalone AMKA core boundaries are introduced.
# Invariants:
# - Run mutations must preserve existing approval gates and background task semantics.
# - Detail responses may add fields, but existing run/step payloads stay backward compatible.
# Related:
# - shared/api/services/marketing_cabinet/amka_service.py
# - shared/api/services/marketing_cabinet/amka_pulse.py
# - shared/api/services/marketing_cabinet/amka_standalone_projection.py
# - shared/api/services/marketing_cabinet/amka_driver_background_schedule.py
# - shared/api/services/marketing_cabinet/amka_background_tasks.py
# ---
"""AMKA run lifecycle: list/detail/create, approve/resume/cancel, plan apply, auto-cycle."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.common import get_accessible_project
from api.routers.marketing_cabinet.summary import build_project_health
from api.services.marketing_cabinet.amka_background_task_keys import (
    AMKA_BG_TASK_PREFIX_AUTO_CHAIN,
    amka_exec_task_key,
    amka_plan_task_key,
)
from api.services.marketing_cabinet.amka_background_tasks import AMKA_BACKGROUND_TASKS
from api.services.marketing_cabinet.amka_driver_background_schedule import (
    schedule_marketing_amka_execute_background,
    schedule_marketing_amka_plan_background,
)
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_preset_service import assert_preset_belongs_to_project
from api.services.marketing_cabinet.amka_pulse import build_marketing_amka_pulse
from api.services.marketing_cabinet.amka_service_support import (
    AMKA_ACTIONABLE_SECTIONS,
    _is_terminal,
    _json_dict,
    _json_list,
    _normalize_run_row,
    _now_utc,
    _safe_int,
    _should_poll,
    format_recent_amka_runs_digest_markdown,
)
from api.services.marketing_cabinet.amka_standalone_projection import (
    build_marketing_amka_standalone_projection,
)

logger = logging.getLogger(__name__)


def coerce_amka_skip_section_keys(raw: Any) -> set[str]:  # noqa: ANN401
    if not raw:
        return set()
    if not isinstance(raw, (list, tuple, set)):
        return set()
    allowed = set(AMKA_ACTIONABLE_SECTIONS)
    out: list[str] = []
    for item in list(raw)[:32]:
        sk = str(item).strip()
        if sk in allowed and sk not in out:
            out.append(sk)
    return set(out)


def coerce_amka_skip_operation_keys(raw: Any) -> set[str]:  # noqa: ANN401
    if not raw:
        return set()
    if not isinstance(raw, (list, tuple, set)):
        return set()
    out: list[str] = []
    for item in list(raw)[:64]:
        key = str(item).strip()
        if key and key not in out:
            out.append(key)
    return set(out)


def coerce_amka_skip_step_ids(raw: Any) -> set[UUID]:  # noqa: ANN401
    if not raw:
        return set()
    if not isinstance(raw, (list, tuple, set)):
        return set()
    out: set[UUID] = set()
    for item in list(raw)[:64]:
        try:
            out.add(UUID(str(item).strip()))
        except ValueError:
            continue
    return out


def filter_plan_tasks_operations(
    tasks: list[dict[str, Any]],
    skip_operation_keys: set[str],
) -> list[dict[str, Any]]:
    if not skip_operation_keys:
        return tasks
    filtered: list[dict[str, Any]] = []
    for task in tasks:
        t = dict(task)
        raw_ops = t.get("operations")
        if isinstance(raw_ops, list):
            t["operations"] = [
                dict(o)
                for o in raw_ops
                if isinstance(o, dict) and str(o.get("operation_key") or "").strip() not in skip_operation_keys
            ]
        filtered.append(t)
    return filtered


async def apply_skip_operation_keys(
    svc: Any,  # AmkaService
    *,
    run_id: UUID,
    user_id: UUID,
    skip_operation_keys: set[str],
) -> None:
    if not skip_operation_keys:
        return
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    mp_raw = _json_list(run.get("master_plan"))
    mp_tasks = [dict(t) for t in mp_raw if isinstance(t, dict)]
    new_mp = filter_plan_tasks_operations(mp_tasks, skip_operation_keys)
    steps = await svc._list_steps(run_id)
    async with svc._db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE marketing_amka_runs
            SET master_plan = $2::jsonb, updated_at = NOW()
            WHERE id = $1
            """,
            run_id,
            json.dumps(new_mp),
        )
        for step in steps:
            if step.get("stage_kind") != "execute_section" or step.get("status") != "pending":
                continue
            pp = _json_dict(step.get("plan_payload"))
            raw_ops = pp.get("operations")
            if not isinstance(raw_ops, list):
                continue
            pp["operations"] = [
                dict(o)
                for o in raw_ops
                if isinstance(o, dict) and str(o.get("operation_key") or "").strip() not in skip_operation_keys
            ]
            await conn.execute(
                """
                UPDATE marketing_amka_run_steps
                SET plan_payload = $2::jsonb, updated_at = NOW()
                WHERE id = $1
                """,
                UUID(step["id"]),
                json.dumps(pp),
            )


async def skip_execute_section_steps(
    svc: Any,  # AmkaService
    *,
    run_id: UUID,
    skip_section_keys: set[str],
    skip_step_ids: set[UUID] | None = None,
) -> None:
    sid_set = skip_step_ids or set()
    if not skip_section_keys and not sid_set:
        return
    steps = await svc._list_steps(run_id)
    now = _now_utc()
    for step in steps:
        if step["stage_kind"] != "execute_section":
            continue
        if step["status"] != "pending":
            continue
        sk = str(step.get("section_key") or "").strip()
        try:
            step_uuid = UUID(str(step["id"]))
        except ValueError:
            continue
        if step_uuid in sid_set or sk in skip_section_keys:
            await svc._update_step(
                step_uuid,
                status="skipped",
                completed_at=now,
                report_markdown="Этап пропущен по выбору оператора при подтверждении плана.",
                report_payload={
                    "skipped_before_execute": True,
                    "section_key": sk,
                    "step_id": str(step_uuid),
                },
                error_payload={},
            )


async def apply_plan_and_start_execute(
    svc: Any,  # AmkaService
    *,
    run_id: UUID,
    user_id: UUID,
    skip_section_keys: list[str] | None,
    skip_operation_keys: list[str] | None = None,
    skip_step_ids: list[str] | None = None,
) -> dict[str, Any]:
    skip_keys = coerce_amka_skip_section_keys(skip_section_keys)
    skip_ops = coerce_amka_skip_operation_keys(skip_operation_keys)
    skip_ids = coerce_amka_skip_step_ids(skip_step_ids)
    await skip_execute_section_steps(svc, run_id=run_id, skip_section_keys=skip_keys, skip_step_ids=skip_ids)
    await apply_skip_operation_keys(svc, run_id=run_id, user_id=user_id, skip_operation_keys=skip_ops)
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    updated = await svc._update_run(
        run_id,
        status_value="queued",
        current_stage="execute",
        progress=max(35, _safe_int(run.get("progress"), 35)),
        progress_message="AMKA: план подтверждён, начинаю выполнение шагов…",
        approved_at=_now_utc(),
        error_payload={},
    )
    schedule_marketing_amka_execute_background(
        svc._db_pool,
        run_id=run_id,
        user_id=user_id,
    )
    return {"ok": True, "run": updated, "poll_after_ms": 2000}


async def list_runs(
    svc: Any,  # AmkaService
    *,
    project_id: UUID,
    user_id: UUID,
    limit: int = 20,
) -> dict[str, Any]:
    await get_accessible_project(svc._db_pool, project_id, user_id, for_mutation=False)
    async with svc._db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_amka_runs
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $2
            """,
            project_id,
            max(1, min(int(limit), 100)),
        )
    items = [_normalize_run_row(row) for row in rows]
    digest_items = await svc._load_recent_amka_runs_digest(
        project_id=project_id,
        user_id=user_id,
        exclude_run_id=None,
        limit=3,
    )
    poll_after_ms = 4000 if any(_should_poll(item) for item in items) else 0
    return {
        "items": items,
        "total": len(items),
        "poll_after_ms": poll_after_ms,
        "recent_runs_digest": digest_items,
        "recent_runs_digest_markdown": format_recent_amka_runs_digest_markdown(digest_items),
    }


async def get_run_detail(svc: Any, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=False)
    steps = await svc._list_steps(run_id)
    pulse = build_marketing_amka_pulse(run, steps)
    standalone_projection = build_marketing_amka_standalone_projection(run, steps)
    overview_health_preview = await build_project_health(
        svc._db_pool,
        UUID(run["project_id"]),
        user_id,
    )
    return {
        "run": run,
        "steps": steps,
        "poll_after_ms": 4000 if _should_poll(run) else 0,
        "overview_health_preview": overview_health_preview,
        "pulse": pulse,
        "standalone_projection": standalone_projection,
    }


async def create_run(
    svc: Any,  # AmkaService
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    scope_key: str,
    user_instruction: str | None,
    section_keys: list[str] | None = None,
    imc_type_key: str | None = None,
    imc_focus: str | None = None,
    imc_max_wait_seconds: int | None = None,
    run_mode: str = "semi_auto",
    auto_cycle_total: int = 1,
    auto_cycle_index: int | None = None,
    auto_cycle_group_id: str | None = None,
    per_step_execution: bool = False,
    preset_id: UUID | None = None,
    use_web_search: bool = False,
    web_search_quality: str = "off",
) -> dict[str, Any]:
    await get_accessible_project(svc._db_pool, project_id, user_id, for_mutation=True, required_mc_module="amka")
    if preset_id is not None:
        ok = await assert_preset_belongs_to_project(
            svc._db_pool,
            preset_id=preset_id,
            project_id=project_id,
        )
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пресет не найден или не относится к этому проекту.",
            )
    ctx_payload: dict[str, Any] = {"user_instruction": user_instruction or ""}
    if section_keys:
        ctx_payload["section_keys"] = [str(k).strip() for k in section_keys if str(k).strip()]
    if imc_type_key and str(imc_type_key).strip():
        ctx_payload["imc_type_key"] = str(imc_type_key).strip()
    if imc_focus and str(imc_focus).strip():
        ctx_payload["imc_focus"] = str(imc_focus).strip().lower()
    if imc_max_wait_seconds is not None:
        ctx_payload["imc_max_wait_seconds"] = int(imc_max_wait_seconds)
    rm = str(run_mode or "semi_auto").strip()
    if rm not in ("auto", "semi_auto"):
        rm = "semi_auto"
    ctx_payload["run_mode"] = rm
    if rm == "auto":
        total = max(1, min(int(auto_cycle_total), 5))
        idx_default = 1 if auto_cycle_index is None else int(auto_cycle_index)
        idx = max(1, min(idx_default, total))
        group = str(auto_cycle_group_id).strip() if auto_cycle_group_id else ""
        if not group:
            group = str(uuid4())
        ctx_payload["auto_cycle_total"] = total
        ctx_payload["auto_cycle_index"] = idx
        ctx_payload["auto_cycle_group_id"] = group
    else:
        ctx_payload["auto_cycle_total"] = 1
        ctx_payload["auto_cycle_index"] = 1
    if per_step_execution:
        ctx_payload["per_step_execution"] = True
    if preset_id is not None:
        ctx_payload["preset_id"] = str(preset_id)
    from api.services.marketing_web_search_quality import normalize_web_search_quality, web_search_enabled

    ws_quality = normalize_web_search_quality(web_search_quality, use_web_search=use_web_search)
    if web_search_enabled(ws_quality):
        ctx_payload["use_web_search"] = True
        ctx_payload["web_search_quality"] = ws_quality
    async with svc._db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_amka_runs (
                project_id,
                company_id,
                created_by_user_id,
                scope_key,
                status,
                current_stage,
                progress,
                progress_message,
                master_plan,
                final_assessment,
                metrics_before,
                metrics_after,
                error_payload,
                context_payload,
                preset_id,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4,
                'planning',
                'audit',
                3,
                'AMKA: собираю состояние кабинета и материалы проекта…',
                '[]'::jsonb,
                '{}'::jsonb,
                '{}'::jsonb,
                '{}'::jsonb,
                '{}'::jsonb,
                $5::jsonb,
                $6,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            project_id,
            company_id,
            user_id,
            scope_key,
            json.dumps(ctx_payload),
            preset_id,
        )
    if row is None:
        raise RuntimeError("Failed to create AMKA run")
    run = _normalize_run_row(row)
    schedule_marketing_amka_plan_background(
        svc._db_pool,
        run_id=UUID(run["id"]),
        user_id=user_id,
    )
    return {"run": run, "poll_after_ms": 2000}


async def approve_run(
    svc: Any,  # AmkaService
    *,
    run_id: UUID,
    user_id: UUID,
    skip_section_keys: list[str] | None = None,
    skip_operation_keys: list[str] | None = None,
    skip_step_ids: list[str] | None = None,
) -> dict[str, Any]:
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    if run["status"] != "awaiting_approval":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Подтверждение доступно только после завершения этапа планирования AMKA",
        )
    return await apply_plan_and_start_execute(
        svc,
        run_id=run_id,
        user_id=user_id,
        skip_section_keys=skip_section_keys,
        skip_operation_keys=skip_operation_keys,
        skip_step_ids=skip_step_ids,
    )


async def continue_step_run(svc: Any, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    if run["status"] != "awaiting_step_approval":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Продолжение шага доступно только когда AMKA ждёт подтверждения следующего этапа",
        )
    updated = await svc._update_run(
        run_id,
        status_value="queued",
        current_stage="execute",
        progress_message="AMKA: продолжаю следующий этап…",
        error_payload={},
    )
    schedule_marketing_amka_execute_background(
        svc._db_pool,
        run_id=run_id,
        user_id=user_id,
    )
    return {"ok": True, "run": updated, "poll_after_ms": 2000}


async def resume_run(
    svc: Any,  # AmkaService
    *,
    run_id: UUID,
    user_id: UUID,
    skip_section_keys: list[str] | None = None,
    skip_operation_keys: list[str] | None = None,
    skip_step_ids: list[str] | None = None,
) -> dict[str, Any]:
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    status_s = str(run.get("status") or "").strip()
    if status_s == "awaiting_approval":
        return await approve_run(
            svc,
            run_id=run_id,
            user_id=user_id,
            skip_section_keys=skip_section_keys,
            skip_operation_keys=skip_operation_keys,
            skip_step_ids=skip_step_ids,
        )
    if status_s == "awaiting_step_approval":
        return await continue_step_run(svc, run_id=run_id, user_id=user_id)
    if status_s not in {"failed", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Повтор доступен только для failed/cancelled/awaiting_approval/awaiting_step_approval запусков AMKA",
        )
    await svc._reset_failed_or_running_steps(run_id)
    current_stage = "execute" if run.get("approved_at") else "audit"
    new_status = "queued" if run.get("approved_at") else "planning"
    updated = await svc._update_run(
        run_id,
        status_value=new_status,
        current_stage=current_stage,
        progress=max(5, _safe_int(run.get("progress"), 5)),
        progress_message=("AMKA: возобновляю выполнение…" if run.get("approved_at") else "AMKA: пересобираю план…"),
        error_payload={},
        clear_completed_at=True,
    )
    if run.get("approved_at"):
        schedule_marketing_amka_execute_background(
            svc._db_pool,
            run_id=run_id,
            user_id=user_id,
        )
    else:
        schedule_marketing_amka_plan_background(
            svc._db_pool,
            run_id=run_id,
            user_id=user_id,
        )
    return {"ok": True, "run": updated, "poll_after_ms": 2000}


async def cancel_run(svc: Any, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    if _is_terminal(run.get("status")):
        return {"ok": True, "run": run}
    updated = await svc._update_run(
        run_id,
        status_value="cancelled",
        progress_message="AMKA: запуск остановлен оператором.",
        completed_at=_now_utc(),
    )
    rid = str(run["id"])
    for key_fn in (amka_plan_task_key, amka_exec_task_key):
        task = AMKA_BACKGROUND_TASKS.get(key_fn(rid))
        if task is not None and not task.done():
            task.cancel()
    chain_prefix = f"{AMKA_BG_TASK_PREFIX_AUTO_CHAIN}{rid}:"
    for task_key, bgtask in list(AMKA_BACKGROUND_TASKS.items()):
        if str(task_key).startswith(chain_prefix) and bgtask is not None and not bgtask.done():
            bgtask.cancel()
    return {"ok": True, "run": updated}


async def maybe_start_next_auto_amka_cycle(
    svc: Any,  # AmkaService
    *,
    prev_run_id: UUID,
    user_id: UUID,
) -> None:
    ctx = _json_dict(await svc._fetch_run_value(prev_run_id, "context_payload"))
    if str(ctx.get("run_mode") or "").strip() != "auto":
        return
    total = max(1, min(_safe_int(ctx.get("auto_cycle_total"), 1), 5))
    index = max(1, _safe_int(ctx.get("auto_cycle_index"), 1))
    if index >= total:
        return
    prev = await svc._get_run_checked(run_id=prev_run_id, user_id=user_id, for_mutation=False)
    next_index = index + 1
    group = str(ctx.get("auto_cycle_group_id") or "").strip() or str(prev_run_id)
    sk_raw = ctx.get("section_keys")
    section_keys = [str(x).strip() for x in sk_raw if str(x).strip()] if isinstance(sk_raw, list) else None
    imc_focus_raw = ctx.get("imc_focus")
    imc_focus_s = str(imc_focus_raw).strip().lower() if imc_focus_raw else ""
    imc_focus = imc_focus_s if imc_focus_s in ("global", "rf", "mixed") else None
    imc_max_int: int | None
    try:
        imc_max_int = int(ctx["imc_max_wait_seconds"]) if ctx.get("imc_max_wait_seconds") is not None else None
    except (TypeError, ValueError):  # fmt: skip
        imc_max_int = None
    itk = str(ctx.get("imc_type_key") or "").strip()
    logger.info(
        amka_log_line(
            "auto_cycle.spawn",
            run_id=prev_run_id,
            next_index=next_index,
            total=total,
            group=group,
        )
    )
    await create_run(
        svc,
        project_id=UUID(prev["project_id"]),
        company_id=UUID(prev["company_id"]),
        user_id=user_id,
        scope_key=str(prev.get("scope_key") or "all_visible"),
        user_instruction=str(ctx.get("user_instruction") or "").strip() or None,
        section_keys=section_keys,
        imc_type_key=itk or None,
        imc_focus=imc_focus,
        imc_max_wait_seconds=imc_max_int,
        run_mode="auto",
        auto_cycle_total=total,
        auto_cycle_index=next_index,
        auto_cycle_group_id=group,
        use_web_search=ctx.get("use_web_search") is True,
        web_search_quality=str(ctx.get("web_search_quality") or "off"),
    )
