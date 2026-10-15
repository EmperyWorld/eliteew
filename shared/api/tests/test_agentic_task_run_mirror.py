# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for agentic task-run mirror — created_documents from HITL gate checkpoints and E5 atomic mirror sync.
# Invariants:
# - sync_task_run_from_session delegates run/step persistence to one companion_task_run_mirror_sync call.
# Related:
# - api/ewa_platform/agentic/adapters/task_run_mirror.py
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E5)
# ---

from __future__ import annotations

import inspect
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.agentic.adapters import task_run_mirror as mirror
from api.ewa_platform.agentic.adapters.task_run_mirror import (
    _agentic_session_display_state,
    _node_error_payload,
    _node_output_payload,
    _run_error_payload_from_session,
    _run_result_payload_from_session,
    created_documents_from_gate_checkpoints,
    mission_answer_payload_from_session,
)
from api.ewa_platform.agentic.jobs import child_reconcile, step_executor


def test_created_documents_from_gate_checkpoints_dedupes_and_parses_names() -> None:
    checkpoints = [
        {
            "kind": "gate",
            "payload_json": {
                "event": "hitl_companion_finalize",
                "decision": "confirm",
                "created_unified_content_id": "id-a",
                "summary": "Готова: создала документ «правила.txt»",
            },
        },
        {
            "kind": "gate",
            "payload_json": {
                "event": "hitl_companion_finalize",
                "decision": "confirm",
                "created_unified_content_id": "id-a",
                "summary": "idempotent replay",
            },
        },
        {
            "kind": "gate",
            "payload_json": {
                "event": "hitl_companion_finalize",
                "decision": "confirm",
                "created_unified_content_id": "id-b",
                "summary": "Готова: создала документ «roadmap.md»",
            },
        },
        {
            "kind": "act",
            "payload_json": {"tool": "file_create"},
        },
    ]
    docs = created_documents_from_gate_checkpoints(checkpoints)
    assert docs == [
        {"unified_content_id": "id-a", "name": "правила.txt"},
        {"unified_content_id": "id-b", "name": "roadmap.md"},
    ]


def test_created_documents_from_act_auto_accept() -> None:
    checkpoints = [
        {
            "kind": "act",
            "payload_json": {
                "tool": "file_create",
                "status": "ok",
                "unified_content_id": "id-auto",
                "created_unified_content_id": "id-auto",
                "document_name": "auto.md",
            },
        },
        {
            "kind": "act",
            "payload_json": {
                "tool": "call_expert_chat",
                "status": "ok",
                "summary": "research",
            },
        },
    ]
    assert created_documents_from_gate_checkpoints(checkpoints) == [
        {"unified_content_id": "id-auto", "name": "auto.md"},
    ]


def test_created_documents_skips_cancel_and_non_finalize_gates() -> None:
    checkpoints = [
        {
            "kind": "gate",
            "payload_json": {
                "event": "hitl_companion_finalize",
                "decision": "cancel",
                "created_unified_content_id": "id-x",
            },
        },
    ]
    assert created_documents_from_gate_checkpoints(checkpoints) == []


def test_agentic_session_display_state_preserves_paused_and_replanning() -> None:
    assert _agentic_session_display_state("paused") == "paused"
    assert _agentic_session_display_state("replanning") == "replanning"
    assert _agentic_session_display_state("awaiting_human") == "awaiting_confirmation"


def test_awaiting_child_step_mirrors_as_running() -> None:
    from api.ewa_platform.agentic.adapters.task_run_mirror import _companion_step_status_from_node_status

    assert _companion_step_status_from_node_status("awaiting_child") == "running"


def test_mission_answer_payload_uses_result_summary_first() -> None:
    payload = mission_answer_payload_from_session(
        {
            "status": "completed",
            "result_summary": "Готово: создан доклад и список следующих шагов.",
            "plan_summary": "technical plan text",
        }
    )

    assert payload["mission_answer_summary"] == "Готово: создан доклад и список следующих шагов."
    assert payload["primary_result"] == "Готово: создан доклад и список следующих шагов."
    assert payload["recommended_next_action"] == "Проверьте результат и откройте созданные материалы."


