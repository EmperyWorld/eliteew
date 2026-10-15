# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sprint 2.6.4 AI & vision intelligence tests: bindings, profiles, adapter dispatch, DAG chains.
# Related:
# - api/ewa_platform/companion/workflows/dag/workflow_ai_services.py
# ---

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.dag_io_profiles import (
    apply_input_profile,
    apply_output_profile,
    default_input_types_for_profile,
    default_output_types_for_profile,
)
from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import get_tool_binding
from api.ewa_platform.companion.workflows.dag.runner import run_workflow_dag_sync
from api.ewa_platform.companion.workflows.dag.tool_registry_adapter import (
    build_tool_dispatch_args,
    execute_tool_registry_node,
    resolve_tool_name,
    tool_result_to_node_outputs,
)
from api.ewa_platform.companion.workflows.dag.workflow_ai_services import (
    truncate_workflow_text,
    workflow_ai_max_input_chars,
)
from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import USER_WORKFLOW_ALLOWED_TOOLS
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def ai_intelligence_tests_stub_adapter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_VISION_ANALYZER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_LLM_SUMMARIZER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_LLM_CLASSIFIER_ENABLED", "1")


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _ctx() -> ToolContext:
    return ToolContext(
        principal_id="p-1",
        user_line="analyze this",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )


def _vision_node(**kwargs: object) -> CompanionWorkflowNodeV2:
    defaults = {
        "id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
        "type": "vision_analyzer",
        "mode": "stateful",
        "inputs": {"image_url": "https://cdn.example/photo.png", "prompt": "What is shown?"},
        "outputs": {
            "reply": CompanionWorkflowOutputSpecV2(type="text"),
            "analysis_text": CompanionWorkflowOutputSpecV2(type="text"),
        },
    }
    defaults.update(kwargs)
    return CompanionWorkflowNodeV2.model_validate(defaults)


def _summarizer_node(**kwargs: object) -> CompanionWorkflowNodeV2:
    defaults = {
        "id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"),
        "type": "llm_summarizer",
        "mode": "stateless",
        "inputs": {"text": "Long document body " * 20},
        "outputs": {
            "reply": CompanionWorkflowOutputSpecV2(type="text"),
            "summary_text": CompanionWorkflowOutputSpecV2(type="text"),
            "analysis_text": CompanionWorkflowOutputSpecV2(type="text"),
        },
    }
    defaults.update(kwargs)
    return CompanionWorkflowNodeV2.model_validate(defaults)


def _classifier_node(**kwargs: object) -> CompanionWorkflowNodeV2:
    defaults = {
        "id": UUID("cccccccc-cccc-4ccc-8ccc-ccccccccccc2"),
        "type": "llm_classifier",
        "mode": "stateless",
        "inputs": {"text": "Great product", "categories": "positive,negative,neutral"},
        "outputs": {
            "reply": CompanionWorkflowOutputSpecV2(type="text"),
            "category": CompanionWorkflowOutputSpecV2(type="string"),
            "matched": CompanionWorkflowOutputSpecV2(type="boolean"),
            "analysis_text": CompanionWorkflowOutputSpecV2(type="text"),
        },
    }
    defaults.update(kwargs)
    return CompanionWorkflowNodeV2.model_validate(defaults)


def test_ai_tools_allowlisted() -> None:
    assert "vision_analyze" in USER_WORKFLOW_ALLOWED_TOOLS
    assert "llm_summarize" in USER_WORKFLOW_ALLOWED_TOOLS
    assert "llm_classify" in USER_WORKFLOW_ALLOWED_TOOLS


def test_vision_analyzer_binding_and_profile() -> None:
    binding = get_tool_binding("vision_analyzer")
    assert binding is not None
    assert binding.default_tool == "vision_analyze"
    assert binding.input_profile == "vision_analyze"
    assert binding.output_profile == "vision_analysis"
    assert binding.execution_mode == "stateful_required"
    assert resolve_tool_name(_vision_node()) == "vision_analyze"
    assert "image_url" in default_input_types_for_profile("vision_analyze")
    assert "analysis_text" in default_output_types_for_profile("vision_analysis")


def test_llm_summarizer_binding_stateless_ok() -> None:
    binding = get_tool_binding("llm_summarizer")
    assert binding is not None
    assert binding.default_tool == "llm_summarize"
    assert binding.input_profile == "long_text"
    assert binding.output_profile == "llm_summary"
    assert binding.execution_mode == "stateless_ok"
    node = _summarizer_node()
    assert node.mode == "stateless"
    assert resolve_tool_name(node) == "llm_summarize"


