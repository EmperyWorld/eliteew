# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Generic declarative workflow starter for user workflows and PG catalog definitions.
# Invariants:
# - Tool steps dispatch through ``dispatch_declarative_workflow_step`` with router bypass.
# - Multi-step chains continue via ``advance_declarative_workflow_after_step`` (sync inline or async child hook).
# - OAuth bearer for later async steps is stored in Redis (``workflow_auth_cache``), not ``plan_payload``.
# Related:
# - api/ewa_platform/companion/workflows/user/declarative_advance.py
# - api/ewa_platform/companion/workflows/action/starter.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext, ToolResult
from api.ewa_platform.companion.orchestration.tool_result_utils import (
    tool_result_as_mapping,
    tool_result_is_background,
    tool_result_is_workflow_step_success,
)
from api.ewa_platform.companion.workflows.action.schema import CompanionWorkflowDefinitionV1
from api.ewa_platform.companion.workflows.user.declarative_advance import (
    advance_declarative_workflow_after_step,
    dispatch_declarative_workflow_step,
)
from api.ewa_platform.companion.workflows.user.workflow_auth_cache import (
    store_workflow_auth_snapshot_sync,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

_ACTIVE_RUN_STATUSES = frozenset({"pending", "running", "awaiting_confirmation"})


async def _find_active_user_workflow_run(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_workflow_row_id: str,
) -> dict[str, Any] | None:
    """Reuse an in-flight parent run when the user retriggers the same workflow."""

    wf_id = str(user_workflow_row_id or "").strip()
    if not wf_id:
        return None
    rows = await companion_pg.companion_task_runs_list(pool, principal_id=principal_id, limit=12)
    for row in rows:
        if str(row.get("intent_kind") or "") != "action_workflow":
            continue
        if str(row.get("status") or "").strip().lower() not in _ACTIVE_RUN_STATUSES:
            continue
        plan = row.get("plan_payload")
        if not isinstance(plan, dict):
            continue
        if str(plan.get("user_workflow_id") or "").strip() != wf_id:
            continue
        return row
    return None


def _looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in str(text or ""))


def _result_view(result: ToolResult) -> dict[str, Any]:
    view = tool_result_as_mapping(result)
    return {
        "status": view.get("status"),
        "reply": view.get("reply"),
        "actions": view.get("actions"),
        "data": view.get("data"),
        "task_run": view.get("task_run"),
    }


def _is_background_result(result: ToolResult) -> bool:
    return tool_result_is_background(result)


async def start_declarative_workflow(
    pool: asyncpg.Pool,
    *,
    user_line: str,
    tool_ctx: ToolContext,
    workflow: CompanionWorkflowDefinitionV1,
    user_workflow_row_id: str | None = None,
) -> dict[str, Any] | None:
    """Create a durable run and execute workflow steps (inline sync chain or async handoff)."""

    tool_steps = [s for s in workflow.steps if s.kind == "tool" and s.tool_name]
    if not tool_steps:
        return None

    ru = _looks_cyrillic(user_line)
    if user_workflow_row_id:
        existing = await _find_active_user_workflow_run(
            pool,
            principal_id=tool_ctx.principal_id,
            user_workflow_row_id=user_workflow_row_id,
        )
        if existing is not None:
            logger.info(
                "[STEP] declarative_workflow_reuse_active run_id=%s user_workflow_id=%s",
                existing.get("id"),
                user_workflow_row_id,
            )
            return {
                "reply": (
                    "Этот сценарий уже выполняется — смотри прогресс в «Текущие операции»."
                    if ru
                    else "This workflow is already running — see Current operations."
                ),
                "actions": [],
                "task_run": existing,
                "orchestration_branch": "user_workflow",
                "workflow_id": workflow.workflow_id,
            }

    plan: dict[str, Any] = {
        "kind": "action_workflow",
        "workflow_id": workflow.workflow_id,
        "workflow_version": workflow.version,
        "user_workflow_id": user_workflow_row_id,
        "workflow_title_ru": workflow.title_ru,
        "workflow_title_en": workflow.title_en,
    }
    if tool_ctx.content_catalog_user_id:
        plan["content_catalog_user_id"] = tool_ctx.content_catalog_user_id

    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=tool_ctx.principal_id,
        intent_kind="action_workflow",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={},
        status="running",
        execution_mode=workflow.execution_mode,
        workflow_id=workflow.workflow_id,
        workflow_version=workflow.version,
    )
    run_id = str(run_row.get("id") or "")

    oauth_user_id = str(getattr(tool_ctx.auth_user, "id", "") or "").strip()
    store_workflow_auth_snapshot_sync(
        run_id,
        bearer_token=tool_ctx.bearer_token,
        oauth_user_id=oauth_user_id or None,
        profile=tool_ctx.profile if isinstance(tool_ctx.profile, Mapping) else None,
    )

    for idx, step_def in enumerate(workflow.steps, start=1):
        await companion_pg.companion_task_step_create(
            pool,
            run_id=run_id,
            step_index=idx,
            step_kind=str(step_def.step_kind or step_def.tool_name or step_def.kind),
            title=step_def.title_ru or step_def.title_en or step_def.step_key,
            input_payload={
                "step_key": step_def.step_key,
                "tool_name": step_def.tool_name,
                "kind": step_def.kind,
                "requires_confirm": bool(step_def.requires_confirm),
                "args_template": dict(step_def.args_template or {}),
            },
            status="pending",
        )

    result = await dispatch_declarative_workflow_step(
        pool,
        workflow_run_id=run_id,
        step_index=1,
        definition=workflow,
        tool_ctx=tool_ctx,
        user_line=user_line,
    )
    if result is None:
        logger.warning(
            "[STEP] declarative_workflow_first_tool_unhandled workflow_id=%s run_id=%s",
            workflow.workflow_id,
            run_id,
        )
        return {
            "reply": (
                "Не удалось запустить первый шаг цепочки — попробуй переформулировать."
                if ru
                else "Could not run the first step of the chain — try rephrasing."
            ),
            "actions": [],
            "task_run": run_row,
            "orchestration_branch": "user_workflow",
        }

    view = _result_view(result)
    status = str(view.get("status") or "ok")
    reply = str(view.get("reply") or "").strip()
    actions = list(view.get("actions") or [])
    task_run = view.get("task_run") or run_row

    if (
        tool_result_is_workflow_step_success(status)
        and status in {"ok", "memory_append"}
        and not _is_background_result(result)
        and len(workflow.steps) > 1
    ):
        output = view.get("data") if isinstance(view.get("data"), dict) else {}
        await advance_declarative_workflow_after_step(
            pool,
            workflow_run_id=run_id,
            completed_step_index=1,
            step_output=output,
            tool_ctx=tool_ctx,
        )
        task_run = await companion_pg.companion_task_run_fetch(pool, run_id=run_id) or run_row

    if not reply:
        reply = f"Запускаю цепочку «{workflow.title_ru}»." if ru else f'Starting chain "{workflow.title_en}".'

    logger.info(
        "[STEP] declarative_workflow_started workflow_id=%s run_id=%s user_workflow_id=%s",
        workflow.workflow_id,
        run_id,
        user_workflow_row_id,
    )
    return {
        "reply": reply,
        "actions": actions,
        "task_run": task_run,
        "orchestration_branch": "user_workflow",
        "workflow_id": workflow.workflow_id,
    }


__all__ = ("start_declarative_workflow",)
