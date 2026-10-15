# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3.2 — discriminated union think command, legacy adapter, L3 tool arg validation.
# Related:
# - api/ewa_platform/agentic/kernel/think_command_v1.py
# - api/ewa_platform/agentic/kernel/legacy_adapter.py
# ---

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from api.ewa_platform.agentic.kernel.legacy_adapter import adapt_legacy_think_blob
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    AgenticStructuredThinkOutput,
    AgenticThinkOutputV1,
    parse_structured_think_from_text,
)
from api.ewa_platform.agentic.kernel.think_schema_v1 import ThinkSchemaError, parse_think_v1_from_text
from api.ewa_platform.agentic.kernel.types import AgenticContext


def _ctx(**kwargs: object) -> AgenticContext:
    return AgenticContext(
        session={
            "id": "sess-struct-1",
            "principal_id": "p-1",
            "status": kwargs.get("status", "executing"),
            "session_revision": 1,
            "goal_json": {"text": "goal"},
            "plan_summary": "",
            "policy_json": {},
        },
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )


def test_discriminated_union_rejects_mismatched_payload() -> None:
    """Wrong decision_type + payload shape must fail at Pydantic, not AttributeError."""

    blob = {
        "reasoning_trace": "should terminate",
        "decision_type": "terminate",
        "payload": {
            "decision_type": "continue",
            "tool_name": "catalog_list",
            "tool_args": {"user_line": "x", "mode": "search"},
        },
        "plan_update_summary": "",
    }
    with pytest.raises(ValidationError) as exc:
        AgenticStructuredThinkOutput.model_validate(blob)
    assert "decision_type mismatch" in str(exc.value) or "union_tag_invalid" in str(exc.value)


def test_wrong_decision_type_rejected_at_pydantic_layer() -> None:
    with pytest.raises(ValidationError):
        AgenticStructuredThinkOutput.model_validate(
            {
                "reasoning_trace": "x",
                "decision_type": "not_a_real_decision",
                "payload": {"decision_type": "terminate"},
                "plan_update_summary": "",
            }
        )


def test_legacy_adapter_converts_continue_execution() -> None:
    legacy = {
        "reasoning_trace": "run catalog",
        "decision_type": "CONTINUE_EXECUTION",
        "action_payload": {
            "tool_name": "catalog_list",
            "tool_args": {"user_line": "quantum", "mode": "search"},
        },
        "plan_update_summary": "searching",
    }
    adapted = adapt_legacy_think_blob(legacy)
    assert adapted["decision_type"] == "continue"
    assert adapted["payload"]["decision_type"] == "continue"
    assert adapted["payload"]["tool_name"] == "catalog_list"

    cmd = AgenticThinkOutputV1.from_llm_blob(legacy)
    assert cmd.decision_type == "continue"
    assert isinstance(cmd.payload, object)
    loop_out = cmd.to_loop_output(_ctx())
    assert loop_out.action == "act"
    assert loop_out.act_tool_name == "catalog_list"


def test_legacy_adapter_repairs_null_decision_type_from_tool_shape() -> None:
    """Prod failure class: LLM omits decision_type → must not raise ValueError."""

    blob = {
        "reasoning_trace": "need to list files first",
        "decision_type": None,
        "action_payload": {
            "tool_name": "catalog_list",
            "tool_args": {"user_line": "файлы", "mode": "list"},
        },
        "plan_update_summary": "",
    }
    adapted = adapt_legacy_think_blob(blob)
    assert adapted["decision_type"] == "continue"
    assert adapted["payload"]["tool_name"] == "catalog_list"
    cmd = AgenticThinkOutputV1.from_llm_blob(blob)
    assert cmd.decision_type == "continue"


def test_legacy_adapter_null_decision_type_without_shape_terminates() -> None:
    blob = {
        "reasoning_trace": "stuck without a next step",
        "decision_type": None,
        "action_payload": {},
        "plan_update_summary": "",
    }
    adapted = adapt_legacy_think_blob(blob)
    assert adapted["decision_type"] == "terminate"
    cmd = AgenticThinkOutputV1.from_llm_blob(blob)
    assert cmd.decision_type == "terminate"
    assert cmd.to_loop_output(_ctx()).action == "complete"


def test_legacy_adapter_repairs_null_decision_type_from_plan_nodes() -> None:
    blob = {
        "reasoning_trace": "build plan",
        "decision_type": None,
        "payload": {
            "plan_nodes": [
                {
                    "node_kind": "tool",
                    "title": "list",
                    "tool_name": "catalog_list",
                    "tool_args": {"user_line": "x", "mode": "list"},
                }
            ],
        },
        "plan_update_summary": "planning",
    }
    adapted = adapt_legacy_think_blob(blob)
    assert adapted["decision_type"] == "mutate"
    assert adapted["payload"]["decision_type"] == "mutate"