def test_llm_classifier_binding() -> None:
    binding = get_tool_binding("llm_classifier")
    assert binding is not None
    assert binding.default_tool == "llm_classify"
    assert binding.input_profile == "classifier"
    assert binding.output_profile == "llm_classification"
    assert resolve_tool_name(_classifier_node()) == "llm_classify"


def test_build_tool_dispatch_args_long_text_profile() -> None:
    node = _summarizer_node()
    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs={"text": "upstream document text"},
        tool_name="llm_summarize",
        ctx=_ctx(),
    )
    assert args["text"] == "upstream document text"


def test_build_tool_dispatch_args_vision_profile() -> None:
    node = _vision_node()
    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs={"image_url": "https://cdn.example/a.png", "prompt": "Describe"},
        tool_name="vision_analyze",
        ctx=_ctx(),
    )
    assert args["image_url"] == "https://cdn.example/a.png"
    assert args["prompt"] == "Describe"


def test_truncate_workflow_text_marks_truncation() -> None:
    body = "x" * 100
    truncated = truncate_workflow_text(body, max_chars=50)
    assert len(truncated) <= 50
    assert truncated.endswith("[truncated]")
    assert workflow_ai_max_input_chars("summarize") >= 256


def test_tool_result_to_node_outputs_vision_analysis_profile() -> None:
    node = _vision_node()
    outputs = tool_result_to_node_outputs(
        {
            "reply": "A cat on a mat.",
            "data": {"analysis_text": "A cat on a mat.", "text": "A cat on a mat."},
        },
        node=node,
    )
    assert outputs["analysis_text"] == "A cat on a mat."
    assert outputs["reply"] == "A cat on a mat."


def test_tool_result_to_node_outputs_llm_classification_profile() -> None:
    node = _classifier_node()
    outputs = tool_result_to_node_outputs(
        {
            "reply": "category=positive; matched=True",
            "data": {
                "category": "positive",
                "matched": True,
                "analysis_text": "category=positive; matched=True",
            },
        },
        node=node,
    )
    assert outputs["category"] == "positive"
    assert outputs["matched"] is True


@pytest.mark.asyncio
async def test_execute_tool_registry_node_llm_summarize_live_dispatch() -> None:
    node = _summarizer_node()
    with patch(
        "api.ewa_platform.companion.workflows.dag.workflow_ai_services.run_llm_summarize",
        new=AsyncMock(return_value="Short summary."),
    ):
        result = await execute_tool_registry_node(
            node,
            {"text": "Very long upstream text"},
            _ctx(),
        )
    assert result.status == "ok"
    assert result.outputs["summary_text"] == "Short summary."
    assert result.outputs["analysis_text"] == "Short summary."


@pytest.mark.asyncio
async def test_execute_tool_registry_node_vision_analyze_live_dispatch() -> None:
    node = _vision_node()
    with patch(
        "api.ewa_platform.companion.workflows.dag.workflow_ai_services.run_vision_analysis",
        new=AsyncMock(return_value="Blue sky and trees."),
    ):
        result = await execute_tool_registry_node(
            node,
            {"image_url": "https://cdn.example/sky.png", "prompt": "Describe scene"},
            _ctx(),
        )
    assert result.status == "ok"
    assert result.outputs["analysis_text"] == "Blue sky and trees."


def test_document_import_to_llm_summarizer_chain_stub_runner() -> None:
    definition = _load_fixture("companion_workflow_v2_ai_doc_summarize_chain.json")
    result = run_workflow_dag_sync(definition, base_ctx=_ctx())
    assert result.status == "completed"
    assert len(result.completed_node_ids) == 2
    import_out = result.registry_snapshot["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"]
    summarize_out = result.registry_snapshot["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"]
    assert "Imported document" in str(import_out["text"])
    assert "summary_text" in summarize_out
    assert "[llm_summarizer stub]" in str(summarize_out.get("summary_text", ""))


def test_apply_input_profile_classifier_maps_categories() -> None:
    merged = apply_input_profile(
        "classifier",
        resolved_inputs={"text": "hello", "categories": "a,b", "rules": "contains hello"},
        ctx=_ctx(),
        args={},
    )
    assert merged["text"] == "hello"
    assert merged["categories"] == "a,b"
    assert merged["rules"] == "contains hello"


def test_apply_output_profile_llm_summary() -> None:
    enriched = apply_output_profile(
        "llm_summary",
        tool_result={"data": {"summary_text": "sum", "analysis_text": "sum"}},
        outputs={"reply": "sum"},
        node=_summarizer_node(),
    )
    assert enriched["summary_text"] == "sum"
    assert enriched["analysis_text"] == "sum"
