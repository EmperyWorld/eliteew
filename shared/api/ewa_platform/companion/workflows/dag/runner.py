# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Synchronous in-process DAG workflow runner with circuit breaker policies (Phase 2).
# Invariants:
# - Validates with tier quota before execution; retry exhaustion → stop + skip downstream.
# Related:
# - api/ewa_platform/companion/workflows/dag/circuit_breaker.py
# ---

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.circuit_breaker import (
    collect_transitive_downstream,
    finalize_run_status,
)
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.context_switcher import build_node_tool_context
from api.ewa_platform.companion.workflows.dag.dag_branching import (
    BRANCHING_NODE_TYPES,
    compute_branch_skip_nodes,
)
from api.ewa_platform.companion.workflows.dag.dag_loop import (
    FOR_EACH_NODE_TYPE,
    collect_all_loop_body_node_ids,
    collect_loop_body_node_ids,
    run_for_each_node,
)
from api.ewa_platform.companion.workflows.dag.errors import NodeExecutionError
from api.ewa_platform.companion.workflows.dag.executors import (
    DEFAULT_NODE_EXECUTOR_REGISTRY,
    NodeExecutionResult,
    NodeExecutorFn,
)
from api.ewa_platform.companion.workflows.dag.graph import (
    WorkflowGraph,
    build_workflow_graph,
    topological_sort_node_ids,
)
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.companion.workflows.dag.variable_resolver import resolve_node_inputs
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

logger = logging.getLogger(__name__)

DagRunStatus = Literal["completed", "failed", "partial", "invalid"]


@dataclass(frozen=True, slots=True)
class NodeRunOutcome:
    status: str
    attempts: int = 0
    error: str | None = None
    used_fallback: bool = False
    skipped_due_to_error: bool = False
    skipped_due_to_branch: bool = False


@dataclass
class DagRunResult:
    status: DagRunStatus
    ordered_node_ids: list[str] = field(default_factory=list)
    registry_snapshot: dict[str, Mapping[str, Any]] = field(default_factory=dict)
    node_outcomes: dict[str, NodeRunOutcome] = field(default_factory=dict)
    skipped_node_ids: list[str] = field(default_factory=list)
    completed_node_ids: list[str] = field(default_factory=list)
    failed_node_id: str | None = None
    error: str | None = None


def validation_context_from_tool_ctx(base_ctx: ToolContext) -> WorkflowValidationContext:
    auth_user = base_ctx.auth_user
    is_verified = bool(getattr(auth_user, "is_verified", False)) if auth_user is not None else False
    return WorkflowValidationContext(is_verified_user=is_verified)


async def _execute_node_once(
    *,
    node,
    node_id: str,
    definition: CompanionWorkflowDefinitionV2,
    graph: WorkflowGraph,
    registry: WorkflowStateRegistry,
    base_ctx: ToolContext,
    executor_map: Mapping[str, NodeExecutorFn],
) -> NodeExecutionResult:
    incoming = [edge for edge in definition.edges if str(edge.target_node_id) == node_id]
    resolved_inputs = resolve_node_inputs(
        node_id=node.id,
        node_inputs=node.inputs,
        incoming_edges=incoming,
        registry=registry,
    )
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
    enriched_inputs = dict(resolved_inputs)
    enriched_inputs["_dag_registry"] = registry
    enriched_inputs["_dag_definition"] = definition
    enriched_inputs["_dag_node_id"] = node_id
    try:
        return await executor(node, enriched_inputs, node_ctx)
    except NodeExecutionError as exc:
        return NodeExecutionResult(status="failed", outputs={}, error=str(exc))


