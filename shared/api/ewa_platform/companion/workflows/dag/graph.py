# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build adjacency structures and compute topological execution order for DAG workflows.
# Invariants:
# - Cycles raise ``CycleDetectedError`` with the unresolved node id set.
# - Orphan nodes (no incoming edges) are valid entrypoints.
# Related:
# - api/ewa_platform/companion/workflows/dag/runner.py
# ---

from __future__ import annotations

import heapq
from collections import defaultdict
from dataclasses import dataclass
from uuid import UUID

from api.ewa_platform.companion.workflows.dag.errors import CycleDetectedError
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowEdgeV2,
    CompanionWorkflowNodeV2,
)


@dataclass(frozen=True, slots=True)
class WorkflowGraph:
    """In-memory graph view for one DAG definition."""

    nodes_by_id: dict[str, CompanionWorkflowNodeV2]
    edges: tuple[CompanionWorkflowEdgeV2, ...]
    adjacency: dict[str, tuple[str, ...]]
    reverse_adjacency: dict[str, tuple[str, ...]]
    in_degree: dict[str, int]

    def get_upstream(self, node_id: str) -> tuple[str, ...]:
        return self.reverse_adjacency.get(node_id, ())

    def get_downstream(self, node_id: str) -> tuple[str, ...]:
        return self.adjacency.get(node_id, ())

    def entrypoint_node_ids(self) -> tuple[str, ...]:
        return tuple(sorted(node_id for node_id, degree in self.in_degree.items() if degree == 0))


def _node_id_str(node_id: UUID | str) -> str:
    return str(node_id)


def build_workflow_graph(definition: CompanionWorkflowDefinitionV2) -> WorkflowGraph:
    nodes_by_id = {_node_id_str(node.id): node for node in definition.nodes}
    edges = tuple(definition.edges)
    adjacency: dict[str, list[str]] = defaultdict(list)
    reverse_adjacency: dict[str, list[str]] = defaultdict(list)
    in_degree = dict.fromkeys(nodes_by_id, 0)

    for edge in edges:
        source = _node_id_str(edge.source_node_id)
        target = _node_id_str(edge.target_node_id)
        adjacency[source].append(target)
        reverse_adjacency[target].append(source)
        in_degree[target] = in_degree.get(target, 0) + 1

    for node_id in nodes_by_id:
        adjacency.setdefault(node_id, [])
        reverse_adjacency.setdefault(node_id, [])

    frozen_adjacency = {node_id: tuple(sorted(neighbors)) for node_id, neighbors in adjacency.items()}
    frozen_reverse = {node_id: tuple(sorted(neighbors)) for node_id, neighbors in reverse_adjacency.items()}
    return WorkflowGraph(
        nodes_by_id=nodes_by_id,
        edges=edges,
        adjacency=frozen_adjacency,
        reverse_adjacency=frozen_reverse,
        in_degree=in_degree,
    )


def topological_sort_node_ids(graph: WorkflowGraph) -> list[str]:
    """Return node ids in a valid execution order (Kahn's algorithm)."""

    in_degree = dict(graph.in_degree)
    ready = [node_id for node_id, degree in in_degree.items() if degree == 0]
    heapq.heapify(ready)
    ordered: list[str] = []

    while ready:
        node_id = heapq.heappop(ready)
        ordered.append(node_id)
        for downstream in graph.adjacency.get(node_id, ()):
            in_degree[downstream] -= 1
            if in_degree[downstream] == 0:
                heapq.heappush(ready, downstream)

    if len(ordered) != len(graph.nodes_by_id):
        remaining = tuple(sorted(node_id for node_id, degree in in_degree.items() if degree > 0))
        raise CycleDetectedError(remaining_node_ids=remaining)
    return ordered


__all__ = (
    "WorkflowGraph",
    "build_workflow_graph",
    "topological_sort_node_ids",
)
