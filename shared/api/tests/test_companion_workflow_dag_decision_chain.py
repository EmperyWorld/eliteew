# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sprint 2.6.5 decision/switch branching tests: validation, evaluation, DAG chain routing.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_branching.py
# ---

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_branching import (
    compute_branch_skip_nodes,
    evaluate_decision,
    evaluate_switch,
)
from api.ewa_platform.companion.workflows.dag.executors import NodeExecutionResult, execute_decision_node
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph
from api.ewa_platform.companion.workflows.dag.runner import run_workflow_dag_sync
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowEdgeV2,
    CompanionWorkflowNodeConfigV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
    CompanionWorkflowSwitchCaseV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"

NODE_IMPORT = "ffffffff-ffff-4fff-8fff-fffffffffff1"
NODE_SUMMARIZE = "ffffffff-ffff-4fff-8fff-fffffffffff2"
NODE_DECISION = "ffffffff-ffff-4fff-8fff-fffffffffff3"
NODE_CONFIRM = "ffffffff-ffff-4fff-8fff-fffffffffff4"
NODE_EMAIL = "ffffffff-ffff-4fff-8fff-fffffffffff5"
NODE_PRINT = "ffffffff-ffff-4fff-8fff-fffffffffff6"


@pytest.fixture(autouse=True)
def decision_tests_stub_adapter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _ctx() -> ToolContext:
    return ToolContext(
        principal_id="p-1",
        user_line="decision chain",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )


def _decision_node(**kwargs: object) -> CompanionWorkflowNodeV2:
    defaults = {
        "id": UUID(NODE_DECISION),
        "type": "decision",
        "config": CompanionWorkflowNodeConfigV2(
            condition_op="length_gt",
            condition_field="text",
            condition_value=100,
        ),
        "inputs": {"text": "short"},
        "outputs": {
            "result": CompanionWorkflowOutputSpecV2(type="boolean"),
            "branch": CompanionWorkflowOutputSpecV2(type="string"),
        },
    }
    defaults.update(kwargs)
    return CompanionWorkflowNodeV2.model_validate(defaults)


def test_decision_evaluate_length_gt_yes() -> None:
    node = _decision_node(inputs={"text": "x" * 120})
    result, branch = evaluate_decision(node, {"text": "x" * 120})
    assert result is True
    assert branch == "yes"


def test_decision_evaluate_length_gt_no() -> None:
    node = _decision_node()
    result, branch = evaluate_decision(node, {"text": "short summary"})
    assert result is False
    assert branch == "no"


@pytest.mark.asyncio
async def test_execute_decision_node_outputs_branch() -> None:
    node = _decision_node(inputs={"text": "x" * 150})
    result = await execute_decision_node(node, {"text": "x" * 150}, _ctx())
    assert result.status == "ok"
    assert result.outputs["branch"] == "yes"
    assert result.outputs["result"] is True


def test_switch_evaluate_first_matching_case() -> None:
    node = CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID("11111111-1111-4111-8111-111111111111"),
            "type": "switch",
            "config": {
                "switch_source": "category",
                "switch_cases": [
                    {"branch": "case_a", "op": "eq", "value": "alpha", "source": "category"},
                    {"branch": "case_b", "op": "eq", "value": "beta", "source": "category"},
                ],
            },
            "inputs": {"category": "beta"},
            "outputs": {"branch": CompanionWorkflowOutputSpecV2(type="string")},
        }
    )
    matched, branch = evaluate_switch(node, {"category": "beta"})
    assert matched == "case_b"
    assert branch == "case_b"


def test_compute_branch_skip_nodes_preserves_merge_reachability() -> None:
    definition = CompanionWorkflowDefinitionV2.model_validate(
        {
            "schema_version": 2,
            "workflow_id": "branch_merge_demo",
            "version": 1,
            "title_ru": "t",
            "title_en": "t",
            "enabled": True,
            "triggers": [{"type": "regex", "pattern": "^x$"}],
            "nodes": [
                {"id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"), "type": "decision", "outputs": {}},
                {"id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"), "type": "print_log", "outputs": {}},
                {"id": UUID("cccccccc-cccc-4ccc-8ccc-ccccccccccc1"), "type": "print_log", "outputs": {}},
                {"id": UUID("dddddddd-dddd-4ddd-8ddd-ddddddddddd1"), "type": "print_log", "outputs": {}},
            ],
            "edges": [
                {
                    "source_node_id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
                    "target_node_id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"),
                    "branch": "yes",
                },
                {
                    "source_node_id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
                    "target_node_id": UUID("cccccccc-cccc-4ccc-8ccc-ccccccccccc1"),
                    "branch": "no",
                },
                {
                    "source_node_id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"),
                    "target_node_id": UUID("dddddddd-dddd-4ddd-8ddd-ddddddddddd1"),
                },
                {
                    "source_node_id": UUID("cccccccc-cccc-4ccc-8ccc-ccccccccccc1"),
                    "target_node_id": UUID("dddddddd-dddd-4ddd-8ddd-ddddddddddd1"),
                },
            ],
        }
    )
    graph = build_workflow_graph(definition)
    skips = compute_branch_skip_nodes(
        graph,
        definition,
        node_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        selected_branch="yes",
    )
    assert "cccccccc-cccc-4ccc-8ccc-ccccccccccc1" in skips
    assert "dddddddd-dddd-4ddd-8ddd-ddddddddddd1" not in skips


