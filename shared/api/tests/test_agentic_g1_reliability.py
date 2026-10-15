# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate G1 regression locks: mirror sync must not block enqueue; IntegrityError
# terminalizes the session instead of Celery blind retry.
# Related:
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G1)
# - api/ewa_platform/agentic/jobs/reliability.py
# ---

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.agentic.jobs import executor
from api.ewa_platform.agentic.jobs import reliability as rel
from api.ewa_platform.agentic.jobs.reliability import (
    is_nonretryable_agentic_error,
    terminalize_session_nonretryable,
)
from api.ewa_platform.agentic.kernel.types import LoopTickResult, TransitionResult
from api.ewa_platform.workers import agentic_task_runner


class IntegrityError(Exception):
    """Stand-in for asyncpg.exceptions.IntegrityError (name-matched)."""


class NotNullViolationError(Exception):
    """Stand-in for asyncpg.exceptions.NotNullViolationError (name-matched)."""


def test_is_nonretryable_agentic_error_integrity() -> None:
    assert is_nonretryable_agentic_error(IntegrityError())
    assert is_nonretryable_agentic_error(NotNullViolationError())
    assert not is_nonretryable_agentic_error(TimeoutError("transient"))
    assert not is_nonretryable_agentic_error(RuntimeError("boom"))


