# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Map ``ewa_companion_task_steps.step_kind`` to Celery executor handlers (WF-1 generic loop).
# Invariants:
# - Side effects for tool steps delegate to ``tool_registry`` / existing pipeline helpers.
# - Unknown ``step_kind`` → ``dispatch_step`` returns False (executor marks run failed).
# - ``MUSIC_XL_BASE_STEP_KIND`` literal here (no import from ``companion_music_xl_base`` — avoids circular import with ``tool_registry``).
# - Presentation steps delegate to the EWRP companion adapter; EWRP itself remains the source of truth.
# - Worker auth: opaque token only; legacy Bearer in ``job_payload`` headers is hard-rejected at step execution.
# Related:
# - api/ewa_platform/companion/jobs/executor.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §7.1
# ---

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
from api.ewa_platform.companion.jobs.worker_auth_token import (
    WORKER_AUTH_AUDIENCE,
    bearer_token_from_headers,
    consume_worker_auth_token_sync,
)
from api.ewa_platform.companion.orchestration.run_lifecycle import assert_run_executable, log_run_skip
from api.ewa_platform.companion.workflows.dag.dag_state_store import DAG_NODE_STEP_KIND
from api.ewa_platform.persistence_pg.companion_asyncpg import companion_task_step_update

logger = logging.getLogger(__name__)

MUSIC_STEP_KIND = "music_generation_pipeline_v2"
MUSIC_XL_BASE_STEP_KIND = "music_generation_pipeline_xl_base"
IMAGE_STEP_KIND = "image_generation_pipeline"
PRESENTATION_STEP_KIND = "presentation_generation_pipeline"
TOOL_DISPATCH_STEP_KIND = "tool_dispatch"
CONFIRM_GATE_STEP_KIND = "confirm_gate"
_MUSIC_INTENT = "music_generation_background"
_IMAGE_INTENTS = frozenset({"image_generation_background", "image_edit_background"})
_PRESENTATION_INTENT = "presentation_generation_background"

StepHandlerFn = Callable[..., Awaitable[None]]


def known_step_kinds() -> frozenset[str]:
    return frozenset(_STEP_HANDLERS)


async def publish_executor_step_event(
    *,
    principal_id: str,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    status: str,
) -> None:
    """Best-effort ``task_step`` SSE when executor transitions a durable step."""

    run_id = str(run.get("id") or "").strip()
    if not run_id:
        return
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_step",
        payload={
            "run_id": run_id,
            "step_id": str(step.get("id") or ""),
            "step_index": int(step.get("step_index") or 0),
            "step_kind": str(step.get("step_kind") or ""),
            "status": str(status or "in_progress").strip()[:32] or "in_progress",
            "title": str(step.get("title") or "")[:240],
            "workflow_id": str(run.get("workflow_id") or "") or None,
            "workflow_version": run.get("workflow_version"),
        },
    )


