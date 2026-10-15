# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resume DAG v2 workflows when async tool child runs complete (parent-child linkage reuse).
# Invariants:
# - Idempotent: already-completed parent nodes are not advanced twice.
# - v2 hook runs before v1 ``maybe_advance_declarative_workflow_from_child_run`` at call sites.
# - Trust T3 / V-M3: OCC revision conflicts re-fetch and retry; never silent-drop parent advance.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_node_executor.py
# - api/ewa_platform/companion/orchestration/companion_image_generation.py
# - documentation/product/ewa/EWA-TRUST-RESTORATION-PROGRAM-2026-07-09.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

import asyncpg

from api.ewa_platform.companion.orchestration.run_lifecycle import normalize_run_status, run_revision
from api.ewa_platform.companion.workflows.dag.circuit_breaker import collect_transitive_downstream
from api.ewa_platform.companion.workflows.dag.dag_node_executor import (
    apply_dag_node_success,
    enqueue_next_dag_node,
    finalize_dag_run,
    mark_dag_downstream_steps_skipped,
)
from api.ewa_platform.companion.workflows.dag.dag_state_store import (
    definition_from_plan,
    is_dag_v2_plan,
    load_dag_state,
    merge_dag_state_into_plan,
)
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph
from api.ewa_platform.companion.workflows.dag.runner import NodeRunOutcome
from api.ewa_platform.companion.workflows.dag.tool_registry_adapter import tool_result_to_node_outputs
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg.companion_asyncpg import companion_task_step_update
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowNodeV2

logger = logging.getLogger(__name__)

_TERMINAL_PARENT_STATUSES = frozenset({"completed", "failed", "cancelled"})
_DAG_ASYNC_RESUME_OCC_ATTEMPTS: Final[int] = 3
_DAG_ASYNC_RESUME_RETRY_COUNTDOWN_SEC: Final[int] = 2


def node_id_for_step_index(steps: list[Mapping[str, Any]], step_index: int) -> str | None:
    for step in steps:
        if int(step.get("step_index") or 0) != step_index:
            continue
        inp = step.get("input_payload")
        payload = dict(inp) if isinstance(inp, Mapping) else {}
        node_id = str(payload.get("node_id") or "").strip()
        return node_id or None
    return None


def child_result_payload_to_node_outputs(
    node: CompanionWorkflowNodeV2,
    result_payload: Mapping[str, Any],
) -> dict[str, Any]:
    """Map a completed child tool ``result_payload`` into DAG node output keys."""

    tool_view = {
        "status": "ok",
        "reply": str(result_payload.get("reply") or result_payload.get("message") or "").strip(),
        "data": dict(result_payload),
    }
    run_id = str(result_payload.get("run_id") or result_payload.get("task_run_id") or "").strip()
    if run_id:
        tool_view["task_run"] = {"id": run_id, "status": "completed"}
    outputs = tool_result_to_node_outputs(tool_view, node=node)
    for key, value in result_payload.items():
        if key.startswith("_"):
            continue
        if key in node.outputs and key not in outputs:
            outputs[key] = value
    if "image_url" in result_payload and "image_url" not in outputs:
        outputs["image_url"] = result_payload["image_url"]
    return outputs


async def _schedule_dag_async_resume_reconcile(
    *,
    parent_run_id: str,
    principal_id: str,
    parent_step_index: int,
    child_run_id: str | None,
) -> str | None:
    """Enqueue a delayed parent companion job so OCC-stuck resume is not silently dropped."""

    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run

    return enqueue_companion_run(
        run_id=parent_run_id,
        step_index=parent_step_index,
        job_payload={
            "principal_id": principal_id,
            "dag_async_resume_reconcile": True,
            "child_run_id": child_run_id or "",
            "parent_step_index": parent_step_index,
        },
        countdown_sec=_DAG_ASYNC_RESUME_RETRY_COUNTDOWN_SEC,
    )


