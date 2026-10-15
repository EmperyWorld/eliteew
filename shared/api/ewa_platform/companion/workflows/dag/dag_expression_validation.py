# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Syntax validation for decision/switch boolean expressions (Sprint 2.6.9).
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_expression.py
# ---

from __future__ import annotations

import re

from api.ewa_platform.companion.workflows.dag.dag_expression import (
    ExpressionEvaluationError,
    evaluate_boolean_expression,
)
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry

_ALLOWED_FUNCTIONS = frozenset({"len", "string_length", "empty"})
_FUNCTION_CALL_RE = re.compile(r"\b([a-z_][a-z0-9_]*)\s*\(", re.IGNORECASE)


def validate_boolean_expression_syntax(expression: str) -> list[str]:
    """Return human-readable syntax errors for ``expression`` (empty when valid)."""

    raw = str(expression or "").strip()
    if not raw:
        return ["expression must not be empty"]

    errors: list[str] = []
    for match in _FUNCTION_CALL_RE.finditer(raw):
        name = str(match.group(1) or "").strip().lower()
        if name not in _ALLOWED_FUNCTIONS:
            errors.append(f"unsupported function {name!r} in expression")

    if errors:
        return errors

    registry = WorkflowStateRegistry(user_line="", principal_id="")
    registry.register(
        "00000000-0000-4000-8000-000000000001",
        {
            "text": "sample",
            "char_count": 6,
            "status": "success",
        },
    )
    normalized = raw
    normalized = re.sub(
        r"\{\{\s*[0-9a-fA-F-]{36}\.[a-zA-Z0-9_]+\s*\}\}",
        "{{00000000-0000-4000-8000-000000000001.text}}",
        normalized,
    )
    normalized = re.sub(r"\{\{\s*loop\.[a-zA-Z0-9_]+\s*\}\}", "1", normalized)
    try:
        evaluate_boolean_expression(normalized, registry, {})
    except ExpressionEvaluationError as exc:
        errors.append(str(exc))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"expression syntax error: {exc}")
    return errors


__all__ = ("validate_boolean_expression_syntax",)
