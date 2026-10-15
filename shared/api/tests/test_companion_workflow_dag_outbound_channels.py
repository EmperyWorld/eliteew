# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sprint 2.6.3–2.6.7 outbound channel tests: bindings, confirm_gate validation, runtime guard, E2E chains.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_outbound_policy.py
# ---

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_outbound_policy import check_outbound_runtime_guard
from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import get_tool_binding
from api.ewa_platform.companion.workflows.dag.executors import NodeExecutionResult, execute_tool_backed_node
from api.ewa_platform.companion.workflows.dag.runner import run_workflow_dag_sync
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.tool_registry_adapter import (
    build_tool_dispatch_args,
    execute_tool_registry_node,
    resolve_tool_name,
    tool_result_to_node_outputs,
)
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import (
    USER_WORKFLOW_ALLOWED_TOOLS,
    USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def outbound_tests_stub_adapter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0")
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_TELEGRAM_SENDER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_EMAIL_DISPATCHER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_STRICT_OUTBOUND_GUARD", "0")


def _load_fixture(name: str) -> CompanionWorkflowDefinitionV2:
    raw = json.loads((_FIXTURES / name).read_text(encoding="utf-8"))
    return CompanionWorkflowDefinitionV2.model_validate(raw)


def _telegram_node() -> CompanionWorkflowNodeV2:
    return CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID("cccccccc-cccc-4ccc-8ccc-ccccccccccc3"),
            "type": "telegram_sender",
            "mode": "stateful",
            "inputs": {"message_text": "Hello", "chat_id": "123"},
            "outputs": {
                "reply": CompanionWorkflowOutputSpecV2(type="text"),
                "delivery_status": CompanionWorkflowOutputSpecV2(type="string"),
            },
        }
    )


def _email_node() -> CompanionWorkflowNodeV2:
    return CompanionWorkflowNodeV2.model_validate(
        {
            "id": UUID("dddddddd-dddd-4ddd-8ddd-ddddddddddd3"),
            "type": "email_dispatcher",
            "mode": "stateless",
            "inputs": {"to": "user@example.com", "subject": "Hi", "body": "Body"},
            "outputs": {
                "reply": CompanionWorkflowOutputSpecV2(type="text"),
                "delivery_status": CompanionWorkflowOutputSpecV2(type="string"),
            },
        }
    )


def test_outbound_tools_allowlisted_and_require_confirm() -> None:
    assert "telegram_sender" in USER_WORKFLOW_ALLOWED_TOOLS
    assert "email_dispatcher" in USER_WORKFLOW_ALLOWED_TOOLS
    assert "telegram_sender" in USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM
    assert "email_dispatcher" in USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM


def test_telegram_sender_binding_and_profile() -> None:
    binding = get_tool_binding("telegram_sender")
    assert binding is not None
    assert binding.default_tool == "telegram_sender"
    assert binding.input_profile == "telegram_send"
    assert binding.output_profile == "delivery_status"
    assert binding.requires_confirm_gate is True
    assert resolve_tool_name(_telegram_node()) == "telegram_sender"


def test_email_dispatcher_binding_and_profile() -> None:
    binding = get_tool_binding("email_dispatcher")
    assert binding is not None
    assert binding.default_tool == "email_dispatcher"
    assert binding.input_profile == "email_dispatch"
    assert binding.requires_confirm_gate is True
    assert resolve_tool_name(_email_node()) == "email_dispatcher"


def test_build_tool_dispatch_args_telegram_profile() -> None:
    node = _telegram_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="hi",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs={"reply": "Announcement text", "chat_id": "999"},
        tool_name="telegram_sender",
        ctx=ctx,
    )
    assert args["message_text"] == "Announcement text"
    assert args["chat_id"] == "999"


def test_build_tool_dispatch_args_email_profile() -> None:
    node = _email_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="hi",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    args = build_tool_dispatch_args(
        node=node,
        resolved_inputs={
            "body": "Summary body",
            "to": "ops@example.com",
            "subject": "Weekly digest",
        },
        tool_name="email_dispatcher",
        ctx=ctx,
    )
    assert args["body"] == "Summary body"
    assert args["to"] == "ops@example.com"
    assert args["subject"] == "Weekly digest"