def test_new_format_continue_validates_l3_tool_args() -> None:
    cmd = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "catalog browse",
            "decision_type": "continue",
            "payload": {
                "decision_type": "continue",
                "tool_name": "catalog_list",
                "tool_args": {"user_line": "hello", "mode": "search"},
            },
            "plan_update_summary": "",
        }
    )
    cmd.validate_registry_tool()
    cmd.validate_tool_args()
    assert cmd.payload.tool_args["user_line"] == "hello"  # type: ignore[union-attr]

    with pytest.raises(ValueError, match="user_line"):
        bad = AgenticStructuredThinkOutput.model_validate(
            {
                "reasoning_trace": "bad args",
                "decision_type": "continue",
                "payload": {
                    "decision_type": "continue",
                    "tool_name": "catalog_list",
                    "tool_args": {"user_line": 123, "mode": "search"},
                },
                "plan_update_summary": "",
            }
        )
        bad.validate_tool_args()


def test_parse_structured_think_legacy_json_no_attribute_error() -> None:
    raw = json.dumps(
        {
            "reasoning_trace": "done",
            "decision_type": "TERMINATE_SESSION",
            "action_payload": {},
            "plan_update_summary": "Mission complete.",
        }
    )
    cmd = parse_think_v1_from_text(raw)
    assert cmd.decision_type == "terminate"
    assert parse_structured_think_from_text(raw).decision_type == "terminate"


def test_mismatched_payload_via_parse_raises_think_schema_error() -> None:
    raw = json.dumps(
        {
            "reasoning_trace": "x",
            "decision_type": "terminate",
            "payload": {
                "decision_type": "continue",
                "tool_name": "catalog_list",
                "tool_args": {"user_line": "a"},
            },
            "plan_update_summary": "",
        }
    )
    with pytest.raises(ThinkSchemaError, match="schema_validation_failed"):
        parse_think_v1_from_text(raw)


def test_schema_validation_failed_includes_compact_loc_for_missing_reasoning_trace() -> None:
    raw = json.dumps(
        {
            "decision_type": "terminate",
            "payload": {"decision_type": "terminate"},
            "plan_update_summary": "",
        }
    )
    with pytest.raises(ThinkSchemaError, match=r"schema_validation_failed:missing:reasoning_trace"):
        parse_think_v1_from_text(raw)


def test_schema_validation_failed_includes_loc_for_missing_plan_node_title() -> None:
    raw = json.dumps(
        {
            "reasoning_trace": "plan",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "tool",
                        "instruction": "x",
                        "tool_name": "catalog_list",
                        "tool_args": {"user_line": "list"},
                    }
                ],
            },
            "plan_update_summary": "ok",
        }
    )
    with pytest.raises(ThinkSchemaError, match=r"schema_validation_failed:missing:.*title"):
        parse_think_v1_from_text(raw)


def test_mutate_coerces_tool_name_as_node_kind() -> None:
    """LLM often puts tool names into node_kind — coerce instead of literal_error fail."""

    raw = json.dumps(
        {
            "reasoning_trace": "build docs",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "call_expert_chat",
                        "title": "Research",
                        "instruction": "Look up references",
                        "tool_args": {"user_line": "research"},
                    },
                    {
                        "node_kind": "file_create",
                        "title": "Write poem",
                        "instruction": "Create poem doc",
                        "tool_args": {"user_line": "write", "title": "Poem"},
                    },
                ],
            },
            "plan_update_summary": "research then write",
        }
    )
    cmd = parse_think_v1_from_text(raw)
    assert cmd.decision_type == "mutate"
    nodes = cmd.payload.plan_nodes  # type: ignore[union-attr]
    assert nodes[0].node_kind == "expert_chat"
    assert nodes[0].tool_name == "call_expert_chat"
    assert nodes[1].node_kind == "tool"
    assert nodes[1].tool_name == "file_create"


def test_agentic_plan_node_coerces_unknown_kind_with_tool() -> None:
    from api.ewa_platform.agentic.kernel.think_schema import AgenticPlanNode

    node = AgenticPlanNode.model_validate(
        {
            "node_kind": "weird_label",
            "title": "Step",
            "tool_name": "catalog_list",
            "tool_args": {"user_line": "x"},
        }
    )
    assert node.node_kind == "tool"
    assert node.tool_name == "catalog_list"
