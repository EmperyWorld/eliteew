# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Advance declarative user/catalog workflows after a tool step completes (multi-step chains).
# Invariants:
# - Pilot builtins ``music_full_cycle_v1`` / ``doc_package_v1`` keep dedicated advance paths.
# - Child async tool runs link back via ``plan_payload.workflow_parent_*`` keys.
# - Async advance restores bearer from Redis ``workflow_auth_cache`` (not plan_payload).
# - Orphan child runs (missing parent link) reconcile against active user ``action_workflow`` steps.
# - Step dispatch is idempotent: completed steps and completed parent runs are not failed by duplicate advance/reconcile.
# Related:
# - api/ewa_platform/companion/workflows/user/generic_workflow_starter.py
# - api/ewa_platform/companion/orchestration/companion_image_generation.py
# ---

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from dataclasses import replace
from typing import Any

import asyncpg
from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
from api.ewa_platform.companion.orchestration.tool_registry import (
    ToolContext,
    ToolResult,
    dispatch_tool_by_name,
)
from api.ewa_platform.companion.orchestration.tool_result_utils import (
    as_mapping_dict,
    tool_result_as_mapping,
    tool_result_is_background,
    tool_result_is_workflow_step_success,
)
from api.ewa_platform.companion.workflows.action.context import build_declarative_tool_dispatch_args
from api.ewa_platform.companion.workflows.action.registry import get_builtin_workflow
from api.ewa_platform.companion.workflows.action.schema import CompanionWorkflowDefinitionV1, CompanionWorkflowStepV1
from api.ewa_platform.companion.workflows.user.workflow_auth_cache import (
    delete_workflow_auth_snapshot_sync,
    load_workflow_auth_snapshot_sync,
    workflow_auth_user,
)
from api.ewa_platform.companion.workflows.user.workflow_parent_link import (
    inject_workflow_parent_args,
    merge_workflow_parent_plan,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg import companion_user_workflows_asyncpg as user_wf_pg

logger = logging.getLogger(__name__)

_PILOT_WORKFLOW_IDS: frozenset[str] = frozenset({"music_full_cycle_v1", "doc_package_v1"})
_ACTIVE_STEP_STATUSES = frozenset({"pending", "running", "in_progress", "awaiting_confirmation"})
_TERMINAL_RUN_STATUSES = frozenset({"completed", "failed", "cancelled"})


def _step_row_at(steps: list[Mapping[str, Any]], step_index: int) -> Mapping[str, Any] | None:
    return next((s for s in steps if int(s.get("step_index") or 0) == step_index), None)


def _step_status(step: Mapping[str, Any] | None) -> str:
    if step is None:
        return ""
    return str(step.get("status") or "").strip().lower()


def _step_has_success_output(step: Mapping[str, Any] | None) -> bool:
    """True when a step row already carries a non-empty success payload (race heal)."""

    if step is None:
        return False
    output = step.get("output_payload")
    if not isinstance(output, Mapping) or not output:
        return False
    return str(output.get("message") or "").strip() != "workflow_tool_unhandled"


def _completed_step_tool_result(step_def: CompanionWorkflowStepV1, step_row: Mapping[str, Any]) -> ToolResult:
    output = step_row.get("output_payload")
    data = dict(output) if isinstance(output, Mapping) else {}
    return ToolResult(
        tool=str(step_def.tool_name or step_def.step_kind or ""),
        status="ok",
        reply="",
        actions=[],
        data=data,
        task_run=None,
    )


_CHILD_INTENT_TO_TOOL: dict[str, str] = {
    "music_generation_xl_base_background": "music_generation_xl_base",
    "music_generation_background": "music_generation",
    "image_generation_background": "image_generation",
}


def _result_view(result: ToolResult | Mapping[str, Any]) -> Mapping[str, Any]:
    return tool_result_as_mapping(result)


def _is_background_result(result: ToolResult | Mapping[str, Any]) -> bool:
    return tool_result_is_background(result)


async def load_workflow_definition_for_run(
    pool: asyncpg.Pool,
    run: Mapping[str, Any],
) -> CompanionWorkflowDefinitionV1 | None:
    plan = run.get("plan_payload")
    user_wf_id = ""
    if isinstance(plan, Mapping):
        user_wf_id = str(plan.get("user_workflow_id") or "").strip()
    if user_wf_id:
        row = await user_wf_pg.companion_user_workflow_fetch(
            pool,
            principal_id=str(run.get("principal_id") or ""),
            workflow_id=user_wf_id,
        )
        if row is None:
            return None
        raw = row.get("definition_json")
        if not isinstance(raw, Mapping):
            return None
        try:
            return CompanionWorkflowDefinitionV1.model_validate(raw)
        except Exception:
            logger.warning("[STEP] declarative_workflow_definition_invalid user_workflow_id=%s", user_wf_id)
            return None

    workflow_id = str(run.get("workflow_id") or "").strip()
    if not workflow_id:
        return None
    builtin = get_builtin_workflow(workflow_id)
    return builtin


def _tool_ctx_for_workflow_run(
    run: Mapping[str, Any],
    *,
    companion_pool: asyncpg.Pool,
    tool_ctx: ToolContext | None = None,
) -> ToolContext:
    if tool_ctx is not None:
        return tool_ctx
    plan = run.get("plan_payload")
    catalog_uid: str | None = None
    if isinstance(plan, Mapping):
        raw = plan.get("content_catalog_user_id")
        if raw is not None and str(raw).strip():
            catalog_uid = str(raw).strip()
    base = ToolContext(
        principal_id=str(run.get("principal_id") or ""),
        user_line=str(run.get("user_message") or ""),
        content_catalog_user_id=catalog_uid,
        oauth2_sub_for_content_alternate=None,
        companion_pool=companion_pool,
    )
    run_id = str(run.get("id") or "").strip()
    snapshot = load_workflow_auth_snapshot_sync(run_id) if run_id else None
    if snapshot is None:
        logger.info(
            "[STEP] declarative_workflow_auth_cache_miss run_id=%s",
            run_id,
        )
        return base
    return replace(
        base,
        bearer_token=snapshot.bearer_token,
        auth_user=workflow_auth_user(snapshot.oauth_user_id),
        profile=snapshot.profile,
    )


def _step_def_at_index(definition: CompanionWorkflowDefinitionV1, step_index: int) -> CompanionWorkflowStepV1 | None:
    if step_index < 1 or step_index > len(definition.steps):
        return None
    return definition.steps[step_index - 1]


def _workflow_step_output_payload(
    view: Mapping[str, Any],
    *,
    tool_name: str = "",
) -> dict[str, Any]:
    """Normalize tool result into durable step output for workflow review UI."""

    data = as_mapping_dict(view.get("data"))
    out = dict(data) if data else {}
    reply = str(view.get("reply") or "").strip()
    if reply:
        out["reply"] = reply
    status = str(view.get("status") or "ok").strip()
    if status:
        out["status"] = status
    if tool_name.strip():
        out["tool_name"] = tool_name.strip()
    return out


async def _mark_workflow_step(
    pool: asyncpg.Pool,
    *,
    steps: list[Mapping[str, Any]],
    step_index: int,
    status: str,
    output_payload: Mapping[str, Any] | None = None,
    error_payload: Mapping[str, Any] | None = None,
) -> None:
    step_row = next((s for s in steps if int(s.get("step_index") or 0) == step_index), None)
    if step_row is None:
        return
    await companion_pg.companion_task_step_update(
        pool,
        step_id=str(step_row.get("id") or ""),
        status=status,
        output_payload=dict(output_payload) if output_payload else None,
        error_payload=dict(error_payload) if error_payload else None,
    )


async def dispatch_declarative_workflow_step(
    pool: asyncpg.Pool,
    *,
    workflow_run_id: str,
    step_index: int,
    definition: CompanionWorkflowDefinitionV1,
    tool_ctx: ToolContext,
    user_line: str,
    step_rows: list[Mapping[str, Any]] | None = None,
) -> ToolResult | None:
    """Run one workflow step by index (1-based)."""

    step_def = _step_def_at_index(definition, step_index)
    if step_def is None:
        return None
    if step_def.kind == "confirm_gate":
        await _mark_workflow_step(pool, steps=step_rows or [], step_index=step_index, status="awaiting_confirmation")
        await companion_pg.companion_task_run_update(
            pool,
            run_id=workflow_run_id,
            principal_id=tool_ctx.principal_id,
            status="awaiting_confirmation",
            confirmation_state={"step_key": step_def.step_key},
        )
        return ToolResult(
            tool="workflow_confirm_gate",
            status="needs_confirm",
            reply="",
            actions=[],
            data={},
            task_run=None,
        )

    if step_def.kind != "tool" or not step_def.tool_name:
        return None

    rows = step_rows
    if rows is None:
        rows = await companion_pg.companion_task_steps_list(pool, run_id=workflow_run_id)

    current = _step_row_at(rows, step_index)
    if _step_status(current) == "completed" or _step_has_success_output(current):
        if _step_status(current) != "completed" and current is not None:
            output = current.get("output_payload")
            await _mark_workflow_step(
                pool,
                steps=rows,
                step_index=step_index,
                status="completed",
                output_payload=dict(output) if isinstance(output, Mapping) else {},
            )
            logger.info(
                "[STEP] declarative_workflow_step_healed_completed run_id=%s step_index=%d tool=%s",
                workflow_run_id,
                step_index,
                step_def.tool_name,
            )
        return _completed_step_tool_result(step_def, current or {})

    tool_args = build_declarative_tool_dispatch_args(
        user_line=user_line,
        principal_id=tool_ctx.principal_id,
        args_template=step_def.args_template or {"user_line": user_line},
        steps=rows,
    )
    inject_workflow_parent_args(tool_args, parent_run_id=workflow_run_id, step_index=step_index)

    await _mark_workflow_step(pool, steps=rows, step_index=step_index, status="running")

    result = await dispatch_tool_by_name(str(step_def.tool_name), tool_args, tool_ctx)
    if result is None:
        if _step_status(current) == "completed" or _step_has_success_output(current):
            if current is not None and _step_status(current) != "completed":
                output = current.get("output_payload")
                await _mark_workflow_step(
                    pool,
                    steps=rows,
                    step_index=step_index,
                    status="completed",
                    output_payload=dict(output) if isinstance(output, Mapping) else {},
                )
            return _completed_step_tool_result(step_def, current or {})
        parent = await companion_pg.companion_task_run_fetch(pool, run_id=workflow_run_id)
        if parent is not None and str(parent.get("status") or "").strip().lower() == "completed":
            logger.info(
                "[STEP] declarative_workflow_skip_fail_parent_completed run_id=%s step_index=%d tool=%s",
                workflow_run_id,
                step_index,
                step_def.tool_name,
            )
            return _completed_step_tool_result(step_def, current or {})
        await _mark_workflow_step(
            pool,
            steps=rows,
            step_index=step_index,
            status="failed",
            error_payload={"message": "workflow_tool_unhandled", "tool_name": step_def.tool_name},
        )
        await companion_pg.companion_task_run_update(
            pool,
            run_id=workflow_run_id,
            principal_id=tool_ctx.principal_id,
            status="failed",
            error_payload={"message": "workflow_tool_unhandled", "tool_name": step_def.tool_name},
        )
        return None

    view = _result_view(result)
    status = str(view.get("status") or "ok")
    if status == "needs_confirm":
        await _mark_workflow_step(pool, steps=rows, step_index=step_index, status="awaiting_confirmation")
        await companion_pg.companion_task_run_update(
            pool,
            run_id=workflow_run_id,
            principal_id=tool_ctx.principal_id,
            status="awaiting_confirmation",
            confirmation_state={"step_key": step_def.step_key},
        )
        return result

    if tool_result_is_workflow_step_success(status):
        if status in {"ok", "memory_append"} and not _is_background_result(result):
            output = _workflow_step_output_payload(view, tool_name=step_def.tool_name or "")
            await _mark_workflow_step(
                pool,
                steps=rows,
                step_index=step_index,
                status="completed",
                output_payload=output,
            )
        else:
            await _mark_workflow_step(pool, steps=rows, step_index=step_index, status="running")
        return result

    err = as_mapping_dict(view.get("data")) or {"message": status}
    await _mark_workflow_step(
        pool,
        steps=rows,
        step_index=step_index,
        status="failed",
        error_payload=err if isinstance(err, Mapping) else {"message": status},
    )
    await companion_pg.companion_task_run_update(
        pool,
        run_id=workflow_run_id,
        principal_id=tool_ctx.principal_id,
        status="failed",
        error_payload=err if isinstance(err, Mapping) else {"message": status},
    )
    return result


async def advance_declarative_workflow_after_step(
    pool: asyncpg.Pool,
    *,
    workflow_run_id: str,
    completed_step_index: int,
    step_output: Mapping[str, Any] | None,
    tool_ctx: ToolContext | None = None,
) -> bool:
    """Mark ``completed_step_index`` done and run following steps when possible."""

    run = await companion_pg.companion_task_run_fetch(pool, run_id=workflow_run_id)
    if run is None:
        return False
    parent_status = str(run.get("status") or "").strip().lower()
    if parent_status == "completed":
        return True
    if parent_status in _TERMINAL_RUN_STATUSES - {"completed"}:
        return False
    workflow_id = str(run.get("workflow_id") or "").strip()
    if workflow_id in _PILOT_WORKFLOW_IDS:
        return False
    if str(run.get("intent_kind") or "") != "action_workflow":
        return False

    definition = await load_workflow_definition_for_run(pool, run)
    if definition is None:
        return False

    principal_id = str(run.get("principal_id") or "")
    ctx = _tool_ctx_for_workflow_run(run, companion_pool=pool, tool_ctx=tool_ctx)
    user_line = str(run.get("user_message") or ctx.user_line or "")

    steps = await companion_pg.companion_task_steps_list(pool, run_id=workflow_run_id)
    if step_output is not None:
        await _mark_workflow_step(
            pool,
            steps=steps,
            step_index=completed_step_index,
            status="completed",
            output_payload=step_output,
        )
        steps = await companion_pg.companion_task_steps_list(pool, run_id=workflow_run_id)

    next_index = completed_step_index + 1
    if next_index > len(definition.steps):
        final_output = dict(step_output) if step_output else {}
        await companion_pg.companion_task_run_update(
            pool,
            run_id=workflow_run_id,
            principal_id=principal_id,
            status="completed",
            result_payload=final_output,
        )
        await publish_task_event_async(
            principal_id=principal_id,
            event_name="task_completed",
            payload={
                "run_id": workflow_run_id,
                "status": "completed",
                "intent_kind": "action_workflow",
                "workflow_id": workflow_id,
                "result_payload": final_output,
            },
        )
        logger.info(
            "[STEP] declarative_workflow_completed workflow_id=%s run_id=%s",
            workflow_id,
            workflow_run_id,
        )
        await asyncio.to_thread(delete_workflow_auth_snapshot_sync, workflow_run_id)
        return True

    result = await dispatch_declarative_workflow_step(
        pool,
        workflow_run_id=workflow_run_id,
        step_index=next_index,
        definition=definition,
        tool_ctx=ctx,
        user_line=user_line,
        step_rows=steps,
    )
    if result is None:
        return False

    view = _result_view(result)
    status = str(view.get("status") or "ok")
    if status == "accepted" and _is_background_result(result):
        logger.info(
            "[STEP] declarative_workflow_advanced_async workflow_id=%s run_id=%s step_index=%d",
            workflow_id,
            workflow_run_id,
            next_index,
        )
        return True

    if status in {"ok", "memory_append"} and not _is_background_result(result):
        data = view.get("data")
        return await advance_declarative_workflow_after_step(
            pool,
            workflow_run_id=workflow_run_id,
            completed_step_index=next_index,
            step_output=data if isinstance(data, Mapping) else {},
            tool_ctx=ctx,
        )

    if status == "needs_confirm":
        logger.info(
            "[STEP] declarative_workflow_advanced_to_confirm workflow_id=%s run_id=%s step_index=%d",
            workflow_id,
            workflow_run_id,
            next_index,
        )
        return True

    return False


def _child_tool_name_for_intent(intent_kind: str) -> str:
    return _CHILD_INTENT_TO_TOOL.get(str(intent_kind or "").strip(), "")


def _step_tool_name(step: Mapping[str, Any]) -> str:
    inp = step.get("input_payload")
    if isinstance(inp, Mapping):
        tool = str(inp.get("tool_name") or "").strip()
        if tool:
            return tool
    return str(step.get("step_kind") or "").strip()


async def _reconcile_orphan_declarative_child_completion(
    pool: asyncpg.Pool,
    *,
    child: Mapping[str, Any],
    result_payload: Mapping[str, Any],
) -> bool:
    """Match a completed async tool run to a stalled parent workflow step (legacy missing parent link)."""

    intent = str(child.get("intent_kind") or "").strip()
    expected_tool = _child_tool_name_for_intent(intent)
    if not expected_tool:
        return False
    principal_id = str(child.get("principal_id") or "").strip()
    user_message = str(child.get("user_message") or "").strip()
    if not principal_id or not user_message:
        return False

    parent_candidates = await companion_pg.companion_task_runs_list(pool, principal_id=principal_id, limit=16)
    for parent in parent_candidates:
        if str(parent.get("intent_kind") or "") != "action_workflow":
            continue
        if str(parent.get("status") or "").strip().lower() not in _ACTIVE_STEP_STATUSES:
            continue
        parent_plan = parent.get("plan_payload")
        if not isinstance(parent_plan, Mapping) or not str(parent_plan.get("user_workflow_id") or "").strip():
            continue
        if str(parent.get("user_message") or "").strip() != user_message:
            continue
        parent_run_id = str(parent.get("id") or "").strip()
        if not parent_run_id:
            continue
        steps = await companion_pg.companion_task_steps_list(pool, run_id=parent_run_id)
        for step in steps:
            st = str(step.get("status") or "").strip().lower()
            if st not in _ACTIVE_STEP_STATUSES:
                continue
            if _step_tool_name(step) != expected_tool:
                continue
            try:
                step_index = int(step.get("step_index") or 0)
            except (TypeError, ValueError):  # fmt: skip
                step_index = 0
            if step_index < 1:
                continue
            child_run_id = str(child.get("id") or "").strip()
            child_plan = child.get("plan_payload")
            if isinstance(child_plan, Mapping) and child_run_id:
                patched = dict(child_plan)
                patched["workflow_parent_run_id"] = parent_run_id
                patched["workflow_parent_step_index"] = step_index
                child_status = str(child.get("status") or "completed").strip() or "completed"
                await companion_pg.companion_task_run_update(
                    pool,
                    run_id=child_run_id,
                    principal_id=principal_id,
                    status=child_status,
                    plan_payload=patched,
                )
            logger.info(
                "[STEP] declarative_workflow_orphan_reconciled child_run_id=%s parent_run_id=%s parent_step=%d",
                child_run_id,
                parent_run_id,
                step_index,
            )
            return await advance_declarative_workflow_after_step(
                pool,
                workflow_run_id=parent_run_id,
                completed_step_index=step_index,
                step_output=result_payload,
                tool_ctx=None,
            )
    return False


async def reconcile_stalled_declarative_workflow(
    pool: asyncpg.Pool,
    *,
    workflow_run_id: str,
    principal_id: str,
) -> bool:
    """Advance parent workflow when a linked child finished but worker-side hook missed."""

    run = await companion_pg.companion_task_run_fetch(pool, run_id=workflow_run_id)
    if run is None:
        return False
    if str(run.get("intent_kind") or "") != "action_workflow":
        return False
    plan = run.get("plan_payload")
    if not isinstance(plan, Mapping) or not str(plan.get("user_workflow_id") or "").strip():
        return False
    parent_status = str(run.get("status") or "").strip().lower()
    if parent_status not in _ACTIVE_STEP_STATUSES | {"running"}:
        return False
    if parent_status == "completed":
        return False

    steps = await companion_pg.companion_task_steps_list(pool, run_id=workflow_run_id)
    stalled_indexes = {
        int(s.get("step_index") or 0)
        for s in steps
        if str(s.get("status") or "").strip().lower() in {"running", "in_progress", "pending"}
        and int(s.get("step_index") or 0) >= 1
    }
    if not stalled_indexes:
        return False

    children = await companion_pg.companion_task_runs_list_children_by_parent_run(
        pool,
        principal_id=principal_id,
        parent_run_id=workflow_run_id,
        limit=16,
    )
    for child in children:
        if str(child.get("status") or "").strip().lower() != "completed":
            continue
        child_plan = child.get("plan_payload")
        if not isinstance(child_plan, Mapping):
            continue
        try:
            step_index = int(child_plan.get("workflow_parent_step_index") or 0)
        except (TypeError, ValueError):  # fmt: skip
            step_index = 0
        if step_index < 1 or step_index not in stalled_indexes:
            continue
        step_row = _step_row_at(steps, step_index)
        if _step_status(step_row) == "completed" or _step_has_success_output(step_row):
            continue
        child_run_id = str(child.get("id") or "").strip()
        if not child_run_id:
            continue
        result_payload = child.get("result_payload")
        if not isinstance(result_payload, Mapping):
            result_payload = {}
        if await maybe_advance_declarative_workflow_from_child_run(
            pool,
            child_run_id=child_run_id,
            result_payload=result_payload,
        ):
            logger.info(
                "[STEP] declarative_workflow_reconciled_on_poll parent_run_id=%s child_run_id=%s step=%d",
                workflow_run_id,
                child_run_id,
                step_index,
            )
            return True
    return False


async def reconcile_stalled_declarative_workflows_for_principal(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> int:
    """Best-effort poll-time recovery for stalled user workflows (e.g. music on remote workers)."""

    pid = str(principal_id or "").strip()
    if not pid:
        return 0
    from api.ewa_platform.companion.orchestration.companion_image_generation import (
        kick_stalled_companion_image_runs_for_principal,
    )

    kicked = await kick_stalled_companion_image_runs_for_principal(pool, principal_id=pid)
    runs = await companion_pg.companion_task_runs_list(pool, principal_id=pid, limit=16)
    advanced = kicked
    for run in runs:
        run_id = str(run.get("id") or "").strip()
        if not run_id:
            continue
        if await reconcile_stalled_declarative_workflow(
            pool,
            workflow_run_id=run_id,
            principal_id=pid,
        ):
            advanced += 1
    return advanced


async def maybe_advance_declarative_workflow_from_child_run(
    pool: asyncpg.Pool,
    *,
    child_run_id: str,
    result_payload: Mapping[str, Any],
) -> bool:
    """When an async tool run finishes, continue the parent declarative workflow if linked."""

    child = await companion_pg.companion_task_run_fetch(pool, run_id=child_run_id)
    if child is None:
        return False
    plan = child.get("plan_payload")
    if not isinstance(plan, Mapping):
        return False
    parent_run_id = str(plan.get("workflow_parent_run_id") or "").strip()
    if not parent_run_id:
        return await _reconcile_orphan_declarative_child_completion(
            pool,
            child=child,
            result_payload=result_payload,
        )
    parent = await companion_pg.companion_task_run_fetch(pool, run_id=parent_run_id)
    if parent is not None and str(parent.get("status") or "").strip().lower() == "completed":
        return False
    try:
        parent_step_index = int(plan.get("workflow_parent_step_index") or 0)
    except (TypeError, ValueError):  # fmt: skip
        parent_step_index = 0
    if parent_step_index < 1:
        return False

    logger.info(
        "[STEP] declarative_workflow_child_completed child_run_id=%s parent_run_id=%s parent_step=%d",
        child_run_id,
        parent_run_id,
        parent_step_index,
    )
    merged_output = dict(result_payload)
    merged_output.setdefault("run_id", child_run_id)
    merged_output.setdefault("task_run_id", child_run_id)
    return await advance_declarative_workflow_after_step(
        pool,
        workflow_run_id=parent_run_id,
        completed_step_index=parent_step_index,
        step_output=merged_output,
        tool_ctx=None,
    )


__all__ = (
    "advance_declarative_workflow_after_step",
    "dispatch_declarative_workflow_step",
    "inject_workflow_parent_args",
    "load_workflow_definition_for_run",
    "maybe_advance_declarative_workflow_from_child_run",
    "merge_workflow_parent_plan",
    "reconcile_stalled_declarative_workflow",
    "reconcile_stalled_declarative_workflows_for_principal",
)
