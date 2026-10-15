# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for asyncio background task tracking (A-05): bare create_task losses
# must become detectable failures with task_id + correlation_id in the registry/logs.
# Invariants:
# - No live HTTP/DB; exercises BackgroundTaskManager only.
# Related:
# - api/core/async_utils.py
# - api/routers/ewrp.py
# ---

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from api.core.async_utils import (
    BackgroundTaskManager,
    BackgroundTaskRecord,
    get_background_task_manager,
    track_background_task,
)


@pytest.fixture(autouse=True)
def reset_background_task_registry_fixture() -> Iterator[None]:
    get_background_task_manager().clear_for_tests()
    yield
    get_background_task_manager().clear_for_tests()


@pytest.mark.asyncio
async def test_raw_create_task_silent_failure_is_untracked() -> None:
    """Phase-0 evidence: fire-and-forget create_task leaves no registry record."""

    manager = get_background_task_manager()

    async def silent_crash() -> None:
        msg = "silent pipeline loss"
        raise RuntimeError(msg)

    task = asyncio.create_task(silent_crash())
    await asyncio.sleep(0.05)
    assert task.done()
    assert task.exception() is not None

    assert manager.running_count() == 0
    assert manager.failed_since(datetime.now(UTC) - timedelta(minutes=1)) == []
    assert manager.get("missing") is None


@pytest.mark.asyncio
async def test_track_background_task_records_failure_with_correlation_id(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    manager = get_background_task_manager()
    correlation_id = "req-trace-abc"

    async def failing_pipeline() -> None:
        msg = "Database error"
        raise RuntimeError(msg)

    task_id = track_background_task(
        failing_pipeline(),
        name="ewrp_pipeline",
        correlation_id=correlation_id,
        metadata={"job_id": "job-1"},
    )
    await asyncio.sleep(0.05)

    record = manager.get(task_id)
    assert record is not None
    assert record.status == "failed"
    assert record.correlation_id == correlation_id
    assert record.name == "ewrp_pipeline"
    assert "Database error" in (record.error or "")
    assert record.traceback

    recent_failed = manager.failed_since(datetime.now(UTC) - timedelta(minutes=1))
    assert any(item.task_id == task_id for item in recent_failed)

    bg_logs = [
        json.loads(rec.message.split("[BG_TASK] ", 1)[1])
        for rec in caplog.records
        if rec.levelname == "INFO" and "[BG_TASK]" in rec.message
    ]
    assert any(
        entry.get("event") == "background_task_failed" and entry.get("correlation_id") == correlation_id
        for entry in bg_logs
    )


@pytest.mark.asyncio
async def test_track_background_task_completed_happy_path() -> None:
    manager = get_background_task_manager()

    async def ok_work() -> None:
        return None

    task_id = track_background_task(ok_work(), name="ewrp_pipeline", correlation_id="corr-ok")
    await asyncio.sleep(0.05)

    record = manager.get(task_id)
    assert record is not None
    assert record.status == "completed"
    assert manager.running_count() == 0


@pytest.mark.asyncio
async def test_stale_running_tasks_are_queryable() -> None:
    manager = BackgroundTaskManager(stale_after_sec=1)
    record = BackgroundTaskRecord(
        task_id="stale-1",
        name="ewrp_pipeline",
        correlation_id="corr-stale",
        status="running",
        started_at=datetime.now(UTC) - timedelta(seconds=5),
    )
    manager._records[record.task_id] = record  # noqa: SLF001 — test fixture seed

    stale = manager.stale_tasks(max_age_sec=2)
    assert len(stale) == 1
    assert stale[0].task_id == "stale-1"


@pytest.mark.asyncio
async def test_abrupt_generator_end_gets_completed_via_wrapper() -> None:
    manager = get_background_task_manager()

    async def short_work() -> None:
        return None

    task_id = track_background_task(short_work(), name="ewrp_pipeline")
    await asyncio.sleep(0.02)
    record = manager.get(task_id)
    assert record is not None
    assert record.status == "completed"


@pytest.mark.asyncio
async def test_ewrp_enqueue_uses_track_background_task(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp_mod

    captured: list[dict[str, object]] = []

    def fake_track(_coro: object, **kwargs: object) -> str:
        captured.append(dict(kwargs))
        return "tracked-task-id"

    monkeypatch.setattr(ewrp_mod, "track_background_task", fake_track)
    monkeypatch.setattr(ewrp_mod, "is_queue_enabled", lambda *_a, **_k: False)

    job_id = uuid4()
    user_id = uuid4()
    await ewrp_mod._enqueue_ewrp_pipeline(job_id, user_id, correlation_id="corr-ewrp-1")

    assert len(captured) == 1
    assert captured[0]["name"] == "ewrp_pipeline"
    assert captured[0]["correlation_id"] == "corr-ewrp-1"
    assert captured[0]["metadata"] == {"job_id": str(job_id), "user_id": str(user_id)}
