# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Execute exactly one DAG v2 node inside the Celery worker loop and advance durable state.
# Invariants:
# - One Celery task executes one node; next node is enqueued via ``enqueue_companion_run``.
# - Runtime state is loaded/saved through ``dag_state_store`` on ``plan_payload``.
# Related:
# - api/ewa_platform/companion/jobs/step_handlers.py
# - api/ewa_platform/companion/workflows/dag/runner.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.jobs.worker_auth_token import bearer_token_from_headers
from api.ewa_platform.companion.orchestration.run_lifecycle import run_revision
from api.ewa_platform.companion.workflows.dag.circuit_breaker import (
    collect_transitive_downstream,
    finalize_run_status,
)
from api.ewa_platform.companion.workflows.dag.context_switcher import build_node_tool_context
from api.ewa_platform.companion.workflows.dag.dag_branching import (
    BRANCHING_NODE_TYPES,
    apply_branch_skips_after_node,
)
from api.ewa_platform.companion.workflows.dag.dag_loop import (
    FOR_EACH_NODE_TYPE,
    collect_loop_body_node_ids,
    run_for_each_node,
)
from api.ewa_platform.companion.workflows.dag.dag_state_store import (
    DagPersistedState,
    definition_from_plan,
    is_dag_v2_plan,
    load_dag_state,
    merge_dag_state_into_plan,
    next_pending_node_id,
    registry_from_dag_state,
    step_index_for_node_id,
)
from api.ewa_platform.companion.workflows.dag.errors import NodeExecutionError
from api.ewa_platform.companion.workflows.dag.executors import (
    DEFAULT_NODE_EXECUTOR_REGISTRY,
    NodeExecutionResult,
    NodeExecutorFn,
)
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph
from api.ewa_platform.companion.workflows.dag.runner import NodeRunOutcome
from api.ewa_platform.companion.workflows.dag.variable_resolver import resolve_node_inputs
from api.ewa_platform.companion.workflows.user.workflow_auth_cache import (
    load_workflow_auth_snapshot_sync,
    workflow_auth_user,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg.companion_asyncpg import companion_task_step_update

logger = logging.getLogger(__name__)


async def _execute_node_once(
    *,
    node,
    node_id: str,
    definition,
    graph,
    registry,
    base_ctx,
    executor_map: Mapping[str, NodeExecutorFn],
    workflow_parent_run_id: str,
    workflow_parent_step_index: int,
) -> NodeExecutionResult:
    incoming = [edge for edge in definition.edges if str(edge.target_node_id) == node_id]
    resolved_inputs = resolve_node_inputs(
        node_id=node.id,
        node_inputs=node.inputs,
        incoming_edges=incoming,
        registry=registry,
    )
    enriched_inputs = dict(resolved_inputs)
    enriched_inputs["_workflow_parent_run_id"] = workflow_parent_run_id
    enriched_inputs["_workflow_parent_step_index"] = workflow_parent_step_index
    enriched_inputs["_dag_registry"] = registry
    enriched_inputs["_dag_definition"] = definition
    enriched_inputs["_dag_node_id"] = node_id
    node_ctx = build_node_tool_context(base_ctx, node)
    if str(node.type) == FOR_EACH_NODE_TYPE:

        async def _execute_loop_child(
            body_node,
            body_id,
            body_definition,
            body_graph,
            body_registry,
            body_ctx,
            body_executor_map,
        ) -> NodeExecutionResult:
            return await _execute_node_once(
                node=body_node,
                node_id=body_id,
                definition=body_definition,
                graph=body_graph,
                registry=body_registry,
                base_ctx=body_ctx,
                executor_map=body_executor_map,
                workflow_parent_run_id=workflow_parent_run_id,
                workflow_parent_step_index=workflow_parent_step_index,
            )

        return await run_for_each_node(
            node=node,
            node_id=node_id,
            definition=definition,
            graph=graph,
            registry=registry,
            base_ctx=base_ctx,
            executor_map=executor_map,
            execute_node=_execute_loop_child,
        )
    executor = executor_map.get(node.type)
    if executor is None:
        return NodeExecutionResult(
            status="failed",
            outputs={},
            error=f"no executor registered for node type {node.type!r}",
        )
    try:
        return await executor(node, enriched_inputs, node_ctx)
    except NodeExecutionError as exc:
        return NodeExecutionResult(status="failed", outputs={}, error=str(exc))


async def _execute_node_with_policy(
    *,
    node,
    node_id: str,
    definition,
    graph,
    registry,
    base_ctx,
    executor_map: Mapping[str, NodeExecutorFn],
    workflow_parent_run_id: str,
    workflow_parent_step_index: int,
) -> tuple[NodeExecutionResult, int, NodeRunOutcome]:
    policy = node.on_error
    max_attempts = policy.max_attempts if policy.strategy == "retry" else 1
    attempts = 0
    result: NodeExecutionResult | None = None

    while attempts < max_attempts:
        attempts += 1
        if policy.strategy == "retry" and attempts > 1:
            logger.debug(
                "[STEP] dag_celery_node_retry node_id=%s attempt=%d max=%d",
                node_id,
                attempts,
                max_attempts,
            )
        result = await _execute_node_once(
            node=node,
            node_id=node_id,
            definition=definition,
            graph=graph,
            registry=registry,
            base_ctx=base_ctx,
            executor_map=executor_map,
            workflow_parent_run_id=workflow_parent_run_id,
            workflow_parent_step_index=workflow_parent_step_index,
        )
        if result.status in {"ok", "accepted", "needs_confirm"}:
            return result, attempts, NodeRunOutcome(status=result.status, attempts=attempts)
        if policy.strategy == "retry" and attempts < max_attempts:
            continue
        break

    assert result is not None
    if policy.strategy == "fallback_value":
        registry.register(node_id, dict(policy.fallback_outputs))
        return (
            NodeExecutionResult(status="ok", outputs=dict(policy.fallback_outputs)),
            attempts,
            NodeRunOutcome(status="ok", attempts=attempts, used_fallback=True),
        )

    error = result.error or "node failed"
    return result, attempts, NodeRunOutcome(status="failed", attempts=attempts, error=error)


def _build_tool_context(
    *,
    pool: asyncpg.Pool,
    run: Mapping[str, Any],
    job_payload: Mapping[str, Any],
    dag_state: DagPersistedState,
) -> Any:
    from api.ewa_platform.companion.jobs.step_handlers import _resolve_music_headers_for_worker
    from api.ewa_platform.companion.orchestration.tool_registry import ToolContext

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    headers = _resolve_music_headers_for_worker(run=run, job_payload=dict(job_payload))
    bearer = bearer_token_from_headers(headers)
    auth_user = None
    profile = None
    if not bearer:
        snapshot = load_workflow_auth_snapshot_sync(run_id)
        if snapshot is not None:
            bearer = snapshot.bearer_token
            auth_user = workflow_auth_user(snapshot.oauth_user_id)
            profile = snapshot.profile

    user_line = str(job_payload.get("user_line") or dag_state.user_line or run.get("user_message") or "").strip()
    content_catalog_user_id = (
        str(job_payload.get("content_catalog_user_id") or dag_state.content_catalog_user_id or principal_id).strip()
        or principal_id
    )
    shell_norm_raw = job_payload.get("shell_norm")
    return ToolContext(
        principal_id=principal_id,
        user_line=user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=None,
        main_pool=pool,
        companion_pool=pool,
        shell_norm=dict(shell_norm_raw) if isinstance(shell_norm_raw, Mapping) else None,
        bearer_token=bearer,
        auth_user=auth_user,
        profile=profile if isinstance(profile, Mapping) else None,
    )


def apply_dag_node_success(
    *,
    state: DagPersistedState,
    node_id: str,
    outputs: Mapping[str, Any],
    outcome: NodeRunOutcome,
) -> None:
    if node_id in state.pending_node_ids:
        state.pending_node_ids = [nid for nid in state.pending_node_ids if nid != node_id]
    if node_id not in state.completed_node_ids:
        state.completed_node_ids.append(node_id)
    state.registry_snapshot[node_id] = dict(outputs)
    state.node_outcomes[node_id] = outcome


def _apply_node_skip(
    *,
    state: DagPersistedState,
    node_id: str,
) -> None:
    if node_id in state.pending_node_ids:
        state.pending_node_ids = [nid for nid in state.pending_node_ids if nid != node_id]
    if node_id not in state.skipped_node_ids:
        state.skipped_node_ids.append(node_id)
    state.node_outcomes[node_id] = NodeRunOutcome(
        status="skipped_due_to_error",
        skipped_due_to_error=True,
    )


async def mark_dag_downstream_steps_skipped(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    run: Mapping[str, Any],
    steps: list[Mapping[str, Any]],
    skipped_node_ids: set[str],
) -> None:
    from api.ewa_platform.companion.jobs.step_handlers import publish_executor_step_event

    for step in steps:
        inp = step.get("input_payload")
        payload = dict(inp) if isinstance(inp, Mapping) else {}
        node_id = str(payload.get("node_id") or "").strip()
        if node_id not in skipped_node_ids:
            continue
        status = str(step.get("status") or "").strip().lower()
        if status in {"completed", "failed", "skipped"}:
            continue
        step_id = str(step.get("id") or "").strip()
        if not step_id:
            continue
        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="skipped",
            output_payload={"node_id": node_id, "reason": "skipped_due_to_error"},
        )
        await publish_executor_step_event(
            principal_id=principal_id,
            run=run,
            step=step,
            status="skipped",
        )


