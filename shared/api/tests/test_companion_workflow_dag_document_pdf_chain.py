# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Integration tests for document_import → prompt_gen → pdf_generate DAG chain (Sprint 2.6.2).
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_tool_bindings.py
# - tests/fixtures/companion_workflow_v2_doc_pdf_chain.json
# ---

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.dag_io_profiles import (
    INPUT_PROFILES,
    OUTPUT_PROFILES,
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
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def dag_doc_chain_stub_adapter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _document_import_node() -> CompanionWorkflowNodeV2:
    return CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"),
            "type": "document_import",
            "mode": "stateful",
            "inputs": {"paperless_id": 42},
            "outputs": {
                "reply": CompanionWorkflowOutputSpecV2(type="text"),
                "unified_content_id": CompanionWorkflowOutputSpecV2(type="string"),
            },
        }
    )


def _pdf_generate_node() -> CompanionWorkflowNodeV2:
    return CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3"),
            "type": "pdf_generate",
            "mode": "stateful",
            "inputs": {"topic": "Quarterly report"},
            "outputs": {
                "reply": CompanionWorkflowOutputSpecV2(type="text"),
                "run_id": CompanionWorkflowOutputSpecV2(type="string"),
                "pdf_url": CompanionWorkflowOutputSpecV2(type="string"),
            },
        }
    )


def test_document_import_binding_maps_paperless_import() -> None:
    binding = get_tool_binding("document_import")
    assert binding is not None
    assert binding.default_tool == "paperless_import"
    assert binding.input_profile == "paperless_import"
    assert binding.output_profile == "document_catalog"
    node = _document_import_node()
    assert resolve_tool_name(node) == "paperless_import"


def test_pdf_generate_binding_maps_presentation_generation() -> None:
    binding = get_tool_binding("pdf_generate")
    assert binding is not None
    assert binding.default_tool == "presentation_generation"
    assert binding.input_profile == "presentation"
    assert binding.output_profile == "async_pdf"
    node = _pdf_generate_node()
    assert resolve_tool_name(node) == "presentation_generation"


def test_io_profiles_cover_bindings() -> None:
    for node_type in ("document_import", "pdf_generate"):
        binding = get_tool_binding(node_type)
        assert binding is not None
        assert binding.input_profile in INPUT_PROFILES
        assert binding.output_profile in OUTPUT_PROFILES
        assert default_input_types_for_profile(binding.input_profile)
        assert default_output_types_for_profile(binding.output_profile)


def test_build_tool_dispatch_args_presentation_profile_maps_topic_from_text() -> None:
    node = _pdf_generate_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="fallback",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs={"text": "Summary from prior node"},
        tool_name="presentation_generation",
        ctx=ctx,
    )
    assert args["topic"] == "Summary from prior node"
    assert args["title"] == "Summary from prior node"


def test_tool_result_output_profiles_document_and_pdf() -> None:
    import_node = _document_import_node()
    doc_outputs = tool_result_to_node_outputs(
        {
            "reply": "Imported",
            "data": {
                "unified_content_id": "uc-1",
                "document_id": "doc-1",
                "paperless_id": 42,
            },
        },
        node=import_node,
    )
    assert doc_outputs["unified_content_id"] == "uc-1"
    assert doc_outputs["document_id"] == "doc-1"

    pdf_node = _pdf_generate_node()
    pdf_outputs = tool_result_to_node_outputs(
        {
            "reply": "Queued",
            "status": "accepted",
            "data": {"run_id": "run-1", "pdf_url": "https://cdn.example/out.pdf"},
            "task_run": {"id": "run-1", "status": "running"},
        },
        node=pdf_node,
    )
    assert pdf_outputs["run_id"] == "run-1"
    assert pdf_outputs["pdf_url"] == "https://cdn.example/out.pdf"


@pytest.mark.asyncio
async def test_execute_tool_registry_node_document_import_dispatch() -> None:
    node = _document_import_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="import doc",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    mock_result = {
        "tool": "paperless_import",
        "status": "ok",
        "reply": "Imported",
        "data": {
            "unified_content_id": "uc-99",
            "document_id": "doc-99",
            "paperless_id": 42,
        },
    }
    with (
        patch(
            "api.ewa_platform.companion.workflows.config.companion_dag_tool_registry_adapter_enabled",
            return_value=True,
        ),
        patch(
            "api.ewa_platform.companion.workflows.dag.tool_registry_adapter.dispatch_tool_by_name",
            new=AsyncMock(return_value=mock_result),
        ) as dispatch,
    ):
        result = await execute_tool_registry_node(node, {"paperless_id": 42}, ctx)
    dispatch.assert_awaited_once()
    assert dispatch.await_args is not None
    assert dispatch.await_args.args[0] == "paperless_import"
    assert dispatch.await_args.args[1]["paperless_id"] == 42
    assert result.status == "ok"
    assert result.outputs["unified_content_id"] == "uc-99"


def test_doc_import_prompt_pdf_chain_completes_with_stubs() -> None:
    definition = _load_fixture("companion_workflow_v2_doc_pdf_chain.json")
    ctx = ToolContext(
        principal_id="user-1",
        user_line="doc pdf chain",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(definition, base_ctx=ctx)
    assert result.status == "completed"
    assert len(result.completed_node_ids) == 3
    import_out = result.registry_snapshot["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"]
    prompt_out = result.registry_snapshot["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"]
    pdf_out = result.registry_snapshot["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3"]
    assert import_out["unified_content_id"]
    assert "Imported document" in str(import_out["text"])
    assert "Summarize for presentation" in str(prompt_out["reply"])
    assert pdf_out["run_id"]
    assert pdf_out["pdf_url"]
    assert str(prompt_out["reply"]) in str(pdf_out["reply"])
