# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validation rules for ``for_each`` loop nodes (Sprint 2.6.6).
# Related:
# - api/ewa_platform/companion/workflows/dag/validation.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.dag_loop import (
    LOOP_BODY_BRANCH,
    collect_loop_body_node_ids,
    outgoing_branch_targets,
)
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2


def validate_for_each_nodes(definition: CompanionWorkflowDefinitionV2) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    graph = build_workflow_graph(definition)

    for node_id, node in graph.nodes_by_id.items():
        if str(node.type) != "for_each":
            continue
        body_entries = outgoing_branch_targets(definition, node_id, LOOP_BODY_BRANCH)
        if len(body_entries) != 1:
            errors.append(
                f"node {node_id} (for_each): requires exactly one outgoing edge with branch={LOOP_BODY_BRANCH!r}"
            )
            continue
        body_nodes = collect_loop_body_node_ids(definition, graph, node_id)
        if not body_nodes:
            errors.append(f"node {node_id} (for_each): loop body is empty")
        nested_for_each = [body_id for body_id in body_nodes if str(graph.nodes_by_id[body_id].type) == "for_each"]
        if nested_for_each:
            warnings.append(
                f"node {node_id} (for_each): nested for_each in loop body is not supported yet ({nested_for_each[0]})"
            )
        if not str(node.config.items_field or "items").strip():
            warnings.append(f"node {node_id} (for_each): items_field not configured; defaults to items")

    return errors, warnings


__all__ = ("validate_for_each_nodes",)
