# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sprint 2.6.8 content processing tests: pdf_parser, document_extractor, import→parse→summarize chain.
# Related:
# - api/ewa_platform/companion/workflows/dag/workflow_document_services.py
# - tests/fixtures/companion_workflow_v2_doc_pdf_parse_summarize_chain.json
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
from api.ewa_platform.companion.workflows.dag.workflow_document_services import (
    WorkflowDocumentBytes,
    WorkflowDocumentExtractResult,
)
from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import USER_WORKFLOW_ALLOWED_TOOLS
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def content_processing_tests_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_PDF_PARSER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_DOCUMENT_EXTRACTOR_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_LLM_SUMMARIZER_ENABLED", "1")


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _ctx() -> ToolContext:
    return ToolContext(
        principal_id="p-1",
        user_line="parse document",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )


def _pdf_parser_node(**kwargs: object) -> CompanionWorkflowNodeV2:
    defaults = {
        "id": UUID("ffffffff-ffff-4fff-8fff-fffffffffff2"),
        "type": "pdf_parser",
        "mode": "stateless",
        "inputs": {"unified_content_id": "uc-pdf-1", "paperless_id": 55},
        "outputs": {
            "reply": CompanionWorkflowOutputSpecV2(type="text"),
            "text": CompanionWorkflowOutputSpecV2(type="text"),
            "extracted_text": CompanionWorkflowOutputSpecV2(type="text"),
            "char_count": CompanionWorkflowOutputSpecV2(type="number"),
        },
    }
    defaults.update(kwargs)
    return CompanionWorkflowNodeV2.model_validate(defaults)


def _document_extractor_node(**kwargs: object) -> CompanionWorkflowNodeV2:
    defaults = {
        "id": UUID("dddddddd-dddd-4ddd-8ddd-dddddddddd02"),
        "type": "document_extractor",
        "mode": "stateless",
        "inputs": {"unified_content_id": "uc-docx-1"},
        "outputs": {
            "reply": CompanionWorkflowOutputSpecV2(type="text"),
            "text": CompanionWorkflowOutputSpecV2(type="text"),
            "extracted_text": CompanionWorkflowOutputSpecV2(type="text"),
            "char_count": CompanionWorkflowOutputSpecV2(type="number"),
        },
    }
    defaults.update(kwargs)
    return CompanionWorkflowNodeV2.model_validate(defaults)


def test_document_tools_allowlisted() -> None:
    assert "pdf_parser" in USER_WORKFLOW_ALLOWED_TOOLS
    assert "document_extractor" in USER_WORKFLOW_ALLOWED_TOOLS


def test_pdf_parser_binding_and_profiles() -> None:
    binding = get_tool_binding("pdf_parser")
    assert binding is not None
    assert binding.default_tool == "pdf_parser"
    assert binding.input_profile == "document_source"
    assert binding.output_profile == "document_extract"
    assert binding.execution_mode == "stateless_ok"
    assert resolve_tool_name(_pdf_parser_node()) == "pdf_parser"
    assert "unified_content_id" in default_input_types_for_profile("document_source")
    assert "extracted_text" in default_output_types_for_profile("document_extract")


def test_document_extractor_binding() -> None:
    binding = get_tool_binding("document_extractor")
    assert binding is not None
    assert binding.default_tool == "document_extractor"
    assert binding.input_profile == "document_source"
    assert binding.output_profile == "document_extract"
    assert resolve_tool_name(_document_extractor_node()) == "document_extractor"


def test_io_profiles_cover_document_bindings() -> None:
    for node_type in ("pdf_parser", "document_extractor"):
        binding = get_tool_binding(node_type)
        assert binding is not None
        assert binding.input_profile in INPUT_PROFILES
        assert binding.output_profile in OUTPUT_PROFILES
        assert default_input_types_for_profile(binding.input_profile)
        assert default_output_types_for_profile(binding.output_profile)


def test_build_tool_dispatch_args_document_source_profile() -> None:
    node = _pdf_parser_node()
    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs={"unified_content_id": "uc-from-import", "paperless_id": 55},
        tool_name="pdf_parser",
        ctx=_ctx(),
    )
    assert args["unified_content_id"] == "uc-from-import"
    assert args["paperless_id"] == 55


def test_apply_input_profile_document_source() -> None:
    merged = apply_input_profile(
        "document_source",
        resolved_inputs={
            "unified_content_id": "uc-1",
            "paperless_id": 12,
            "filename": "report.pdf",
        },
        ctx=_ctx(),
        args={},
    )
    assert merged["unified_content_id"] == "uc-1"
    assert merged["paperless_id"] == 12
    assert merged["filename"] == "report.pdf"


