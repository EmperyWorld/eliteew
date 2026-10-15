# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lightweight boolean expression evaluation for decision/switch nodes (Sprint 2.6.6–2.6.9).
# Invariants:
# - Placeholders resolve through ``WorkflowStateRegistry``; ``loop.*`` reads active loop frame.
# - No ``eval()``; comparisons, AND/OR/NOT, and allowlisted functions only.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_branching.py
# - api/ewa_platform/companion/workflows/dag/variable_resolver.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from api.ewa_platform.companion.workflows.dag.errors import UnresolvedPlaceholderError
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.variable_resolver import resolve_registry_path

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")
_COMPARISON_RE = re.compile(r"(==|!=|>=|<=|>|<)")
_LOGICAL_SPLIT_RE = re.compile(r"\s+(AND|OR)\s+", re.IGNORECASE)
_ALLOWED_FUNCTIONS = frozenset({"len", "string_length", "empty"})


class ExpressionEvaluationError(ValueError):
    """Raised when an expression cannot be parsed or evaluated."""


@dataclass(frozen=True, slots=True)
class _Comparison:
    left: str
    op: str
    right: str


def looks_like_expression(text: str) -> bool:
    raw = str(text or "").strip()
    if not raw:
        return False
    lower = raw.lower()
    if any(f"{name}(" in lower for name in _ALLOWED_FUNCTIONS):
        return True
    if "{{" not in raw and "}}" not in raw:
        return False
    upper = raw.upper()
    if _COMPARISON_RE.search(raw):
        return True
    return " AND " in upper or " OR " in upper or upper.startswith("NOT ")


def _strip_outer_parens(text: str) -> str:
    raw = text.strip()
    while raw.startswith("(") and raw.endswith(")"):
        depth = 0
        balanced = True
        for index, char in enumerate(raw):
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            if depth == 0 and index < len(raw) - 1:
                balanced = False
                break
        if not balanced:
            break
        raw = raw[1:-1].strip()
    return raw


def _parse_function_call(raw: str) -> tuple[str, str] | None:
    text = str(raw or "").strip()
    paren = text.find("(")
    if paren <= 0 or not text.endswith(")"):
        return None
    name = text[:paren].strip().lower()
    if name not in _ALLOWED_FUNCTIONS:
        return None
    return name, text[paren + 1 : -1].strip()


def _apply_value_function(name: str, arg_value: Any) -> Any:
    if name in {"len", "string_length"}:
        if isinstance(arg_value, (list, tuple, dict)):
            return len(arg_value)
        return len(str(arg_value or ""))
    if name == "empty":
        if arg_value is None:
            return True
        if isinstance(arg_value, (list, tuple, dict, str)):
            return len(arg_value) == 0
        return not str(arg_value).strip()
    msg = f"unsupported function {name!r}"
    raise ExpressionEvaluationError(msg)


def _resolve_operand(raw: str, registry: WorkflowStateRegistry | None, resolved_inputs: Mapping[str, Any]) -> Any:
    token = str(raw or "").strip()
    if not token:
        return ""
    function_call = _parse_function_call(token)
    if function_call is not None:
        name, arg_raw = function_call
        arg_value = _resolve_operand(arg_raw, registry, resolved_inputs)
        return _apply_value_function(name, arg_value)
    placeholder = _PLACEHOLDER_RE.fullmatch(token)
    if placeholder is not None:
        path = placeholder.group(1).strip()
        if registry is not None:
            return resolve_registry_path(registry, path)
        msg = f"registry required for placeholder {token}"
        raise ExpressionEvaluationError(msg)
    if token.startswith("{{") and token.endswith("}}"):
        inner = token[2:-2].strip()
        if registry is not None:
            return resolve_registry_path(registry, inner)
        msg = f"registry required for placeholder {token}"
        raise ExpressionEvaluationError(msg)
    if (token.startswith("'") and token.endswith("'")) or (token.startswith('"') and token.endswith('"')):
        return token[1:-1]
    lower = token.lower()
    if lower == "true":
        return True
    if lower == "false":
        return False
    try:
        if "." in token:
            return float(token)
        return int(token)
    except ValueError:
        return token


