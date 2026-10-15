# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typed errors for the EWA companion workflow DAG engine (v2).
# Invariants:
# - Graph and resolver failures are explicit; no silent placeholder drops in v2 strict mode.
# Related:
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from __future__ import annotations


class WorkflowDagError(Exception):
    """Base error for DAG workflow engine failures."""


class CycleDetectedError(WorkflowDagError):
    """Raised when the workflow graph contains a cycle."""

    def __init__(self, *, remaining_node_ids: tuple[str, ...]) -> None:
        self.remaining_node_ids = remaining_node_ids
        ids = ", ".join(remaining_node_ids)
        super().__init__(f"workflow graph cycle detected; unresolved nodes: {ids}")


class UnresolvedPlaceholderError(WorkflowDagError):
    """Raised when a {{...}} reference cannot be resolved in strict mode."""

    def __init__(self, *, placeholder: str, path: str) -> None:
        self.placeholder = placeholder
        self.path = path
        super().__init__(f"unresolved placeholder {placeholder!r} at {path!r}")


class UnknownNodeReferenceError(WorkflowDagError):
    """Raised when a placeholder references a node id that is not in the graph."""

    def __init__(self, *, node_id: str, path: str) -> None:
        self.node_id = node_id
        self.path = path
        super().__init__(f"unknown node reference {node_id!r} at {path!r}")


class NodeExecutionError(WorkflowDagError):
    """Raised when a node executor returns a failure status."""

    def __init__(self, *, node_id: str, message: str) -> None:
        self.node_id = node_id
        self.message = message
        super().__init__(f"node {node_id!r} failed: {message}")


class TypeMismatchError(WorkflowDagError):
    """Raised when an upstream output type is incompatible with a target input spec."""

    def __init__(
        self,
        *,
        source_node_id: str,
        source_field: str,
        source_type: str,
        target_node_id: str,
        target_input_key: str,
        expected_type: str,
        path: str,
    ) -> None:
        self.source_node_id = source_node_id
        self.source_field = source_field
        self.source_type = source_type
        self.target_node_id = target_node_id
        self.target_input_key = target_input_key
        self.expected_type = expected_type
        self.path = path
        super().__init__(
            f"{path}: type mismatch — {target_node_id} input {target_input_key!r} expects "
            f"{expected_type} but {source_node_id}.{source_field} produces {source_type}"
        )


__all__ = (
    "CycleDetectedError",
    "NodeExecutionError",
    "TypeMismatchError",
    "UnknownNodeReferenceError",
    "UnresolvedPlaceholderError",
    "WorkflowDagError",
)
