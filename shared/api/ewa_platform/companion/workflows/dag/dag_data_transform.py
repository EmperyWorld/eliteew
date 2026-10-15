# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Inline data_transformer ops for DAG workflows (JSON/string/array transforms).
# Invariants:
# - No eval(); ops are a fixed allowlist with explicit handlers.
# Related:
# - api/ewa_platform/companion/workflows/dag/executors.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md §Sprint 2.6.9
# ---

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

TRANSFORM_OPS: frozenset[str] = frozenset(
    {
        "identity",
        "json_stringify",
        "json_parse",
        "string_trim",
        "string_lower",
        "string_upper",
        "string_replace",
        "string_slice",
        "array_filter_contains",
        "array_length",
        "pick_field",
    }
)


class DataTransformError(ValueError):
    """Raised when a transform op cannot run on the provided value."""


def _first_value(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _resolve_source_value(resolved_inputs: Mapping[str, Any]) -> Any:
    return _first_value(
        resolved_inputs.get("value"),
        resolved_inputs.get("text"),
        resolved_inputs.get("input"),
        resolved_inputs.get("body"),
        resolved_inputs.get("reply"),
    )


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _preview_text(value: Any, *, limit: int = 240) -> str:
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        text = _as_text(value)
    if len(text) <= limit:
        return text
    return f"{text[:limit]}…"


def run_data_transform(
    op: str,
    *,
    resolved_inputs: Mapping[str, Any],
    transform_args: Mapping[str, Any] | None = None,
) -> tuple[Any, str]:
    """Apply one transform op; return ``(value, reply)``."""

    operation = str(op or "").strip().lower()
    if operation not in TRANSFORM_OPS:
        msg = f"unsupported transform_op {op!r}"
        raise DataTransformError(msg)

    args = dict(transform_args or {})
    source = _resolve_source_value(resolved_inputs)

    if operation == "identity":
        return source, _preview_text(source)

    if operation == "json_stringify":
        if isinstance(source, str):
            return source, source
        text = json.dumps(source, ensure_ascii=False, separators=(",", ":"))
        return text, _preview_text(text)

    if operation == "json_parse":
        raw = _as_text(source).strip()
        if not raw:
            msg = "json_parse requires non-empty text input"
            raise DataTransformError(msg)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            msg = f"json_parse failed: {exc}"
            raise DataTransformError(msg) from exc
        return parsed, _preview_text(parsed)

    if operation == "string_trim":
        text = _as_text(source).strip()
        return text, text

    if operation == "string_lower":
        text = _as_text(source).lower()
        return text, text

    if operation == "string_upper":
        text = _as_text(source).upper()
        return text, text

    if operation == "string_replace":
        text = _as_text(source)
        find = _as_text(args.get("find") or resolved_inputs.get("find"))
        replace = _as_text(args.get("replace") if "replace" in args else resolved_inputs.get("replace", ""))
        if not find:
            msg = "string_replace requires find argument"
            raise DataTransformError(msg)
        replaced = text.replace(find, replace)
        return replaced, _preview_text(replaced)

    if operation == "string_slice":
        text = _as_text(source)
        start_raw = args.get("start", resolved_inputs.get("start", 0))
        end_raw = args.get("end", resolved_inputs.get("end"))
        try:
            start = int(start_raw)
        except (TypeError, ValueError) as exc:
            msg = f"string_slice invalid start: {start_raw!r}"
            raise DataTransformError(msg) from exc
        if end_raw is None or str(end_raw).strip() == "":
            sliced = text[start:]
        else:
            try:
                end = int(end_raw)
            except (TypeError, ValueError) as exc:
                msg = f"string_slice invalid end: {end_raw!r}"
                raise DataTransformError(msg) from exc
            sliced = text[start:end]
        return sliced, _preview_text(sliced)

    if operation == "array_filter_contains":
        if not isinstance(source, list):
            msg = "array_filter_contains requires list input"
            raise DataTransformError(msg)
        needle = _as_text(args.get("needle") or resolved_inputs.get("needle") or resolved_inputs.get("contains"))
        if not needle:
            msg = "array_filter_contains requires needle argument"
            raise DataTransformError(msg)
        filtered = [item for item in source if needle in _as_text(item)]
        return filtered, _preview_text(filtered)

    if operation == "array_length":
        if isinstance(source, (list, str)):
            length = len(source)
        else:
            msg = "array_length requires list or text input"
            raise DataTransformError(msg)
        return length, str(length)

    if operation == "pick_field":
        field = _as_text(args.get("field") or resolved_inputs.get("field")).strip()
        if not field:
            msg = "pick_field requires field argument"
            raise DataTransformError(msg)
        if not isinstance(source, Mapping):
            msg = "pick_field requires object/json input"
            raise DataTransformError(msg)
        if field not in source:
            msg = f"pick_field missing key {field!r}"
            raise DataTransformError(msg)
        picked = source[field]
        return picked, _preview_text(picked)

    msg = f"unsupported transform_op {op!r}"
    raise DataTransformError(msg)


__all__ = (
    "TRANSFORM_OPS",
    "DataTransformError",
    "run_data_transform",
)
