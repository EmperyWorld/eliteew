# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests for async companion task SSE publish (`publish_task_event_async`) and executor/step_handlers wiring.
# Invariants:
# - No live Redis; ``asyncio.to_thread`` and publish paths are mocked.
# Related:
# - api/ewa_platform/companion/jobs/task_events.py
# - api/ewa_platform/companion/jobs/step_handlers.py
# - api/ewa_platform/companion/jobs/executor.py
# - api/ewa_platform/companion/jobs/music_pipeline_progress.py
# ---

from __future__ import annotations

import asyncio
import warnings
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.jobs import executor as job_executor
from api.ewa_platform.companion.jobs import music_pipeline_progress as music_progress
from api.ewa_platform.companion.jobs import step_handlers, task_events

pytestmark = pytest.mark.unit


@pytest.fixture
def published_events() -> list[dict[str, Any]]:
    return []


@pytest.fixture
def capture_sync_publish(
    monkeypatch: pytest.MonkeyPatch,
    published_events: list[dict[str, Any]],
) -> None:
    def _fake_sync(**kwargs: Any) -> None:
        published_events.append(dict(kwargs))

    monkeypatch.setattr(task_events, "publish_task_event_sync", _fake_sync)


@pytest.mark.asyncio
async def test_publish_task_event_async_delegates_via_to_thread(
    monkeypatch: pytest.MonkeyPatch,
    published_events: list[dict[str, Any]],
    capture_sync_publish: None,
) -> None:
    to_thread_calls: list[tuple[Any, tuple[Any, ...], dict[str, Any]]] = []

    async def fake_to_thread(func: Any, /, *args: Any, **kwargs: Any) -> None:
        to_thread_calls.append((func, args, kwargs))
        await asyncio.sleep(0)
        func(*args, **kwargs)

    monkeypatch.setattr(task_events.asyncio, "to_thread", fake_to_thread)

    payload = {"run_id": "run-1", "status": "running"}
    await task_events.publish_task_event_async(
        principal_id="principal-1",
        event_name="task_step",
        payload=payload,
    )

    assert len(to_thread_calls) == 1
    assert to_thread_calls[0][0] is task_events.publish_task_event_sync
    assert len(published_events) == 1
    assert published_events[0]["principal_id"] == "principal-1"
    assert published_events[0]["event_name"] == "task_step"
    assert published_events[0]["payload"] == payload


@pytest.mark.asyncio
async def test_publish_executor_step_event_awaits_async_publish(
    monkeypatch: pytest.MonkeyPatch,
    published_events: list[dict[str, Any]],
) -> None:
    publish_mock = AsyncMock()
    monkeypatch.setattr(step_handlers, "publish_task_event_async", publish_mock)

    await step_handlers.publish_executor_step_event(
        principal_id="p1",
        run={"id": "run-1", "workflow_id": "wf-1", "workflow_version": 1},
        step={"id": "step-1", "step_index": 2, "step_kind": "music_generation_pipeline_v2", "title": "Gen"},
        status="in_progress",
    )

    publish_mock.assert_awaited_once()
    await_args = publish_mock.await_args
    assert await_args is not None
    kwargs = await_args.kwargs
    assert kwargs["event_name"] == "task_step"
    assert kwargs["payload"]["run_id"] == "run-1"
    assert kwargs["payload"]["status"] == "in_progress"


@pytest.mark.asyncio
async def test_executor_publish_step_event_no_unawaited_coroutine_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Executor path must await async SSE publish (no RuntimeWarning)."""

    async def fake_dispatch(_pool: Any, **kwargs: Any) -> bool:
        return True

    publish_mock = AsyncMock()
    step_update_mock = AsyncMock()

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    run_row = {
        "id": "run-1",
        "principal_id": "p1",
        "intent_kind": "music_generation_background",
        "status": "running",
        "run_revision": 3,
    }
    step_row = {
        "id": "step-1",
        "step_index": 1,
        "step_kind": "music_generation_pipeline_v2",
        "title": "Music",
    }

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", AsyncMock(return_value=fake_pool))
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor, "companion_task_run_update", AsyncMock(return_value={**run_row, "run_revision": 4})
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))
    monkeypatch.setattr(step_handlers, "companion_task_step_update", step_update_mock)
    monkeypatch.setattr(step_handlers, "publish_task_event_async", publish_mock)
    monkeypatch.setattr(job_executor.step_handlers, "dispatch_step", fake_dispatch)

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", RuntimeWarning)
        out = await job_executor.execute_companion_run(run_id="run-1", step_index=1, job_payload={})

    assert out.get("ok") is True
    publish_mock.assert_awaited()
    runtime_unawaited = [
        w for w in caught if issubclass(w.category, RuntimeWarning) and "never awaited" in str(w.message).lower()
    ]
    assert runtime_unawaited == []


@pytest.mark.unit
def test_publish_music_pipeline_step_sync_from_sync_context(
    monkeypatch: pytest.MonkeyPatch,
    published_events: list[dict[str, Any]],
) -> None:
    """Sync fallback must work without a running event loop."""

    def _fake_sync(**kwargs: Any) -> None:
        published_events.append(dict(kwargs))

    monkeypatch.setattr(music_progress, "publish_task_event_sync", _fake_sync)

    music_progress.publish_music_pipeline_step_sync(
        principal_id="p-sync",
        run_id="run-sync",
        stage_index=1,
        status="running",
        ru=True,
    )

    assert len(published_events) == 1
    assert published_events[0]["principal_id"] == "p-sync"
    assert published_events[0]["payload"]["step_index"] == 1


@pytest.mark.asyncio
async def test_publish_music_pipeline_step_async_uses_to_thread(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    publish_mock = AsyncMock()
    monkeypatch.setattr(music_progress, "publish_task_event_async", publish_mock)

    await music_progress.publish_music_pipeline_step(
        principal_id="p1",
        run_id="run-1",
        stage_index=3,
        status="running",
        ru=False,
    )

    publish_mock.assert_awaited_once()
    await_args = publish_mock.await_args
    assert await_args is not None
    assert await_args.kwargs["event_name"] == "task_step"
    assert await_args.kwargs["payload"]["step_index"] == 3