@pytest.mark.asyncio
async def test_safe_sync_swallows_mirror_failure(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def _boom(*_a: Any, **_k: Any) -> None:
        raise NotNullViolationError("null value in column output_payload")

    monkeypatch.setattr(rel, "sync_and_publish_task_run_from_session", _boom)
    with caplog.at_level(logging.ERROR):
        ok = await rel.safe_sync_and_publish_task_run_from_session(
            object(),
            session={"id": "sess-g1", "principal_id": "p-1", "status": "executing"},
        )
    assert ok is False
    assert any("agentic_mirror_sync_failed" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_execute_loop_tick_enqueues_when_mirror_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No-Lies: mirror_ok=False but enqueue still runs."""

    session = {
        "id": "sess-g1-mirror",
        "principal_id": "principal-g1",
        "status": "planning",
        "session_revision": 5,
    }

    class _Pool:
        close = AsyncMock()

    monkeypatch.setattr(
        executor,
        "open_initialized_ewa_worker_pool",
        AsyncMock(return_value=_Pool()),
    )
    monkeypatch.setattr(
        executor,
        "run_agentic_loop_tick",
        AsyncMock(
            return_value=LoopTickResult(
                ok=True,
                session=session,
                continue_loop=True,
                reason="continue",
                iterations_ran=1,
            ),
        ),
    )
    monkeypatch.setattr(
        executor,
        "safe_sync_and_publish_task_run_from_session",
        AsyncMock(return_value=False),
    )
    enqueued: list[dict[str, Any]] = []

    def _capture_reschedule(**kwargs: Any) -> str:
        enqueued.append(dict(kwargs))
        return "celery-task-g1"

    monkeypatch.setattr(executor, "reschedule_after_loop_tick", _capture_reschedule)

    out = await executor.execute_agentic_loop_tick(
        session_id="sess-g1-mirror",
        job_payload={"principal_id": "principal-g1", "expected_revision": 5},
    )

    assert out["ok"] is True
    assert out["continue_loop"] is True
    assert out["mirror_ok"] is False
    assert out["enqueued_task_id"] == "celery-task-g1"
    assert len(enqueued) == 1
    assert enqueued[0]["mirror_ok"] is False


@pytest.mark.asyncio
async def test_execute_loop_tick_mirror_raise_still_enqueues_via_safe_path(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Trace lock: agentic_mirror_sync_failed then agentic_job_enqueued in same tick."""

    session = {
        "id": "sess-g1-raise",
        "principal_id": "principal-g1",
        "status": "planning",
        "session_revision": 2,
    }

    class _Pool:
        close = AsyncMock()

    monkeypatch.setattr(
        executor,
        "open_initialized_ewa_worker_pool",
        AsyncMock(return_value=_Pool()),
    )
    monkeypatch.setattr(
        executor,
        "run_agentic_loop_tick",
        AsyncMock(
            return_value=LoopTickResult(
                ok=True,
                session=session,
                continue_loop=True,
                iterations_ran=1,
            ),
        ),
    )

    async def _mirror_boom(*_a: Any, **_k: Any) -> None:
        raise NotNullViolationError("null value in column output_payload")

    monkeypatch.setattr(rel, "sync_and_publish_task_run_from_session", _mirror_boom)
    monkeypatch.setattr(
        executor,
        "safe_sync_and_publish_task_run_from_session",
        rel.safe_sync_and_publish_task_run_from_session,
    )

    def _fake_enqueue(**kwargs: Any) -> str:
        logging.getLogger("api.ewa_platform.agentic.jobs.enqueue").info(
            "[STEP] agentic_job_enqueued session_id=%s revision=%s celery_task_id=%s",
            kwargs.get("session_id"),
            kwargs.get("expected_revision"),
            "celery-live-g1",
        )
        return "celery-live-g1"

    monkeypatch.setattr(rel, "enqueue_agentic_loop_tick", _fake_enqueue)
    monkeypatch.setattr(rel, "agentic_step_scheduler_enabled", lambda: False)
    monkeypatch.setattr(executor, "reschedule_after_loop_tick", rel.reschedule_after_loop_tick)

    with caplog.at_level(logging.INFO):
        out = await executor.execute_agentic_loop_tick(
            session_id="sess-g1-raise",
            job_payload={"principal_id": "principal-g1"},
        )

    messages = "\n".join(r.message for r in caplog.records)
    assert "agentic_mirror_sync_failed" in messages
    assert "agentic_job_enqueued" in messages
    assert out["mirror_ok"] is False
    assert out["enqueued_task_id"] == "celery-live-g1"


def test_integrity_error_terminalizes_not_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    """No-Lies: IntegrityError → failed; Celery retry must not be called."""

    terminal_calls: list[dict[str, Any]] = []

    async def _fake_terminalize(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        terminal_calls.append(dict(kwargs))
        return {
            "id": kwargs["session_id"],
            "principal_id": kwargs["principal_id"],
            "status": "failed",
            "session_revision": 9,
        }

    monkeypatch.setattr(agentic_task_runner, "terminalize_session_nonretryable", _fake_terminalize)
    monkeypatch.setattr(
        agentic_task_runner,
        "open_initialized_ewa_worker_pool",
        AsyncMock(return_value=MagicMock(close=AsyncMock())),
    )

    async def _raise_integrity(*_a: Any, **_k: Any) -> dict[str, Any]:
        raise IntegrityError('null value in column "output_payload"')

    monkeypatch.setattr(agentic_task_runner, "execute_agentic_loop_tick", _raise_integrity)

    def _forbidden_retry(self: Any, *, exc: BaseException, countdown: int) -> None:  # noqa: ARG001
        raise AssertionError(f"retry must not be called for IntegrityError: {exc}")

    monkeypatch.setattr(agentic_task_runner.agentic_loop_tick_task, "retry", _forbidden_retry)

    out = agentic_task_runner.agentic_loop_tick_task.run(
        session_id="sess-g1-integrity",
        job_payload={"principal_id": "principal-g1", "expected_revision": 8},
    )

    assert out["reason"] == "nonretryable_terminalized"
    assert out["status"] == "failed"
    assert len(terminal_calls) == 1
    assert terminal_calls[0]["session_id"] == "sess-g1-integrity"


@pytest.mark.asyncio
async def test_terminalize_session_nonretryable_applies_fatal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    applied: list[str] = []

    async def _apply(*_a: Any, **kwargs: Any) -> TransitionResult:
        applied.append(str(kwargs.get("event")))
        return TransitionResult(
            ok=True,
            session={
                "id": kwargs["session_id"],
                "principal_id": kwargs["principal_id"],
                "status": "failed",
                "session_revision": 2,
            },
        )

    monkeypatch.setattr(rel.fsm, "apply_session_transition", _apply)
    monkeypatch.setattr(rel, "safe_sync_and_publish_task_run_from_session", AsyncMock(return_value=True))

    session = await terminalize_session_nonretryable(
        object(),
        session_id="sess-term",
        principal_id="p-1",
        exc=IntegrityError("boom"),
        expect_revision=1,
    )
    assert session is not None
    assert session["status"] == "failed"
    assert applied == ["fatal_error"]
