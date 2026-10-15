# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve ``{{node_id.field}}`` placeholders against the DAG state registry (strict mode).
# Invariants:
# - ``node.inputs`` wins over ``edge.mapping_rules`` on key conflicts.
# - Unknown node references and missing fields raise explicit errors in strict mode.
# Related:
# - api/ewa_platform/companion/workflows/action/context.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any
from uuid import UUID

from api.ewa_platform.companion.workflows.dag.errors import (
    UnknownNodeReferenceError,
    UnresolvedPlaceholderError,
)
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowEdgeV2

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def _split_path(raw_path: str) -> list[str]:
    return [part for part in str(raw_path or "").strip().split(".") if part]


def _is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value))


def resolve_registry_path(registry: WorkflowStateRegistry, path: str) -> Any:
    parts = _split_path(path)
    if not parts:
        raise UnresolvedPlaceholderError(placeholder=f"{{{{{path}}}}}", path=path)
    if parts[0] == "turn":
        value = registry.resolve_turn_path(parts[1:])
        if value is None:
            raise UnresolvedPlaceholderError(placeholder=f"{{{{{path}}}}}", path=path)
        return value
    if parts[0] == "loop":
        value = registry.resolve_loop_path(parts[1:])
        if value is None:
            raise UnresolvedPlaceholderError(placeholder=f"{{{{{path}}}}}", path=path)
        return value
    head = parts[0]
    if not _is_uuid(head):
        raise UnresolvedPlaceholderError(placeholder=f"{{{{{path}}}}}", path=path)
    if registry.get_node_outputs(head) is None:
        raise UnknownNodeReferenceError(node_id=head, path=path)
    value = registry.get_path(head, parts[1:])
    if value is None:
        raise UnresolvedPlaceholderError(placeholder=f"{{{{{path}}}}}", path=path)
    return value


def resolve_template_string(template: str, registry: WorkflowStateRegistry, *, path: str = "template") -> str:
    def _repl(match: re.Match[str]) -> str:
        inner = match.group(1).strip()
        value = resolve_registry_path(registry, inner)
        return str(value)

    return _PLACEHOLDER_RE.sub(_repl, str(template or ""))


def resolve_template_value(value: Any, registry: WorkflowStateRegistry, *, path: str = "value") -> Any:
    if isinstance(value, str):
        if _PLACEHOLDER_RE.fullmatch(value.strip()):
            inner = _PLACEHOLDER_RE.match(value.strip())
            if inner is not None:
                return resolve_registry_path(registry, inner.group(1).strip())
        if "{{" in value:
            return resolve_template_string(value, registry, path=path)
        return value
    if isinstance(value, Mapping):
        return {str(key): resolve_template_value(item, registry, path=f"{path}.{key}") for key, item in value.items()}
    if isinstance(value, list):
        return [resolve_template_value(item, registry, path=f"{path}[{index}]") for index, item in enumerate(value)]
    return value


def collect_placeholders(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, str):
        for match in _PLACEHOLDER_RE.finditer(value):
            found.add(match.group(1).strip())
        return found
    if isinstance(value, Mapping):
        for item in value.values():
            found.update(collect_placeholders(item))
        return found
    if isinstance(value, list):
        for item in value:
            found.update(collect_placeholders(item))
    return found


def apply_edge_mapping_rules(
    edges: Sequence[CompanionWorkflowEdgeV2],
    *,
    target_node_id: UUID | str,
    registry: WorkflowStateRegistry,
) -> dict[str, Any]:
    target = str(target_node_id)
    merged: dict[str, Any] = {}
    for edge in edges:
        if str(edge.target_node_id) != target:
            continue
        for key, template in edge.mapping_rules.items():
            merged[str(key)] = resolve_template_value(template, registry, path=f"edge.{target}.{key}")
    return merged


def resolve_node_inputs(
    *,
    node_id: UUID | str,
    node_inputs: Mapping[str, Any],
    incoming_edges: Sequence[CompanionWorkflowEdgeV2],
    registry: WorkflowStateRegistry,
) -> dict[str, Any]:
    """Merge edge mappings first, then apply node inputs (node wins on conflicts)."""

    edge_values = apply_edge_mapping_rules(incoming_edges, target_node_id=node_id, registry=registry)
    node_values = resolve_template_value(dict(node_inputs), registry, path=f"node.{node_id}")
    if not isinstance(node_values, dict):
        node_values = {}
    return {**edge_values, **node_values}


__all__ = (
    "apply_edge_mapping_rules",
    "collect_placeholders",
    "resolve_node_inputs",
    "resolve_registry_path",
    "resolve_template_string",
    "resolve_template_value",
)
