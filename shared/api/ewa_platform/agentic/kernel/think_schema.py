# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic v2 structured output contract for Think/Plan LLM calls in the agentic loop.
# Invariants:
# - Parser failures trigger one retry then session failed transition at loop layer.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

_ALLOWED_NODE_KINDS = frozenset({"subtask", "tool", "llm", "gate", "expert_chat", "block_append"})

# LLM often puts tool names / informal labels into node_kind.
_NODE_KIND_ALIASES: dict[str, str] = {
    "sub-task": "subtask",
    "sub_task": "subtask",
    "task": "subtask",
    "step": "subtask",
    "action": "tool",
    "document": "tool",
    "file": "tool",
    "file_create": "tool",
    "file_save_text": "tool",
    "file_open": "tool",
    "catalog_list": "tool",
    "document_extractor": "tool",
    "llm_summarize": "llm",
    "summarize": "llm",
    "call_expert_chat": "expert_chat",
    "expert": "expert_chat",
    "experts": "expert_chat",
    "research": "expert_chat",
    "expert_research": "expert_chat",
    "block": "block_append",
    "append": "block_append",
    "append_block": "block_append",
}

_TOOLISH_KINDS = frozenset(
    {
        "file_create",
        "file_save_text",
        "file_open",
        "file_delete",
        "catalog_list",
        "document_extractor",
        "llm_summarize",
        "recall_memory",
        "call_expert_chat",
    }
)


class AgenticPlanNode(BaseModel):
    node_kind: Literal["subtask", "tool", "llm", "gate", "expert_chat", "block_append"] = "subtask"
    title: str = Field(min_length=1, max_length=240)
    instruction: str = Field(default="", max_length=8000)
    tool_name: str | None = Field(default=None, max_length=80)
    tool_args: dict[str, Any] = Field(default_factory=dict)
    gate_kind: Literal["confirm", "choose", "freeform"] | None = None
    gate_prompt: str | None = None
    gate_options: list[dict[str, str]] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_node_kind_and_tool(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        raw_kind = str(out.get("node_kind") or "").strip()
        kind_key = raw_kind.lower().replace(" ", "_")
        tool = str(out.get("tool_name") or "").strip()

        if kind_key in _TOOLISH_KINDS and not tool:
            out["tool_name"] = kind_key
            tool = kind_key

        if kind_key in _NODE_KIND_ALIASES:
            out["node_kind"] = _NODE_KIND_ALIASES[kind_key]
        elif kind_key and kind_key not in _ALLOWED_NODE_KINDS:
            # Unknown labels: keep executable intent via tool_name when present.
            out["node_kind"] = "tool" if tool else "subtask"
        elif not kind_key:
            if tool == "call_expert_chat":
                out["node_kind"] = "expert_chat"
            elif tool == "llm_summarize":
                out["node_kind"] = "llm"
            elif tool:
                out["node_kind"] = "tool"

        if str(out.get("node_kind") or "") == "expert_chat" and not str(out.get("tool_name") or "").strip():
            out["tool_name"] = "call_expert_chat"
        if str(out.get("node_kind") or "") == "llm" and not str(out.get("tool_name") or "").strip():
            out["tool_name"] = "llm_summarize"
        return out

    @field_validator("node_kind", mode="before")
    @classmethod
    def _normalize_node_kind_case(cls, raw: Any) -> Any:
        if raw is None:
            return "subtask"
        text = str(raw).strip().lower().replace(" ", "_")
        return _NODE_KIND_ALIASES.get(text, text or "subtask")


class AgenticThinkOutput(BaseModel):
    action: Literal["plan", "act", "gate", "complete", "clarify"]
    rationale: str = Field(default="", max_length=4000)
    plan_nodes: list[AgenticPlanNode] = Field(default_factory=list)
    act_node_id: str | None = None
    act_tool_name: str | None = None
    act_tool_args: dict[str, Any] = Field(default_factory=dict)
    gate: AgenticPlanNode | None = None
    plan_summary_patch: str | None = None
    user_message: str | None = None
