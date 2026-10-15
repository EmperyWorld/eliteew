# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for agentic HITL confirm finalizing companion doc_create task runs.
# Invariants:
# - confirm must not leave awaiting_human node stuck after file_create needs_confirm.
# Related:
# - api/ewa_platform/agentic/hitl_companion_finalize.py
# - api/ewa_platform/agentic/respond.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.hitl_companion_finalize import _resolve_companion_pending_run
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.respond import apply_agentic_human_response


@pytest.mark.asyncio
async def test_human_respond_confirm_finalizes_companion_doc_create(monkeypatch: pytest.MonkeyPatch) -> None:
    session_row = {
        "id": "sess-doc",
        "principal_id": "p-1",
        "status": fsm.STATUS_AWAITING_HUMAN,
        "session_revision": 12,
        "policy_json": {},
        "working_memory_json": {},
        "gate_json": {
            "kind": "confirm",
            "bound_node_id": "node-file",
            "companion_pending_task_run_id": "comp-run-1",
            "pending_tool": "file_create",
        },
    }
    active_node = {
        "id": "node-file",
        "status": "awaiting_human",
        "tool_name": "file_create",
    }
    tree_updates: list[dict[str, Any]] = []
    policy_saved: dict[str, Any] | None = None

    async def _fetch(*_a: object, **_k: object) -> dict[str, Any]:
        return dict(session_row)

    async def _list_tree(*_a: object, **_k: object) -> list[dict[str, Any]]:
        return [active_node]

    async def _inbound(*_a: object, **_k: object) -> None:
        return None

    async def _transition(*_a: object, **_k: object) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        return TransitionResult(
            ok=True,
            session={
                **session_row,
                "status": fsm.STATUS_EXECUTING,
                "session_revision": 13,
                "gate_json": {},
            },
        )

    async def _update(*_a: object, **kwargs: object) -> dict[str, Any]:
        nonlocal policy_saved
        policy_saved = kwargs.get("policy_json")  # type: ignore[assignment]
        return {
            **session_row,
            "status": fsm.STATUS_EXECUTING,
            "session_revision": 14,
            "policy_json": policy_saved or {},
            "gate_json": {},
        }

    async def _fetch_run(*_a: object, **kwargs: object) -> dict[str, Any]:
        assert kwargs.get("run_id") == "comp-run-1"
        return {
            "id": "comp-run-1",
            "principal_id": "p-1",
            "status": "awaiting_confirmation",
            "intent_kind": "doc_create",
            "plan_payload": {"kind": "doc_create", "name": "plan.md", "body": "hello"},
            "run_revision": 1,
        }

    async def _confirm(*_a: object, **_k: object) -> dict[str, Any]:
        return {
            "reply": "created",
            "actions": [{"type": "open_app", "unified_content_id": "uc-99"}],
            "task_run": {
                "id": "comp-run-1",
                "status": "completed",
                "result_payload": {"created_unified_content_id": "uc-99"},
            },
        }

    async def _tree_update(*_a: object, **kwargs: object) -> dict[str, Any]:
        tree_updates.append(dict(kwargs))
        return dict(active_node, **kwargs)

    async def _checkpoint(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-1", "seq": 3}

    async def _status_counts(*_a: object, **_k: object) -> dict[str, int]:
        return {}

    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_session_fetch_for_principal",
        _fetch,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_list",
        _list_tree,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_inbound_insert",
        _inbound,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.fsm.apply_session_transition",
        _transition,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_session_update",
        _update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.enqueue_agentic_loop_tick",
        lambda **_k: None,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_status_counts",
        _status_counts,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.sync_and_publish_task_run_from_session",
        AsyncMock(return_value={"id": "mirror-run"}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.companion_pg.companion_task_run_fetch_for_principal",
        _fetch_run,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_run_confirm.apply_companion_task_run_confirmation",
        _confirm,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.agentic_pg.agentic_task_tree_update",
        _tree_update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.agentic_pg.agentic_checkpoint_append",
        _checkpoint,
    )

    out = await apply_agentic_human_response(
        pool=object(),  # type: ignore[arg-type]
        session_id="sess-doc",
        principal_id="p-1",
        decision="confirm",
        message_text="да",
    )

    assert out["ok"] is True
    assert tree_updates
    assert tree_updates[-1]["status"] == "completed"
    assert tree_updates[-1].get("mark_completed") is True
    assert policy_saved is not None
    assert policy_saved.get("unified_content_id") == "uc-99"


@pytest.mark.asyncio
async def test_human_respond_cancel_finalizes_companion_pending_before_transition(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_row = {
        "id": "sess-cancel",
        "principal_id": "p-1",
        "status": fsm.STATUS_AWAITING_HUMAN,
        "session_revision": 9,
        "policy_json": {},
        "working_memory_json": {},
        "gate_json": {
            "kind": "confirm",
            "bound_node_id": "node-file",
            "companion_pending_task_run_id": "comp-run-1",
            "pending_tool": "file_create",
        },
    }
    active_nodes = [{"id": "node-file", "status": "awaiting_human", "tool_name": "file_create"}]
    order: list[str] = []

    async def _fetch(*_a: object, **_k: object) -> dict[str, Any]:
        return dict(session_row)

    async def _list_tree(*_a: object, **_k: object) -> list[dict[str, Any]]:
        return active_nodes

    async def _finalize(*_a: object, **kwargs: object) -> dict[str, Any]:
        order.append(f"finalize:{kwargs.get('decision')}")
        return {"ok": True}

    async def _transition(*_a: object, **_k: object) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        order.append("transition")
        return TransitionResult(
            ok=True,
            session={
                **session_row,
                "status": fsm.STATUS_CANCELLED,
                "session_revision": 10,
                "gate_json": {},
            },
        )

    async def _sync(*_a: object, session: dict[str, Any], **_kwargs: object) -> dict[str, Any]:
        order.append("sync_publish")
        assert session["status"] == fsm.STATUS_CANCELLED
        return {"id": "mirror-run", "status": "cancelled"}

    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_session_fetch_for_principal",
        _fetch,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_list",
        _list_tree,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.finalize_hitl_companion_pending",
        _finalize,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.kernel.state_machine.apply_session_transition",
        _transition,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.sync_and_publish_task_run_from_session",
        _sync,
    )

    out = await apply_agentic_human_response(
        pool=object(),  # type: ignore[arg-type]
        session_id="sess-cancel",
        principal_id="p-1",
        decision="cancel",
        message_text="отмена",
    )

    assert out["ok"] is True
    assert out["task_run"]["status"] == "cancelled"
    assert order == ["finalize:cancel", "transition", "sync_publish"]


@pytest.mark.asyncio
async def test_resolve_companion_pending_run_fails_closed_without_bound_run_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    latest = AsyncMock(return_value={"id": "wrong-run", "status": "awaiting_confirmation"})
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.companion_pg.companion_task_find_latest_awaiting_confirmation",
        latest,
    )

    run = await _resolve_companion_pending_run(
        pool=object(),  # type: ignore[arg-type]
        principal_id="p-1",
        gate={"pending_tool": "file_create"},
        bound_node={"tool_name": "file_create"},
    )

    assert run is None
    latest.assert_not_awaited()