def _bad_outbound_definition(outbound_type: str) -> CompanionWorkflowDefinitionV2:
    return CompanionWorkflowDefinitionV2.model_validate(
        {
            "schema_version": 2,
            "workflow_id": f"bad_{outbound_type}",
            "version": 1,
            "title_ru": "Bad",
            "title_en": "Bad",
            "triggers": [{"type": "regex", "pattern": "^bad$"}],
            "nodes": [
                {
                    "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
                    "type": "prompt_gen",
                    "inputs": {"prompt": "x"},
                    "outputs": {"reply": {"type": "text"}},
                },
                {
                    "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
                    "type": outbound_type,
                    "inputs": {"message_text": "{{eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1.reply}}"}
                    if outbound_type == "telegram_sender"
                    else {
                        "to": "user@example.com",
                        "subject": "Hi",
                        "body": "{{eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1.reply}}",
                    },
                    "outputs": {"reply": {"type": "text"}, "delivery_status": {"type": "string"}},
                },
            ],
            "edges": [
                {
                    "source_node_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
                    "target_node_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
                }
            ],
        }
    )


def test_validate_rejects_outbound_without_confirm_gate() -> None:
    definition = _bad_outbound_definition("telegram_sender")
    result = validate_dag_definition_for_execution(definition, WorkflowValidationContext())
    assert result.ok is False
    assert any("confirm_gate" in err for err in result.errors)


def test_validate_rejects_email_without_confirm_gate() -> None:
    definition = _bad_outbound_definition("email_dispatcher")
    result = validate_dag_definition_for_execution(definition, WorkflowValidationContext())
    assert result.ok is False
    assert any("confirm_gate" in err for err in result.errors)


def test_validate_accepts_outbound_with_confirm_gate() -> None:
    definition = _load_fixture("companion_workflow_v2_outbound_telegram_chain.json")
    result = validate_dag_definition_for_execution(definition, WorkflowValidationContext())
    assert result.ok is True


def test_validate_accepts_outbound_email_doc_chain() -> None:
    definition = _load_fixture("companion_workflow_v2_outbound_email_doc_chain.json")
    result = validate_dag_definition_for_execution(
        definition,
        WorkflowValidationContext(is_verified_user=True),
    )
    assert result.ok is True


