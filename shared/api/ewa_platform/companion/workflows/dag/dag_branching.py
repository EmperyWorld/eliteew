# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Decision/switch node evaluation and branch-aware downstream skip computation (Sprint 2.6.5).
# Invariants:
# - Selected branch keeps merge nodes reachable from the active path; unselected subtrees are skipped.
# - Decision branches normalize to ``yes`` / ``no`` for edge matching.
# Related:
# - api/ewa_platform/companion/workflows/dag/runner.py
# - api/ewa_platform/companion/workflows/dag/dag_node_executor.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.workflows.dag.circuit_breaker import collect_transitive_downstream
from api.ewa_platform.companion.workflows.dag.dag_expression import (
    evaluate_boolean_expression,
)
from api.ewa_platform.companion.workflows.dag.graph import WorkflowGraph
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowSwitchCaseV2,
)

BRANCHING_NODE_TYPES: frozenset[str] = frozenset({"decision", "switch"})
DECISION_YES_BRANCHES: frozenset[str] = frozenset({"yes", "true"})
DECISION_NO_BRANCHES: frozenset[str] = frozenset({"no", "false"})


def normalize_decision_branch(label: str) -> str:
    raw = str(label or "").strip().lower()
    if raw in DECISION_YES_BRANCHES:
        return "yes"
    if raw in DECISION_NO_BRANCHES:
        return "no"
    return raw


def normalize_switch_branch(label: str) -> str:
    return str(label or "").strip().lower()


def _resolve_field(resolved_inputs: Mapping[str, Any], field: str) -> Any:
    key = str(field or "text").strip() or "text"
    if key in resolved_inputs:
        return resolved_inputs[key]
    return resolved_inputs.get("text") or resolved_inputs.get("reply") or resolved_inputs.get("body")


def _coerce_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _compare(op: str, left: Any, right: Any) -> bool:
    operation = str(op or "truthy").strip().lower()
    if operation in {"truthy", "true"}:
        if isinstance(left, bool):
            return left
        if isinstance(left, (int, float)):
            return left != 0
        return bool(str(left or "").strip())
    if operation in {"falsy", "false"}:
        return not _compare("truthy", left, right)

    if operation.startswith("length_"):
        left_len = len(str(left or ""))
        right_num = _coerce_number(right)
        if right_num is None:
            return False
        threshold = int(right_num)
        if operation == "length_gt":
            return left_len > threshold
        if operation == "length_gte":
            return left_len >= threshold
        if operation == "length_lt":
            return left_len < threshold
        if operation == "length_lte":
            return left_len <= threshold
        return False

    if operation == "contains":
        needle = str(right or "")
        return needle == "" or needle in str(left or "")

    left_num = _coerce_number(left)
    right_num = _coerce_number(right)
    if left_num is not None and right_num is not None:
        if operation == "eq":
            return left_num == right_num
        if operation == "ne":
            return left_num != right_num
        if operation == "gt":
            return left_num > right_num
        if operation == "gte":
            return left_num >= right_num
        if operation == "lt":
            return left_num < right_num
        if operation == "lte":
            return left_num <= right_num

    left_text = str(left if left is not None else "")
    right_text = str(right if right is not None else "")
    if operation == "eq":
        return left_text == right_text
    if operation == "ne":
        return left_text != right_text
    return False


def evaluate_decision(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    *,
    registry: WorkflowStateRegistry | None = None,
) -> tuple[bool, str]:
    """Evaluate a decision node; return (result, branch label ``yes``/``no``)."""

    config = node.config
    expression = str(config.condition_expression or "").strip()
    if expression:
        result = evaluate_boolean_expression(expression, registry, resolved_inputs)
        branch = "yes" if result else "no"
        return result, branch

    op = str(config.condition_op or "truthy").strip().lower()
    field = str(config.condition_field or "text").strip() or "text"
    left = _resolve_field(resolved_inputs, field)
    result = _compare(op, left, config.condition_value)
    branch = "yes" if result else "no"
    return result, branch