def test_decision_requires_two_branch_edges() -> None:
    definition = CompanionWorkflowDefinitionV2.model_validate(
        {
            "schema_version": 2,
            "workflow_id": "bad_decision",
            "version": 1,
            "title_ru": "t",
            "title_en": "t",
            "enabled": True,
            "triggers": [{"type": "regex", "pattern": "^x$"}],
            "nodes": [
                {"id": UUID(NODE_DECISION), "type": "decision", "outputs": {}},
                {"id": UUID(NODE_PRINT), "type": "print_log", "outputs": {}},
            ],
            "edges": [
                CompanionWorkflowEdgeV2(
                    source_node_id=UUID(NODE_DECISION),
                    target_node_id=UUID(NODE_PRINT),
                    branch="yes",
                ).model_dump(mode="json")
            ],
        }
    )
    validation = validate_dag_definition_for_execution(definition, WorkflowValidationContext())
    assert not validation.ok
    assert any("at least two outgoing branch edges" in err for err in validation.errors)


def test_switch_unreachable_case_detected() -> None:
    definition = CompanionWorkflowDefinitionV2.model_validate(
        {
            "schema_version": 2,
            "workflow_id": "bad_switch",
            "version": 1,
            "title_ru": "t",
            "title_en": "t",
            "enabled": True,
            "triggers": [{"type": "regex", "pattern": "^x$"}],
            "nodes": [
                {
                    "id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
                    "type": "switch",
                    "config": {
                        "switch_cases": [
                            CompanionWorkflowSwitchCaseV2(branch="case_a", op="eq", value="a").model_dump(mode="json"),
                            CompanionWorkflowSwitchCaseV2(branch="case_b", op="eq", value="b").model_dump(mode="json"),
                        ]
                    },
                    "outputs": {},
                },
                {"id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"), "type": "print_log", "outputs": {}},
                {"id": UUID("cccccccc-cccc-4ccc-8ccc-ccccccccccc2"), "type": "print_log", "outputs": {}},
            ],
            "edges": [
                {
                    "source_node_id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
                    "target_node_id": UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"),
                    "branch": "case_a",
                },
                {
                    "source_node_id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
                    "target_node_id": UUID("cccccccc-cccc-4ccc-8ccc-ccccccccccc2"),
                    "branch": "default",
                },
            ],
        }
    )
    validation = validate_dag_definition_for_execution(definition, WorkflowValidationContext())
    assert not validation.ok
    assert any("case_b" in err and "unreachable" in err for err in validation.errors)


def _verified_ctx() -> WorkflowValidationContext:
    return WorkflowValidationContext(is_verified_user=True)


def test_decision_fixture_validates() -> None:
    definition = _load_fixture("companion_workflow_v2_decision_email_or_log.json")
    validation = validate_dag_definition_for_execution(definition, _verified_ctx())
    assert validation.ok, validation.errors


async def _long_document_import(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: object,
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = node, resolved_inputs, ctx
    long_text = "L" * 160
    return NodeExecutionResult(
        status="ok",
        outputs={
            "reply": long_text,
            "text": long_text,
            "unified_content_id": "stub-long",
            "document_id": "stub-doc",
            "paperless_id": 55,
        },
    )


def test_decision_chain_routes_yes_to_email_skips_print_log() -> None:
    definition = _load_fixture("companion_workflow_v2_decision_email_or_log.json")
    result = run_workflow_dag_sync(
        definition,
        base_ctx=_ctx(),
        executors={"document_import": _long_document_import},
        validation_ctx=_verified_ctx(),
    )
    assert result.status == "completed"
    assert NODE_PRINT in result.skipped_node_ids
    assert NODE_EMAIL in result.completed_node_ids
    assert NODE_CONFIRM in result.completed_node_ids
    assert result.registry_snapshot[NODE_DECISION]["branch"] == "yes"


def test_decision_chain_routes_no_to_print_log_skips_email_path() -> None:
    definition = _load_fixture("companion_workflow_v2_decision_email_or_log.json")
    result = run_workflow_dag_sync(definition, base_ctx=_ctx(), validation_ctx=_verified_ctx())
    assert result.status == "completed"
    assert NODE_PRINT in result.completed_node_ids
    assert NODE_EMAIL in result.skipped_node_ids
    assert NODE_CONFIRM in result.skipped_node_ids
    assert result.registry_snapshot[NODE_DECISION]["branch"] == "no"
    assert result.registry_snapshot[NODE_PRINT]["log_text"]