def test_mission_answer_payload_uses_completed_node_summary_when_session_has_no_result() -> None:
    payload = mission_answer_payload_from_session(
        {
            "status": "completed",
            "plan_summary": "technical plan text",
        },
        nodes=[
            {
                "status": "completed",
                "result_summary": "Собран пользовательский итог миссии.",
            }
        ],
    )

    assert payload["mission_answer_summary"] == "Собран пользовательский итог миссии."
    assert payload["primary_result"] == "Собран пользовательский итог миссии."


def test_mission_answer_prefers_file_create_over_research_scaffold() -> None:
    payload = mission_answer_payload_from_session(
        {"status": "executing"},
        nodes=[
            {
                "status": "completed",
                "tool_name": "file_create",
                "result_summary": "Готова: создала документ «отчета_по_исследованию.md» и открываю его в редакторе.",
            },
            {
                "status": "completed",
                "tool_name": "call_expert_chat",
                "result_summary": "## Фокус\n\n**Контекст решения**\n\nРезультатом исследования должен стать выбор.",
            },
        ],
    )
    assert "отчета_по_исследованию.md" in payload["mission_answer_summary"]
    assert "## Фокус" not in payload["mission_answer_summary"]
    assert "создала документ" in payload["primary_result"]


def test_mission_answer_skips_scaffold_only_nodes() -> None:
    payload = mission_answer_payload_from_session(
        {"status": "executing"},
        nodes=[
            {
                "status": "completed",
                "tool_name": "call_expert_chat",
                "result_summary": "## Фокус\n\n**Контекст решения**\n\nПлан исследования.",
            }
        ],
    )
    assert "mission_answer_summary" not in payload
    assert payload["primary_result"] == ""


def test_mission_answer_payload_distinguishes_confirmation_next_action() -> None:
    payload = mission_answer_payload_from_session({"status": "awaiting_human"})

    assert payload["primary_result"] == ""
    assert payload["recommended_next_action"] == "Подтвердите решение, чтобы Кора продолжила миссию."


def test_run_result_payload_includes_terminal_answer_and_artifacts() -> None:
    nodes = [
        {
            "id": "node-1",
            "status": "completed",
            "title": "Write brief",
            "tool_name": "file_create",
            "result_ref": "cp-1",
            "result_summary": "Документ создан.",
        }
    ]
    answer = mission_answer_payload_from_session({"status": "completed"}, nodes=nodes)

    payload = _run_result_payload_from_session(
        {"id": "sess-1", "status": "completed"},
        nodes=nodes,
        created_documents=[{"unified_content_id": "uc-1", "name": "brief.md"}],
        answer_payload=answer,
    )

    assert payload is not None
    assert payload["session_status"] == "completed"
    assert payload["mission_answer_summary"] == "Документ создан."
    assert payload["created_documents"] == [{"unified_content_id": "uc-1", "name": "brief.md"}]
    assert payload["latest_completed_node"]["node_id"] == "node-1"


def test_run_error_payload_uses_terminate_reason_and_failed_node() -> None:
    payload = _run_error_payload_from_session(
        {
            "id": "sess-1",
            "status": "failed",
            "working_memory_json": {"terminate_reason": "reasoning_loop_detected"},
        },
        nodes=[
            {
                "id": "node-f",
                "status": "failed",
                "title": "Loop",
                "last_error": "model repeated plan",
            }
        ],
    )

    assert payload is not None
    assert payload["reason"] == "reasoning_loop_detected"
    assert payload["latest_failed_node"]["node_id"] == "node-f"


def test_node_step_payloads_preserve_output_and_error_details() -> None:
    assert _node_output_payload(
        {
            "id": "node-ok",
            "status": "completed",
            "result_ref": "cp-ok",
            "result_summary": "done",
        }
    ) == {"node_id": "node-ok", "result_ref": "cp-ok", "result_summary": "done"}

    error = _node_error_payload(
        {
            "id": "node-bad",
            "status": "failed",
            "last_error": "tool failed",
        }
    )
    assert error is not None
    assert error["node_id"] == "node-bad"
    assert error["reason"] == "tool failed"


