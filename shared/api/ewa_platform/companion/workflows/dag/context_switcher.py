# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build per-node ``ToolContext`` for stateless vs stateful DAG execution modes.
# Invariants:
# - Auth fields (``bearer_token``, ``auth_user``) are preserved in both modes.
# - Stateless mode strips companion memory / planner / shell hints from the context.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import replace
from typing import Any

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowNodeModeV2,
    CompanionWorkflowNodeV2,
)


def memory_access_allowed(mode: CompanionWorkflowNodeModeV2) -> bool:
    return mode == "stateful"


def build_node_tool_context(
    base: ToolContext,
    node: CompanionWorkflowNodeV2,
) -> ToolContext:
    if node.mode == "stateful":
        return base
    return replace(
        base,
        shell_norm=None,
        intent_plan=None,
        profile=None,
        image_attachment=None,
    )


def build_node_tool_context_from_mapping(
    base: Mapping[str, Any],
    node: CompanionWorkflowNodeV2,
) -> dict[str, Any]:
    ctx = dict(base)
    if node.mode == "stateless":
        ctx["shell_norm"] = None
        ctx["intent_plan"] = None
        ctx["profile"] = None
        ctx["image_attachment"] = None
    return ctx


__all__ = (
    "build_node_tool_context",
    "build_node_tool_context_from_mapping",
    "memory_access_allowed",
)
