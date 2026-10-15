# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate LLM-proposed tool_args before AgenticToolBridge dispatch (poisoned payload guard).
# Invariants:
# - Values must be JSON-serializable scalars/containers; keys must match registry input_keys when known.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.agentic.kernel.tool_args_enrich import enrich_tool_args
from api.ewa_platform.agentic.schemas.tool_args import validate_core_tool_args
from api.ewa_platform.companion.orchestration.tools.registry_core import REGISTRY, tool_descriptor

_ALLOWED_ARG_TYPES = (str, int, float, bool, type(None))


def _is_safe_json_value(val: Any, *, depth: int = 0) -> bool:
    if depth > 4:
        return False
    if isinstance(val, _ALLOWED_ARG_TYPES):
        return True
    if isinstance(val, list):
        return all(_is_safe_json_value(x, depth=depth + 1) for x in val[:32])
    if isinstance(val, dict):
        if len(val) > 32:
            return False
        return all(isinstance(k, str) and _is_safe_json_value(v, depth=depth + 1) for k, v in val.items())
    return False


def validate_tool_args_for_registry(
    tool_name: str,
    tool_args: Mapping[str, Any] | None,
    *,
    user_line: str = "",
    node_instruction: str | None = None,
    session: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Validate and normalize tool_args; raise ValueError when unsafe or type-incompatible."""

    name = str(tool_name or "").strip()
    if name not in REGISTRY:
        raise ValueError(f"tool {name!r} is not registered")

    enriched = enrich_tool_args(
        name,
        tool_args,
        user_line=user_line,
        node_instruction=node_instruction,
        session=session,
    )
    args = validate_core_tool_args(name, enriched)
    for key, val in args.items():
        if key.startswith("_"):
            continue
        if not _is_safe_json_value(val):
            raise ValueError(f"tool_args.{key} has unsupported type {type(val).__name__}")

    desc = tool_descriptor(name)
    if desc is None:
        return args

    for key, val in args.items():
        if key.startswith("_") or key not in desc.input_keys:
            continue
        # Registry keys are string-like in companion tools; reject obvious type poison
        if (
            key
            in {
                "user_line",
                "plan_focus",
                "horizon",
                "file_query",
                "rewrite_brief",
                "mode",
                "task_id",
                "run_id",
            }
            and val is not None
            and not isinstance(val, str)
        ):
            raise ValueError(f"tool_args.{key} must be string, got {type(val).__name__}")
        if key in {"open_editor", "force"} and val is not None and not isinstance(val, (bool, str)):
            raise ValueError(f"tool_args.{key} must be bool or string, got {type(val).__name__}")
    return args