@pytest.mark.asyncio
async def test_sync_task_run_from_session_uses_atomic_mirror_sync(monkeypatch: pytest.MonkeyPatch) -> None:
    nodes: list[dict[str, Any]] = [
        {
            "id": "node-1",
            "status": "completed",
            "title": "Write brief",
            "node_kind": "tool",
            "tool_name": "file_create",
            "result_ref": "cp-1",
            "result_summary": "Документ создан.",
        },
        {
            "id": "node-2",
            "status": "awaiting_child",
            "title": "Generate media",
            "node_kind": "tool",
            "tool_name": "music_generation",
        },
    ]
    atomic_sync = AsyncMock(return_value={"id": "run-1", "status": "running"})
    old_run_update = AsyncMock()
    old_step_update = AsyncMock()
    old_step_create = AsyncMock()
    old_steps_list = AsyncMock()

    monkeypatch.setattr(mirror.agentic_pg, "agentic_task_tree_list", AsyncMock(return_value=nodes))
    monkeypatch.setattr(mirror, "_mirror_created_documents", AsyncMock(return_value=[]))
    monkeypatch.setattr(mirror.companion_pg, "companion_task_run_mirror_sync", atomic_sync)
    monkeypatch.setattr(mirror.companion_pg, "companion_task_run_update", old_run_update)
    monkeypatch.setattr(mirror.companion_pg, "companion_task_step_update", old_step_update)
    monkeypatch.setattr(mirror.companion_pg, "companion_task_step_create", old_step_create)
    monkeypatch.setattr(mirror.companion_pg, "companion_task_steps_list", old_steps_list)

    out = await mirror.sync_task_run_from_session(
        MagicMock(),
        session={
            "id": "sess-1",
            "principal_id": "principal-1",
            "linked_task_run_id": "run-1",
            "status": "executing",
            "plan_summary": "Plan",
        },
    )

    assert out == {"id": "run-1", "status": "running"}
    atomic_sync.assert_awaited_once()
    assert atomic_sync.await_args is not None
    kwargs = atomic_sync.await_args.kwargs
    assert kwargs["run_id"] == "run-1"
    assert kwargs["principal_id"] == "principal-1"
    assert kwargs["status"] == "running"
    assert kwargs["step_mirrors"] == [
        {
            "node_id": "node-1",
            "step_index": 0,
            "title": "Write brief",
            "status": "completed",
            "input_payload": {"node_id": "node-1", "node_kind": "tool", "tool_name": "file_create"},
            "output_payload": {
                "node_id": "node-1",
                "title": "Write brief",
                "tool_name": "file_create",
                "result_ref": "cp-1",
                "result_summary": "Документ создан.",
            },
            "error_payload": None,
        },
        {
            "node_id": "node-2",
            "step_index": 1,
            "title": "Generate media",
            "status": "running",
            "input_payload": {"node_id": "node-2", "node_kind": "tool", "tool_name": "music_generation"},
            "output_payload": None,
            "error_payload": None,
        },
    ]
    old_run_update.assert_not_awaited()
    old_step_update.assert_not_awaited()
    old_step_create.assert_not_awaited()
    old_steps_list.assert_not_awaited()


def test_e5_agentic_child_boundaries_use_atomic_helpers() -> None:
    assert hasattr(step_executor.agentic_pg, "agentic_task_tree_mark_awaiting_child")
    assert hasattr(child_reconcile.agentic_pg, "agentic_task_tree_mark_failed_from_child")
    assert "agentic_task_tree_mark_awaiting_child" in inspect.getsource(step_executor.execute_agentic_step)
    assert "agentic_task_tree_mark_failed_from_child" in inspect.getsource(
        child_reconcile._terminalize_awaiting_child_node
    )
    assert "agentic_task_tree_mark_failed_from_child" in inspect.getsource(
        child_reconcile.reconcile_awaiting_child_nodes_for_session
    )
