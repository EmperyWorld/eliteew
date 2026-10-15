# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for companion task SSE helpers and music pipeline progress publish (Phase 2).
# Invariants:
# - No live Redis; publish is mocked.
# Related:
# - api/ewa_platform/companion/jobs/task_events.py
# - api/ewa_platform/companion/turn/stream_events.py
# ---

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from api.ewa_platform.companion.jobs import music_pipeline_progress as music_progress
from api.ewa_platform.companion.turn import stream_events


@pytest.mark.unit
def test_task_event_payload_run_id_prefers_run_id_key() -> None:
    from api.ewa_platform.companion.jobs.task_events import task_event_payload_run_id

    assert task_event_payload_run_id({"run_id": "run-1"}) == "run-1"
    assert task_event_payload_run_id({"task_run": {"id": "nested"}}) == "nested"


@pytest.mark.unit
def test_format_run_snapshot_sse_event() -> None:
    from api.ewa_platform.companion.jobs.task_events import format_run_snapshot_sse_event

    out = format_run_snapshot_sse_event({"id": "run-1", "status": "running"})
    assert "event: run_snapshot" in out
    assert "run-1" in out


@pytest.mark.unit
def test_sse_task_accepted_for_async_music_run() -> None:
    orchestrated = {
        "orchestration_branch": "music_generation",
        "task_run": {
            "id": "run-abc",
            "status": "running",
            "intent_kind": "music_generation_background",
            "execution_mode": "async",
        },
    }
    out = stream_events.sse_task_accepted_from_orchestrated(orchestrated)
    assert out is not None
    assert "event: task_accepted" in out
    assert "run-abc" in out
    assert "music_generation_background" in out


@pytest.mark.unit
def test_sse_task_accepted_skips_unrelated_sync_run() -> None:
    orchestrated = {
        "task_run": {
            "id": "run-x",
            "intent_kind": "file_create",
            "execution_mode": "sync",
        },
    }
    assert stream_events.sse_task_accepted_from_orchestrated(orchestrated) is None


@pytest.mark.unit
def test_sse_task_awaiting_confirmation_from_orchestrated() -> None:
    orchestrated = {
        "task_run": {
            "id": "run-confirm",
            "status": "awaiting_confirmation",
            "intent_kind": "file_create",
            "plan_payload": {"kind": "doc_create"},
        },
    }
    out = stream_events.sse_task_awaiting_confirmation_from_orchestrated(orchestrated)
    assert out is not None
    assert "event: task_awaiting_confirmation" in out
    assert "run-confirm" in out
    assert "doc_create" in out


@pytest.mark.unit
def test_sse_task_awaiting_confirmation_skips_running() -> None:
    orchestrated = {
        "task_run": {
            "id": "run-x",
            "status": "running",
            "intent_kind": "file_create",
        },
    }
    assert stream_events.sse_task_awaiting_confirmation_from_orchestrated(orchestrated) is None


@pytest.mark.unit
def test_publish_music_pipeline_step(monkeypatch: pytest.MonkeyPatch) -> None:
    published: list[dict[str, Any]] = []

    async def fake_publish(**kwargs: Any) -> None:
        published.append(dict(kwargs))

    monkeypatch.setattr(music_progress, "publish_task_event_async", fake_publish)

    async def _run() -> None:
        await music_progress.publish_music_pipeline_step(
            principal_id="p1",
            run_id="run-1",
            stage_index=2,
            status="running",
            ru=True,
        )

    asyncio.run(_run())
    assert len(published) == 1
    assert published[0]["event_name"] == "task_step"
    payload = published[0]["payload"]
    assert payload["run_id"] == "run-1"
    assert payload["step_index"] == 2
    assert payload["progress"] == {"current": 2, "total": 4}
    assert payload["status"] == "in_progress"