def evaluate_switch(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    *,
    registry: WorkflowStateRegistry | None = None,
) -> tuple[str, str]:
    """Evaluate switch cases; return (matched_branch, branch label for routing)."""

    cases: list[CompanionWorkflowSwitchCaseV2] = list(node.config.switch_cases or [])
    default_source = str(node.config.switch_source or "text").strip() or "text"
    for case in cases:
        case_expression = str(case.expression or "").strip()
        if case_expression:
            if evaluate_boolean_expression(case_expression, registry, resolved_inputs):
                branch = normalize_switch_branch(case.branch)
                return branch, branch
            continue
        source = str(case.source or default_source).strip() or default_source
        left = _resolve_field(resolved_inputs, source)
        if _compare(str(case.op or "eq"), left, case.value):
            branch = normalize_switch_branch(case.branch)
            return branch, branch
    return "default", "default"


def outgoing_edges(definition: CompanionWorkflowDefinitionV2, node_id: str):
    target = str(node_id)
    return [edge for edge in definition.edges if str(edge.source_node_id) == target]


def compute_branch_skip_nodes(
    graph: WorkflowGraph,
    definition: CompanionWorkflowDefinitionV2,
    *,
    node_id: str,
    selected_branch: str,
) -> set[str]:
    """Skip unselected branch targets and their downstream, preserving merge nodes on the active path."""

    selected = normalize_switch_branch(selected_branch)
    if str(graph.nodes_by_id[node_id].type) == "decision":
        selected = normalize_decision_branch(selected_branch)

    edges = outgoing_edges(definition, node_id)
    selected_targets: set[str] = set()
    skip: set[str] = set()

    for edge in edges:
        branch = normalize_switch_branch(str(edge.branch or ""))
        if str(graph.nodes_by_id[node_id].type) == "decision":
            branch = normalize_decision_branch(str(edge.branch or ""))
        target = str(edge.target_node_id)
        if not branch:
            continue
        if branch == selected:
            selected_targets.add(target)
            continue
        skip.add(target)
        skip |= collect_transitive_downstream(graph, target)

    reachable_from_selected: set[str] = set()
    for target in selected_targets:
        reachable_from_selected.add(target)
        reachable_from_selected |= collect_transitive_downstream(graph, target)

    return skip - reachable_from_selected


def branch_labels_on_outgoing_edges(
    definition: CompanionWorkflowDefinitionV2,
    node_id: str,
    *,
    normalize_decision: bool = False,
) -> list[str]:
    labels: list[str] = []
    for edge in outgoing_edges(definition, node_id):
        label = str(edge.branch or "").strip()
        if not label:
            continue
        label = normalize_decision_branch(label) if normalize_decision else normalize_switch_branch(label)
        labels.append(label)
    return labels


def apply_branch_skips_after_node(
    *,
    graph: WorkflowGraph,
    definition: CompanionWorkflowDefinitionV2,
    node_id: str,
    selected_branch: str,
    skipped_node_ids: set[str],
    node_outcomes: dict[str, Any],
    pending_node_ids: list[str],
) -> set[str]:
    """Mark unselected branch targets (and downstream) as skipped while preserving merge nodes."""

    from api.ewa_platform.companion.workflows.dag.runner import NodeRunOutcome

    route_skips = compute_branch_skip_nodes(
        graph,
        definition,
        node_id=node_id,
        selected_branch=selected_branch,
    )
    for skip_id in route_skips:
        skipped_node_ids.add(skip_id)
        node_outcomes[skip_id] = NodeRunOutcome(
            status="skipped_due_to_branch",
            skipped_due_to_branch=True,
        )
    if route_skips and pending_node_ids:
        skip_set = set(route_skips)
        pending_node_ids[:] = [node for node in pending_node_ids if node not in skip_set]
    return route_skips


__all__ = (
    "BRANCHING_NODE_TYPES",
    "DECISION_NO_BRANCHES",
    "DECISION_YES_BRANCHES",
    "apply_branch_skips_after_node",
    "branch_labels_on_outgoing_edges",
    "compute_branch_skip_nodes",
    "evaluate_decision",
    "evaluate_switch",
    "normalize_decision_branch",
    "normalize_switch_branch",
    "outgoing_edges",
)