def _step_tool_name_for_dispatch(
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> str:
    from api.ewa_platform.companion.orchestration.tool_registry import known_tool_names

    known = frozenset(known_tool_names())
    inp = step.get("input_payload")
    if isinstance(inp, Mapping):
        tool_name = str(inp.get("tool_name") or "").strip()
        if tool_name in known:
            return tool_name
    raw_job_tool = str(job_payload.get("tool_name") or "").strip()
    if raw_job_tool in known:
        return raw_job_tool
    step_kind = str(step.get("step_kind") or "").strip()
    if step_kind in known:
        return step_kind
    return ""


async def dispatch_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> bool:
    """Execute one step when a handler is registered; return False if unsupported."""

    step_kind = str(step.get("step_kind") or "").strip()
    handler = _STEP_HANDLERS.get(step_kind)
    if handler is None:
        if _step_tool_name_for_dispatch(step, job_payload):
            handler = execute_tool_dispatch_step
        else:
            return False
    await handler(pool, run=run, step=step, job_payload=job_payload)
    return True


def _resolve_music_headers_for_worker(
    *,
    run: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> dict[str, str]:
    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    if str(job_payload.get("worker_auth_error") or "").strip():
        msg = "companion_worker_auth_invalid"
        raise RuntimeError(msg)

    token_ref = str(job_payload.get("worker_auth_token") or "").strip()
    audience = str(job_payload.get("worker_auth_audience") or WORKER_AUTH_AUDIENCE).strip() or WORKER_AUTH_AUDIENCE
    if token_ref and principal_id:
        snapshot = consume_worker_auth_token_sync(
            token_ref=token_ref,
            run_id=run_id,
            principal_id=principal_id,
            audience=audience,
        )
        if snapshot is None:
            msg = "companion_worker_auth_invalid_or_expired"
            raise RuntimeError(msg)
        headers = {"Authorization": f"Bearer {snapshot.bearer_token}"}
        if isinstance(job_payload, dict):
            job_payload["headers"] = headers
            job_payload.pop("worker_auth_token", None)
            job_payload.pop("worker_auth_audience", None)
        logger.info(
            "[STEP] companion_worker_auth_resolved_for_step run_id=%s principal_id=%s audience=%s",
            run_id,
            principal_id,
            audience,
        )
        return headers

    headers_raw = job_payload.get("headers")
    headers = dict(headers_raw) if isinstance(headers_raw, Mapping) else {}
    bearer = bearer_token_from_headers(headers)
    if bearer:
        # ``companion_task_runner`` already consumed the opaque token and injected Bearer here.
        return headers
    return headers


async def execute_music_pipeline_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> None:
    from api.ewa_platform.companion.orchestration.tool_registry import (
        _resolve_music_job_base_url,
        _run_background_music_generation_job,
    )

    run_id = str(run.get("id") or "")
    step_id = str(step.get("id") or "")
    principal_id = str(run.get("principal_id") or "")
    intent_kind = str(run.get("intent_kind") or "").strip()
    if intent_kind not in (_MUSIC_INTENT, "music_generation_xl_base_background"):
        logger.warning(
            "[STEP] music_pipeline_step_intent_mismatch run_id=%s intent=%s",
            run_id,
            intent_kind,
        )

    headers = _resolve_music_headers_for_worker(run=run, job_payload=job_payload)

    await _run_background_music_generation_job(
        companion_pool=pool,
        principal_id=principal_id,
        run_id=run_id,
        step_id=step_id,
        catalog_user_id=str(job_payload.get("catalog_user_id") or run.get("principal_id") or principal_id or ""),
        base_url=_resolve_music_job_base_url(job_payload),
        headers=headers,
        style_key=str(job_payload.get("style_key") or job_payload.get("style") or "pop"),
        vocal_eff=str(job_payload.get("vocal_eff") or job_payload.get("vocal") or "female"),
        language_e=str(job_payload.get("language_e") or job_payload.get("language") or "ru"),
        ugs_wf=str(job_payload.get("ugs_wf") or "v2"),
        theme=str(job_payload.get("theme") or job_payload.get("theme_preview") or ""),
        lyrics_arg=str(job_payload.get("lyrics_arg") or ""),
        voice_diversity=str(job_payload.get("voice_diversity") or "balanced"),
        luna_mode=job_payload.get("luna_mode"),
        bpm_override=job_payload.get("bpm_override"),
        duration_override=job_payload.get("duration_override"),
        name_arg=str(job_payload.get("name_arg") or ""),
        explicit_tags=str(job_payload.get("explicit_tags") or ""),
        skip_lyrics_validation=bool(job_payload.get("skip_lyrics_validation")),
        autoplay_requested=bool(job_payload.get("autoplay_requested")),
        billing_mode=str(job_payload.get("billing_mode") or "wizard"),
        ksampler_use_comfy_template=bool(job_payload.get("ksampler_use_comfy_template")),
        ewa_companion_context=str(job_payload.get("ewa_companion_context") or ""),
    )


async def execute_image_pipeline_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> None:
    from api.ewa_platform.companion.orchestration.companion_image_generation import (
        run_companion_image_generation_job,
    )

    run_id = str(run.get("id") or "")
    step_id = str(step.get("id") or "")
    principal_id = str(run.get("principal_id") or "")
    intent_kind = str(run.get("intent_kind") or "").strip()
    if intent_kind not in _IMAGE_INTENTS:
        logger.warning(
            "[STEP] image_pipeline_step_intent_mismatch run_id=%s intent=%s",
            run_id,
            intent_kind,
        )

    await run_companion_image_generation_job(
        companion_pool=pool,
        principal_id=principal_id,
        run_id=run_id,
        step_id=step_id,
        catalog_user_id=str(job_payload.get("catalog_user_id") or ""),
        prompt=str(job_payload.get("prompt") or job_payload.get("prompt_preview") or ""),
        aspect_ratio=str(job_payload.get("aspect_ratio") or "1:1"),
        operation_mode=str(job_payload.get("operation_mode") or "generate"),
        source_content_id=str(job_payload.get("source_content_id") or "") or None,
        negative_prompt=str(job_payload.get("negative_prompt") or ""),
    )


async def execute_presentation_pipeline_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> None:
    from api.ewa_platform.companion.orchestration.companion_presentation_generation import (
        resolve_presentation_job_base_url,
        run_companion_presentation_generation_job,
    )

    run_id = str(run.get("id") or "")
    step_id = str(step.get("id") or "")
    principal_id = str(run.get("principal_id") or "")
    intent_kind = str(run.get("intent_kind") or "").strip()
    if intent_kind != _PRESENTATION_INTENT:
        logger.warning(
            "[STEP] presentation_pipeline_step_intent_mismatch run_id=%s intent=%s",
            run_id,
            intent_kind,
        )

    headers = _resolve_music_headers_for_worker(run=run, job_payload=job_payload)
    await run_companion_presentation_generation_job(
        companion_pool=pool,
        principal_id=principal_id,
        run_id=run_id,
        step_id=step_id,
        catalog_user_id=str(job_payload.get("catalog_user_id") or run.get("principal_id") or principal_id or ""),
        base_url=resolve_presentation_job_base_url(job_payload),
        headers=headers,
        topic=str(job_payload.get("topic") or ""),
        title=str(job_payload.get("title") or "Презентация"),
        num_slides=int(job_payload.get("num_slides") or 7),
        extra_context=str(job_payload.get("extra_context") or ""),
        presentation_theme=str(job_payload.get("presentation_theme") or "aurora"),
        default_slide_layout=str(job_payload.get("default_slide_layout") or ""),
        web_search_quality=str(job_payload.get("web_search_quality") or "off"),
    )


_BLOCKED_TOOL_DISPATCH_TOOLS = frozenset({"image_tool"})


def _sanitize_tool_dispatch_args(
    *,
    tool_name: str,
    args: Mapping[str, Any],
) -> dict[str, Any]:
    from api.ewa_platform.companion.orchestration.tool_registry import tool_descriptor

    descriptor = tool_descriptor(tool_name)
    if descriptor is None:
        return {}
    allowed = set(descriptor.input_keys)
    allowed.update(
        {
            "user_line",
            "_workflow_parent_run_id",
            "_workflow_parent_step_index",
            "_tool_router_bypass_line_match",
        }
    )
    out: dict[str, Any] = {}
    for key, value in args.items():
        if key not in allowed or value is None:
            continue
        if isinstance(value, str):
            text = value.strip()
            if not text:
                continue
            out[key] = text
            continue
        if isinstance(value, bool | int | float):
            out[key] = value
            continue
        if isinstance(value, list):
            clean = [v for v in value if isinstance(v, str) and v.strip()]
            if clean:
                out[key] = clean[:32]
            continue
        if isinstance(value, Mapping):
            out[key] = dict(value)
    return out


async def execute_tool_dispatch_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> None:
    """Safe generic tool dispatch for workflow executor steps."""

    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run
    from api.ewa_platform.companion.orchestration.tool_registry import (
        ToolContext,
        dispatch_tool_by_name,
    )
    from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import (
        USER_WORKFLOW_ALLOWED_TOOLS,
        sanitize_user_workflow_args,
    )
    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    step_id = str(step.get("id") or "").strip()
    step_index = int(step.get("step_index") or 0)
    step_input = step.get("input_payload")
    inp = dict(step_input) if isinstance(step_input, Mapping) else {}
    tool_name = _step_tool_name_for_dispatch(step, job_payload)
    if not tool_name or tool_name in _BLOCKED_TOOL_DISPATCH_TOOLS:
        msg = f"workflow_tool_dispatch_blocked:{tool_name or 'unknown'}"
        raise RuntimeError(msg)

    headers_raw = job_payload.get("headers")
    headers = dict(headers_raw) if isinstance(headers_raw, Mapping) else {}
    bearer = bearer_token_from_headers(headers)
    user_line = str(job_payload.get("user_line") or run.get("user_message") or "").strip()
    plan_payload = run.get("plan_payload")
    plan = dict(plan_payload) if isinstance(plan_payload, Mapping) else {}
    content_catalog_user_id = (
        str(
            job_payload.get("content_catalog_user_id")
            or job_payload.get("catalog_user_id")
            or plan.get("content_catalog_user_id")
            or principal_id
        ).strip()
        or principal_id
    )

    template: dict[str, Any] = {}
    for source in (inp.get("args_template"), inp.get("args"), job_payload.get("tool_args")):
        if isinstance(source, Mapping):
            template.update(dict(source))
    from api.ewa_platform.companion.workflows.action.context import (
        WorkflowRunContext,
        resolve_args_template,
    )

    steps_list = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    wf_ctx = WorkflowRunContext(
        user_line=user_line,
        principal_id=principal_id,
        steps=tuple(steps_list),
    )
    raw_args = resolve_args_template(template, wf_ctx)
    raw_args.setdefault("user_line", user_line)
    raw_args["_workflow_parent_run_id"] = run_id
    raw_args["_workflow_parent_step_index"] = step_index
    raw_args = _sanitize_tool_dispatch_args(tool_name=tool_name, args=raw_args)

    if tool_name in USER_WORKFLOW_ALLOWED_TOOLS:
        reserved = {
            k: raw_args[k]
            for k in ("user_line", "_workflow_parent_run_id", "_workflow_parent_step_index")
            if k in raw_args
        }
        user_args = sanitize_user_workflow_args(
            tool_name,
            {k: v for k, v in raw_args.items() if k not in reserved},
        )
        raw_args = {**user_args, **reserved}

    raw_args["_tool_router_bypass_line_match"] = True

    shell_norm_raw = job_payload.get("shell_norm")
    tool_ctx = ToolContext(
        principal_id=principal_id,
        user_line=user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=None,
        main_pool=pool,
        companion_pool=pool,
        shell_norm=dict(shell_norm_raw) if isinstance(shell_norm_raw, Mapping) else None,
        bearer_token=bearer,
        auth_user=None,
    )
    result = await dispatch_tool_by_name(tool_name, raw_args, tool_ctx)
    if result is None:
        raise RuntimeError(f"workflow_tool_unhandled:{tool_name}")

    status = str(result.get("status") or "").strip().lower() or "ok"
    data_raw = result.get("data")
    data_dict = dict(data_raw) if isinstance(data_raw, Mapping) else {}
    task_run_raw = result.get("task_run")
    task_run_dict = dict(task_run_raw) if isinstance(task_run_raw, Mapping) else {}
    reply = str(result.get("reply") or "").strip()
    output_payload = {
        "tool_name": tool_name,
        "status": status,
        "reply": reply,
        "data": data_dict,
        "task_run_id": str(task_run_dict.get("id") or ""),
    }

    if status in {"error", "failed", "unavailable"}:
        raise RuntimeError(str(result.get("reply") or f"workflow_tool_failed:{tool_name}"))

    if status == "needs_confirm":
        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="awaiting_confirmation",
            output_payload=output_payload,
        )
        await publish_executor_step_event(
            principal_id=principal_id,
            run=run,
            step=step,
            status="awaiting_confirmation",
        )
        await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            status="awaiting_confirmation",
            confirmation_state={"step_index": step_index, "step_key": str(inp.get("step_key") or "")},
        )
        return

    await companion_task_step_update(
        pool,
        step_id=step_id,
        status="completed",
        output_payload=output_payload,
    )
    await publish_executor_step_event(
        principal_id=principal_id,
        run=run,
        step=step,
        status="completed",
    )

    if status == "accepted":
        await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            status="running",
            result_payload=output_payload,
        )
        return

    steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    next_indexes = sorted(
        int(row.get("step_index") or 0)
        for row in steps
        if int(row.get("step_index") or 0) > step_index and str(row.get("status") or "").strip().lower() == "pending"
    )
    if next_indexes:
        celery_id = enqueue_companion_run(
            run_id=run_id,
            step_index=next_indexes[0],
            job_payload={
                "user_line": user_line,
                "content_catalog_user_id": content_catalog_user_id,
            },
        )
        if celery_id is None:
            raise RuntimeError("workflow_next_step_enqueue_failed")
        return

    await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="completed",
        result_payload=output_payload,
        error_payload={},
    )