async def run_workflow_dag(
    definition: CompanionWorkflowDefinitionV2,
    *,
    base_ctx: ToolContext,
    executors: Mapping[str, NodeExecutorFn] | None = None,
    validation_ctx: WorkflowValidationContext | None = None,
) -> DagRunResult:
    ctx = validation_ctx or validation_context_from_tool_ctx(base_ctx)
    validation = validate_dag_definition_for_execution(definition, ctx)
    if not validation.ok:
        return DagRunResult(
            status="invalid",
            error="; ".join(validation.errors),
        )

    graph = build_workflow_graph(definition)
    ordered = topological_sort_node_ids(graph)
    loop_body_nodes = collect_all_loop_body_node_ids(definition, graph)
    registry = WorkflowStateRegistry(
        user_line=base_ctx.user_line,
        principal_id=base_ctx.principal_id,
    )
    executor_map: dict[str, NodeExecutorFn] = dict(DEFAULT_NODE_EXECUTOR_REGISTRY)
    if executors:
        executor_map.update(dict(executors))

    skipped: set[str] = set()
    branch_skipped: set[str] = set()
    completed: set[str] = set()
    node_outcomes: dict[str, NodeRunOutcome] = {}
    failed_node_id: str | None = None
    run_error: str | None = None

    for node_id in ordered:
        if node_id in loop_body_nodes:
            continue
        if node_id in skipped:
            if node_id not in node_outcomes:
                node_outcomes[node_id] = NodeRunOutcome(
                    status="skipped_due_to_branch" if node_id in branch_skipped else "skipped_due_to_error",
                    skipped_due_to_error=node_id not in branch_skipped,
                    skipped_due_to_branch=node_id in branch_skipped,
                )
            continue

        node = graph.nodes_by_id[node_id]
        policy = node.on_error
        max_attempts = policy.max_attempts if policy.strategy == "retry" else 1
        attempts = 0
        result: NodeExecutionResult | None = None

        while attempts < max_attempts:
            attempts += 1
            if policy.strategy == "retry" and attempts > 1:
                logger.debug(
                    "[STEP] dag_node_retry node_id=%s attempt=%d max=%d",
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
            )
            if result.status == "ok":
                registry.register(node_id, result.outputs)
                completed.add(node_id)
                node_outcomes[node_id] = NodeRunOutcome(status="ok", attempts=attempts)
                if str(node.type) == FOR_EACH_NODE_TYPE:
                    body_ids = collect_loop_body_node_ids(definition, graph, node_id)
                    completed |= body_ids
                    for body_id in body_ids:
                        if registry.get_node_outputs(body_id) is not None and body_id not in node_outcomes:
                            node_outcomes[body_id] = NodeRunOutcome(status="ok", attempts=1)
                if str(node.type) in BRANCHING_NODE_TYPES:
                    selected_branch = str(result.outputs.get("branch") or "")
                    route_skips = compute_branch_skip_nodes(
                        graph,
                        definition,
                        node_id=node_id,
                        selected_branch=selected_branch,
                    )
                    branch_skipped |= route_skips
                    skipped |= route_skips
                break
            if result.status in {"accepted", "needs_confirm"}:
                registry.register(node_id, result.outputs)
                completed.add(node_id)
                node_outcomes[node_id] = NodeRunOutcome(status=result.status, attempts=attempts)
                break

            if policy.strategy == "retry" and attempts < max_attempts:
                continue
            break

        if node_id in completed:
            continue

        assert result is not None
        if policy.strategy == "fallback_value":
            registry.register(node_id, dict(policy.fallback_outputs))
            completed.add(node_id)
            node_outcomes[node_id] = NodeRunOutcome(status="ok", attempts=attempts, used_fallback=True)
            continue

        failed_node_id = node_id
        run_error = result.error or "node failed"
        node_outcomes[node_id] = NodeRunOutcome(status="failed", attempts=attempts, error=run_error)
        skipped |= collect_transitive_downstream(graph, node_id)

    skipped_sorted = sorted(skipped)
    for node_id in ordered:
        if node_id in skipped and node_id not in node_outcomes:
            node_outcomes[node_id] = NodeRunOutcome(
                status="skipped_due_to_branch" if node_id in branch_skipped else "skipped_due_to_error",
                skipped_due_to_error=node_id not in branch_skipped,
                skipped_due_to_branch=node_id in branch_skipped,
            )

    status = finalize_run_status(
        ordered_node_ids=ordered,
        completed_node_ids=completed,
        skipped_node_ids=skipped,
        failed_node_id=failed_node_id,
        branch_skipped_node_ids=branch_skipped,
    )
    return DagRunResult(
        status=status,  # type: ignore[arg-type]
        ordered_node_ids=ordered,
        registry_snapshot=registry.snapshot(),
        node_outcomes=node_outcomes,
        skipped_node_ids=skipped_sorted,
        completed_node_ids=sorted(completed),
        failed_node_id=failed_node_id,
        error=run_error,
    )


def run_workflow_dag_sync(
    definition: CompanionWorkflowDefinitionV2,
    *,
    base_ctx: ToolContext,
    executors: Mapping[str, NodeExecutorFn] | None = None,
    validation_ctx: WorkflowValidationContext | None = None,
) -> DagRunResult:
    return asyncio.run(
        run_workflow_dag(
            definition,
            base_ctx=base_ctx,
            executors=executors,
            validation_ctx=validation_ctx,
        )
    )


__all__ = (
    "DagRunResult",
    "DagRunStatus",
    "NodeRunOutcome",
    "run_workflow_dag",
    "run_workflow_dag_sync",
    "validation_context_from_tool_ctx",
)
