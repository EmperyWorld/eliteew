# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Output/input type compatibility rules for DAG workflow v2 type safety validation.
# Invariants:
# - ``text`` and ``string`` are interchangeable; ``plain_text`` is a documentation alias for ``text``.
# - ``image_url`` only accepts ``image_url``.
# Related:
# - api/ewa_platform/companion/workflows/dag/validation.py
# ---

from __future__ import annotations

from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowOutputTypeV2

_TYPE_ALIASES: dict[str, CompanionWorkflowOutputTypeV2] = {
    "plain_text": "text",
}

_TEXT_LIKE: frozenset[CompanionWorkflowOutputTypeV2] = frozenset({"text", "string"})


def normalize_type_name(raw: str) -> CompanionWorkflowOutputTypeV2 | None:
    key = str(raw or "").strip().lower()
    if not key:
        return None
    if key in _TYPE_ALIASES:
        return _TYPE_ALIASES[key]
    if key in {"string", "text", "json", "boolean", "number", "image_url"}:
        return key  # type: ignore[return-value]
    return None


def format_type_label(raw: CompanionWorkflowOutputTypeV2 | str) -> str:
    value = str(raw)
    if value == "text":
        return "text (plain_text)"
    return value


def types_compatible(
    source_type: CompanionWorkflowOutputTypeV2,
    expected_type: CompanionWorkflowOutputTypeV2,
) -> bool:
    if source_type == expected_type:
        return True
    if source_type in _TEXT_LIKE and expected_type in _TEXT_LIKE:
        return True
    if source_type == "json" and expected_type in _TEXT_LIKE:
        return True
    if source_type == "number" and expected_type in _TEXT_LIKE | {"number"}:
        return True
    return source_type == "boolean" and expected_type in _TEXT_LIKE | {"boolean"}


__all__ = (
    "format_type_label",
    "normalize_type_name",
    "types_compatible",
)
