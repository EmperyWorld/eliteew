# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validation rules for decision/switch branching nodes (Sprint 2.6.5).
# Invariants:
# - Branching nodes require at least two uniquely labeled outgoing edges.
# - Switch cases without matching edges are reported as unreachable branch errors.
# Related:
# - api/ewa_platform/companion/workflows/dag/validation.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.dag_branching import (
    branch_labels_on_outgoing_edges,
    normalize_decision_branch,
    normalize_switch_branch,
)
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2


def validate_branching_nodes(definition: CompanionWorkflowDefinitionV2) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    graph = build_workflow_graph(definition)

    for node_id, node in graph.nodes_by_id.items():
        node_type = str(node.type)
        if node_type not in {"decision", "switch"}:
            continue

        labels = branch_labels_on_outgoing_edges(
            definition,
            node_id,
            normalize_decision=node_type == "decision",
        )
        if len(labels) < 2:
            errors.append(f"node {node_id} ({node_type}): requires at least two outgoing branch edges")
            continue
        if len(labels) != len(set(labels)):
            errors.append(f"node {node_id} ({node_type}): duplicate branch labels on outgoing edges")

        if node_type == "decision":
            normalized = {normalize_decision_branch(label) for label in labels}
            if "yes" not in normalized or "no" not in normalized:
                errors.append(f"node {node_id} (decision): outgoing branches must include yes/true and no/false labels")
            if not str(node.config.condition_op or "").strip():
                warnings.append(f"node {node_id} (decision): condition_op not set; defaults to truthy")

        if node_type == "switch":
            edge_branches = set(labels)
            case_branches = {normalize_switch_branch(case.branch) for case in node.config.switch_cases}
            if "default" not in edge_branches:
                warnings.append(
                    f"node {node_id} (switch): no default outgoing edge; unmatched values skip all branches"
                )
            for case_branch in sorted(case_branches):
                if case_branch not in edge_branches:
                    errors.append(
                        f"node {node_id} (switch): case branch {case_branch!r} has no outgoing edge (unreachable)"
                    )
            for edge_branch in sorted(edge_branches):
                if edge_branch == "default":
                    continue
                if edge_branch not in case_branches:
                    warnings.append(f"node {node_id} (switch): edge branch {edge_branch!r} has no matching switch case")

    return errors, warnings


__all__ = ("validate_branching_nodes",)
