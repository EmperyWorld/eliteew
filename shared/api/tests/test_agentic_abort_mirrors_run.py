# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate G3 locks: abort/circuit paths must mirror Operations; empty plan while
# executing bumps the replanning circuit.
# Related:
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G3)
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.kernel import loop as loop_mod
from api.ewa_platform.agentic.kernel.circuit_breaker import WM_REPLANNING_COUNT
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import TransitionResult


@pytest.mark.asyncio
async def test_abort_tick_mirrors_operations_run(monkeypatch: pytest.MonkeyPatch) -> None:
    mirrored: list[str] = []

    async def _apply(*_a: Any, **kwargs: Any) -> TransitionResult:
        return TransitionResult(
            ok=True,
            session={
                "id": kwargs["session_id"],
                "principal_id": kwargs["principal_id"],
                "status": "failed",
                "session_revision": 3,
            },
        )

    async def _safe_sync(_pool: Any, *, session: dict[str, Any]) -> bool:
        mirrored.append(str(session.get("id")))
        return True

    monkeypatch.setattr(loop_mod.fsm, "apply_session_transition", _apply)
    monkeypatch.setattr(loop_mod, "safe_sync_and_publish_task_run_from_session", _safe_sync)
    monkeypatch.setattr(loop_mod, "publish_agentic_session_lifecycle_sync", lambda *_a, **_k: None)

    result = await loop_mod._abort_tick(
        object(),  # type: ignore[arg-type]
        session={
            "id": "sess-abort",
            "principal_id": "p-1",
            "status": "executing",
            "session_revision": 2,
        },
        session_id="sess-abort",
        principal_id="p-1",
        reason="invariant_break",
        iterations=1,
    )
    assert result.ok is True
    assert result.session is not None
    assert result.session["status"] == "failed"
    assert mirrored == ["sess-abort"]


@pytest.mark.asyncio
async def test_empty_plan_while_executing_records_replanning_guard(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    replan_calls: list[str] = []
    transitions: list[str] = []

    async def _fake_replan(*_a: object, **kwargs: object) -> tuple[None, dict[str, Any]]:
        replan_calls.append(str(kwargs.get("reason")))
        return None, {
            "id": "sess-exec-empty",
            "status": "replanning",
            "session_revision": 5,
            "working_memory_json": {WM_REPLANNING_COUNT: 1},
        }

    async def _fake_transition(*_a: object, **kwargs: object) -> TransitionResult:
        transitions.append(str(kwargs.get("event")))
        raise AssertionError("plan_ready must not fire for empty plan while executing")

    async def _fake_append(*_a: object, **_k: object) -> dict[str, Any]:
        return {"id": "cp-1", "seq": 1}

    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)
    monkeypatch.setattr(loop_mod.fsm, "apply_session_transition", _fake_transition)
    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_checkpoint_append", _fake_append)
    monkeypatch.setattr(loop_mod, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value=True))

    session = {
        "id": "sess-exec-empty",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 4,
        "goal_json": {"text": "do work"},
        "policy_json": {},
        "iteration_count": 1,
    }
    think_out = AgenticThinkOutput(action="plan", plan_nodes=[], plan_summary_patch=None)

    result = await loop_mod._process_think_output(
        pool=object(),  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-exec-empty",
        principal_id="p-1",
        tool_ctx=object(),
        iterations=1,
        ctx=None,
    )
    assert result is None  # continue after guard recorded (not circuit-open yet)
    assert replan_calls == ["empty_plan_while_executing"]
    assert transitions == []


@pytest.mark.asyncio
async def test_record_replanning_guard_mirrors_when_circuit_opens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mirrored: list[str] = []

    async def _fake_replan(*_a: object, **_k: object) -> tuple[None, dict[str, Any]]:
        return None, {
            "id": "sess-circuit",
            "status": "awaiting_human",
            "session_revision": 10,
            "working_memory_json": {WM_REPLANNING_COUNT: 99},
        }

    async def _safe_sync(_pool: Any, *, session: dict[str, Any]) -> bool:
        mirrored.append(str(session.get("id")))
        return True

    monkeypatch.setattr(loop_mod.agentic_pg, "agentic_record_replanning_atomic", _fake_replan)
    monkeypatch.setattr(loop_mod, "safe_sync_and_publish_task_run_from_session", _safe_sync)
    monkeypatch.setattr(loop_mod, "publish_agentic_session_lifecycle_sync", lambda *_a, **_k: None)

    tick = await loop_mod._record_replanning_guard(
        object(),  # type: ignore[arg-type]
        session={"id": "sess-circuit", "session_revision": 9},
        session_id="sess-circuit",
        principal_id="p-1",
        reason="empty_plan_while_executing",
        iterations=2,
    )
    assert tick is not None
    assert tick.session is not None
    assert tick.session["status"] == "awaiting_human"
    assert mirrored == ["sess-circuit"]
