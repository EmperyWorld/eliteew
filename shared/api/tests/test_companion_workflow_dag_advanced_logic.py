# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sprint 2.6.9 advanced logic tests: expressions, data_transformer, complex doc chain.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_expression.py
# - api/ewa_platform/companion/workflows/dag/dag_data_transform.py
# ---

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_branching import evaluate_decision
from api.ewa_platform.companion.workflows.dag.dag_data_transform import run_data_transform
from api.ewa_platform.companion.workflows.dag.dag_expression import evaluate_boolean_expression
from api.ewa_platform.companion.workflows.dag.dag_expression_validation import validate_boolean_expression_syntax
from api.ewa_platform.companion.workflows.dag.executors import (
    NodeExecutionResult,
    execute_data_transformer_node,
)
from api.ewa_platform.companion.workflows.dag.runner import run_workflow_dag_sync
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import USER_WORKFLOW_INLINE_DAG_NODE_TYPES
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeConfigV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"

NODE_IMPORT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
NODE_PARSER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
NODE_DECISION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"
NODE_CONFIRM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4"
NODE_EMAIL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5"
NODE_PRINT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6"


@pytest.fixture(autouse=True)
def advanced_logic_tests_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_PDF_PARSER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_DATA_TRANSFORMER_ENABLED", "1")


def _verified_ctx() -> WorkflowValidationContext:
    return WorkflowValidationContext(is_verified_user=True)


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _ctx() -> ToolContext:
    return ToolContext(
        principal_id="p-1",
        user_line="advanced logic",
        content_catalog_user_id="cat-1",
        oauth2_sub_for_content_alternate=None,
    )


def test_data_transformer_node_type_allowlisted() -> None:
    assert "data_transformer" in USER_WORKFLOW_INLINE_DAG_NODE_TYPES


def test_expression_len_function_on_registry_field() -> None:
    from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry

    registry = WorkflowStateRegistry(user_line="", principal_id="p-1")
    registry.register(NODE_PARSER, {"text": "hello world"})
    assert evaluate_boolean_expression(f"len({{{{ {NODE_PARSER}.text }}}}) > 5", registry, {})
    assert not evaluate_boolean_expression(f"string_length({{{{ {NODE_PARSER}.text }}}}) > 100", registry, {})


def test_expression_empty_function() -> None:
    from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry

    registry = WorkflowStateRegistry(user_line="", principal_id="p-1")
    registry.register(NODE_PARSER, {"text": ""})
    assert evaluate_boolean_expression(f"empty({{{{ {NODE_PARSER}.text }}}})", registry, {})


def test_validate_boolean_expression_syntax_accepts_len_comparison() -> None:
    expression = f"len({{{{ {NODE_PARSER}.text }}}}) > 50"
    assert validate_boolean_expression_syntax(expression) == []


def test_evaluate_decision_with_len_expression() -> None:
    from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry

    registry = WorkflowStateRegistry(user_line="", principal_id="p-1")
    registry.register(NODE_PARSER, {"text": "x" * 80})
    node = CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID(NODE_DECISION),
            "type": "decision",
            "config": CompanionWorkflowNodeConfigV2(condition_expression=f"len({{{{ {NODE_PARSER}.text }}}}) > 50"),
            "outputs": {"branch": CompanionWorkflowOutputSpecV2(type="string")},
        }
    )
    result, branch = evaluate_decision(node, {}, registry=registry)
    assert result is True
    assert branch == "yes"


def test_data_transform_json_stringify_and_parse() -> None:
    payload = {"status": "success", "count": 2}
    text, reply = run_data_transform("json_stringify", resolved_inputs={"value": payload})
    assert isinstance(text, str)
    assert "success" in text
    parsed, _ = run_data_transform("json_parse", resolved_inputs={"text": text})
    assert parsed == payload
    assert reply


@pytest.mark.asyncio
async def test_execute_data_transformer_node_string_trim() -> None:
    node = CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"),
            "type": "data_transformer",
            "config": {"transform_op": "string_trim"},
            "inputs": {"text": "  padded  "},
            "outputs": {
                "value": CompanionWorkflowOutputSpecV2(type="json"),
                "text": CompanionWorkflowOutputSpecV2(type="text"),
            },
        }
    )
    result = await execute_data_transformer_node(node, {"text": "  padded  "}, _ctx())
    assert result.status == "ok"
    assert result.outputs["text"] == "padded"
    assert result.outputs["value"] == "padded"


def test_advanced_fixture_validates() -> None:
    definition = _load_fixture("companion_workflow_v2_advanced_doc_decision_email_chain.json")
    validation = validate_dag_definition_for_execution(definition, _verified_ctx())
    assert validation.ok, validation.errors


async def _short_pdf_parser(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: object,
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = node, resolved_inputs, ctx
    short_text = "tiny"
    return NodeExecutionResult(
        status="ok",
        outputs={
            "reply": short_text,
            "text": short_text,
            "extracted_text": short_text,
            "char_count": len(short_text),
        },
    )


def test_advanced_chain_routes_yes_to_email() -> None:
    definition = _load_fixture("companion_workflow_v2_advanced_doc_decision_email_chain.json")
    result = run_workflow_dag_sync(definition, base_ctx=_ctx(), validation_ctx=_verified_ctx())
    assert result.status == "completed"
    assert result.registry_snapshot[NODE_DECISION]["branch"] == "yes"
    assert NODE_PRINT in result.skipped_node_ids
    assert NODE_EMAIL in result.completed_node_ids
    assert NODE_CONFIRM in result.completed_node_ids
    assert "[pdf_parser stub]" in str(result.registry_snapshot[NODE_PARSER]["text"])


def test_advanced_chain_routes_no_to_print_log() -> None:
    definition = _load_fixture("companion_workflow_v2_advanced_doc_decision_email_chain.json")
    result = run_workflow_dag_sync(
        definition,
        base_ctx=_ctx(),
        executors={"pdf_parser": _short_pdf_parser},
        validation_ctx=_verified_ctx(),
    )
    assert result.status == "completed"
    assert result.registry_snapshot[NODE_DECISION]["branch"] == "no"
    assert NODE_PRINT in result.completed_node_ids
    assert NODE_EMAIL in result.skipped_node_ids
    assert NODE_CONFIRM in result.skipped_node_ids


def test_pdf_parser_char_count_expression_also_works() -> None:
    from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry

    registry = WorkflowStateRegistry(user_line="", principal_id="p-1")
    registry.register(NODE_PARSER, {"char_count": 120, "text": "body"})
    assert evaluate_boolean_expression(f"{{{{ {NODE_PARSER}.char_count}}}} > 100", registry, {})