@pytest.mark.asyncio
async def test_human_respond_confirm_idempotent_when_companion_run_already_completed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_row = {
        "id": "sess-replay",
        "principal_id": "p-1",
        "status": fsm.STATUS_AWAITING_HUMAN,
        "session_revision": 20,
        "policy_json": {},
        "working_memory_json": {},
        "gate_json": {
            "kind": "confirm",
            "bound_node_id": "node-file",
            "companion_pending_task_run_id": "comp-run-done",
            "pending_tool": "file_create",
        },
    }
    active_node = {"id": "node-file", "status": "awaiting_human", "tool_name": "file_create"}
    confirm_calls = 0

    async def _fetch(*_a: object, **_k: object) -> dict[str, Any]:
        return dict(session_row)

    async def _list_tree(*_a: object, **_k: object) -> list[dict[str, Any]]:
        return [active_node]

    async def _inbound(*_a: object, **_k: object) -> None:
        return None

    async def _transition(*_a: object, **_k: object) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        return TransitionResult(
            ok=True,
            session={**session_row, "status": fsm.STATUS_EXECUTING, "session_revision": 21, "gate_json": {}},
        )

    async def _update(*_a: object, **kwargs: object) -> dict[str, Any]:
        return {
            **session_row,
            "status": fsm.STATUS_EXECUTING,
            "session_revision": 22,
            "policy_json": kwargs.get("policy_json") or {},
            "gate_json": {},
        }

    async def _fetch_run(*_a: object, **_k: object) -> dict[str, Any]:
        return {
            "id": "comp-run-done",
            "principal_id": "p-1",
            "status": "completed",
            "intent_kind": "doc_create",
            "result_payload": {"created_unified_content_id": "uc-replay"},
            "run_revision": 3,
        }

    async def _confirm(*_a: object, **_k: object) -> dict[str, Any]:
        nonlocal confirm_calls
        confirm_calls += 1
        return {"reply": "should not run", "actions": [], "task_run": {}}

    checkpoint_kinds: list[str] = []

    async def _checkpoint(*_a: object, **kwargs: object) -> dict[str, Any]:
        checkpoint_kinds.append(str(kwargs.get("kind") or ""))
        return {"id": "cp-replay", "seq": 4}

    async def _tree_update(*_a: object, **kwargs: object) -> dict[str, Any]:
        return dict(active_node, **kwargs)

    async def _status_counts(*_a: object, **_k: object) -> dict[str, int]:
        return {}

    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_session_fetch_for_principal", _fetch)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_list", _list_tree)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_inbound_insert", _inbound)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.fsm.apply_session_transition", _transition)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_session_update", _update)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.enqueue_agentic_loop_tick", lambda **_k: None)
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_status_counts",
        _status_counts,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.sync_and_publish_task_run_from_session",
        AsyncMock(return_value={"id": "mirror-run"}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.companion_pg.companion_task_run_fetch_for_principal",
        _fetch_run,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_run_confirm.apply_companion_task_run_confirmation",
        _confirm,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.agentic_pg.agentic_task_tree_update",
        _tree_update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.agentic_pg.agentic_checkpoint_append",
        _checkpoint,
    )

    out = await apply_agentic_human_response(
        pool=object(),  # type: ignore[arg-type]
        session_id="sess-replay",
        principal_id="p-1",
        decision="confirm",
    )

    assert out["ok"] is True
    assert confirm_calls == 0
    assert checkpoint_kinds == ["gate"]


