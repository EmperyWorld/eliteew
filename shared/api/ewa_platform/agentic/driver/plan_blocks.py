# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structured PlanBlocks for agentic PLAN phase (tool, expert chat, block append).
# Related:
# - api/ewa_platform/agentic/kernel/think_schema.py
# ---

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from api.ewa_platform.agentic.kernel.think_schema import AgenticPlanNode


class PlanBlock(BaseModel):
    """One planned unit bound to a tool, expert consultation, or direct block append."""

    block_id: str = Field(min_length=1, max_length=64)
    block_kind: Literal["tool", "expert_chat", "block_append"] = "tool"
    title: str = Field(min_length=1, max_length=240)
    instruction: str = Field(default="", max_length=8000)
    tool_name: str | None = Field(default=None, max_length=80)
    tool_args: dict[str, Any] = Field(default_factory=dict)
    expert_roles: list[str] = Field(default_factory=list)
    author_role: str = Field(default="agent", max_length=64)
    unified_content_id: str | None = None


def plan_blocks_to_plan_nodes(blocks: list[PlanBlock]) -> list[AgenticPlanNode]:
    """Convert PlanBlocks into scheduler-ready plan nodes."""
    nodes: list[AgenticPlanNode] = []
    for block in blocks:
        if block.block_kind == "expert_chat":
            args = dict(block.tool_args)
            if block.expert_roles:
                args.setdefault("expert_roles", block.expert_roles)
            if block.unified_content_id:
                args.setdefault("unified_content_id", block.unified_content_id)
            args.setdefault("user_line", block.instruction or block.title)
            nodes.append(
                AgenticPlanNode(
                    node_kind="expert_chat",
                    title=block.title,
                    instruction=block.instruction,
                    tool_name="call_expert_chat",
                    tool_args=args,
                ),
            )
            continue
        if block.block_kind == "block_append":
            args = dict(block.tool_args)
            args.setdefault("block_content", block.instruction)
            args.setdefault("author_role", block.author_role)
            if block.unified_content_id:
                args.setdefault("unified_content_id", block.unified_content_id)
            nodes.append(
                AgenticPlanNode(
                    node_kind="block_append",
                    title=block.title,
                    instruction=block.instruction,
                    tool_name="doc_append_block",
                    tool_args=args,
                ),
            )
            continue
        nodes.append(
            AgenticPlanNode(
                node_kind="tool",
                title=block.title,
                instruction=block.instruction,
                tool_name=block.tool_name,
                tool_args=dict(block.tool_args),
            ),
        )
    return nodes


def plan_nodes_to_plan_blocks(nodes: list[Any]) -> list[PlanBlock]:
    """Best-effort reverse mapping for Think outputs and tests."""
    blocks: list[PlanBlock] = []
    for idx, raw in enumerate(nodes):
        if isinstance(raw, AgenticPlanNode):
            node = raw
        elif isinstance(raw, dict):
            node = AgenticPlanNode.model_validate(raw)
        else:
            continue
        kind = str(node.node_kind or "tool")
        if kind == "expert_chat" or node.tool_name == "call_expert_chat":
            blocks.append(
                PlanBlock(
                    block_id=f"pb-{idx + 1}",
                    block_kind="expert_chat",
                    title=node.title,
                    instruction=node.instruction,
                    tool_name="call_expert_chat",
                    tool_args=dict(node.tool_args),
                    expert_roles=list(node.tool_args.get("expert_roles") or []),
                    unified_content_id=str(node.tool_args.get("unified_content_id") or "") or None,
                ),
            )
            continue
        if kind == "block_append" or node.tool_name == "doc_append_block":
            blocks.append(
                PlanBlock(
                    block_id=f"pb-{idx + 1}",
                    block_kind="block_append",
                    title=node.title,
                    instruction=node.instruction,
                    tool_name="doc_append_block",
                    tool_args=dict(node.tool_args),
                    author_role=str(node.tool_args.get("author_role") or "agent"),
                    unified_content_id=str(node.tool_args.get("unified_content_id") or "") or None,
                ),
            )
            continue
        blocks.append(
            PlanBlock(
                block_id=f"pb-{idx + 1}",
                block_kind="tool",
                title=node.title,
                instruction=node.instruction,
                tool_name=node.tool_name,
                tool_args=dict(node.tool_args),
            ),
        )
    return blocks
