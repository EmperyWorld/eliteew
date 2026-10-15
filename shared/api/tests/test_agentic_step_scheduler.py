# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression locks for scheduler-owned EWA agentic step execution.
# Invariants:
# - Tool failures are recorded against durable steps; this path must not call the Think loop.
# Related:
# - api/ewa_platform/agentic/jobs/step_executor.py
# - api/ewa_platform/agentic/kernel/tree_scheduler.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.agentic.jobs import executor, step_executor
from api.ewa_platform.agentic.kernel.tree_scheduler import select_next_runnable_node
from api.ewa_platform.agentic.kernel.types import AgenticActResult, LoopTickResult
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg


class _FakePool:
    close = AsyncMock()


def _session(status: str = "executing") -> dict[str, Any]:
    return {
        "id": "sess-step",
        "principal_id": "principal-1",
        "status": status,
        "session_revision": 3,
        "goal_json": {"text": "browse catalog"},
        "plan_summary": "",
        "policy_json": {},
        "working_memory_json": {},
        "gate_json": {},
        "linked_task_run_id": None,
    }


def test_scheduler_prefers_retry_wait_after_priority() -> None:
    picked = select_next_runnable_node(
        [
            {"id": "low", "status": "pending", "priority": 0, "sort_order": 1, "materialized_path": "/1/"},
            {"id": "retry", "status": "retry_wait", "priority": 5, "sort_order": 9, "materialized_path": "/9/"},
        ],
    )
    assert picked is not None
    assert picked["id"] == "retry"


@pytest.mark.asyncio
async def test_agentic_step_tool_failure_terminalizes_without_think_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    """Persistent tool failure is a step outcome, not a reason to re-enter Think."""

    pool = _FakePool()
    node = {
        "id": "node-1",
        "session_id": "sess-step",
        "status": "running",
        "tool_name": "catalog_list",
        "tool_args_json": {"user_line": "list"},
        "instruction": "list files",
    }
    failed_node = {**node, "status": "failed", "retry_count": 3, "max_retries": 2}
    session = _session()

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=node))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_session_update",
        AsyncMock(
            side_effect=lambda *a, **k: {**session, "iteration_count": int(session.get("iteration_count") or 0) + 1}
        ),
    )
    monkeypatch.setattr(step_executor, "build_agentic_tool_context", AsyncMock(return_value=object()))
    monkeypatch.setattr(
        step_executor,
        "agentic_dispatch_tool",
        AsyncMock(return_value=AgenticActResult(status="error", summary="tool failed", tool_name="catalog_list")),
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_checkpoint_append", AsyncMock(return_value={"id": 7}))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_task_tree_mark_retry_or_failed",
        AsyncMock(return_value=failed_node),
    )
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_task_tree_status_counts", AsyncMock(return_value={"failed": 1})
    )
    monkeypatch.setattr(
        step_executor.fsm,
        "apply_session_transition",
        AsyncMock(return_value=step_executor.fsm.TransitionResult(ok=True, session={**session, "status": "failed"})),
    )
    monkeypatch.setattr(step_executor, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value=None))
    enqueue_mock = AsyncMock()
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", enqueue_mock)

    out = await step_executor.execute_agentic_step(session_id="sess-step", job_payload={"principal_id": "principal-1"})

    assert out["status"] == "failed"
    enqueue_mock.assert_not_called()


@pytest.mark.asyncio
async def test_agentic_step_accepted_async_run_waits_for_child(monkeypatch: pytest.MonkeyPatch) -> None:
    pool = _FakePool()
    node = {
        "id": "node-async",
        "session_id": "sess-step",
        "status": "running",
        "tool_name": "image_generation",
        "tool_args_json": {"prompt": "cat"},
        "instruction": "generate image",
    }
    session = _session()
    clear_claim = AsyncMock()
    update_node = AsyncMock(return_value={**node, "status": "awaiting_child"})
    mark_awaiting = AsyncMock(return_value={**node, "status": "awaiting_child"})

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=node))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_session_update",
        AsyncMock(
            side_effect=lambda *a, **k: {**session, "iteration_count": int(session.get("iteration_count") or 0) + 1}
        ),
    )
    monkeypatch.setattr(step_executor, "build_agentic_tool_context", AsyncMock(return_value=object()))
    monkeypatch.setattr(
        step_executor,
        "agentic_dispatch_tool",
        AsyncMock(
            return_value=AgenticActResult(
                status="accepted",
                summary="Image job accepted.",
                tool_name="image_generation",
                raw={"task_run": {"id": "child-run"}},
            )
        ),
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_checkpoint_append", AsyncMock(return_value={"id": 77}))
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_clear_claim", clear_claim)
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_update", update_node)
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_mark_awaiting_child", mark_awaiting)
    monkeypatch.setattr(
        step_executor, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value={"id": "run"})
    )
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", MagicMock(return_value="task-1"))

    out = await step_executor.execute_agentic_step(session_id="sess-step", job_payload={"principal_id": "principal-1"})

    assert out["reason"] == "awaiting_child"
    mark_awaiting.assert_awaited_once()
    mark_call = mark_awaiting.await_args
    assert mark_call is not None
    assert mark_call.kwargs["node_id"] == "node-async"
    assert mark_call.kwargs["session_id"] == "sess-step"
    assert mark_call.kwargs["result_summary"] == "Image job accepted."
    assert mark_call.kwargs["metadata_json"]["child_run_id"] == "child-run"