@pytest.mark.asyncio
async def test_human_respond_confirm_enqueues_step_when_scheduler_pending(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_row = {
        "id": "sess-step",
        "principal_id": "p-1",
        "status": fsm.STATUS_AWAITING_HUMAN,
        "session_revision": 8,
        "policy_json": {},
        "working_memory_json": {},
        "gate_json": {
            "kind": "confirm",
            "bound_node_id": "node-a",
            "companion_pending_task_run_id": "comp-run-step",
            "pending_tool": "file_create",
        },
    }
    active_node = {"id": "node-a", "status": "awaiting_human", "tool_name": "file_create"}
    step_calls: list[dict[str, Any]] = []
    loop_calls: list[dict[str, Any]] = []

    async def _fetch(*_a: object, **_k: object) -> dict[str, Any]:
        return dict(session_row)

    async def _list_tree(*_a: object, **_k: object) -> list[dict[str, Any]]:
        return [active_node]

    async def _inbound(*_a: object, **_k: object) -> None:
        return None

    async def _transition(*_a: object, **_k: object) -> object:
        from api.ewa_platform.agentic.kernel.state_machine import TransitionResult

        return TransitionResult(
            ok=True,
            session={**session_row, "status": fsm.STATUS_EXECUTING, "session_revision": 9, "gate_json": {}},
        )

    async def _update(*_a: object, **_k: object) -> dict[str, Any]:
        return {**session_row, "status": fsm.STATUS_EXECUTING, "session_revision": 9, "gate_json": {}}

    async def _status_counts(*_a: object, **_k: object) -> dict[str, int]:
        return {"pending": 1, "completed": 1}

    async def _fetch_run(*_a: object, **_k: object) -> dict[str, Any]:
        return {
            "id": "comp-run-step",
            "principal_id": "p-1",
            "status": "awaiting_confirmation",
            "intent_kind": "doc_create",
            "plan_payload": {"kind": "doc_create", "name": "step.md", "body": "hello"},
            "run_revision": 1,
        }

    async def _confirm(*_a: object, **_k: object) -> dict[str, Any]:
        return {
            "reply": "ok",
            "actions": [],
            "task_run": {"id": "comp-run-step", "status": "completed", "result_payload": {}},
        }

    async def _tree_update(*_a: object, **kwargs: object) -> dict[str, Any]:
        return dict(active_node, **kwargs)

    async def _checkpoint(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-step", "seq": 2}

    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_session_fetch_for_principal", _fetch)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_list", _list_tree)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_inbound_insert", _inbound)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.fsm.apply_session_transition", _transition)
    monkeypatch.setattr("api.ewa_platform.agentic.respond.agentic_pg.agentic_session_update", _update)
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.agentic_pg.agentic_task_tree_status_counts",
        _status_counts,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.enqueue_agentic_step",
        lambda **kwargs: step_calls.append(dict(kwargs)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.enqueue_agentic_loop_tick",
        lambda **kwargs: loop_calls.append(dict(kwargs)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.respond.sync_and_publish_task_run_from_session",
        AsyncMock(return_value={"id": "mirror-step"}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.companion_pg.companion_task_run_fetch_for_principal",
        _fetch_run,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_run_confirm.apply_companion_task_run_confirmation",
        _confirm,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.agentic_pg.agentic_task_tree_update",
        _tree_update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.hitl_companion_finalize.agentic_pg.agentic_checkpoint_append",
        _checkpoint,
    )

    out = await apply_agentic_human_response(
        pool=object(),  # type: ignore[arg-type]
        session_id="sess-step",
        principal_id="p-1",
        decision="confirm",
    )

    assert out["ok"] is True
    assert len(step_calls) == 1
    assert step_calls[0]["session_id"] == "sess-step"
    assert loop_calls == []
