# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for WF-4 music capacity gate and step retry matching (layer C boundary).
# Related:
# - api/ewa_platform/companion/jobs/run_capacity.py
# - api/ewa_platform/companion/jobs/step_retry.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.jobs import run_capacity, step_retry


@pytest.mark.unit
def test_music_busy_reply_ru() -> None:
    text = run_capacity.music_busy_reply(ru=True)
    assert "генерация музыки" in text.lower()


@pytest.mark.unit
def test_music_capacity_exceeded_when_at_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        run_capacity.companion_pg,
        "companion_task_count_active_music_runs",
        AsyncMock(return_value=1),
    )
    monkeypatch.setattr(run_capacity, "music_max_concurrent_per_principal", lambda: 1)
    out = asyncio.run(run_capacity.companion_music_capacity_exceeded(MagicMock(), principal_id="p1"))
    assert out is True


@pytest.mark.unit
def test_presentation_capacity_exceeded_when_at_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        run_capacity.companion_pg,
        "companion_task_count_active_presentation_runs",
        AsyncMock(return_value=1),
    )
    monkeypatch.setattr(run_capacity, "presentation_max_concurrent_per_principal", lambda: 1)
    out = asyncio.run(run_capacity.companion_presentation_capacity_exceeded(MagicMock(), principal_id="p1"))
    assert out is True


@pytest.mark.unit
def test_presentation_busy_reply_ru() -> None:
    text = run_capacity.presentation_busy_reply(ru=True)
    assert "презентац" in text.lower()


@pytest.mark.unit
def test_step_retry_schedules_celery_on_transient_error(monkeypatch: pytest.MonkeyPatch) -> None:
    enqueued: list[dict[str, Any]] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(dict(kwargs))
        return "celery-retry-1"

    run = {
        "id": "run-1",
        "principal_id": "p1",
        "workflow_id": "music_full_cycle_v1",
        "workflow_version": 1,
    }
    step = {
        "id": "step-1",
        "step_index": 1,
        "status": "failed",
        "input_payload": {"step_key": "generate"},
        "error_payload": {"stage": "generate", "message": "503 upstream", "http_status": 503},
    }

    monkeypatch.setattr(step_retry, "enqueue_companion_run", fake_enqueue)
    monkeypatch.setattr(step_retry, "companion_task_step_update", AsyncMock())
    monkeypatch.setattr(step_retry, "companion_task_run_update", AsyncMock())

    out = asyncio.run(
        step_retry.maybe_retry_failed_step(
            MagicMock(),
            run=run,
            step=step,
            job_payload={"theme": "summer"},
        ),
    )
    assert out is True
    assert len(enqueued) == 1
    assert enqueued[0]["run_id"] == "run-1"
    assert enqueued[0]["countdown_sec"] == 5


@pytest.mark.unit
def test_step_retry_skips_non_matching_error(monkeypatch: pytest.MonkeyPatch) -> None:
    run = {
        "id": "run-1",
        "principal_id": "p1",
        "workflow_id": "music_full_cycle_v1",
    }
    step = {
        "id": "step-1",
        "step_index": 1,
        "status": "failed",
        "input_payload": {"step_key": "generate"},
        "error_payload": {"stage": "lyrics", "message": "music_generation_missing_theme"},
    }
    monkeypatch.setattr(step_retry, "enqueue_companion_run", MagicMock())
    out = asyncio.run(
        step_retry.maybe_retry_failed_step(
            MagicMock(),
            run=run,
            step=step,
            job_payload={},
        ),
    )
    assert out is False
