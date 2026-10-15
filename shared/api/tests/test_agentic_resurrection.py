# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resurrection patch locks — FSM gate from replanning, scheduler claiming, Celery HTTP lifecycle.
# Invariants:
# - No live Postgres for unit paths; behavioral contracts only.
# Related:
# - api/ewa_platform/agentic/kernel/state_machine.py
# - api/ewa_platform/agentic/jobs/step_executor.py
# - api/core/celery_async.py
# ---

from __future__ import annotations

import asyncio
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.ewa_platform.agentic.jobs import step_executor
from api.ewa_platform.agentic.kernel import loop as loop_mod
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.think_schema import AgenticPlanNode, AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticActResult, AgenticContext
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg


class _FakePool:
    close = AsyncMock()


def _session(status: str = "executing", **extra: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "sess-res",
        "principal_id": "principal-1",
        "status": status,
        "session_revision": 7,
        "goal_json": {"text": "goal"},
        "plan_summary": "plan exists",
        "policy_json": {},
        "working_memory_json": {},
        "gate_json": {},
        "linked_task_run_id": None,
    }
    base.update(extra)
    return base


def test_transition_test_replanning_gate_required_to_awaiting_human() -> None:
    """Test 1 — gate from replanning must land in awaiting_human, not stay replanning."""

    assert fsm.resolve_next_status(fsm.STATUS_REPLANNING, "gate_required") == fsm.STATUS_AWAITING_HUMAN