def _compare_values(left: Any, op: str, right: Any) -> bool:
    operation = op.strip()
    if operation == "==":
        return left == right or str(left) == str(right)
    if operation == "!=":
        return left != right and str(left) != str(right)
    left_num = _coerce_number(left)
    right_num = _coerce_number(right)
    if left_num is not None and right_num is not None:
        if operation == ">":
            return left_num > right_num
        if operation == "<":
            return left_num < right_num
        if operation == ">=":
            return left_num >= right_num
        if operation == "<=":
            return left_num <= right_num
    left_text = str(left if left is not None else "")
    right_text = str(right if right is not None else "")
    if operation == ">":
        return left_text > right_text
    if operation == "<":
        return left_text < right_text
    if operation == ">=":
        return left_text >= right_text
    if operation == "<=":
        return left_text <= right_text
    msg = f"unsupported comparison operator {op!r}"
    raise ExpressionEvaluationError(msg)


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


def _parse_comparison(expr: str) -> _Comparison | None:
    raw = _strip_outer_parens(expr)
    match = _COMPARISON_RE.search(raw)
    if match is None:
        return None
    left = raw[: match.start()].strip()
    right = raw[match.end() :].strip()
    if not left or not right:
        msg = f"invalid comparison expression: {expr!r}"
        raise ExpressionEvaluationError(msg)
    return _Comparison(left=left, op=match.group(1), right=right)


def _evaluate_atom(
    expr: str,
    *,
    registry: WorkflowStateRegistry | None,
    resolved_inputs: Mapping[str, Any],
) -> bool:
    raw = _strip_outer_parens(expr)
    if not raw:
        return False
    upper = raw.upper()
    if upper.startswith("NOT "):
        tail = raw[4:].strip()
        return not _evaluate_atom(tail, registry=registry, resolved_inputs=resolved_inputs)
    comparison = _parse_comparison(raw)
    if comparison is not None:
        left = _resolve_operand(comparison.left, registry, resolved_inputs)
        right = _resolve_operand(comparison.right, registry, resolved_inputs)
        return _compare_values(left, comparison.op, right)
    value = _resolve_operand(raw, registry, resolved_inputs)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return bool(str(value or "").strip())


def evaluate_boolean_expression(
    expression: str,
    registry: WorkflowStateRegistry | None,
    resolved_inputs: Mapping[str, Any] | None = None,
) -> bool:
    """Evaluate a boolean expression with placeholders, comparisons, AND/OR/NOT."""

    inputs = resolved_inputs or {}
    raw = str(expression or "").strip()
    if not raw:
        return False
    try:
        or_segments = re.split(r"\s+OR\s+", raw, flags=re.IGNORECASE)
        return any(_evaluate_and_segment(segment, registry=registry, resolved_inputs=inputs) for segment in or_segments)
    except UnresolvedPlaceholderError, ExpressionEvaluationError:
        raise
    except Exception as exc:  # noqa: BLE001
        msg = f"failed to evaluate expression {raw!r}: {exc}"
        raise ExpressionEvaluationError(msg) from exc


def _evaluate_and_segment(
    expr: str,
    *,
    registry: WorkflowStateRegistry | None,
    resolved_inputs: Mapping[str, Any],
) -> bool:
    and_segments = re.split(r"\s+AND\s+", expr.strip(), flags=re.IGNORECASE)
    return all(
        _evaluate_atom(segment.strip(), registry=registry, resolved_inputs=resolved_inputs)
        for segment in and_segments
        if segment.strip()
    )


__all__ = (
    "ExpressionEvaluationError",
    "evaluate_boolean_expression",
    "looks_like_expression",
)