@pytest.mark.asyncio
async def test_execute_tool_registry_node_telegram_dispatch() -> None:
    node = _telegram_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="hi",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    mock_result = {
        "tool": "telegram_sender",
        "status": "ok",
        "reply": "Sent",
        "data": {"delivery_status": "sent", "chat_id": "123", "message_id": 42},
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
        result = await execute_tool_registry_node(node, {"message_text": "Hello", "chat_id": "123"}, ctx)
    dispatch.assert_awaited_once()
    assert result.status == "ok"
    assert result.outputs["delivery_status"] == "sent"
    assert result.outputs["message_id"] == 42


@pytest.mark.asyncio
async def test_execute_tool_registry_node_email_dispatch() -> None:
    node = _email_node()
    ctx = ToolContext(
        principal_id="p-1",
        user_line="hi",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    mock_result = {
        "tool": "email_dispatcher",
        "status": "ok",
        "reply": "Mail sent",
        "data": {"delivery_status": "sent", "to": "user@example.com"},
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
        result = await execute_tool_registry_node(
            node,
            {"to": "user@example.com", "subject": "Hi", "body": "Body text"},
            ctx,
        )
    dispatch.assert_awaited_once()
    assert result.status == "ok"
    assert result.outputs["delivery_status"] == "sent"
    assert result.outputs["to"] == "user@example.com"


def test_tool_result_delivery_status_profile() -> None:
    node = _email_node()
    outputs = tool_result_to_node_outputs(
        {
            "reply": "Mail sent",
            "data": {"delivery_status": "sent", "to": "user@example.com"},
        },
        node=node,
    )
    assert outputs["delivery_status"] == "sent"
    assert outputs["to"] == "user@example.com"


def test_compose_confirm_telegram_chain_completes_with_stubs() -> None:
    definition = _load_fixture("companion_workflow_v2_outbound_telegram_chain.json")
    ctx = ToolContext(
        principal_id="user-1",
        user_line="product launch",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(definition, base_ctx=ctx)
    assert result.status == "completed"
    assert len(result.completed_node_ids) == 3
    compose_out = result.registry_snapshot[str(definition.nodes[0].id)]
    telegram_out = result.registry_snapshot[str(definition.nodes[2].id)]
    assert "product launch" in str(compose_out["reply"])
    assert telegram_out["delivery_status"] == "sent"
    assert str(compose_out["reply"]) in str(telegram_out["reply"])


def test_document_import_to_email_dispatcher_chain_stub_runner() -> None:
    definition = _load_fixture("companion_workflow_v2_outbound_email_doc_chain.json")
    ctx = ToolContext(
        principal_id="user-1",
        user_line="quarterly report",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(
        definition,
        base_ctx=ctx,
        validation_ctx=WorkflowValidationContext(is_verified_user=True),
    )
    assert result.status == "completed"
    assert len(result.completed_node_ids) == 4
    import_out = result.registry_snapshot[str(definition.nodes[0].id)]
    summarize_out = result.registry_snapshot[str(definition.nodes[1].id)]
    email_out = result.registry_snapshot[str(definition.nodes[3].id)]
    assert "Imported document" in str(import_out["text"])
    assert "llm_summarizer stub" in str(summarize_out.get("summary_text", ""))
    assert email_out["delivery_status"] == "sent"
    assert email_out["to"] == "operator@example.com"


async def _confirmed_confirm_gate_executor(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: dict,
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = node, resolved_inputs, ctx
    return NodeExecutionResult(
        status="ok",
        outputs={"message": "Confirmed", "confirmed": True},
    )


def test_outbound_runtime_guard_blocks_unconfirmed_outbound(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_STRICT_OUTBOUND_GUARD", "1")
    definition = _load_fixture("companion_workflow_v2_outbound_telegram_chain.json")
    ctx = ToolContext(
        principal_id="user-1",
        user_line="product launch",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(definition, base_ctx=ctx)
    assert result.status in {"failed", "partial"}
    assert result.failed_node_id == str(definition.nodes[2].id)
    assert result.error is not None
    assert "confirmed upstream confirm_gate" in result.error


def test_outbound_runtime_guard_allows_confirmed_outbound(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_STRICT_OUTBOUND_GUARD", "1")
    definition = _load_fixture("companion_workflow_v2_outbound_telegram_chain.json")
    ctx = ToolContext(
        principal_id="user-1",
        user_line="product launch",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = run_workflow_dag_sync(
        definition,
        base_ctx=ctx,
        executors={"confirm_gate": _confirmed_confirm_gate_executor},
    )
    assert result.status == "completed"
    telegram_out = result.registry_snapshot[str(definition.nodes[2].id)]
    assert telegram_out["delivery_status"] == "sent"


def test_check_outbound_runtime_guard_unit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_STRICT_OUTBOUND_GUARD", "1")
    definition = _load_fixture("companion_workflow_v2_outbound_telegram_chain.json")
    telegram_node = definition.nodes[2]
    registry = WorkflowStateRegistry()
    registry.register(str(definition.nodes[0].id), {"reply": "hello"})
    registry.register(str(definition.nodes[1].id), {"message": "Confirm?", "confirmed": False})

    blocked = check_outbound_runtime_guard(
        node=telegram_node,
        node_id=str(telegram_node.id),
        definition=definition,
        registry=registry,
    )
    assert blocked is not None
    assert "confirmed upstream confirm_gate" in blocked

    registry.register(str(definition.nodes[1].id), {"message": "Confirm?", "confirmed": True})
    allowed = check_outbound_runtime_guard(
        node=telegram_node,
        node_id=str(telegram_node.id),
        definition=definition,
        registry=registry,
    )
    assert allowed is None


@pytest.mark.asyncio
async def test_execute_tool_backed_node_respects_runtime_guard(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_STRICT_OUTBOUND_GUARD", "1")
    node = _telegram_node()
    definition = _load_fixture("companion_workflow_v2_outbound_telegram_chain.json")
    registry = WorkflowStateRegistry()
    registry.register(str(definition.nodes[1].id), {"message": "?", "confirmed": False})
    ctx = ToolContext(
        principal_id="p-1",
        user_line="hi",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )
    result = await execute_tool_backed_node(
        node,
        {
            "message_text": "Hello",
            "chat_id": "123",
            "_dag_definition": definition,
            "_dag_node_id": str(node.id),
            "_dag_registry": registry,
        },
        ctx,
    )
    assert result.status == "failed"
    assert result.error is not None
    assert "confirmed upstream confirm_gate" in result.error