async def finalize_dag_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    state: DagPersistedState,
    plan_payload: Mapping[str, Any],
) -> None:
    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    terminal_status = finalize_run_status(
        ordered_node_ids=state.ordered_node_ids,
        completed_node_ids=set(state.completed_node_ids),
        skipped_node_ids=set(state.skipped_node_ids),
        failed_node_id=state.failed_node_id,
        branch_skipped_node_ids={
            node_id for node_id, outcome in state.node_outcomes.items() if outcome.skipped_due_to_branch
        },
    )
    merged_plan = merge_dag_state_into_plan(plan_payload, state)
    result_payload = {
        "dag_status": terminal_status,
        "completed_node_ids": list(state.completed_node_ids),
        "skipped_node_ids": list(state.skipped_node_ids),
        "failed_node_id": state.failed_node_id,
        "registry_snapshot": dict(state.registry_snapshot),
    }
    error_payload = {"message": state.error} if state.error else {}
    await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="failed" if terminal_status == "failed" else "completed",
        plan_payload=merged_plan,
        result_payload=result_payload,
        error_payload=error_payload,
    )
    from api.ewa_platform.companion.jobs.task_events import publish_task_event_async

    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_run",
        payload={
            "run_id": run_id,
            "status": "failed" if terminal_status == "failed" else "completed",
            "intent_kind": str(run.get("intent_kind") or ""),
            "workflow_id": str(run.get("workflow_id") or "") or None,
        },
    )