async def mark_step_in_progress(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
) -> None:
    step_id = str(step.get("id") or "").strip()
    run_id = str(run.get("id") or "").strip()
    if not step_id:
        return
    executable, skip_reason = assert_run_executable(run)
    if not executable:
        log_run_skip(
            run_id=run_id,
            principal_id=principal_id,
            reason=str(skip_reason or "not_executable"),
            context="mark_step_in_progress",
        )
        return
    await companion_task_step_update(pool, step_id=step_id, status="in_progress")
    await publish_executor_step_event(
        principal_id=principal_id,
        run=run,
        step=step,
        status="in_progress",
    )


async def execute_confirm_gate_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> None:
    """Pause workflow at confirm gate; resume via ``task_run_confirm`` generic handler."""

    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    step_id = str(step.get("id") or "").strip()
    step_index = int(step.get("step_index") or 0)
    if not run_id or not step_id:
        msg = "confirm_gate_missing_ids"
        raise RuntimeError(msg)

    inp = step.get("input_payload")
    input_payload = dict(inp) if isinstance(inp, Mapping) else {}
    step_key = str(input_payload.get("step_key") or "").strip()
    workflow_id = str(run.get("workflow_id") or "").strip()

    await companion_task_step_update(
        pool,
        step_id=step_id,
        status="awaiting_confirmation",
        output_payload={"step_key": step_key, "kind": "confirm_gate"},
    )
    await publish_executor_step_event(
        principal_id=principal_id,
        run=run,
        step=step,
        status="awaiting_confirmation",
    )
    existing_plan = run.get("plan_payload")
    merged_plan: dict[str, Any] = dict(existing_plan) if isinstance(existing_plan, Mapping) else {}
    if str(merged_plan.get("kind") or "") != "action_workflow":
        merged_plan["kind"] = "action_workflow"
    if workflow_id:
        merged_plan["workflow_id"] = workflow_id

    await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="awaiting_confirmation",
        confirmation_state={
            "step_index": step_index,
            "step_key": step_key,
            "workflow_id": workflow_id,
            "kind": "workflow_confirm_gate",
        },
        plan_payload=merged_plan,
    )
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_awaiting_confirmation",
        payload={
            "run_id": run_id,
            "status": "awaiting_confirmation",
            "intent_kind": str(run.get("intent_kind") or "action_workflow"),
            "workflow_id": workflow_id or None,
            "plan_kind": "workflow_confirm_gate",
            "step_index": step_index,
        },
    )
    logger.info(
        "[STEP] workflow_confirm_gate_paused run_id=%s workflow_id=%s step_index=%s",
        run_id,
        workflow_id,
        step_index,
    )