async def advance_dag_workflow_after_async_node(
    pool: asyncpg.Pool,
    *,
    parent_run_id: str,
    parent_step_index: int,
    node_outputs: Mapping[str, Any],
    child_run_id: str | None = None,
) -> bool:
    """Mark one async DAG node complete and enqueue the next node or terminalize.

    Trust T3: on ``expect_revision`` mismatch, re-fetch and retry (idempotent if another
    writer already completed the node). After exhausted retries, schedule a delayed
    parent reconcile enqueue — never silent-drop the advance.
    """

    from api.ewa_platform.companion.jobs.step_handlers import publish_executor_step_event

    step_event_published = False
    last_node_id: str | None = None
    last_principal_id = ""

    for attempt in range(1, _DAG_ASYNC_RESUME_OCC_ATTEMPTS + 1):
        run = await companion_pg.companion_task_run_fetch(pool, run_id=parent_run_id)
        if run is None:
            return False
        if str(run.get("intent_kind") or "") != "action_workflow_v2":
            return False

        plan_payload_raw = run.get("plan_payload")
        plan_payload = dict(plan_payload_raw) if isinstance(plan_payload_raw, Mapping) else {}
        if not is_dag_v2_plan(plan_payload):
            return False

        definition = definition_from_plan(plan_payload)
        dag_state = load_dag_state(plan_payload)
        if definition is None or dag_state is None:
            return False

        principal_id = str(run.get("principal_id") or "").strip()
        last_principal_id = principal_id
        steps = await companion_pg.companion_task_steps_list(pool, run_id=parent_run_id)
        node_id = node_id_for_step_index(steps, parent_step_index)
        if not node_id:
            return False
        last_node_id = node_id

        if node_id in set(dag_state.completed_node_ids):
            logger.info(
                "[STEP] dag_async_resume_idempotent parent_run_id=%s node_id=%s step=%d attempt=%d",
                parent_run_id,
                node_id,
                parent_step_index,
                attempt,
            )
            return True

        parent_status = normalize_run_status(run)
        if parent_status in _TERMINAL_PARENT_STATUSES:
            return parent_status == "completed"

        step_row = next((s for s in steps if int(s.get("step_index") or 0) == parent_step_index), None)
        outcome = NodeRunOutcome(status="ok", attempts=1)
        apply_dag_node_success(
            state=dag_state,
            node_id=node_id,
            outputs=node_outputs,
            outcome=outcome,
        )

        output_payload = {
            "node_id": node_id,
            "status": "ok",
            "outputs": dict(node_outputs),
            "child_run_id": child_run_id,
        }
        if step_row is not None:
            step_id = str(step_row.get("id") or "").strip()
            if step_id:
                await companion_task_step_update(
                    pool,
                    step_id=step_id,
                    status="completed",
                    output_payload=output_payload,
                )
                if not step_event_published:
                    await publish_executor_step_event(
                        principal_id=principal_id,
                        run=run,
                        step=step_row,
                        status="completed",
                    )
                    step_event_published = True

        merged_plan = merge_dag_state_into_plan(plan_payload, dag_state)
        updated = await companion_pg.companion_task_run_update(
            pool,
            run_id=parent_run_id,
            principal_id=principal_id,
            status="running",
            plan_payload=merged_plan,
            result_payload=output_payload,
            expect_revision=run_revision(run),
        )
        if updated is None:
            logger.warning(
                "[STEP] dag_async_resume_revision_conflict parent_run_id=%s step=%d attempt=%d/%d",
                parent_run_id,
                parent_step_index,
                attempt,
                _DAG_ASYNC_RESUME_OCC_ATTEMPTS,
            )
            continue

        run = updated
        job_payload = {
            "user_line": dag_state.user_line or str(run.get("user_message") or ""),
            "content_catalog_user_id": dag_state.content_catalog_user_id or principal_id,
            "principal_id": principal_id,
        }
        await enqueue_next_dag_node(
            pool,
            run=run,
            state=dag_state,
            plan_payload=merged_plan,
            steps=steps,
            job_payload=job_payload,
        )
        logger.info(
            "[STEP] dag_async_resume_advanced parent_run_id=%s node_id=%s child_run_id=%s step=%d attempt=%d",
            parent_run_id,
            node_id,
            child_run_id or "",
            parent_step_index,
            attempt,
        )
        return True

    celery_id = await _schedule_dag_async_resume_reconcile(
        parent_run_id=parent_run_id,
        principal_id=last_principal_id,
        parent_step_index=parent_step_index,
        child_run_id=child_run_id,
    )
    logger.error(
        "[STEP] dag_async_resume_occ_exhausted parent_run_id=%s node_id=%s step=%d "
        "child_run_id=%s reconcile_celery_id=%s",
        parent_run_id,
        last_node_id or "?",
        parent_step_index,
        child_run_id or "",
        celery_id or "none",
    )
    return False


