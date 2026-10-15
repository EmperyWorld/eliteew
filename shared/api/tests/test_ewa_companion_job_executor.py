# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for companion Celery job enqueue + executor (Phase 1.5–1.7).
# Invariants:
# - No live broker/Postgres — mocks only.
# - Executor uses process-level EWA worker pool (E4); tests patch worker pool opener.
# Related:
# - api/ewa_platform/companion/jobs/
# - api/ewa_platform/workers/companion_task_runner.py
# ---

from __future__ import annotations

import asyncio
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.jobs import config as job_config
from api.ewa_platform.companion.jobs import enqueue as job_enqueue
from api.ewa_platform.companion.jobs import executor as job_executor


@pytest.mark.unit
def test_enqueue_skipped_when_async_jobs_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "0")
    assert job_enqueue.enqueue_companion_run(run_id="run-1") is None


@pytest.mark.unit
def test_enqueue_dispatches_celery_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    fake_result = MagicMock(id="celery-task-abc")

    class FakeTask:
        @staticmethod
        def apply_async(**kwargs: Any) -> MagicMock:
            task_kwargs = kwargs["kwargs"]
            assert task_kwargs["run_id"] == "run-1"
            assert task_kwargs["step_index"] == 1
            assert task_kwargs["job_payload"] == {}
            assert kwargs["queue"] == "ewa_companion"
            return fake_result

    fake_mod = MagicMock(companion_run_task=FakeTask)
    monkeypatch.setitem(sys.modules, "api.ewa_platform.workers.companion_task_runner", fake_mod)
    out = job_enqueue.enqueue_companion_run(run_id="run-1", step_index=1, job_payload={"k": "v"})
    assert out == "celery-task-abc"


@pytest.mark.unit
def test_async_music_requires_master_jobs_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "0")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")
    assert job_config.companion_async_music_enabled() is False

    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    assert job_config.companion_async_music_enabled() is True


@pytest.mark.unit
def test_executor_skips_when_ewa_database_url_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    open_pool = AsyncMock(side_effect=RuntimeError("EWA_DATABASE_URL_unset"))
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", open_pool)

    out = asyncio.run(job_executor.execute_companion_run(run_id="run-x", step_index=1, job_payload={}))
    assert out == {"ok": False, "reason": "EWA_DATABASE_URL_unset", "run_id": "run-x"}
    open_pool.assert_awaited_once_with(min_size=1, max_size=4)


@pytest.mark.unit
def test_executor_routes_music_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    music_called: dict[str, Any] = {}

    async def fake_music(**kwargs: Any) -> None:
        music_called.update(kwargs)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_registry._run_background_music_generation_job",
        fake_music,
    )

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    async def fake_open_pool(*, min_size: int = 1, max_size: int = 4) -> MagicMock:
        return fake_pool

    async def fake_init_schema(_pool: Any) -> None:
        return None

    run_row = {
        "id": "run-1",
        "principal_id": "p1",
        "intent_kind": "music_generation_background",
    }
    step_row = {
        "id": "step-1",
        "step_index": 1,
        "step_kind": "music_generation_pipeline_v2",
    }

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", fake_open_pool)
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor, "companion_task_run_update", AsyncMock(return_value={**run_row, "status": "running"})
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))

    out = asyncio.run(
        job_executor.execute_companion_run(
            run_id="run-1",
            step_index=1,
            job_payload={"base_url": "http://music", "headers": {"Authorization": "Bearer x"}},
        ),
    )
    assert out.get("ok") is True
    assert music_called.get("run_id") == "run-1"
    assert music_called.get("step_id") == "step-1"


