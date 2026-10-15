# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bridge abstract DAG node types to ``tool_registry.dispatch_tool_by_name`` and map ``ToolResult`` envelopes.
# Invariants:
# - Tool-backed types resolve through ``dag_tool_bindings``; ``api_call`` requires ``config.tool_name``.
# - User workflows enforce ``USER_WORKFLOW_ALLOWED_TOOLS`` when ``enforce_allowlist=True``.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_tool_bindings.py
# - api/ewa_platform/companion/workflows/dag/executors.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.orchestration.tool_registry import (
    REGISTRY,
    ToolContext,
    dispatch_tool_by_name,
)
from api.ewa_platform.companion.orchestration.tool_result_utils import tool_result_data
from api.ewa_platform.companion.workflows.dag.dag_io_profiles import (
    apply_input_profile,
    apply_output_profile,
)
from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import (
    DAG_TOOL_BINDINGS,
    get_tool_binding,
    is_inline_node_type,
    is_tool_backed_node_type,
)
from api.ewa_platform.companion.workflows.dag.executors import NodeExecutionResult
from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import (
    USER_WORKFLOW_ALLOWED_TOOLS,
    sanitize_user_workflow_args,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowNodeV2

logger = logging.getLogger(__name__)

# Back-compat alias for tests/docs that referenced Phase 2.5 name.
NODE_TYPE_DEFAULT_TOOL: dict[str, str] = {
    binding.node_type: binding.default_tool for binding in DAG_TOOL_BINDINGS.values() if binding.default_tool
}


def node_type_uses_tool_registry(node: CompanionWorkflowNodeV2) -> bool:
    return is_tool_backed_node_type(str(node.type))


def resolve_tool_name(
    node: CompanionWorkflowNodeV2,
    *,
    enforce_allowlist: bool = True,
) -> str | None:
    """Return registry tool name for a node, or ``None`` when unmapped."""

    node_type = str(node.type)
    if is_inline_node_type(node_type):
        return None

    binding = get_tool_binding(node_type)
    if binding is None:
        return None

    override = str(node.config.tool_name or "").strip()
    if override:
        tool_name = override
    elif binding.default_tool:
        tool_name = binding.default_tool
    elif binding.requires_config_tool_name:
        return None
    else:
        return None

    if tool_name not in REGISTRY:
        return None
    if enforce_allowlist and tool_name not in USER_WORKFLOW_ALLOWED_TOOLS:
        return None
    return tool_name


def build_tool_dispatch_args(
    *,
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    tool_name: str,
    ctx: ToolContext,
    workflow_parent_run_id: str | None = None,
    workflow_parent_step_index: int | None = None,
    enforce_allowlist: bool = True,
) -> dict[str, Any]:
    """Map resolved DAG inputs to tool handler args."""

    prompt = str(resolved_inputs.get("prompt") or resolved_inputs.get("text") or "").strip()
    user_line = str(resolved_inputs.get("user_line") or "").strip()
    if not user_line:
        user_line = prompt or str(ctx.user_line or "").strip()
    elif not prompt:
        prompt = user_line

    args: dict[str, Any] = {str(key): value for key, value in resolved_inputs.items()}
    args.setdefault("user_line", user_line)
    if prompt and "prompt" not in args:
        args["prompt"] = prompt
    args["_tool_router_bypass_line_match"] = True

    if workflow_parent_run_id:
        args["_workflow_parent_run_id"] = workflow_parent_run_id
    if workflow_parent_step_index is not None:
        args["_workflow_parent_step_index"] = workflow_parent_step_index

    if enforce_allowlist and tool_name in USER_WORKFLOW_ALLOWED_TOOLS:
        reserved = {
            key: args[key]
            for key in (
                "user_line",
                "_workflow_parent_run_id",
                "_workflow_parent_step_index",
                "_tool_router_bypass_line_match",
                "_dag_outbound_authorized",
            )
            if key in args
        }
        sanitized = sanitize_user_workflow_args(
            tool_name,
            {key: value for key, value in args.items() if key not in reserved},
        )
        args = {**sanitized, **reserved}

    binding = get_tool_binding(str(node.type))
    if binding is not None and binding.requires_confirm_gate:
        # DAG confirm_gate (design-time + optional runtime guard) already authorized send.
        args["_dag_outbound_authorized"] = True
    if binding is not None:
        args = apply_input_profile(
            binding.input_profile,
            resolved_inputs=resolved_inputs,
            ctx=ctx,
            args=args,
        )

    descriptor = REGISTRY.get(tool_name)
    if descriptor is not None:
        allowed = set(descriptor.input_keys)
        if allowed:
            args = {key: value for key, value in args.items() if key in allowed or key.startswith("_")}

    return args


def tool_result_to_node_outputs(
    tool_result: Mapping[str, Any],
    *,
    node: CompanionWorkflowNodeV2,
) -> dict[str, Any]:
    """Project a ``ToolResult`` into DAG node output keys declared on the node."""

    outputs: dict[str, Any] = {}
    reply = str(tool_result.get("reply") or "").strip()
    if reply:
        outputs["reply"] = reply
        outputs.setdefault("text", reply)

    data = tool_result_data(tool_result)
    for key in (
        "image_url",
        "url",
        "run_id",
        "task_run_id",
        "prompt",
        "delivery_status",
        "chat_id",
        "message_id",
        "to",
        "analysis_text",
        "summary_text",
        "category",
        "matched",
        "extracted_text",
        "filename",
        "mime_type",
        "char_count",
        "page_count",
        "error",
    ):
        if key in data and data[key] is not None:
            outputs[key] = data[key]

    task_run = tool_result.get("task_run")
    if isinstance(task_run, Mapping):
        run_id = str(task_run.get("id") or task_run.get("run_id") or "").strip()
        if run_id:
            outputs["run_id"] = run_id
            outputs["task_run_id"] = run_id
        status = str(task_run.get("status") or "").strip()
        if status:
            outputs["task_run_status"] = status

    for field_name, _spec in node.outputs.items():
        if field_name in outputs:
            continue
        if field_name in data:
            outputs[field_name] = data[field_name]

    if not outputs and reply:
        outputs["reply"] = reply

    binding = get_tool_binding(str(node.type))
    if binding is not None:
        outputs = apply_output_profile(
            binding.output_profile,
            tool_result=tool_result,
            outputs=outputs,
            node=node,
        )
    return outputs


def tool_result_to_node_execution_result(
    tool_result: Mapping[str, Any] | None,
    *,
    node: CompanionWorkflowNodeV2,
    tool_name: str,
) -> NodeExecutionResult:
    """Normalize registry dispatch outcome to ``NodeExecutionResult``."""

    if tool_result is None:
        return NodeExecutionResult(
            status="failed",
            outputs={},
            error=f"tool {tool_name!r} did not handle DAG node {node.id}",
        )

    status = str(tool_result.get("status") or "error").strip().lower()
    outputs = tool_result_to_node_outputs(tool_result, node=node)

    if status in {"ok", "memory_append"}:
        return NodeExecutionResult(status="ok", outputs=outputs)
    if status == "accepted":
        return NodeExecutionResult(status="accepted", outputs=outputs)
    if status == "needs_confirm":
        return NodeExecutionResult(status="needs_confirm", outputs=outputs)
    if status == "skipped":
        return NodeExecutionResult(status="failed", outputs=outputs, error=f"tool {tool_name!r} skipped")

    reply = str(tool_result.get("reply") or "").strip()
    message = reply or f"tool {tool_name!r} returned status {status}"
    return NodeExecutionResult(status="failed", outputs=outputs, error=message)


def _workflow_parent_fields(resolved_inputs: Mapping[str, Any]) -> tuple[str | None, int | None]:
    parent_run_id = str(resolved_inputs.get("_workflow_parent_run_id") or "").strip() or None
    parent_step_index_raw = resolved_inputs.get("_workflow_parent_step_index")
    parent_step_index = int(parent_step_index_raw) if parent_step_index_raw is not None else None
    return parent_run_id, parent_step_index


async def execute_tool_registry_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
    *,
    enforce_allowlist: bool = True,
    workflow_parent_run_id: str | None = None,
    workflow_parent_step_index: int | None = None,
) -> NodeExecutionResult:
    """Dispatch one tool-backed DAG node through the companion tool registry."""

    tool_name = resolve_tool_name(node, enforce_allowlist=enforce_allowlist)
    if not tool_name:
        return NodeExecutionResult(
            status="failed",
            outputs={},
            error=f"no tool_registry mapping for node type {node.type!r}",
        )

    if workflow_parent_run_id is None or workflow_parent_step_index is None:
        inferred_run_id, inferred_step_index = _workflow_parent_fields(resolved_inputs)
        workflow_parent_run_id = workflow_parent_run_id or inferred_run_id
        if workflow_parent_step_index is None:
            workflow_parent_step_index = inferred_step_index

    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs=resolved_inputs,
        tool_name=tool_name,
        ctx=ctx,
        workflow_parent_run_id=workflow_parent_run_id,
        workflow_parent_step_index=workflow_parent_step_index,
        enforce_allowlist=enforce_allowlist,
    )

    logger.info(
        "[STEP] dag_tool_registry_dispatch node_id=%s node_type=%s tool=%s",
        node.id,
        node.type,
        tool_name,
    )
    tool_result = await dispatch_tool_by_name(tool_name, args, ctx)
    return tool_result_to_node_execution_result(tool_result, node=node, tool_name=tool_name)


__all__ = (
    "NODE_TYPE_DEFAULT_TOOL",
    "build_tool_dispatch_args",
    "execute_tool_registry_node",
    "node_type_uses_tool_registry",
    "resolve_tool_name",
    "tool_result_to_node_execution_result",
    "tool_result_to_node_outputs",
)
