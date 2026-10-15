# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for DAG tool binding registry (Phase 2.6.1).
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_tool_bindings.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import (
    DAG_TOOL_BINDINGS,
    get_tool_binding,
    is_inline_node_type,
    is_tool_backed_node_type,
)


def test_dag_tool_bindings_image_gen_default_tool() -> None:
    binding = get_tool_binding("image_gen")
    assert binding is not None
    assert binding.default_tool == "image_generation"
    assert binding.requires_config_tool_name is False


def test_dag_tool_bindings_api_call_requires_config_tool_name() -> None:
    binding = get_tool_binding("api_call")
    assert binding is not None
    assert binding.default_tool is None
    assert binding.requires_config_tool_name is True


def test_inline_node_types_are_not_tool_backed() -> None:
    for node_type in (
        "prompt_gen",
        "logic_filter",
        "confirm_gate",
        "delay",
        "decision",
        "switch",
        "print_log",
        "for_each",
    ):
        assert is_inline_node_type(node_type)
        assert not is_tool_backed_node_type(node_type)


def test_tool_backed_types_match_registry_keys() -> None:
    assert set(DAG_TOOL_BINDINGS) == {
        "image_gen",
        "api_call",
        "document_import",
        "pdf_generate",
        "telegram_sender",
        "email_dispatcher",
        "vision_analyzer",
        "llm_summarizer",
        "llm_classifier",
        "pdf_parser",
        "document_extractor",
    }
    assert is_tool_backed_node_type("telegram_sender")
    assert is_tool_backed_node_type("email_dispatcher")
    assert is_tool_backed_node_type("vision_analyzer")
    assert is_tool_backed_node_type("llm_summarizer")
    assert is_tool_backed_node_type("llm_classifier")
    assert not is_tool_backed_node_type("prompt_gen")
