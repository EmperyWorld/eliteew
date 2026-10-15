# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSE contract tests for agentic task_run mirror events (run_id + canonical names).
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.ewa_platform.agentic.adapters import task_run_events as mod


def test_publish_agentic_task_failed_includes_run_id(monkeypatch: Any) -> None:
    published: list[dict[str, Any]] = []

    def _capture(**kwargs: Any) -> None:
        published.append(kwargs)

    monkeypatch.setattr(mod, "publish_task_event_sync", _capture)
    session = {
        "id": "sess-1",
        "principal_id": "pid-1",
        "linked_task_run_id": "run-abc",
        "status": "failed",
        "working_memory_json": {"terminate_reason": "Reasoning_Loop_Detected"},
    }
    mod.publish_agentic_session_lifecycle_sync(session)
    assert len(published) == 1
    assert published[0]["event_name"] == "task_failed"
    assert published[0]["payload"]["run_id"] == "run-abc"
    assert published[0]["payload"]["intent_kind"] == "agentic_session"


def test_publish_agentic_run_snapshot_sync(monkeypatch: Any) -> None:
    published: list[dict[str, Any]] = []

    def _capture(**kwargs: Any) -> None:
        published.append(kwargs)

    monkeypatch.setattr(mod, "publish_task_event_sync", _capture)
    mod.publish_agentic_run_snapshot_sync(
        {"id": "run-1", "status": "running", "principal_id": "pid-1"},
        principal_id="pid-1",
    )
    assert published[0]["event_name"] == "run_snapshot"
    assert published[0]["payload"]["run"]["id"] == "run-1"


def test_publish_after_mirror_terminal_vs_progress(monkeypatch: Any) -> None:
    calls: list[str] = []

    def _lifecycle(session: Any, **_: Any) -> None:
        calls.append("lifecycle")

    def _snapshot(run: Any, *, principal_id: str) -> None:
        calls.append("snapshot")

    monkeypatch.setattr(mod, "publish_agentic_session_lifecycle_sync", _lifecycle)
    monkeypatch.setattr(mod, "publish_agentic_run_snapshot_sync", _snapshot)

    session = {"status": "executing", "principal_id": "pid-1"}
    mod.publish_agentic_after_mirror_sync(session, {"id": "run-1", "status": "running"})
    assert calls == ["snapshot"]

    calls.clear()
    session = {"status": "failed", "principal_id": "pid-1", "linked_task_run_id": "run-1"}
    mod.publish_agentic_after_mirror_sync(session, {"id": "run-1", "status": "failed"})
    assert calls == ["lifecycle"]


@pytest.mark.asyncio
async def test_sync_and_publish_task_run_from_session_uses_one_boundary(monkeypatch: Any) -> None:
    synced: list[str] = []
    published: list[str] = []

    async def _sync(_pool: Any, *, session: Any) -> dict[str, Any]:
        synced.append(str(session["id"]))
        return {"id": "run-1", "status": "running"}

    monkeypatch.setattr(
        "api.ewa_platform.agentic.adapters.task_run_mirror.sync_task_run_from_session",
        _sync,
    )
    monkeypatch.setattr(
        mod,
        "publish_agentic_after_mirror_sync",
        lambda session, _run: published.append(str(session["id"])),
    )

    run = await mod.sync_and_publish_task_run_from_session(
        object(),
        session={"id": "sess-1", "principal_id": "pid-1", "status": "executing"},
    )

    assert run == {"id": "run-1", "status": "running"}
    assert synced == ["sess-1"]
    assert published == ["sess-1"]