@pytest.mark.asyncio
async def test_transition_test_replanning_circuit_limit_to_awaiting_human(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test 1b — replanning_count at cap opens awaiting_human via atomic record."""

    monkeypatch.setenv("EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS", "2")
    monkeypatch.setattr(agentic_pg, "agentic_max_replanning_attempts", lambda: 2)

    from api.tests.test_agentic_replanning_circuit_breaker import _CircuitConn, _CircuitPool

    conn = _CircuitConn(status="replanning", wm={"replanning_count": 2})
    pool = _CircuitPool(conn)
    _cp, session = await agentic_pg.agentic_record_replanning_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-cb-1",
        principal_id="p-1",
        expect_revision=4,
        reason="tool_act_error:cap",
    )
    assert session is not None
    assert session["status"] == "awaiting_human"
    assert conn.gate_json.get("kind") == "circuit_break"


@pytest.mark.asyncio
async def test_claiming_test_step_executor_claims_and_runs_pending_node(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test 2 — pending node with tool is claimed and dispatched by agentic_step_task path."""

    pool = _FakePool()
    session = _session(status="executing")
    node = {
        "id": "node-run",
        "session_id": "sess-res",
        "status": "running",
        "tool_name": "catalog_list",
        "tool_args_json": {"user_line": "list"},
        "instruction": "list catalog",
    }
    dispatch_mock = AsyncMock(
        return_value=AgenticActResult(
            status="ok",
            summary="listed",
            tool_name="catalog_list",
        )
    )
    step_mock = MagicMock(return_value="next-step")

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=node))
    monkeypatch.setattr(step_executor, "build_agentic_tool_context", AsyncMock(return_value=object()))
    monkeypatch.setattr(step_executor, "agentic_dispatch_tool", dispatch_mock)
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_checkpoint_append", AsyncMock(return_value={"id": 3}))
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_mark_completed", AsyncMock(return_value=node))
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_session_update", AsyncMock(return_value=session))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_task_tree_status_counts",
        AsyncMock(return_value={"pending": 1, "completed": 1}),
    )
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", step_mock)

    out = await step_executor.execute_agentic_step(
        session_id="sess-res",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["ok"] is True
    assert out["reason"] == "step_completed_more"
    dispatch_mock.assert_awaited_once()
    step_mock.assert_called_once()


@pytest.mark.asyncio
async def test_claiming_test_pending_without_claim_does_not_loop_tick(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unclaimable pending must reconcile and re-enqueue step — never Think loop_tick."""

    pool = _FakePool()
    session = _session(status="executing")
    fail_empty_mock = AsyncMock(return_value=2)
    step_mock = MagicMock(return_value="step-id")
    loop_mock = MagicMock(return_value="loop-id")

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=None))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_task_tree_status_counts",
        AsyncMock(return_value={"pending": 4, "running": 0}),
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_fail_empty_tool_pending", fail_empty_mock)
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", step_mock)
    monkeypatch.setattr(step_executor, "enqueue_agentic_loop_tick", loop_mock)

    out = await step_executor.execute_agentic_step(
        session_id="sess-res",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["reason"] == "agentic_step:pending_reconcile"
    fail_empty_mock.assert_awaited_once()
    step_mock.assert_called_once()
    loop_mock.assert_not_called()


@pytest.mark.asyncio
async def test_replanning_with_pending_resumes_executing_scheduler_handoff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Replanning with runnable pending nodes must transition to executing and hand off step scheduler."""

    pool = _FakePool()
    session = _session(status="replanning", session_revision=12)
    executing = {**session, "status": "executing", "session_revision": 13}

    async def _fake_rehydrate(
        _pool: object,
        *,
        session_id: str,
        principal_id: str,
        worker_id: str | None = None,
        for_update: bool = False,
    ) -> AgenticContext:
        return AgenticContext(
            session=dict(session),
            active_nodes=[],
            tree_summary={},
            checkpoints=[],
            inbound_messages=[],
            llm_messages=[],
            worker_id=worker_id,
        )

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(loop_mod, "agentic_step_scheduler_enabled", lambda: True)
    monkeypatch.setattr(loop_mod, "rehydrate_agentic_context", _fake_rehydrate)
    monkeypatch.setattr(
        loop_mod.agentic_pg,
        "agentic_session_acquire_lease",
        AsyncMock(return_value=session),
    )
    monkeypatch.setattr(
        loop_mod.agentic_pg,
        "agentic_session_release_lease",
        AsyncMock(),
    )
    monkeypatch.setattr(
        loop_mod.agentic_pg,
        "agentic_task_tree_status_counts",
        AsyncMock(return_value={"pending": 3}),
    )
    monkeypatch.setattr(
        loop_mod.fsm,
        "apply_session_transition",
        AsyncMock(return_value=fsm.TransitionResult(ok=True, session=executing)),
    )
    publish_mock = MagicMock()
    monkeypatch.setattr(loop_mod, "publish_agentic_session_lifecycle_sync", publish_mock)

    out = await loop_mod.run_agentic_loop_tick(
        pool,  # type: ignore[arg-type]
        session_id="sess-res",
        principal_id="principal-1",
        worker_id="worker-1",
        expected_revision=12,
    )

    assert out.ok is True
    assert out.continue_loop is True
    assert out.reason == "scheduler_handoff"
    assert out.session is not None
    assert out.session["status"] == "executing"


@pytest.mark.asyncio
async def test_gate_action_from_replanning_applies_awaiting_human(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pool = _FakePool()
    session = _session(status="replanning")
    awaiting = {**session, "status": "awaiting_human", "session_revision": 8}

    monkeypatch.setattr(
        loop_mod.fsm,
        "apply_session_transition",
        AsyncMock(return_value=fsm.TransitionResult(ok=True, session=awaiting)),
    )
    publish_mock = MagicMock()
    monkeypatch.setattr(loop_mod, "publish_agentic_session_lifecycle_sync", publish_mock)

    think_out = AgenticThinkOutput(
        action="gate",
        gate=AgenticPlanNode(
            node_kind="gate",
            title="Confirm",
            gate_kind="confirm",
            gate_prompt="Need approval",
        ),
    )

    out = await loop_mod._process_think_output(
        pool,  # type: ignore[arg-type]
        think_out=think_out,
        session=session,
        session_id="sess-res",
        principal_id="principal-1",
        tool_ctx=None,
        iterations=1,
    )

    assert out is not None
    assert out.continue_loop is False
    assert out.session is not None
    assert out.session["status"] == "awaiting_human"
    loop_mod.fsm.apply_session_transition.assert_awaited_once()
    assert loop_mod.fsm.apply_session_transition.await_args.kwargs["event"] == "gate_required"


def test_e2e_celery_async_db_manager_loop_change_closes_http_not_drop() -> None:
    """Test 3 — get_database_manager loop reset closes HTTP clients without per-task cleanup."""

    close_mock = AsyncMock()
    init_mock = AsyncMock()
    cleanup_mock = AsyncMock()

    async def _simulate_task() -> str:
        import api.core.database_manager as dm
        from api.core.http_clients import init_http_clients

        await init_http_clients()
        dm.db_manager.is_initialized = True
        dm.db_manager._event_loop = cast(asyncio.AbstractEventLoop, object())
        dm.db_manager.postgres_session_factory = cast(Any, True)
        with patch.object(dm.db_manager, "initialize", AsyncMock()):
            await dm.get_database_manager()
        return "done"

    with (
        patch("api.core.http_clients.close_http_clients", close_mock),
        patch("api.core.http_clients.init_http_clients", init_mock),
        patch("api.core.celery_async._cleanup_celery_async_resources", cleanup_mock),
    ):
        from api.core import celery_async

        try:
            assert celery_async.run_celery_async(_simulate_task()) == "done"
            close_mock.assert_awaited_once()
            cleanup_mock.assert_not_awaited()
        finally:
            celery_async.shutdown_celery_async_resources()

    cleanup_mock.assert_awaited_once()
