# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Declarative registry mapping DAG node types to ``tool_registry`` tools and adapter behavior.
# Invariants:
# - Tool-backed node types must appear here; inline nodes (``prompt_gen``, ``logic_filter``) do not.
# - ``api_call`` requires ``config.tool_name``; typed nodes may set ``default_tool``.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_io_profiles.py
# - api/ewa_platform/companion/workflows/dag/tool_registry_adapter.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md §Phase 2.6
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

AllowlistGroup = Literal["user", "operator", "internal"]
ExecutionMode = Literal["inline", "stateless_ok", "stateful_required"]


@dataclass(frozen=True, slots=True)
class DagToolBinding:
    """Maps one DAG node ``type`` to tool_registry dispatch and stub behavior."""

    node_type: str
    default_tool: str | None = None
    requires_config_tool_name: bool = False
    allowlist_group: AllowlistGroup = "user"
    input_profile: str = "generic"
    output_profile: str = "text_reply"
    execution_mode: ExecutionMode = "stateful_required"
    requires_confirm_gate: bool = False


INLINE_NODE_TYPES: frozenset[str] = frozenset(
    {
        "prompt_gen",
        "logic_filter",
        "confirm_gate",
        "delay",
        "decision",
        "switch",
        "print_log",
        "for_each",
        "data_transformer",
    }
)

DAG_TOOL_BINDINGS: dict[str, DagToolBinding] = {
    "image_gen": DagToolBinding(
        node_type="image_gen",
        default_tool="image_generation",
        input_profile="prompt_text",
        output_profile="text_reply",
    ),
    "api_call": DagToolBinding(
        node_type="api_call",
        default_tool=None,
        requires_config_tool_name=True,
        input_profile="generic",
        output_profile="text_reply",
        execution_mode="stateless_ok",
    ),
    "document_import": DagToolBinding(
        node_type="document_import",
        default_tool="paperless_import",
        input_profile="paperless_import",
        output_profile="document_catalog",
        execution_mode="stateful_required",
    ),
    "pdf_generate": DagToolBinding(
        node_type="pdf_generate",
        default_tool="presentation_generation",
        input_profile="presentation",
        output_profile="async_pdf",
        execution_mode="stateful_required",
    ),
    "telegram_sender": DagToolBinding(
        node_type="telegram_sender",
        default_tool="telegram_sender",
        input_profile="telegram_send",
        output_profile="delivery_status",
        execution_mode="stateful_required",
        requires_confirm_gate=True,
    ),
    "email_dispatcher": DagToolBinding(
        node_type="email_dispatcher",
        default_tool="email_dispatcher",
        input_profile="email_dispatch",
        output_profile="delivery_status",
        execution_mode="stateless_ok",
        requires_confirm_gate=True,
    ),
    "vision_analyzer": DagToolBinding(
        node_type="vision_analyzer",
        default_tool="vision_analyze",
        input_profile="vision_analyze",
        output_profile="vision_analysis",
        execution_mode="stateful_required",
    ),
    "llm_summarizer": DagToolBinding(
        node_type="llm_summarizer",
        default_tool="llm_summarize",
        input_profile="long_text",
        output_profile="llm_summary",
        execution_mode="stateless_ok",
    ),
    "llm_classifier": DagToolBinding(
        node_type="llm_classifier",
        default_tool="llm_classify",
        input_profile="classifier",
        output_profile="llm_classification",
        execution_mode="stateless_ok",
    ),
    "pdf_parser": DagToolBinding(
        node_type="pdf_parser",
        default_tool="pdf_parser",
        input_profile="document_source",
        output_profile="document_extract",
        execution_mode="stateless_ok",
    ),
    "document_extractor": DagToolBinding(
        node_type="document_extractor",
        default_tool="document_extractor",
        input_profile="document_source",
        output_profile="document_extract",
        execution_mode="stateless_ok",
    ),
}


def get_tool_binding(node_type: str) -> DagToolBinding | None:
    return DAG_TOOL_BINDINGS.get(str(node_type or "").strip())


def is_inline_node_type(node_type: str) -> bool:
    return str(node_type or "").strip() in INLINE_NODE_TYPES


def is_tool_backed_node_type(node_type: str) -> bool:
    return get_tool_binding(node_type) is not None


__all__ = (
    "AllowlistGroup",
    "DAG_TOOL_BINDINGS",
    "DagToolBinding",
    "ExecutionMode",
    "INLINE_NODE_TYPES",
    "get_tool_binding",
    "is_inline_node_type",
    "is_tool_backed_node_type",
)
