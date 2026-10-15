# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Runtime context + Jinja-like placeholder resolver for action workflow step args (WF-3).
# Invariants:
# - Supported roots: ``turn.*``, ``steps.<index>.*``, ``steps.by_key.<step_key>.*``.
# - Unknown paths resolve to empty string in templates (no exception).
# Related:
# - api/ewa_platform/companion/workflows/action/starter.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §4.2
# ---

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")


@dataclass(slots=True)
class WorkflowRunContext:
    """Resolved inputs for ``args_template`` substitution during workflow execution."""

    user_line: str = ""
    principal_id: str = ""
    steps: tuple[Mapping[str, Any], ...] = field(default_factory=tuple)

    def resolve_path(self, path: str) -> Any:
        parts = [p for p in str(path or "").strip().split(".") if p]
        if not parts:
            return None
        if parts[0] == "turn":
            if len(parts) == 2 and parts[1] == "user_line":
                return self.user_line
            if len(parts) == 2 and parts[1] == "principal_id":
                return self.principal_id
            return None
        if parts[0] != "steps" or len(parts) < 3:
            return None
        if parts[1] == "by_key" and len(parts) >= 4:
            step_key = parts[2]
            step = _step_by_key(self.steps, step_key)
            if step is None:
                return None
            if parts[3] == "output":
                return _nested_get(step.get("output_payload"), parts[4:])
            if parts[3] == "input":
                return _nested_get(step.get("input_payload"), parts[4:])
            return _nested_get(step, parts[3:])
        try:
            step_index = int(parts[1])
        except ValueError:
            return None
        step = _step_by_index(self.steps, step_index)
        if step is None:
            return None
        if parts[2] == "output":
            return _nested_get(step.get("output_payload"), parts[3:])
        if parts[2] == "input":
            return _nested_get(step.get("input_payload"), parts[3:])
        return _nested_get(step, parts[2:])


def _step_by_index(steps: Sequence[Mapping[str, Any]], index: int) -> Mapping[str, Any] | None:
    for step in steps:
        if int(step.get("step_index") or 0) == index + 1:
            return step
    if 0 <= index < len(steps):
        return steps[index]
    return None


def _step_by_key(steps: Sequence[Mapping[str, Any]], step_key: str) -> Mapping[str, Any] | None:
    key = str(step_key or "").strip()
    if not key:
        return None
    for step in steps:
        inp = step.get("input_payload")
        if isinstance(inp, Mapping) and str(inp.get("step_key") or "") == key:
            return step
    return None


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


def resolve_template_string(template: str, ctx: WorkflowRunContext) -> str:
    """Replace ``{{path}}`` placeholders in a string."""

    def _repl(match: re.Match[str]) -> str:
        val = ctx.resolve_path(match.group(1))
        if val is None:
            return ""
        return str(val)

    return _PLACEHOLDER_RE.sub(_repl, str(template or ""))


def resolve_template_value(value: Any, ctx: WorkflowRunContext) -> Any:
    """Recursively resolve placeholders in strings inside dicts/lists."""

    if isinstance(value, str):
        return resolve_template_string(value, ctx)
    if isinstance(value, Mapping):
        return {str(k): resolve_template_value(v, ctx) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve_template_value(v, ctx) for v in value]
    return value


def resolve_args_template(args_template: Mapping[str, Any], ctx: WorkflowRunContext) -> dict[str, Any]:
    """Resolve workflow step ``args_template`` to concrete tool args."""

    resolved = resolve_template_value(dict(args_template), ctx)
    return resolved if isinstance(resolved, dict) else {}


def build_declarative_tool_dispatch_args(
    *,
    user_line: str,
    principal_id: str,
    args_template: Mapping[str, Any] | None = None,
    steps: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Resolve template args and mark router bypass for declarative workflow tool dispatch."""

    wf_ctx = WorkflowRunContext(
        user_line=user_line,
        principal_id=principal_id,
        steps=tuple(steps or ()),
    )
    tool_args = resolve_args_template(args_template or {"user_line": user_line}, wf_ctx)
    return {
        **tool_args,
        "user_line": user_line,
        "_tool_router_bypass_line_match": True,
    }


__all__ = (
    "WorkflowRunContext",
    "build_declarative_tool_dispatch_args",
    "resolve_args_template",
    "resolve_template_string",
    "resolve_template_value",
)
