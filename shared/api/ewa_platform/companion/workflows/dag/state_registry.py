# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime store for DAG node outputs and turn-level context during workflow execution.
# Invariants:
# - Node outputs are keyed by stringified UUID.
# Related:
# - api/ewa_platform/companion/workflows/dag/variable_resolver.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class LoopContext:
    for_each_node_id: str
    index: int
    item: Any
    total: int


def _nested_get(obj: Any, parts: list[str]) -> Any:
    cur = obj
    for part in parts:
        if cur is None:
            return None
        if isinstance(cur, Mapping):
            cur = cur.get(part)
        else:
            return None
    return cur


@dataclass
class WorkflowStateRegistry:
    """In-process state registry for one DAG run."""

    user_line: str = ""
    principal_id: str = ""
    _node_outputs: dict[str, Mapping[str, Any]] = field(default_factory=dict)
    _loop_stack: list[LoopContext] = field(default_factory=list)

    def push_loop(self, context: LoopContext) -> None:
        self._loop_stack.append(context)

    def pop_loop(self) -> LoopContext | None:
        if not self._loop_stack:
            return None
        return self._loop_stack.pop()

    def current_loop(self) -> LoopContext | None:
        if not self._loop_stack:
            return None
        return self._loop_stack[-1]

    def register_turn_context(self, *, user_line: str, principal_id: str) -> None:
        self.user_line = user_line
        self.principal_id = principal_id

    def register(self, node_id: str, outputs: Mapping[str, Any]) -> None:
        self._node_outputs[str(node_id)] = dict(outputs)

    def get_node_outputs(self, node_id: str) -> Mapping[str, Any] | None:
        return self._node_outputs.get(str(node_id))

    def resolve_turn_path(self, parts: list[str]) -> Any:
        if not parts:
            return None
        if parts[0] == "user_line":
            return self.user_line
        if parts[0] == "principal_id":
            return self.principal_id
        return None

    def resolve_loop_path(self, parts: list[str]) -> Any:
        loop = self.current_loop()
        if loop is None or not parts:
            return None
        head = parts[0]
        if head == "item":
            if len(parts) == 1:
                return loop.item
            return _nested_get(loop.item, parts[1:])
        if head == "index":
            return loop.index
        if head == "total":
            return loop.total
        if head == "id":
            return loop.for_each_node_id
        return None

    def get_path(self, node_id: str, field_path: list[str]) -> Any:
        outputs = self.get_node_outputs(node_id)
        if outputs is None:
            return None
        return _nested_get(outputs, field_path)

    def snapshot(self) -> dict[str, Mapping[str, Any]]:
        return {node_id: dict(outputs) for node_id, outputs in self._node_outputs.items()}

    def freeze(self) -> Mapping[str, Mapping[str, Any]]:
        return self.snapshot()


__all__ = ("LoopContext", "WorkflowStateRegistry")