async def maybe_fail_dag_workflow_from_child_run(
    pool: asyncpg.Pool,
    *,
    child_run_id: str,
    error_payload: Mapping[str, Any],
) -> bool:
    """When an async tool child fails, fail the linked DAG node and skip downstream."""

    from api.ewa_platform.companion.jobs.step_handlers import publish_executor_step_event

    child = await companion_pg.companion_task_run_fetch(pool, run_id=child_run_id)
    if child is None:
        return False
    child_plan = child.get("plan_payload")
    if not isinstance(child_plan, Mapping):
        return False
    parent_run_id = str(child_plan.get("workflow_parent_run_id") or "").strip()
    if not parent_run_id:
        return False
    try:
        parent_step_index = int(child_plan.get("workflow_parent_step_index") or 0)
    except (TypeError, ValueError):  # fmt: skip
        return False
    if parent_step_index < 1:
        return False

    run = await companion_pg.companion_task_run_fetch(pool, run_id=parent_run_id)
    if run is None or str(run.get("intent_kind") or "") != "action_workflow_v2":
        return False
    plan_payload = dict(run.get("plan_payload") or {}) if isinstance(run.get("plan_payload"), Mapping) else {}
    if not is_dag_v2_plan(plan_payload):
        return False

    definition = definition_from_plan(plan_payload)
    dag_state = load_dag_state(plan_payload)
    if definition is None or dag_state is None:
        return False

    principal_id = str(run.get("principal_id") or "").strip()
    steps = await companion_pg.companion_task_steps_list(pool, run_id=parent_run_id)
    node_id = node_id_for_step_index(steps, parent_step_index)
    if not node_id:
        return False
    if node_id in set(dag_state.completed_node_ids):
        return True

    graph = build_workflow_graph(definition)
    message = str(error_payload.get("message") or "child tool failed").strip()
    dag_state.failed_node_id = node_id
    dag_state.error = message
    dag_state.node_outcomes[node_id] = NodeRunOutcome(status="failed", attempts=1, error=message)
    if node_id in dag_state.pending_node_ids:
        dag_state.pending_node_ids = [nid for nid in dag_state.pending_node_ids if nid != node_id]

    downstream = collect_transitive_downstream(graph, node_id)
    dag_state.skipped_node_ids = sorted(set(dag_state.skipped_node_ids) | downstream)
    for skipped_id in downstream:
        if skipped_id in dag_state.pending_node_ids:
            dag_state.pending_node_ids = [nid for nid in dag_state.pending_node_ids if nid != skipped_id]
        if skipped_id not in dag_state.node_outcomes:
            dag_state.node_outcomes[skipped_id] = NodeRunOutcome(
                status="skipped_due_to_error",
                skipped_due_to_error=True,
            )

    step_row = next((s for s in steps if int(s.get("step_index") or 0) == parent_step_index), None)
    if step_row is not None:
        step_id = str(step_row.get("id") or "").strip()
        if step_id:
            await companion_task_step_update(
                pool,
                step_id=step_id,
                status="failed",
                error_payload={"node_id": node_id, "message": message, "child_run_id": child_run_id},
            )
            await publish_executor_step_event(
                principal_id=principal_id,
                run=run,
                step=step_row,
                status="failed",
            )

    await mark_dag_downstream_steps_skipped(
        pool,
        principal_id=principal_id,
        run=run,
        steps=steps,
        skipped_node_ids=set(dag_state.skipped_node_ids),
    )
    merged_plan = merge_dag_state_into_plan(plan_payload, dag_state)
    await finalize_dag_run(pool, run=run, state=dag_state, plan_payload=merged_plan)
    logger.info(
        "[STEP] dag_async_resume_child_failed parent_run_id=%s node_id=%s child_run_id=%s",
        parent_run_id,
        node_id,
        child_run_id,
    )
    return True


