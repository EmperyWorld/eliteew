# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Circuit breaker helpers: downstream skip closure and run status finalization.
# Invariants:
# - Retry exhaustion behaves like ``stop`` (skip all transitive downstream nodes).
# Related:
# - api/ewa_platform/companion/workflows/dag/runner.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.graph import WorkflowGraph


def collect_transitive_downstream(graph: WorkflowGraph, node_id: str) -> set[str]:
    """Return all nodes reachable downstream from ``node_id`` (excluding the source)."""

    pending = list(graph.get_downstream(node_id))
    visited: set[str] = set()
    while pending:
        current = pending.pop()
        if current in visited:
            continue
        visited.add(current)
        pending.extend(graph.get_downstream(current))
    return visited


def finalize_run_status(
    *,
    ordered_node_ids: list[str],
    completed_node_ids: set[str],
    skipped_node_ids: set[str],
    failed_node_id: str | None,
    branch_skipped_node_ids: set[str] | None = None,
) -> str:
    branch_skipped = branch_skipped_node_ids or set()
    error_skipped = skipped_node_ids - branch_skipped
    if failed_node_id is None and not error_skipped:
        return "completed"
    if completed_node_ids and error_skipped:
        return "partial"
    if not completed_node_ids and failed_node_id is not None:
        return "failed"
    if completed_node_ids and failed_node_id is not None:
        return "partial"
    return "failed"


__all__ = (
    "collect_transitive_downstream",
    "finalize_run_status",
)
