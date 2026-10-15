# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Entry point for DAG v2 workflows: validate, persist initial state, create steps, enqueue Celery.
# Invariants:
# - One durable step row per topo-sorted node; first node is enqueued onto ``ewa_companion``.
# - OAuth bearer for async steps is stored in Redis via ``workflow_auth_cache``, not ``plan_payload``.
# Related:
# - api/ewa_platform/companion/workflows/user/generic_workflow_starter.py
# - api/ewa_platform/companion/workflows/dag/dag_state_store.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.config import companion_workflow_engine_v2_enabled
from api.ewa_platform.companion.workflows.dag.dag_state_store import (
    DAG_NODE_STEP_KIND,
    PLAN_KIND_V2,
    build_initial_dag_state,
    merge_dag_state_into_plan,
)
from api.ewa_platform.companion.workflows.dag.runner import validation_context_from_tool_ctx
from api.ewa_platform.companion.workflows.user.workflow_auth_cache import store_workflow_auth_snapshot_sync
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

logger = logging.getLogger(__name__)

_ACTIVE_RUN_STATUSES = frozenset({"pending", "running", "awaiting_confirmation"})


def _looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in str(text or ""))


async def _find_active_dag_workflow_run(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_workflow_row_id: str,
) -> dict[str, Any] | None:
    wf_id = str(user_workflow_row_id or "").strip()
    if not wf_id:
        return None
    rows = await companion_pg.companion_task_runs_list(pool, principal_id=principal_id, limit=12)
    for row in rows:
        if str(row.get("intent_kind") or "") != "action_workflow_v2":
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


async def start_dag_workflow_v2(
    pool: asyncpg.Pool,
    *,
    user_line: str,
    tool_ctx: ToolContext,
    definition: CompanionWorkflowDefinitionV2,
    user_workflow_row_id: str | None = None,
) -> dict[str, Any] | None:
    """Create a durable DAG v2 run and enqueue the first node when Celery orchestration is enabled."""

    if not companion_workflow_engine_v2_enabled():
        return None
    if not definition.nodes:
        return None

    ru = _looks_cyrillic(user_line)
    validation_ctx = validation_context_from_tool_ctx(tool_ctx)
    dag_state, errors = build_initial_dag_state(
        definition,
        user_line=user_line,
        content_catalog_user_id=str(tool_ctx.content_catalog_user_id or tool_ctx.principal_id or ""),
        validation_ctx=validation_ctx,
    )
    if dag_state is None:
        logger.warning(
            "[STEP] dag_workflow_start_invalid workflow_id=%s errors=%s",
            definition.workflow_id,
            "; ".join(errors),
        )
        return {
            "reply": (
                "Сценарий не прошёл проверку — исправь узлы и связи в конструкторе."
                if ru
                else "Workflow validation failed — fix nodes and edges in the builder."
            ),
            "actions": [],
            "orchestration_branch": "user_workflow_v2",
            "workflow_id": definition.workflow_id,
            "validation_errors": errors,
        }

    if user_workflow_row_id:
        existing = await _find_active_dag_workflow_run(
            pool,
            principal_id=tool_ctx.principal_id,
            user_workflow_row_id=user_workflow_row_id,
        )
        if existing is not None:
            return {
                "reply": (
                    "Этот сценарий уже выполняется — смотри прогресс в «Текущие операции»."
                    if ru
                    else "This workflow is already running — see Current operations."
                ),
                "actions": [],
                "task_run": existing,
                "orchestration_branch": "user_workflow_v2",
                "workflow_id": definition.workflow_id,
            }

    plan: dict[str, Any] = {
        "kind": PLAN_KIND_V2,
        "dag_engine": "v2",
        "workflow_id": definition.workflow_id,
        "workflow_version": definition.version,
        "user_workflow_id": user_workflow_row_id,
        "workflow_title_ru": definition.title_ru,
        "workflow_title_en": definition.title_en,
        "definition_json": definition.model_dump(mode="json"),
    }
    if tool_ctx.content_catalog_user_id:
        plan["content_catalog_user_id"] = tool_ctx.content_catalog_user_id
    plan = merge_dag_state_into_plan(plan, dag_state)

    execution_mode = str(definition.execution_mode or "async").strip() or "async"
    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=tool_ctx.principal_id,
        intent_kind="action_workflow_v2",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={},
        status="running",
        execution_mode=execution_mode,
        workflow_id=definition.workflow_id,
        workflow_version=definition.version,
    )
    run_id = str(run_row.get("id") or "")

    oauth_user_id = str(getattr(tool_ctx.auth_user, "id", "") or "").strip()
    store_workflow_auth_snapshot_sync(
        run_id,
        bearer_token=tool_ctx.bearer_token,
        oauth_user_id=oauth_user_id or None,
        profile=tool_ctx.profile if isinstance(tool_ctx.profile, Mapping) else None,
    )

    graph_nodes = {str(node.id): node for node in definition.nodes}
    for idx, node_id in enumerate(dag_state.ordered_node_ids, start=1):
        node = graph_nodes.get(node_id)
        title = ""
        if node is not None:
            title = str(node.title_ru or node.title_en or node.type)
        await companion_pg.companion_task_step_create(
            pool,
            run_id=run_id,
            step_index=idx,
            step_kind=DAG_NODE_STEP_KIND,
            title=title or node_id,
            input_payload={
                "node_id": node_id,
                "node_type": str(node.type) if node is not None else "",
            },
            status="pending",
        )

    first_index = 1
    celery_id = enqueue_companion_run(
        run_id=run_id,
        step_index=first_index,
        job_payload={
            "user_line": user_line,
            "content_catalog_user_id": str(tool_ctx.content_catalog_user_id or tool_ctx.principal_id or ""),
            "principal_id": tool_ctx.principal_id,
        },
    )
    if celery_id is None:
        await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=tool_ctx.principal_id,
            status="failed",
            error_payload={"message": "dag_first_node_enqueue_failed", "stage": "starter"},
        )
        return {
            "reply": (
                "Не удалось поставить сценарий в очередь — попробуй позже."
                if ru
                else "Could not enqueue workflow — try again later."
            ),
            "actions": [],
            "task_run": run_row,
            "orchestration_branch": "user_workflow_v2",
            "workflow_id": definition.workflow_id,
        }

    reply = (
        f"Запускаю сценарий «{definition.title_ru}» по узлам."
        if ru
        else f'Starting workflow "{definition.title_en}" node by node.'
    )
    logger.info(
        "[STEP] dag_workflow_started workflow_id=%s run_id=%s user_workflow_id=%s celery_task_id=%s",
        definition.workflow_id,
        run_id,
        user_workflow_row_id,
        celery_id,
    )
    return {
        "reply": reply,
        "actions": [],
        "task_run": run_row,
        "orchestration_branch": "user_workflow_v2",
        "workflow_id": definition.workflow_id,
        "celery_task_id": celery_id,
    }


__all__ = ("start_dag_workflow_v2",)