async def maybe_advance_dag_workflow_from_child_run(
    pool: asyncpg.Pool,
    *,
    child_run_id: str,
    result_payload: Mapping[str, Any],
) -> bool:
    """When an async tool child completes, continue the parent DAG workflow if linked."""

    child = await companion_pg.companion_task_run_fetch(pool, run_id=child_run_id)
    if child is None:
        return False
    child_plan = child.get("plan_payload")
    if not isinstance(child_plan, Mapping):
        return False
    parent_run_id = str(child_plan.get("workflow_parent_run_id") or "").strip()
    if not parent_run_id:
        return False
    try:
        parent_step_index = int(child_plan.get("workflow_parent_step_index") or 0)
    except (TypeError, ValueError):  # fmt: skip
        parent_step_index = 0
    if parent_step_index < 1:
        return False

    parent = await companion_pg.companion_task_run_fetch(pool, run_id=parent_run_id)
    if parent is None or str(parent.get("intent_kind") or "") != "action_workflow_v2":
        return False

    plan_payload = dict(parent.get("plan_payload") or {}) if isinstance(parent.get("plan_payload"), Mapping) else {}
    if not is_dag_v2_plan(plan_payload):
        return False

    definition = definition_from_plan(plan_payload)
    if definition is None:
        return False

    steps = await companion_pg.companion_task_steps_list(pool, run_id=parent_run_id)
    node_id = node_id_for_step_index(steps, parent_step_index)
    if not node_id:
        return False
    node = next((n for n in definition.nodes if str(n.id) == node_id), None)
    if node is None:
        return False

    outputs = child_result_payload_to_node_outputs(node, result_payload)
    return await advance_dag_workflow_after_async_node(
        pool,
        parent_run_id=parent_run_id,
        parent_step_index=parent_step_index,
        node_outputs=outputs,
        child_run_id=child_run_id,
    )


async def maybe_advance_workflow_from_child_run(
    pool: asyncpg.Pool,
    *,
    child_run_id: str,
    result_payload: Mapping[str, Any],
) -> bool:
    """Try DAG v2 resume first, then legacy v1 declarative advance."""

    if await maybe_advance_dag_workflow_from_child_run(
        pool,
        child_run_id=child_run_id,
        result_payload=result_payload,
    ):
        return True
    from api.ewa_platform.companion.workflows.user.declarative_advance import (
        maybe_advance_declarative_workflow_from_child_run,
    )

    return await maybe_advance_declarative_workflow_from_child_run(
        pool,
        child_run_id=child_run_id,
        result_payload=result_payload,
    )


async def maybe_fail_workflow_from_child_run(
    pool: asyncpg.Pool,
    *,
    child_run_id: str,
    error_payload: Mapping[str, Any],
) -> bool:
    """Try DAG v2 child failure handling first, then no-op for v1 (legacy handles elsewhere)."""

    return await maybe_fail_dag_workflow_from_child_run(
        pool,
        child_run_id=child_run_id,
        error_payload=error_payload,
    )


__all__ = (
    "advance_dag_workflow_after_async_node",
    "child_result_payload_to_node_outputs",
    "maybe_advance_dag_workflow_from_child_run",
    "maybe_advance_workflow_from_child_run",
    "maybe_fail_dag_workflow_from_child_run",
    "maybe_fail_workflow_from_child_run",
    "node_id_for_step_index",
)