async def execute_dag_node_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> None:
    from api.ewa_platform.companion.workflows.dag.dag_node_executor import execute_dag_node_step as _execute

    await _execute(pool, run=run, step=step, job_payload=job_payload)


_STEP_HANDLERS: dict[str, StepHandlerFn] = {
    MUSIC_STEP_KIND: execute_music_pipeline_step,
    MUSIC_XL_BASE_STEP_KIND: execute_music_pipeline_step,
    IMAGE_STEP_KIND: execute_image_pipeline_step,
    PRESENTATION_STEP_KIND: execute_presentation_pipeline_step,
    TOOL_DISPATCH_STEP_KIND: execute_tool_dispatch_step,
    CONFIRM_GATE_STEP_KIND: execute_confirm_gate_step,
    DAG_NODE_STEP_KIND: execute_dag_node_step,
}


__all__ = (
    "IMAGE_STEP_KIND",
    "MUSIC_STEP_KIND",
    "MUSIC_XL_BASE_STEP_KIND",
    "PRESENTATION_STEP_KIND",
    "TOOL_DISPATCH_STEP_KIND",
    "CONFIRM_GATE_STEP_KIND",
    "DAG_NODE_STEP_KIND",
    "dispatch_step",
    "execute_confirm_gate_step",
    "execute_dag_node_step",
    "execute_image_pipeline_step",
    "execute_music_pipeline_step",
    "execute_presentation_pipeline_step",
    "execute_tool_dispatch_step",
    "known_step_kinds",
    "mark_step_in_progress",
    "publish_executor_step_event",
)