async def enqueue_next_dag_node(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    state: DagPersistedState,
    plan_payload: Mapping[str, Any],
    steps: list[Mapping[str, Any]],
    job_payload: Mapping[str, Any],
) -> None:
    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    next_node_id = next_pending_node_id(state)
    if next_node_id is None:
        await finalize_dag_run(pool, run=run, state=state, plan_payload=plan_payload)
        return

    state.current_node_id = next_node_id
    merged_plan = merge_dag_state_into_plan(plan_payload, state)
    updated = await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="running",
        plan_payload=merged_plan,
        expect_revision=run_revision(run),
    )
    if updated is None:
        msg = "dag_run_revision_conflict_on_advance"
        raise RuntimeError(msg)

    next_index = step_index_for_node_id(steps, next_node_id)
    if next_index is None:
        msg = f"dag_missing_step_for_node:{next_node_id}"
        raise RuntimeError(msg)

    user_line = str(job_payload.get("user_line") or state.user_line or run.get("user_message") or "").strip()
    content_catalog_user_id = (
        str(job_payload.get("content_catalog_user_id") or state.content_catalog_user_id or principal_id).strip()
        or principal_id
    )
    celery_id = enqueue_companion_run(
        run_id=run_id,
        step_index=next_index,
        job_payload={
            "user_line": user_line,
            "content_catalog_user_id": content_catalog_user_id,
            "principal_id": principal_id,
        },
    )
    if celery_id is None:
        msg = "dag_next_node_enqueue_failed"
        raise RuntimeError(msg)


