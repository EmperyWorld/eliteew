# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Outbound DAG node guardrails: confirm_gate ancestry validation (Phase 2.6.3).
# Invariants:
# - Every outbound node must have a ``confirm_gate`` ancestor on all upstream paths.
# Related:
# - api/ewa_platform/companion/workflows/dag/validation.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import get_tool_binding
from api.ewa_platform.companion.workflows.dag.graph import WorkflowGraph, build_workflow_graph
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
)

OUTBOUND_DAG_NODE_TYPES: frozenset[str] = frozenset({"telegram_sender", "email_dispatcher"})

OUTBOUND_TOOL_NAMES: frozenset[str] = frozenset({"telegram_sender", "email_dispatcher"})


def collect_transitive_upstream(graph: WorkflowGraph, node_id: str) -> set[str]:
    pending = list(graph.get_upstream(node_id))
    visited: set[str] = set()
    while pending:
        current = pending.pop()
        if current in visited:
            continue
        visited.add(current)
        pending.extend(graph.get_upstream(current))
    return visited


def validate_outbound_confirm_gates(definition: CompanionWorkflowDefinitionV2) -> list[str]:
    """Require ``confirm_gate`` upstream of every outbound node."""

    graph = build_workflow_graph(definition)
    errors: list[str] = []
    for node_id, node in graph.nodes_by_id.items():
        if str(node.type) not in OUTBOUND_DAG_NODE_TYPES:
            continue
        upstream_ids = collect_transitive_upstream(graph, node_id)
        has_confirm = any(str(graph.nodes_by_id[upstream_id].type) == "confirm_gate" for upstream_id in upstream_ids)
        if not has_confirm:
            errors.append(f"node {node_id} ({node.type}): outbound delivery requires an upstream confirm_gate node")
    return errors


def _confirm_gate_confirmed(registry: WorkflowStateRegistry, confirm_node_id: str) -> bool:
    outputs = registry.get_node_outputs(confirm_node_id)
    if outputs is None:
        return False
    confirmed = outputs.get("confirmed")
    if confirmed is True:
        return True
    return isinstance(confirmed, str) and confirmed.strip().lower() in {"1", "true", "yes", "on"}


def check_outbound_runtime_guard(
    *,
    node: CompanionWorkflowNodeV2,
    node_id: str,
    definition: CompanionWorkflowDefinitionV2 | None,
    registry: WorkflowStateRegistry | None,
) -> str | None:
    """Return an error message when strict outbound guard blocks dispatch, else ``None``."""

    from api.ewa_platform.companion.workflows.config import companion_wf_strict_outbound_guard_enabled

    if not companion_wf_strict_outbound_guard_enabled():
        return None

    binding = get_tool_binding(str(node.type))
    if binding is None or not binding.requires_confirm_gate:
        return None

    if definition is None or registry is None:
        return f"node {node_id} ({node.type}): outbound runtime guard missing DAG context"

    graph = build_workflow_graph(definition)
    upstream_ids = collect_transitive_upstream(graph, node_id)
    confirm_ids = [
        upstream_id for upstream_id in upstream_ids if str(graph.nodes_by_id[upstream_id].type) == "confirm_gate"
    ]
    if not confirm_ids:
        return f"node {node_id} ({node.type}): outbound delivery requires an upstream confirm_gate node"

    if not any(_confirm_gate_confirmed(registry, confirm_id) for confirm_id in confirm_ids):
        return (
            f"node {node_id} ({node.type}): outbound delivery requires a confirmed upstream confirm_gate "
            "(set confirmed=True after user approval)"
        )
    return None


__all__ = (
    "OUTBOUND_DAG_NODE_TYPES",
    "OUTBOUND_TOOL_NAMES",
    "check_outbound_runtime_guard",
    "collect_transitive_upstream",
    "validate_outbound_confirm_gates",
)
