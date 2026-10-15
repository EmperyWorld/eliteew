# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for workflow engine v2 schema, graph, resolver, runner, and validation.
# Related:
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.context_switcher import build_node_tool_context
from api.ewa_platform.companion.workflows.dag.errors import (
    CycleDetectedError,
    NodeExecutionError,
    UnknownNodeReferenceError,
    UnresolvedPlaceholderError,
)
from api.ewa_platform.companion.workflows.dag.executors import NodeExecutionResult, execute_prompt_gen_node
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph, topological_sort_node_ids
from api.ewa_platform.companion.workflows.dag.limits import DAG_MAX_NODES_REGULAR, DAG_MAX_NODES_VERIFIED
from api.ewa_platform.companion.workflows.dag.migration import linear_steps_to_dag_v2
from api.ewa_platform.companion.workflows.dag.runner import run_workflow_dag_sync
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.companion.workflows.dag.variable_resolver import (
    collect_placeholders,
    resolve_node_inputs,
    resolve_registry_path,
    resolve_template_string,
)
from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowDefinitionV1,
    CompanionWorkflowStepV1,
    CompanionWorkflowTriggerV1,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowEdgeV2,
    CompanionWorkflowOnErrorV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def dag_sync_runner_uses_tool_stubs(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sync runner tests assert stub executors; disable live tool_registry adapter from stack0 env."""

    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def test_linear_fixture_parses() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    assert definition.schema_version == 2
    assert len(definition.nodes) == 3


def test_duplicate_node_ids_rejected() -> None:
    base = _load_fixture("companion_workflow_v2_linear.json").model_dump(mode="json")
    base["nodes"].append(dict(base["nodes"][0]))
    with pytest.raises(ValidationError):
        CompanionWorkflowDefinitionV2.model_validate(base)


def test_topological_sort_linear_and_diamond() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    graph = build_workflow_graph(definition)
    ordered = topological_sort_node_ids(graph)
    assert ordered[0] == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    assert set(ordered[1:]) == {
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    }


def test_cycle_detected() -> None:
    definition = _load_fixture("companion_workflow_v2_cycle.json")
    graph = build_workflow_graph(definition)
    with pytest.raises(CycleDetectedError):
        topological_sort_node_ids(graph)


def test_entrypoints_include_orphans() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    graph = build_workflow_graph(definition)
    assert graph.entrypoint_node_ids() == ("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",)


def test_state_registry_nested_get() -> None:
    registry = WorkflowStateRegistry(user_line="hello", principal_id="p-1")
    registry.register("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", {"reply": {"text": "ok"}})
    assert registry.get_path("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", ["reply", "text"]) == "ok"
    assert registry.resolve_turn_path(["user_line"]) == "hello"


def test_resolver_strict_missing_field() -> None:
    registry = WorkflowStateRegistry()
    registry.register("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", {"reply": "x"})
    with pytest.raises(UnresolvedPlaceholderError):
        resolve_registry_path(registry, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.missing")


def test_resolver_unknown_node() -> None:
    registry = WorkflowStateRegistry()
    with pytest.raises(UnknownNodeReferenceError):
        resolve_registry_path(registry, "cccccccc-cccc-4ccc-8ccc-ccccccccccc1.reply")


def test_node_inputs_override_edge_mapping_rules() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    registry = WorkflowStateRegistry()
    registry.register("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", {"reply": "from-node"})
    node = definition.nodes[1]
    edge = definition.edges[0].model_copy(
        update={"mapping_rules": {"text": "{{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.reply}}"}}
    )
    node = node.model_copy(update={"inputs": {"text": "explicit-win", "contains": "demo"}})
    resolved = resolve_node_inputs(
        node_id=node.id,
        node_inputs=node.inputs,
        incoming_edges=[edge],
        registry=registry,
    )
    assert resolved["text"] == "explicit-win"


def test_validate_placeholders_rejects_forward_reference() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    bad = definition.model_copy(
        update={
            "nodes": [
                definition.nodes[0].model_copy(
                    update={"inputs": {"prompt": "{{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2.reply}}"}}
                ),
                *definition.nodes[1:],
            ]
        }
    )
    result = validate_dag_definition_for_execution(bad)
    assert result.ok is False
    assert any("not upstream" in err for err in result.errors)


def test_quota_rejects_four_nodes_for_unverified() -> None:
    definition = _load_fixture("companion_workflow_v2_quota.json")
    result = validate_dag_definition_for_execution(
        definition,
        WorkflowValidationContext(is_verified_user=False),
    )
    assert result.ok is False
    assert result.max_nodes_allowed == DAG_MAX_NODES_REGULAR
    assert any("node quota exceeded" in err for err in result.errors)


def test_quota_allows_four_nodes_for_verified() -> None:
    definition = _load_fixture("companion_workflow_v2_quota.json")
    result = validate_dag_definition_for_execution(
        definition,
        WorkflowValidationContext(is_verified_user=True),
    )
    assert result.ok is True
    assert result.max_nodes_allowed == DAG_MAX_NODES_VERIFIED


def test_type_mismatch_image_url_to_text() -> None:
    definition = _load_fixture("companion_workflow_v2_type_mismatch.json")
    result = validate_dag_definition_for_execution(definition)
    assert result.ok is False
    assert any("type mismatch" in err for err in result.errors)
    assert any("plain_text" in err or "text" in err for err in result.errors)


def test_runner_fallback_value_continues_downstream() -> None:
    definition = _load_fixture("companion_workflow_v2_fallback.json")
    fail_id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"
    attempts = {"count": 0}

    async def _fail_once(node, resolved_inputs, ctx):
        _ = resolved_inputs, ctx
        if str(node.id) == fail_id:
            attempts["count"] += 1
            return NodeExecutionResult(status="failed", outputs={}, error="boom")
        return await execute_prompt_gen_node(node, resolved_inputs, ctx)

    ctx = ToolContext(
        principal_id="user-1",
        user_line="seed",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(definition, base_ctx=ctx, executors={"prompt_gen": _fail_once})
    assert result.status == "completed"
    assert result.node_outcomes[fail_id].used_fallback is True
    assert result.registry_snapshot["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3"]["matched"] is True


def test_runner_stop_skips_downstream_partial() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    fail_id = str(definition.nodes[1].id)
    patched = definition.model_copy(
        update={
            "edges": [
                CompanionWorkflowEdgeV2(
                    source_node_id=definition.nodes[0].id,
                    target_node_id=definition.nodes[1].id,
                ),
                CompanionWorkflowEdgeV2(
                    source_node_id=definition.nodes[1].id,
                    target_node_id=definition.nodes[2].id,
                ),
            ]
        }
    )

    async def _fail_filter(node, resolved_inputs, ctx):
        _ = node, resolved_inputs, ctx
        raise NodeExecutionError(node_id=fail_id, message="filter failed")

    ctx = ToolContext(
        principal_id="user-1",
        user_line="demo prompt",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(patched, base_ctx=ctx, executors={"logic_filter": _fail_filter})
    assert result.status == "partial"
    assert str(definition.nodes[0].id) in result.completed_node_ids
    assert fail_id == result.failed_node_id
    assert str(definition.nodes[2].id) in result.skipped_node_ids


def test_runner_retry_succeeds_on_third_attempt() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    node = definition.nodes[0].model_copy(
        update={"on_error": CompanionWorkflowOnErrorV2(strategy="retry", max_attempts=3)}
    )
    patched = definition.model_copy(update={"nodes": [node, *definition.nodes[1:]]})
    attempts = {"count": 0}

    async def _fail_twice(node_obj, resolved_inputs, ctx):
        _ = node_obj, resolved_inputs, ctx
        attempts["count"] += 1
        if attempts["count"] < 3:
            return NodeExecutionResult(status="failed", outputs={}, error="retry me")
        return await execute_prompt_gen_node(node_obj, resolved_inputs, ctx)

    ctx = ToolContext(
        principal_id="user-1",
        user_line="demo prompt",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(patched, base_ctx=ctx, executors={"prompt_gen": _fail_twice})
    assert result.status == "completed"
    assert attempts["count"] == 3
    assert result.node_outcomes[str(node.id)].attempts == 3


def test_runner_retry_exhaustion_skips_downstream() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    node = definition.nodes[0].model_copy(
        update={"on_error": CompanionWorkflowOnErrorV2(strategy="retry", max_attempts=2)}
    )
    patched = definition.model_copy(update={"nodes": [node, *definition.nodes[1:]]})

    async def _always_fail(node_obj, resolved_inputs, ctx):
        _ = node_obj, resolved_inputs, ctx
        return NodeExecutionResult(status="failed", outputs={}, error="nope")

    ctx = ToolContext(
        principal_id="user-1",
        user_line="demo prompt",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(patched, base_ctx=ctx, executors={"prompt_gen": _always_fail})
    assert result.status == "failed"
    assert result.node_outcomes[str(node.id)].attempts == 2
    assert str(definition.nodes[1].id) in result.skipped_node_ids


def test_runner_completes_linear_fixture() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    ctx = ToolContext(
        principal_id="user-1",
        user_line="demo prompt",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(definition, base_ctx=ctx)
    assert result.status == "completed"
    assert len(result.registry_snapshot) == 3
    assert result.registry_snapshot["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"]["matched"] is True


def test_runner_stops_on_failure() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")

    async def _fail_prompt(node, resolved_inputs, ctx):
        _ = node, resolved_inputs, ctx
        raise NodeExecutionError(node_id=str(definition.nodes[0].id), message="forced failure")

    ctx = ToolContext(
        principal_id="user-1", user_line="demo", content_catalog_user_id=None, oauth2_sub_for_content_alternate=None
    )
    result = run_workflow_dag_sync(definition, base_ctx=ctx, executors={"prompt_gen": _fail_prompt})
    assert result.status == "failed"
    assert result.failed_node_id == str(definition.nodes[0].id)
    assert str(definition.nodes[1].id) in result.skipped_node_ids


def test_context_switcher_stateless_strips_memory_fields() -> None:
    definition = _load_fixture("companion_workflow_v2_linear.json")
    base = ToolContext(
        principal_id="user-1",
        user_line="demo",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        shell_norm={"x": 1},
        intent_plan={"y": 2},
        profile={"z": 3},
        bearer_token="token",
    )
    node = definition.nodes[1]
    stateless_ctx = build_node_tool_context(base, node)
    assert stateless_ctx.shell_norm is None
    assert stateless_ctx.intent_plan is None
    assert stateless_ctx.profile is None
    assert stateless_ctx.bearer_token == "token"


def test_linear_v1_migration_preserves_order() -> None:
    v1 = CompanionWorkflowDefinitionV1(
        workflow_id="user_demo_chain",
        version=1,
        title_ru="Demo",
        title_en="Demo",
        triggers=[CompanionWorkflowTriggerV1(type="regex", pattern="^demo$")],
        steps=[
            CompanionWorkflowStepV1(step_key="s1", kind="tool", tool_name="file_create", args_template={"name": "a"}),
            CompanionWorkflowStepV1(
                step_key="s2",
                kind="tool",
                tool_name="image_generation",
                args_template={"prompt": "{{steps.1.output.reply}}"},
            ),
        ],
    )
    v2 = linear_steps_to_dag_v2(v1)
    graph = build_workflow_graph(v2)
    ordered = topological_sort_node_ids(graph)
    assert len(ordered) == 2
    assert v2.schema_version == 2
    by_id = {str(node.id): node for node in v2.nodes}
    first = by_id[ordered[0]]
    second = by_id[ordered[1]]
    assert first.type == "api_call"
    assert first.config.tool_name == "file_create"
    assert second.type == "image_gen"
    assert second.config.tool_name is None


def test_collect_placeholders() -> None:
    assert collect_placeholders("{{aaaa.reply}} and {{bbbb.text}}") == {"aaaa.reply", "bbbb.text"}


def test_template_string_multiple_replacements() -> None:
    registry = WorkflowStateRegistry()
    registry.register("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", {"reply": "A"})
    registry.register("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", {"reply": "B"})
    out = resolve_template_string(
        "left {{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.reply}} right {{bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2.reply}}",
        registry,
    )
    assert out == "left A right B"