async def execute_dag_node_step(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    step: Mapping[str, Any],
    job_payload: Mapping[str, Any],
) -> None:
    """Celery step handler: run one DAG node and enqueue the next or terminalize."""

    from api.ewa_platform.companion.jobs.step_handlers import publish_executor_step_event

    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    step_id = str(step.get("id") or "").strip()
    step_index = int(step.get("step_index") or 0)
    plan_payload_raw = run.get("plan_payload")
    plan_payload = dict(plan_payload_raw) if isinstance(plan_payload_raw, Mapping) else {}

    if not is_dag_v2_plan(plan_payload):
        msg = "dag_plan_payload_missing"
        raise RuntimeError(msg)

    definition = definition_from_plan(plan_payload)
    if definition is None:
        msg = "dag_definition_invalid"
        raise RuntimeError(msg)

    dag_state = load_dag_state(plan_payload)
    if dag_state is None:
        msg = "dag_state_missing"
        raise RuntimeError(msg)

    step_input = step.get("input_payload")
    step_payload = dict(step_input) if isinstance(step_input, Mapping) else {}
    node_id = str(step_payload.get("node_id") or dag_state.current_node_id or "").strip()
    if not node_id:
        msg = "dag_node_id_missing"
        raise RuntimeError(msg)

    graph = build_workflow_graph(definition)
    node = graph.nodes_by_id.get(node_id)
    if node is None:
        msg = f"dag_unknown_node:{node_id}"
        raise RuntimeError(msg)

    steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)

    if str(node.type) == "delay" and not bool(job_payload.get("dag_delay_wakeup")):
        incoming = [edge for edge in definition.edges if str(edge.target_node_id) == node_id]
        delay_inputs = resolve_node_inputs(
            node_id=node.id,
            node_inputs=node.inputs,
            incoming_edges=incoming,
            registry=registry_from_dag_state(dag_state, principal_id=principal_id),
        )
        delay_sec = int(delay_inputs.get("delay_sec") or node.config.delay_sec or 0)
        delay_sec = max(0, min(delay_sec, 3600))
        from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run

        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="in_progress",
            output_payload={"node_id": node_id, "status": "delay_scheduled", "delay_sec": delay_sec},
        )
        await publish_executor_step_event(
            principal_id=principal_id,
            run=run,
            step=step,
            status="in_progress",
        )
        user_line = str(job_payload.get("user_line") or dag_state.user_line or run.get("user_message") or "").strip()
        content_catalog_user_id = (
            str(job_payload.get("content_catalog_user_id") or dag_state.content_catalog_user_id or principal_id).strip()
            or principal_id
        )
        celery_id = enqueue_companion_run(
            run_id=run_id,
            step_index=step_index,
            countdown_sec=delay_sec,
            job_payload={
                "user_line": user_line,
                "content_catalog_user_id": content_catalog_user_id,
                "principal_id": principal_id,
                "dag_delay_wakeup": True,
            },
        )
        if celery_id is None:
            msg = "dag_delay_enqueue_failed"
            raise RuntimeError(msg)
        return

    if str(node.type) == "delay" and bool(job_payload.get("dag_delay_wakeup")):
        delay_sec = int(node.config.delay_sec or 0)
        apply_dag_node_success(
            state=dag_state,
            node_id=node_id,
            outputs={"delayed_sec": delay_sec},
            outcome=NodeRunOutcome(status="ok", attempts=1),
        )
        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="completed",
            output_payload={"node_id": node_id, "status": "ok", "outputs": {"delayed_sec": delay_sec}},
        )
        await publish_executor_step_event(
            principal_id=principal_id,
            run=run,
            step=step,
            status="completed",
        )
        merged_plan = merge_dag_state_into_plan(plan_payload, dag_state)
        updated = await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            status="running",
            plan_payload=merged_plan,
            expect_revision=run_revision(run),
        )
        if updated is None:
            msg = "dag_run_revision_conflict_after_delay"
            raise RuntimeError(msg)
        run = updated
        await enqueue_next_dag_node(
            pool,
            run=run,
            state=dag_state,
            plan_payload=merged_plan,
            steps=steps,
            job_payload=job_payload,
        )
        return

    if node_id in set(dag_state.skipped_node_ids):
        _apply_node_skip(state=dag_state, node_id=node_id)
        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="skipped",
            output_payload={"node_id": node_id, "reason": "skipped_due_to_error"},
        )
        await publish_executor_step_event(
            principal_id=principal_id,
            run=run,
            step=step,
            status="skipped",
        )
        await enqueue_next_dag_node(
            pool,
            run=run,
            state=dag_state,
            plan_payload=plan_payload,
            steps=steps,
            job_payload=job_payload,
        )
        return

    registry = registry_from_dag_state(dag_state, principal_id=principal_id)
    tool_ctx = _build_tool_context(pool=pool, run=run, job_payload=job_payload, dag_state=dag_state)
    executor_map: dict[str, NodeExecutorFn] = dict(DEFAULT_NODE_EXECUTOR_REGISTRY)

    result, _attempts, outcome = await _execute_node_with_policy(
        node=node,
        node_id=node_id,
        definition=definition,
        graph=graph,
        registry=registry,
        base_ctx=tool_ctx,
        executor_map=executor_map,
        workflow_parent_run_id=run_id,
        workflow_parent_step_index=step_index,
    )

    if outcome.status in {"ok", "accepted", "needs_confirm"}:
        if outcome.status == "ok":
            apply_dag_node_success(
                state=dag_state,
                node_id=node_id,
                outputs=result.outputs,
                outcome=outcome,
            )
            if str(node.type) == FOR_EACH_NODE_TYPE:
                body_ids = collect_loop_body_node_ids(definition, graph, node_id)
                for body_id in body_ids:
                    body_outputs = dict(registry.get_node_outputs(body_id) or {})
                    dag_state.registry_snapshot[body_id] = body_outputs
                    if body_id in dag_state.pending_node_ids:
                        dag_state.pending_node_ids = [
                            pending_id for pending_id in dag_state.pending_node_ids if pending_id != body_id
                        ]
                    if body_id not in dag_state.completed_node_ids:
                        dag_state.completed_node_ids.append(body_id)
                    dag_state.node_outcomes[body_id] = NodeRunOutcome(status="ok", attempts=1)
            if str(node.type) in BRANCHING_NODE_TYPES:
                branch_skip_set = set(dag_state.skipped_node_ids)
                apply_branch_skips_after_node(
                    graph=graph,
                    definition=definition,
                    node_id=node_id,
                    selected_branch=str(result.outputs.get("branch") or ""),
                    skipped_node_ids=branch_skip_set,
                    node_outcomes=dag_state.node_outcomes,
                    pending_node_ids=dag_state.pending_node_ids,
                )
                dag_state.skipped_node_ids = sorted(branch_skip_set)

        if outcome.status == "needs_confirm":
            await companion_task_step_update(
                pool,
                step_id=step_id,
                status="awaiting_confirmation",
                output_payload={
                    "node_id": node_id,
                    "node_type": str(node.type),
                    "status": outcome.status,
                    "outputs": dict(result.outputs),
                },
            )
            await publish_executor_step_event(
                principal_id=principal_id,
                run=run,
                step=step,
                status="awaiting_confirmation",
            )
            merged_plan = merge_dag_state_into_plan(plan_payload, dag_state)
            await companion_pg.companion_task_run_update(
                pool,
                run_id=run_id,
                principal_id=principal_id,
                status="awaiting_confirmation",
                plan_payload=merged_plan,
                confirmation_state={
                    "kind": "workflow_confirm_gate",
                    "engine": "dag_v2",
                    "step_index": step_index,
                    "node_id": node_id,
                    "workflow_id": str(run.get("workflow_id") or ""),
                },
            )
            return

        if outcome.status == "accepted":
            await companion_task_step_update(
                pool,
                step_id=step_id,
                status="in_progress",
                output_payload={
                    "node_id": node_id,
                    "node_type": str(node.type),
                    "status": outcome.status,
                    "outputs": dict(result.outputs),
                },
            )
            await publish_executor_step_event(
                principal_id=principal_id,
                run=run,
                step=step,
                status="in_progress",
            )
            await companion_pg.companion_task_run_update(
                pool,
                run_id=run_id,
                principal_id=principal_id,
                status="running",
                plan_payload=plan_payload,
                result_payload={"node_id": node_id, "status": "accepted"},
            )
            return

        await companion_task_step_update(
            pool,
            step_id=step_id,
            status="completed",
            output_payload={
                "node_id": node_id,
                "node_type": str(node.type),
                "status": outcome.status,
                "outputs": dict(result.outputs),
            },
        )
        await publish_executor_step_event(
            principal_id=principal_id,
            run=run,
            step=step,
            status="completed",
        )

        merged_plan = merge_dag_state_into_plan(plan_payload, dag_state)
        updated = await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            status="running",
            plan_payload=merged_plan,
            expect_revision=run_revision(run),
        )
        if updated is None:
            msg = "dag_run_revision_conflict_after_node"
            raise RuntimeError(msg)
        run = updated
        await enqueue_next_dag_node(
            pool,
            run=run,
            state=dag_state,
            plan_payload=merged_plan,
            steps=steps,
            job_payload=job_payload,
        )
        return

    dag_state.failed_node_id = node_id
    dag_state.error = outcome.error
    dag_state.node_outcomes[node_id] = outcome
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

    await companion_task_step_update(
        pool,
        step_id=step_id,
        status="failed",
        error_payload={"node_id": node_id, "message": outcome.error or "node failed"},
        output_payload={"node_id": node_id, "status": "failed"},
    )
    await publish_executor_step_event(
        principal_id=principal_id,
        run=run,
        step=step,
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


__all__ = (
    "apply_dag_node_success",
    "enqueue_next_dag_node",
    "execute_dag_node_step",
    "finalize_dag_run",
    "mark_dag_downstream_steps_skipped",
)
