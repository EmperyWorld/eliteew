# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# EWA Agentic Orchestrator (AMKA-style lifecycle) regression tests.
# Related:
# - api/ewa_platform/agentic/driver/
# ---

from __future__ import annotations

import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from api.ewa_platform.agentic.driver.plan_blocks import PlanBlock, plan_blocks_to_plan_nodes
from api.ewa_platform.agentic.driver.tick_integration import act_error_is_version_conflict
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.state_machine import (
    AgenticLifecyclePhase,
    lifecycle_phase_from_session,
)
from api.ewa_platform.agentic.kernel.types import AgenticActResult
from api.ewa_platform.agentic.tools.profiles import resolve_tools_allowlist


def test_orchestrator_profile_includes_expert_and_block_tools() -> None:
    allow = resolve_tools_allowlist({"tools_profile": "orchestrator"})
    assert allow is not None
    assert "call_expert_chat" in allow
    assert "doc_append_block" in allow
    assert "file_rewrite" in allow


def test_plan_blocks_map_to_scheduler_nodes() -> None:
    blocks = [
        PlanBlock(
            block_id="b1",
            block_kind="expert_chat",
            title="Expert plan",
            instruction="Discuss market research plan",
            expert_roles=["analyst", "strategist"],
            unified_content_id="12345678-1234-5678-1234-567812345678",
        ),
        PlanBlock(
            block_id="b2",
            block_kind="block_append",
            title="Append audit",
            instruction="Audit section body",
            author_role="audit",
            unified_content_id="12345678-1234-5678-1234-567812345678",
        ),
        PlanBlock(
            block_id="b3",
            block_kind="tool",
            title="Rewrite doc",
            instruction="Finalize report",
            tool_name="file_rewrite",
            tool_args={"mode": "append"},
        ),
    ]
    nodes = plan_blocks_to_plan_nodes(blocks)
    assert nodes[0].tool_name == "call_expert_chat"
    assert nodes[1].tool_name == "doc_append_block"
    assert nodes[2].tool_name == "file_rewrite"


def test_lifecycle_expert_consultation_maps_from_gate() -> None:
    session = {
        "status": fsm.STATUS_AWAITING_HUMAN,
        "gate_json": {"kind": "expert_consultation"},
    }
    assert lifecycle_phase_from_session(session) == AgenticLifecyclePhase.AWAITING_EXPERT_CONSULTATION


def test_expert_consultation_transition_registered() -> None:
    assert fsm.resolve_next_status(fsm.STATUS_EXECUTING, "expert_consultation_required") == fsm.STATUS_AWAITING_HUMAN


def test_act_error_is_version_conflict_from_tool_data() -> None:
    act = AgenticActResult(
        status="error",
        summary="conflict",
        tool_name="file_rewrite",
        raw={"data": {"error_code": "version_conflict"}},
    )
    assert act_error_is_version_conflict(act) is True


@pytest.mark.asyncio
async def test_market_research_orchestrator_e2e_trace(caplog: pytest.LogCaptureFixture) -> None:
    from api.ewa_platform.companion.orchestration.tools.handlers_agentic_orchestrator import (
        _handle_call_expert_chat,
    )
    from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext

    content_id = UUID("12345678-1234-5678-1234-567812345678")
    uid = UUID("22345678-1234-5678-1234-567812345678")
    block_id = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"

    expert_result = {
        "output_text": "## Market overview\nExperts agree.",
        "expert_chat_id": "cccccccc-cccc-dddd-eeee-ffffffffffff",
        "heroes": ["analyst", "marketing"],
    }

    class FakeStorage:
        async def get_content(self, *_a: object, **_k: object) -> SimpleNamespace:
            return SimpleNamespace(version=2)

        async def append_to_content(self, *_a: object, **kwargs: object) -> SimpleNamespace:
            assert kwargs.get("expected_version") == 2
            return SimpleNamespace(version=3)

    with (
        patch(
            "api.ewa_platform.agentic.orchestration.expert_chat_bridge.run_agentic_expert_chat",
            AsyncMock(return_value=expert_result),
        ),
        patch(
            "api.ewa_platform.companion.storage.catalog_pipeline.make_content_storage_service",
            lambda _pool: FakeStorage(),
        ),
        patch(
            "api.ewa_platform.companion.orchestration.tools.handlers_agentic_orchestrator._resolve_main_pool",
            AsyncMock(return_value=object()),
        ),
        patch(
            "api.services.unified_content.content_blocks.new_content_block",
            return_value=SimpleNamespace(
                id=block_id,
                model_dump=lambda **_kw: {"id": block_id, "content": "x", "author_role": "analyst"},
            ),
        ),
        caplog.at_level(logging.INFO),
    ):
        result = await _handle_call_expert_chat(
            {
                "user_line": "Исследование рынка: согласуйте план",
                "expert_roles": ["analyst", "marketing"],
                "unified_content_id": str(content_id),
                "_agentic_session_id": "agent-sess-1",
            },
            ToolContext(
                principal_id="p1",
                user_line="market research",
                content_catalog_user_id=str(uid),
                oauth2_sub_for_content_alternate=None,
            ),
        )

    assert result is not None
    assert result.get("status") == "ok"
    messages = [r.getMessage() for r in caplog.records]
    assert any("call_expert_chat_success" in m and "agent-sess-1" in m for m in messages)
    assert any("call_expert_chat_block_appended" in m and block_id in m for m in messages)


@pytest.mark.asyncio
async def test_step_executor_version_conflict_triggers_replan() -> None:
    from api.ewa_platform.agentic.jobs import step_executor

    session = {
        "id": "sess-vc",
        "principal_id": "principal-1",
        "status": "executing",
        "session_revision": 4,
        "goal_json": {"text": "market research"},
        "policy_json": {},
        "working_memory_json": {},
    }
    node = {
        "id": "node-1",
        "tool_name": "file_rewrite",
        "tool_args_json": {"unified_content_id": "12345678-1234-5678-1234-567812345678"},
        "instruction": "rewrite",
    }
    conflict_act = AgenticActResult(
        status="error",
        summary="version changed",
        tool_name="file_rewrite",
        raw={"data": {"error_code": "version_conflict", "expected_version": 1, "current_version": 2}},
    )

    pool = MagicMock()
    pool.close = AsyncMock()
    with (
        patch.object(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool)),
        patch.object(step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)),
        patch.object(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=node)),
        patch.object(step_executor.agentic_pg, "agentic_task_tree_clear_claim", AsyncMock()),
        patch.object(
            step_executor.agentic_pg,
            "agentic_record_replanning_atomic",
            AsyncMock(return_value=(True, {**session, "status": "replanning"})),
        ),
        patch.object(step_executor, "build_agentic_tool_context", AsyncMock(return_value=MagicMock())),
        patch.object(step_executor, "agentic_dispatch_tool", AsyncMock(return_value=conflict_act)),
        patch.object(step_executor.agentic_pg, "agentic_checkpoint_append", AsyncMock(return_value={"id": "cp1"})),
        patch.object(step_executor, "enqueue_agentic_loop_tick") as mock_loop,
    ):
        out = await step_executor.execute_agentic_step(
            session_id="sess-vc", job_payload={"principal_id": "principal-1"}
        )

    assert out.get("reason") == "content_version_conflict_replan"
    mock_loop.assert_called_once()