@pytest.mark.asyncio
async def test_agentic_step_no_claimable_waits_for_awaiting_child(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import MagicMock

    enqueue_loop = MagicMock()
    enqueue_step = MagicMock()
    monkeypatch.setattr(step_executor, "enqueue_agentic_loop_tick", enqueue_loop)
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", enqueue_step)
    monkeypatch.setattr(
        step_executor,
        "reconcile_awaiting_child_nodes_for_session",
        AsyncMock(return_value=0),
    )

    out = await step_executor._resolve_executing_no_claimable(  # noqa: SLF001 - lock private scheduler branch
        object(),
        session=_session(),
        principal_id="principal-1",
        counts={"awaiting_child": 1},
        reason_prefix="agentic_step",
    )

    assert out["reason"] == "agentic_step:awaiting_child_poll"
    enqueue_loop.assert_not_called()
    enqueue_step.assert_called()


@pytest.mark.asyncio
async def test_agentic_step_awaiting_child_reconciled_reenqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import MagicMock

    enqueue_loop = MagicMock()
    enqueue_step = MagicMock()
    monkeypatch.setattr(step_executor, "enqueue_agentic_loop_tick", enqueue_loop)
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", enqueue_step)
    monkeypatch.setattr(
        step_executor,
        "reconcile_awaiting_child_nodes_for_session",
        AsyncMock(return_value=1),
    )
    monkeypatch.setattr(
        step_executor,
        "safe_sync_and_publish_task_run_from_session",
        AsyncMock(return_value=True),
    )

    out = await step_executor._resolve_executing_no_claimable(  # noqa: SLF001
        object(),
        session=_session(),
        principal_id="principal-1",
        counts={"awaiting_child": 1},
        reason_prefix="agentic_step",
    )

    assert out["reason"] == "agentic_step:awaiting_child_reconciled"
    assert out["reconciled_nodes"] == 1
    enqueue_step.assert_called()
    enqueue_loop.assert_not_called()


@pytest.mark.asyncio
async def test_loop_tick_replanning_enqueues_loop_not_step(monkeypatch: pytest.MonkeyPatch) -> None:
    """Replanning must stay on Think loop tick; step scheduler only owns Act in executing."""

    pool = _FakePool()
    session = {**_session(status="replanning"), "id": "sess-replan", "session_revision": 13}

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setenv("EWA_AGENTIC_STEP_SCHEDULER_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setattr(executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        executor,
        "run_agentic_loop_tick",
        AsyncMock(
            return_value=LoopTickResult(
                ok=True,
                session=session,
                continue_loop=True,
                iterations_ran=2,
            )
        ),
    )
    monkeypatch.setattr(executor, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value=True))
    step_mock = MagicMock(return_value="step-id")
    loop_mock = MagicMock(return_value="loop-id")
    # G1: reschedule goes through reliability helpers, not executor-local enqueue.
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.reliability.enqueue_agentic_step",
        step_mock,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.reliability.enqueue_agentic_loop_tick",
        loop_mock,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.reliability.agentic_step_scheduler_enabled",
        lambda: True,
    )
    from api.ewa_platform.agentic.jobs.reliability import reschedule_after_loop_tick as real_reschedule

    monkeypatch.setattr(executor, "reschedule_after_loop_tick", real_reschedule)

    out = await executor.execute_agentic_loop_tick(
        session_id="sess-replan",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["status"] == "replanning"
    step_mock.assert_not_called()
    loop_mock.assert_called_once_with(
        session_id="sess-replan",
        principal_id="principal-1",
        expected_revision=13,
    )


@pytest.mark.asyncio
async def test_replanning_empty_tree_handoffs_to_loop_tick(monkeypatch: pytest.MonkeyPatch) -> None:
    """Safety net: step task with empty tree in replanning must not orphan the session."""

    pool = _FakePool()
    session = _session(status="replanning")

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setenv("EWA_AGENTIC_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=None))
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_status_counts", AsyncMock(return_value={}))
    loop_mock = MagicMock(return_value="loop-id")
    monkeypatch.setattr(step_executor, "enqueue_agentic_loop_tick", loop_mock)

    out = await step_executor.execute_agentic_step(
        session_id="sess-step",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["reason"] == "agentic_step:handoff_loop_tick"
    assert out["status"] == "replanning"
    loop_mock.assert_called_once_with(
        session_id="sess-step",
        principal_id="principal-1",
        expected_revision=3,
    )


@pytest.mark.asyncio
async def test_mark_retry_or_failed_binds_timestamptz() -> None:
    """Survival test 1: retry scheduling must bind timestamptz, not text."""

    captured: dict[str, Any] = {}

    class _FakeConn:
        async def fetchrow(self, query: str, *args: object) -> dict[str, Any]:
            captured["query"] = query
            captured["args"] = args
            return {
                "id": "node-1",
                "session_id": "sess-1",
                "parent_id": None,
                "materialized_path": "/1/",
                "sort_order": 1,
                "status": "retry_wait",
                "node_kind": "tool",
                "title": "t",
                "instruction": "i",
                "tool_name": "catalog_list",
                "tool_args_json": {},
                "result_ref": None,
                "result_summary": None,
                "retry_count": 1,
                "max_retries": 3,
                "gate_json": {},
                "metadata_json": {},
                "priority": 0,
                "claim_holder": None,
                "claim_until": None,
                "not_before_at": args[2],
                "last_error": args[3],
                "attempt_id": None,
                "created_at": datetime.now(tz=UTC),
                "updated_at": datetime.now(tz=UTC),
                "started_at": None,
                "completed_at": None,
            }

        async def __aenter__(self) -> _FakeConn:
            return self

        async def __aexit__(self, *_exc: object) -> None:
            return None

    class _FakePool:
        def acquire(self) -> _FakeConn:
            return _FakeConn()

    row = await agentic_pg.agentic_task_tree_mark_retry_or_failed(
        _FakePool(),  # type: ignore[arg-type]
        node_id="node-1",
        session_id="sess-1",
        reason="tool_args_invalid:test",
        retry_delay_sec=5,
    )

    assert row is not None
    assert "$3::timestamptz" in str(captured["query"])
    assert isinstance(captured["args"][2], datetime)


@pytest.mark.asyncio
async def test_system_error_aborts_running_step(monkeypatch: pytest.MonkeyPatch) -> None:
    """Survival test 2: DB/system failure must not leave a claimed node in running."""

    pool = _FakePool()
    node = {
        "id": "node-1",
        "session_id": "sess-step",
        "status": "running",
        "tool_name": "catalog_list",
        "tool_args_json": {"user_line": "list"},
        "instruction": "list files",
    }
    session = _session()
    abort_mock = AsyncMock(return_value={**node, "status": "failed"})
    mark_retry_mock = AsyncMock(side_effect=RuntimeError("DatatypeMismatchError"))

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=node))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_session_update",
        AsyncMock(
            side_effect=lambda *a, **k: {**session, "iteration_count": int(session.get("iteration_count") or 0) + 1}
        ),
    )
    monkeypatch.setattr(step_executor, "build_agentic_tool_context", AsyncMock(return_value=object()))
    monkeypatch.setattr(
        step_executor,
        "agentic_dispatch_tool",
        AsyncMock(return_value=AgenticActResult(status="error", summary="tool failed", tool_name="catalog_list")),
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_checkpoint_append", AsyncMock(return_value={"id": 7}))
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_mark_retry_or_failed", mark_retry_mock)
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_abort_running_step", abort_mock)
    monkeypatch.setattr(step_executor, "conn_execute_release_lease", AsyncMock())
    monkeypatch.setattr(
        step_executor,
        "safe_sync_and_publish_task_run_from_session",
        AsyncMock(return_value=True),
    )

    out = await step_executor.execute_agentic_step(
        session_id="sess-step",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["reason"] == "system_error"
    abort_mock.assert_called_once()
    abort_call = abort_mock.await_args
    assert abort_call is not None
    assert abort_call.kwargs["node_id"] == "node-1"
    assert abort_call.kwargs["terminal_status"] == "failed"
    step_executor.conn_execute_release_lease.assert_awaited_once()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_send_scenario_missing_tool_name_continues_scheduler_not_replan(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty tool_name safety net: fail node and continue step scheduler — no replanning circuit."""

    pool = _FakePool()
    node = {
        "id": "node-plan",
        "session_id": "sess-step",
        "status": "running",
        "tool_name": "",
        "tool_args_json": {},
        "instruction": "bad plan node",
    }
    session = _session(status="executing")
    abort_mock = AsyncMock(return_value={**node, "status": "failed"})
    checkpoint_mock = AsyncMock(return_value={"id": 1})
    step_mock = MagicMock(return_value="step-id")
    replan_mock = AsyncMock()
    loop_mock = MagicMock(return_value="loop-id")

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=node))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_session_update",
        AsyncMock(
            side_effect=lambda *a, **k: {**session, "iteration_count": int(session.get("iteration_count") or 0) + 1}
        ),
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_abort_running_step", abort_mock)
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_checkpoint_append", checkpoint_mock)
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_record_replanning_atomic", replan_mock)
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_task_tree_status_counts",
        AsyncMock(return_value={"pending": 1, "failed": 1}),
    )
    monkeypatch.setattr(step_executor, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value=None))
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", step_mock)
    monkeypatch.setattr(step_executor, "enqueue_agentic_loop_tick", loop_mock)

    out = await step_executor.execute_agentic_step(
        session_id="sess-step",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["reason"] == "step_missing_tool_name"
    assert out["status"] == "executing"
    replan_mock.assert_not_called()
    loop_mock.assert_not_called()
    step_mock.assert_called_once()
    abort_mock.assert_called_once()
    checkpoint_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_executing_empty_tree_completes_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """Executing with no task-tree rows must complete, not stay on no_runnable."""

    pool = _FakePool()
    session = _session(status="executing")
    completed = {**session, "status": "completed", "session_revision": 4}

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=None))
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_status_counts", AsyncMock(return_value={}))
    monkeypatch.setattr(
        step_executor.fsm,
        "apply_session_transition",
        AsyncMock(return_value=step_executor.fsm.TransitionResult(ok=True, session=completed)),
    )
    monkeypatch.setattr(step_executor, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value=None))
    loop_mock = MagicMock(return_value="loop-id")
    monkeypatch.setattr(step_executor, "enqueue_agentic_loop_tick", loop_mock)

    out = await step_executor.execute_agentic_step(
        session_id="sess-step",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["reason"] == "agentic_step:completed"
    assert out["status"] == "completed"
    loop_mock.assert_not_called()


@pytest.mark.asyncio
async def test_executing_awaiting_human_only_syncs_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unclaimable awaiting_human rows must pause the session, not leave executing+no_runnable."""

    pool = _FakePool()
    session = _session(status="executing")
    gate = {"kind": "confirm", "prompt": "confirm delete", "bound_node_id": "node-hitl"}
    awaiting = {**session, "status": "awaiting_human", "session_revision": 4, "gate_json": gate}

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=None))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_task_tree_status_counts",
        AsyncMock(return_value={"awaiting_human": 1, "completed": 2}),
    )
    list_mock = AsyncMock(return_value=[{"id": "node-hitl", "gate_json": gate}])
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_list", list_mock)
    transition_mock = AsyncMock(return_value=step_executor.fsm.TransitionResult(ok=True, session=awaiting))
    monkeypatch.setattr(step_executor.fsm, "apply_session_transition", transition_mock)
    sync_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(step_executor, "safe_sync_and_publish_task_run_from_session", sync_mock)

    out = await step_executor.execute_agentic_step(
        session_id="sess-step",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["reason"] == "agentic_step:awaiting_human"
    assert out["status"] == "awaiting_human"
    transition_mock.assert_awaited_once()
    transition_call = transition_mock.await_args
    assert transition_call is not None
    assert transition_call.kwargs["event"] == "gate_required"
    sync_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_executing_retry_wait_schedules_next_step(monkeypatch: pytest.MonkeyPatch) -> None:
    """Future retry_wait rows must re-enqueue step work instead of silent no_runnable."""

    pool = _FakePool()
    session = _session(status="executing")
    step_mock = MagicMock(return_value="step-id")

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(step_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        step_executor.agentic_pg, "agentic_session_fetch_for_principal", AsyncMock(return_value=session)
    )
    monkeypatch.setattr(step_executor.agentic_pg, "agentic_task_tree_claim_next", AsyncMock(return_value=None))
    monkeypatch.setattr(
        step_executor.agentic_pg,
        "agentic_task_tree_status_counts",
        AsyncMock(return_value={"retry_wait": 1, "completed": 1}),
    )
    monkeypatch.setattr(step_executor, "enqueue_agentic_step", step_mock)

    out = await step_executor.execute_agentic_step(
        session_id="sess-step",
        job_payload={"principal_id": "principal-1"},
    )

    assert out["reason"] == "agentic_step:retry_wait_scheduled"
    step_mock.assert_called_once()
