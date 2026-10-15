# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ``for_each`` loop-body discovery and in-process iteration (Sprint 2.6.6).
# Invariants:
# - Loop body nodes run inside ``for_each``; the outer topo walk skips them.
# - Branch pruning inside a loop iteration is scoped to the loop body node set.
# Related:
# - api/ewa_platform/companion/workflows/dag/runner.py
# - api/ewa_platform/companion/workflows/dag/state_registry.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.circuit_breaker import collect_transitive_downstream
from api.ewa_platform.companion.workflows.dag.dag_branching import BRANCHING_NODE_TYPES, compute_branch_skip_nodes
from api.ewa_platform.companion.workflows.dag.executors import NodeExecutionResult, NodeExecutorFn
from api.ewa_platform.companion.workflows.dag.graph import WorkflowGraph, topological_sort_node_ids
from api.ewa_platform.companion.workflows.dag.state_registry import LoopContext, WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.variable_resolver import resolve_node_inputs
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
)

logger = logging.getLogger(__name__)

FOR_EACH_NODE_TYPE = "for_each"
LOOP_BODY_BRANCH = "body"
LOOP_NEXT_BRANCH = "next"

NodeExecuteFn = Callable[
    [
        CompanionWorkflowNodeV2,
        str,
        CompanionWorkflowDefinitionV2,
        WorkflowGraph,
        WorkflowStateRegistry,
        ToolContext,
        Mapping[str, NodeExecutorFn],
    ],
    Awaitable[NodeExecutionResult],
]


def _normalize_branch(label: str | None) -> str:
    return str(label or "").strip().lower()


def outgoing_branch_targets(definition: CompanionWorkflowDefinitionV2, node_id: str, branch: str) -> list[str]:
    target_branch = _normalize_branch(branch)
    targets: list[str] = []
    for edge in definition.edges:
        if str(edge.source_node_id) != str(node_id):
            continue
        if _normalize_branch(edge.branch) == target_branch:
            targets.append(str(edge.target_node_id))
    return targets


def collect_loop_body_node_ids(
    definition: CompanionWorkflowDefinitionV2,
    graph: WorkflowGraph,
    for_each_node_id: str,
) -> set[str]:
    body_entries = outgoing_branch_targets(definition, for_each_node_id, LOOP_BODY_BRANCH)
    if not body_entries:
        return set()
    next_entries = set(outgoing_branch_targets(definition, for_each_node_id, LOOP_NEXT_BRANCH))
    body_nodes: set[str] = set()
    for entry in body_entries:
        body_nodes.add(entry)
        body_nodes |= collect_transitive_downstream(graph, entry)
    if next_entries:
        after_nodes: set[str] = set()
        for entry in next_entries:
            after_nodes.add(entry)
            after_nodes |= collect_transitive_downstream(graph, entry)
        body_nodes -= after_nodes
    body_nodes.discard(str(for_each_node_id))
    return body_nodes


def collect_all_loop_body_node_ids(
    definition: CompanionWorkflowDefinitionV2,
    graph: WorkflowGraph,
) -> set[str]:
    body_nodes: set[str] = set()
    for node_id, node in graph.nodes_by_id.items():
        if str(node.type) != FOR_EACH_NODE_TYPE:
            continue
        body_nodes |= collect_loop_body_node_ids(definition, graph, node_id)
    return body_nodes


def _coerce_items(raw: Any) -> list[Any]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return list(raw)
    if isinstance(raw, tuple):
        return list(raw)
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        if text.startswith("[") and text.endswith("]"):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                return list(parsed)
        if "," in text:
            return [part.strip() for part in text.split(",") if part.strip()]
        return [text]
    return [raw]


def _ordered_body_nodes(graph: WorkflowGraph, body_nodes: set[str]) -> list[str]:
    ordered = topological_sort_node_ids(graph)
    return [node_id for node_id in ordered if node_id in body_nodes]


async def run_for_each_node(
    *,
    node: CompanionWorkflowNodeV2,
    node_id: str,
    definition: CompanionWorkflowDefinitionV2,
    graph: WorkflowGraph,
    registry: WorkflowStateRegistry,
    base_ctx: ToolContext,
    executor_map: Mapping[str, NodeExecutorFn],
    execute_node: NodeExecuteFn,
) -> NodeExecutionResult:
    incoming = [edge for edge in definition.edges if str(edge.target_node_id) == node_id]
    resolved_inputs = resolve_node_inputs(
        node_id=node.id,
        node_inputs=node.inputs,
        incoming_edges=incoming,
        registry=registry,
    )
    items_field = str(node.config.items_field or "items").strip() or "items"
    items = _coerce_items(
        resolved_inputs.get(items_field) if items_field in resolved_inputs else resolved_inputs.get("items")
    )
    body_nodes = collect_loop_body_node_ids(definition, graph, node_id)
    if not body_nodes:
        return NodeExecutionResult(
            status="failed",
            outputs={},
            error=f"for_each node {node_id} has no loop body (missing branch={LOOP_BODY_BRANCH!r} edge)",
        )

    body_order = _ordered_body_nodes(graph, body_nodes)
    iteration_results: list[dict[str, Any]] = []

    for index, item in enumerate(items):
        registry.push_loop(LoopContext(for_each_node_id=str(node_id), index=index, item=item, total=len(items)))
        iteration_skipped: set[str] = set()
        iteration_outputs: dict[str, dict[str, Any]] = {}
        failed: NodeExecutionResult | None = None

        try:
            for body_id in body_order:
                if body_id in iteration_skipped:
                    continue
                body_node = graph.nodes_by_id[body_id]
                result = await execute_node(
                    body_node,
                    body_id,
                    definition,
                    graph,
                    registry,
                    base_ctx,
                    executor_map,
                )
                if result.status != "ok":
                    failed = result
                    break
                registry.register(body_id, result.outputs)
                iteration_outputs[body_id] = dict(result.outputs)
                if str(body_node.type) in BRANCHING_NODE_TYPES:
                    selected_branch = str(result.outputs.get("branch") or "")
                    route_skips = compute_branch_skip_nodes(
                        graph,
                        definition,
                        node_id=body_id,
                        selected_branch=selected_branch,
                    )
                    iteration_skipped |= route_skips & body_nodes
        finally:
            registry.pop_loop()

        if failed is not None:
            return NodeExecutionResult(
                status="failed",
                outputs={"count": index, "items_processed": index},
                error=failed.error or f"for_each iteration {index} failed at loop body",
            )
        iteration_results.append(
            {
                "index": index,
                "item": item,
                "outputs": iteration_outputs,
            }
        )

    if iteration_results:
        last_outputs = iteration_results[-1].get("outputs")
        if isinstance(last_outputs, Mapping):
            for body_id, outputs in last_outputs.items():
                if isinstance(outputs, Mapping):
                    registry.register(str(body_id), dict(outputs))

    outputs = {
        "count": len(items),
        "items_processed": len(items),
        "iteration_results": iteration_results,
        "reply": f"for_each processed {len(items)} item(s)",
    }
    logger.info("[STEP] for_each_complete node_id=%s count=%d", node_id, len(items))
    return NodeExecutionResult(status="ok", outputs=outputs)


__all__ = (
    "FOR_EACH_NODE_TYPE",
    "LOOP_BODY_BRANCH",
    "LOOP_NEXT_BRANCH",
    "NodeExecuteFn",
    "collect_all_loop_body_node_ids",
    "collect_loop_body_node_ids",
    "outgoing_branch_targets",
    "run_for_each_node",
)
