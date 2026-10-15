# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sprint 2.6.6 for_each loops and expression parser tests.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_expression.py
# - api/ewa_platform/companion/workflows/dag/dag_loop.py
# ---

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_branching import evaluate_decision
from api.ewa_platform.companion.workflows.dag.dag_expression import evaluate_boolean_expression
from api.ewa_platform.companion.workflows.dag.dag_loop import collect_loop_body_node_ids
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph
from api.ewa_platform.companion.workflows.dag.runner import run_workflow_dag_sync
from api.ewa_platform.companion.workflows.dag.state_registry import LoopContext, WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeConfigV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"

NODE_FOR_EACH = "11111111-1111-4111-8111-111111111101"
NODE_DECISION = "11111111-1111-4111-8111-111111111102"
NODE_SEND = "11111111-1111-4111-8111-111111111103"
NODE_SKIP = "11111111-1111-4111-8111-111111111104"


@pytest.fixture(autouse=True)
def loop_expression_tests_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")


def _verified_ctx() -> WorkflowValidationContext:
    return WorkflowValidationContext(is_verified_user=True)


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _ctx() -> ToolContext:
    return ToolContext(
        principal_id="p-1",
        user_line="for each decision",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )


def test_expression_comparisons_and_logical_operators() -> None:
    registry = WorkflowStateRegistry(user_line="x", principal_id="p-1")
    registry.register("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", {"status": "success", "count": 5})
    assert evaluate_boolean_expression("{{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.status}} == 'success'", registry, {})
    assert evaluate_boolean_expression("{{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.count}} > 3", registry, {})
    assert evaluate_boolean_expression(
        "{{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.status}} == 'success' AND {{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.count}} >= 5",
        registry,
        {},
    )
    assert not evaluate_boolean_expression(
        "{{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.status}} == 'failed' OR {{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.count}} < 1",
        registry,
        {},
    )


def test_expression_len_and_string_length_functions() -> None:
    registry = WorkflowStateRegistry(user_line="", principal_id="p-1")
    registry.register("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", {"text": "abcdef"})
    assert evaluate_boolean_expression("len({{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.text}}) > 5", registry, {})
    assert evaluate_boolean_expression(
        "string_length({{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.text}}) == 6", registry, {}
    )


def test_expression_loop_item_placeholder() -> None:
    registry = WorkflowStateRegistry(user_line="", principal_id="p-1")
    registry.push_loop(LoopContext(for_each_node_id=NODE_FOR_EACH, index=1, item="urgent", total=3))
    try:
        assert evaluate_boolean_expression("{{loop.item}} == 'urgent'", registry, {})
        assert evaluate_boolean_expression("{{loop.index}} == 1", registry, {})
    finally:
        registry.pop_loop()


def test_evaluate_decision_with_condition_expression() -> None:
    registry = WorkflowStateRegistry(user_line="", principal_id="p-1")
    registry.push_loop(LoopContext(for_each_node_id=NODE_FOR_EACH, index=0, item="urgent", total=2))
    node = CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID(NODE_DECISION),
            "type": "decision",
            "config": CompanionWorkflowNodeConfigV2(condition_expression="{{loop.item}} == 'urgent'"),
            "outputs": {"branch": CompanionWorkflowOutputSpecV2(type="string")},
        }
    )
    try:
        result, branch = evaluate_decision(node, {}, registry=registry)
        assert result is True
        assert branch == "yes"
    finally:
        registry.pop_loop()


def test_for_each_fixture_validates_and_body_discovery() -> None:
    definition = _load_fixture("companion_workflow_v2_for_each_decision_chain.json")
    validation = validate_dag_definition_for_execution(definition, _verified_ctx())
    assert validation.ok, validation.errors
    graph = build_workflow_graph(definition)
    body = collect_loop_body_node_ids(definition, graph, NODE_FOR_EACH)
    assert NODE_DECISION in body
    assert NODE_SEND in body
    assert NODE_SKIP in body


def test_for_each_decision_chain_executes_matching_iterations() -> None:
    definition = _load_fixture("companion_workflow_v2_for_each_decision_chain.json")
    result = run_workflow_dag_sync(definition, base_ctx=_ctx(), validation_ctx=_verified_ctx())
    assert result.status == "completed"
    for_each_out = result.registry_snapshot[NODE_FOR_EACH]
    assert for_each_out["count"] == 3
    iteration_results = for_each_out["iteration_results"]
    assert len(iteration_results) == 3
    yes_iterations = [
        item for item in iteration_results if item["outputs"].get(NODE_DECISION, {}).get("branch") == "yes"
    ]
    no_iterations = [item for item in iteration_results if item["outputs"].get(NODE_DECISION, {}).get("branch") == "no"]
    assert len(yes_iterations) == 2
    assert len(no_iterations) == 1
    assert yes_iterations[0]["outputs"][NODE_SEND]["log_text"] == "send urgent"
    assert no_iterations[0]["outputs"][NODE_SKIP]["log_text"] == "skip normal"


def test_for_each_requires_single_body_edge() -> None:
    definition = CompanionWorkflowDefinitionV2.model_validate(
        {
            "schema_version": 2,
            "workflow_id": "bad_for_each",
            "version": 1,
            "title_ru": "t",
            "title_en": "t",
            "enabled": True,
            "triggers": [{"type": "regex", "pattern": "^x$"}],
            "nodes": [
                {"id": UUID(NODE_FOR_EACH), "type": "for_each", "outputs": {}},
                {"id": UUID(NODE_DECISION), "type": "print_log", "outputs": {}},
            ],
            "edges": [],
        }
    )
    validation = validate_dag_definition_for_execution(definition, _verified_ctx())
    assert not validation.ok
    assert any("for_each" in err and "body" in err for err in validation.errors)