@pytest.mark.unit
def test_executor_routes_image_edit_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    image_called: dict[str, Any] = {}

    async def fake_image(**kwargs: Any) -> None:
        image_called.update(kwargs)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.companion_image_generation.run_companion_image_generation_job",
        fake_image,
    )

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    async def fake_open_pool(*, min_size: int = 1, max_size: int = 4) -> MagicMock:
        return fake_pool

    async def fake_init_schema(_pool: Any) -> None:
        return None

    run_row = {
        "id": "run-img-1",
        "principal_id": "p1",
        "intent_kind": "image_edit_background",
    }
    step_row = {
        "id": "step-img-1",
        "step_index": 1,
        "step_kind": "image_generation_pipeline",
    }

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", fake_open_pool)
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor, "companion_task_run_update", AsyncMock(return_value={**run_row, "status": "running"})
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))

    out = asyncio.run(
        job_executor.execute_companion_run(
            run_id="run-img-1",
            step_index=1,
            job_payload={
                "catalog_user_id": "u1",
                "prompt": "remove background",
                "operation_mode": "edit",
                "source_content_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            },
        ),
    )
    assert out.get("ok") is True
    assert image_called.get("operation_mode") == "edit"
    assert image_called.get("source_content_id") == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


@pytest.mark.unit
def test_executor_routes_presentation_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    presentation_called: dict[str, Any] = {}

    async def fake_presentation(**kwargs: Any) -> None:
        presentation_called.update(kwargs)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.companion_presentation_generation."
        "run_companion_presentation_generation_job",
        fake_presentation,
    )

    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    async def fake_open_pool(*, min_size: int = 1, max_size: int = 4) -> MagicMock:
        return fake_pool

    async def fake_init_schema(_pool: Any) -> None:
        return None

    run_row = {
        "id": "run-prs-1",
        "principal_id": "p1",
        "intent_kind": "presentation_generation_background",
    }
    step_row = {
        "id": "step-prs-1",
        "step_index": 1,
        "step_kind": "presentation_generation_pipeline",
        "input_payload": {
            "topic": "AI strategy",
            "title": "AI strategy",
            "num_slides": 8,
            "presentation_theme": "aurora",
            "base_url": "http://ewrp",
        },
    }

    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", fake_open_pool)
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", fake_init_schema)
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor, "companion_task_run_update", AsyncMock(return_value={**run_row, "status": "running"})
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))

    out = asyncio.run(
        job_executor.execute_companion_run(
            run_id="run-prs-1",
            step_index=1,
            job_payload={"headers": {"Authorization": "Bearer x"}},
        ),
    )
    assert out.get("ok") is True
    assert presentation_called.get("run_id") == "run-prs-1"
    assert presentation_called.get("topic") == "AI strategy"
    assert presentation_called.get("num_slides") == 8
    assert presentation_called.get("base_url") == "http://ewrp"


@pytest.mark.unit
def test_executor_marks_unsupported_intent_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_pool = MagicMock(name="pool")
    fake_pool.close = AsyncMock()

    async def fake_open_pool(*, min_size: int = 1, max_size: int = 4) -> MagicMock:
        return fake_pool

    run_row = {"id": "run-2", "principal_id": "p1", "intent_kind": "unknown_kind"}
    step_row = {"id": "step-2", "step_index": 1, "step_kind": "other"}

    fail_run = AsyncMock()
    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@127.0.0.1:30433/ewa")
    monkeypatch.setattr(job_executor, "open_initialized_ewa_worker_pool", fake_open_pool)
    monkeypatch.setattr(job_executor, "init_ewa_orchestration_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "init_ewa_companion_plans_schema", AsyncMock())
    monkeypatch.setattr(job_executor, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(
        job_executor, "companion_task_run_update", AsyncMock(return_value={**run_row, "status": "running"})
    )
    monkeypatch.setattr(job_executor, "companion_task_steps_list", AsyncMock(return_value=[step_row]))
    monkeypatch.setattr(job_executor, "_fail_run", fail_run)

    out = asyncio.run(job_executor.execute_companion_run(run_id="run-2", step_index=1, job_payload={}))
    assert out.get("ok") is False
    assert fail_run.await_count == 1