def test_tool_result_to_node_outputs_document_extract_profile() -> None:
    node = _pdf_parser_node()
    outputs = tool_result_to_node_outputs(
        {
            "reply": "Quarterly revenue grew.",
            "data": {
                "text": "Quarterly revenue grew.",
                "extracted_text": "Quarterly revenue grew.",
                "filename": "report.pdf",
                "mime_type": "application/pdf",
                "char_count": 23,
            },
        },
        node=node,
    )
    assert outputs["text"] == "Quarterly revenue grew."
    assert outputs["extracted_text"] == "Quarterly revenue grew."
    assert outputs["char_count"] == 23
    assert outputs["filename"] == "report.pdf"


def test_apply_output_profile_document_extract() -> None:
    enriched = apply_output_profile(
        "document_extract",
        tool_result={
            "data": {
                "text": "Body text",
                "extracted_text": "Body text",
                "char_count": 9,
            }
        },
        outputs={"reply": "Body text"},
        node=_pdf_parser_node(),
    )
    assert enriched["text"] == "Body text"
    assert enriched["extracted_text"] == "Body text"
    assert enriched["char_count"] == 9


@pytest.mark.asyncio
async def test_execute_tool_registry_node_pdf_parser_live_dispatch() -> None:
    node = _pdf_parser_node()
    extract_result = WorkflowDocumentExtractResult(
        ok=True,
        text="Parsed PDF body for summarization.",
        filename="report.pdf",
        mime_type="application/pdf",
        char_count=34,
    )
    with (
        patch(
            "api.ewa_platform.companion.workflows.dag.workflow_document_services.resolve_workflow_document_bytes",
            new=AsyncMock(
                return_value=WorkflowDocumentBytes(
                    filename="report.pdf",
                    data=b"%PDF-1.4",
                    mime_type="application/pdf",
                )
            ),
        ),
        patch(
            "api.ewa_platform.companion.workflows.dag.workflow_document_services.run_pdf_text_extraction",
            new=AsyncMock(return_value=extract_result),
        ),
    ):
        result = await execute_tool_registry_node(
            node,
            {"unified_content_id": "uc-pdf-1"},
            _ctx(),
        )
    assert result.status == "ok"
    assert result.outputs["text"] == "Parsed PDF body for summarization."
    assert result.outputs["extracted_text"] == "Parsed PDF body for summarization."
    assert result.outputs["char_count"] == 34


@pytest.mark.asyncio
async def test_execute_tool_registry_node_document_extractor_live_dispatch() -> None:
    node = _document_extractor_node()
    extract_result = WorkflowDocumentExtractResult(
        ok=True,
        text="DOCX paragraph one.",
        filename="notes.docx",
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        char_count=19,
    )
    with (
        patch(
            "api.ewa_platform.companion.workflows.dag.workflow_document_services.resolve_workflow_document_bytes",
            new=AsyncMock(
                return_value=WorkflowDocumentBytes(
                    filename="notes.docx",
                    data=b"PK\x03\x04",
                    mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            ),
        ),
        patch(
            "api.ewa_platform.companion.workflows.dag.workflow_document_services.run_document_text_extraction",
            new=AsyncMock(return_value=extract_result),
        ),
    ):
        result = await execute_tool_registry_node(
            node,
            {"unified_content_id": "uc-docx-1"},
            _ctx(),
        )
    assert result.status == "ok"
    assert result.outputs["text"] == "DOCX paragraph one."
    assert result.outputs["char_count"] == 19


def test_document_import_pdf_parser_summarizer_chain_stub_runner() -> None:
    definition = _load_fixture("companion_workflow_v2_doc_pdf_parse_summarize_chain.json")
    result = run_workflow_dag_sync(definition, base_ctx=_ctx())
    assert result.status == "completed"
    assert len(result.completed_node_ids) == 3

    import_out = result.registry_snapshot["ffffffff-ffff-4fff-8fff-fffffffffff1"]
    parser_out = result.registry_snapshot["ffffffff-ffff-4fff-8fff-fffffffffff2"]
    summarize_out = result.registry_snapshot["ffffffff-ffff-4fff-8fff-fffffffffff3"]

    assert import_out["unified_content_id"]
    assert "[pdf_parser stub]" in str(parser_out["text"])
    assert parser_out["char_count"] >= 1
    assert "[llm_summarizer stub]" in str(summarize_out.get("summary_text", ""))
    assert str(parser_out["text"]) in str(summarize_out.get("summary_text", ""))
