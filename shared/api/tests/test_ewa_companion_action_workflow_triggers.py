# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for WF-2 action workflow triggers and music full-cycle advance (layer B/C boundary).
# Related:
# - api/ewa_platform/companion/workflows/action/triggers.py
# - api/ewa_platform/companion/workflows/action/advance.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.workflows.action import advance as action_advance
from api.ewa_platform.companion.workflows.action import triggers as action_triggers


@pytest.mark.unit
def test_match_action_workflow_regex_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_MUSIC_FULL_V1", "1")
    wf = action_triggers.match_action_workflow("Сгенерируй песню про лето и включи когда будет готово")
    assert wf is not None
    assert wf.workflow_id == "music_full_cycle_v1"


@pytest.mark.unit
def test_match_action_workflow_off_when_env_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_WF_ENGINE_ENABLED", raising=False)
    monkeypatch.delenv("EWA_COMPANION_WF_MUSIC_FULL_V1", raising=False)
    assert action_triggers.match_action_workflow("Сгенерируй песню и включи") is None


@pytest.mark.unit
def test_atomic_music_phrase_does_not_match_full_cycle_trigger(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_MUSIC_FULL_V1", "1")
    assert action_triggers.match_action_workflow("ещё одну песню про дождь") is None


@pytest.mark.unit
def test_advance_music_workflow_moves_to_confirm_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    published: list[dict[str, Any]] = []

    def fake_publish(**kwargs: Any) -> None:
        published.append(dict(kwargs))

    run_row = {
        "id": "run-wf",
        "principal_id": "p1",
        "intent_kind": "action_workflow",
        "workflow_id": "music_full_cycle_v1",
        "workflow_version": 1,
    }
    steps = [
        {"id": "s1", "step_index": 1, "step_kind": "music_generation_pipeline_v2", "status": "completed"},
        {"id": "s2", "step_index": 2, "step_kind": "confirm_gate", "status": "pending"},
    ]
    updated_run = dict(run_row)
    updated_run["status"] = "awaiting_confirmation"

    monkeypatch.setattr(action_advance.companion_pg, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(action_advance.companion_pg, "companion_task_steps_list", AsyncMock(return_value=steps))
    monkeypatch.setattr(action_advance.companion_pg, "companion_task_step_update", AsyncMock())
    update_mock = AsyncMock(return_value=updated_run)
    monkeypatch.setattr(action_advance.companion_pg, "companion_task_run_update", update_mock)

    async def fake_publish_async(**kwargs: Any) -> None:
        fake_publish(**kwargs)

    monkeypatch.setattr(action_advance, "publish_task_event_async", fake_publish_async)

    result_payload = {
        "content_id": "uc-123",
        "track_name": "Summer",
        "description_ru": "Летний трек",
        "description_en": "Summer track",
    }
    out = asyncio.run(
        action_advance.maybe_advance_workflow_after_music_step(
            MagicMock(),
            run_id="run-wf",
            principal_id="p1",
            result_payload=result_payload,
            ru_locale=True,
        ),
    )
    assert out is True
    assert len(published) == 1
    assert published[0]["event_name"] == "task_awaiting_confirmation"
    assert published[0]["payload"]["workflow_id"] == "music_full_cycle_v1"
    update_mock.assert_awaited_once()
    update_call = update_mock.await_args
    assert update_call is not None
    kwargs = update_call.kwargs
    assert kwargs.get("plan_payload", {}).get("kind") == "music_play_after_generation"
    assert kwargs.get("plan_payload", {}).get("content_id") == "uc-123"


@pytest.mark.unit
def test_advance_music_workflow_autoplay_skips_confirm(monkeypatch: pytest.MonkeyPatch) -> None:
    run_row = {
        "id": "run-wf",
        "principal_id": "p1",
        "intent_kind": "action_workflow",
        "workflow_id": "music_full_cycle_v1",
        "plan_payload": {"kind": "action_workflow", "autoplay_requested": True},
    }
    steps = [
        {"id": "s1", "step_index": 1, "step_kind": "music_generation_pipeline_v2", "status": "completed"},
        {"id": "s2", "step_index": 2, "step_kind": "confirm_gate", "status": "pending"},
    ]
    published: list[dict[str, Any]] = []

    def fake_publish(**kwargs: Any) -> None:
        published.append(dict(kwargs))

    monkeypatch.setattr(action_advance.companion_pg, "companion_task_run_fetch", AsyncMock(return_value=run_row))
    monkeypatch.setattr(action_advance.companion_pg, "companion_task_steps_list", AsyncMock(return_value=steps))
    monkeypatch.setattr(action_advance.companion_pg, "companion_task_step_update", AsyncMock())
    monkeypatch.setattr(
        action_advance.companion_pg,
        "companion_task_run_update",
        AsyncMock(return_value={**run_row, "status": "completed"}),
    )

    async def fake_publish_async(**kwargs: Any) -> None:
        fake_publish(**kwargs)

    monkeypatch.setattr(action_advance, "publish_task_event_async", fake_publish_async)

    out = asyncio.run(
        action_advance.maybe_advance_workflow_after_music_step(
            MagicMock(),
            run_id="run-wf",
            principal_id="p1",
            result_payload={
                "content_id": "uc-99",
                "track_name": "Rain",
                "autoplay_requested": True,
            },
            ru_locale=True,
        ),
    )
    assert out is True
    assert len(published) == 1
    assert published[0]["event_name"] == "task_completed"
    assert published[0]["payload"]["result_payload"]["background_play"] is True


@pytest.mark.unit
def test_advance_skips_non_workflow_run(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        action_advance.companion_pg,
        "companion_task_run_fetch",
        AsyncMock(return_value={"id": "r1", "workflow_id": None}),
    )
    out = asyncio.run(
        action_advance.maybe_advance_workflow_after_music_step(
            MagicMock(),
            run_id="r1",
            principal_id="p1",
            result_payload={"content_id": "x"},
            ru_locale=True,
        ),
    )
    assert out is False
