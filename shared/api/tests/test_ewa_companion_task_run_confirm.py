# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for explicit companion task-run confirm/cancel (Phase 3 HTTP + chat regex).
# Invariants:
# - No live Postgres or storage — companion_asyncpg is mocked.
# Related:
# - api/ewa_platform/companion/orchestration/task_run_confirm.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration import task_run_confirm


@pytest.mark.unit
def test_confirm_cancel_doc_create_run(monkeypatch: pytest.MonkeyPatch) -> None:
    updated = {"id": "run-1", "status": "cancelled"}

    async def fake_update(_pool: Any, **kwargs: Any) -> dict[str, Any]:
        assert kwargs["status"] == "cancelled"
        return updated

    monkeypatch.setattr(
        task_run_confirm.companion_pg,
        "companion_task_run_update",
        fake_update,
    )
    run = {
        "id": "run-1",
        "status": "awaiting_confirmation",
        "user_message": "создай документ",
        "plan_payload": {"kind": "doc_create", "name": "Notes.md", "body": "# Hi"},
    }
    out = asyncio.run(
        task_run_confirm.apply_companion_task_run_confirmation(
            MagicMock(),
            run=run,
            principal_id="p1",
            decision="cancel",
        )
    )
    assert out["actions"] == []
    assert out["task_run"]["status"] == "cancelled"
    assert "Отменила" in out["reply"]


@pytest.mark.unit
def test_confirm_cancel_music_play_after_generation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    updated = {"id": "run-m", "status": "cancelled"}

    async def fake_update(_pool: Any, **kwargs: Any) -> dict[str, Any]:
        assert kwargs["status"] == "cancelled"
        return updated

    monkeypatch.setattr(
        task_run_confirm.companion_pg,
        "companion_task_run_update",
        fake_update,
    )
    run = {
        "id": "run-m",
        "status": "awaiting_confirmation",
        "user_message": "play track",
        "plan_payload": {
            "kind": "music_play_after_generation",
            "description_en": "Track ready.",
            "description_ru": "Трек готов.",
            "content_id": "c-1",
            "track_name": "Demo",
        },
    }
    out = asyncio.run(
        task_run_confirm.apply_companion_task_run_confirmation(
            MagicMock(),
            run=run,
            principal_id="p1",
            decision="cancel",
            ru=False,
        )
    )
    assert out["actions"] == []
    assert "won't start playback" in out["reply"]


@pytest.mark.unit
def test_confirm_cancel_revision_conflict(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_update(_pool: Any, **kwargs: Any) -> dict[str, Any] | None:
        assert kwargs.get("expect_revision") == 2
        assert kwargs["status"] == "cancelled"
        return None

    monkeypatch.setattr(
        task_run_confirm.companion_pg,
        "companion_task_run_update",
        fake_update,
    )
    run = {
        "id": "run-1",
        "status": "awaiting_confirmation",
        "run_revision": 2,
        "user_message": "создай документ",
        "plan_payload": {"kind": "doc_create", "name": "Notes.md", "body": "# Hi"},
    }
    out = asyncio.run(
        task_run_confirm.apply_companion_task_run_confirmation(
            MagicMock(),
            run=run,
            principal_id="p1",
            decision="cancel",
            expect_run_revision=2,
        )
    )
    assert out.get("revision_conflict") is True
    assert out["task_run"]["status"] == "awaiting_confirmation"
    assert out["task_run"]["run_revision"] == 2


@pytest.mark.unit
def test_confirm_claim_conflict_blocks_document_side_effect(monkeypatch: pytest.MonkeyPatch) -> None:
    update_mock = AsyncMock(return_value=None)
    storage_mock = AsyncMock()
    create_mock = AsyncMock()

    monkeypatch.setattr(task_run_confirm.companion_pg, "companion_task_run_update", update_mock)
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_orchestrator._storage_service_or_none",
        storage_mock,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_orchestrator._create_document",
        create_mock,
    )

    run = {
        "id": "run-claim",
        "status": "awaiting_confirmation",
        "run_revision": 9,
        "user_message": "создай документ",
        "plan_payload": {"kind": "doc_create", "name": "Notes.md", "body": "# Hi"},
    }
    out = asyncio.run(
        task_run_confirm.apply_companion_task_run_confirmation(
            MagicMock(),
            run=run,
            principal_id="p1",
            decision="confirm",
            expect_run_revision=9,
        )
    )

    assert out.get("revision_conflict") is True
    assert out["actions"] == []
    update_mock.assert_awaited_once()
    update_call = update_mock.await_args
    assert update_call is not None
    assert update_call.kwargs["status"] == "running"
    storage_mock.assert_not_awaited()
    create_mock.assert_not_awaited()


@pytest.mark.unit
def test_confirm_doc_create_opens_embedded_surface_only(monkeypatch: pytest.MonkeyPatch) -> None:
    created_row = MagicMock(id="uc-new-doc")
    update_mock = AsyncMock(
        return_value={"id": "run-doc", "status": "completed"},
    )

    monkeypatch.setattr(task_run_confirm.companion_pg, "companion_task_run_update", update_mock)
    monkeypatch.setattr(
        task_run_confirm.companion_pg,
        "companion_task_steps_list",
        AsyncMock(return_value=[{"id": "step-1"}]),
    )
    monkeypatch.setattr(
        task_run_confirm.companion_pg,
        "companion_task_step_update",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_orchestrator._storage_service_or_none",
        AsyncMock(return_value=MagicMock()),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_orchestrator._create_document",
        AsyncMock(return_value=created_row),
    )

    run = {
        "id": "run-doc",
        "status": "awaiting_confirmation",
        "user_message": "создай документ",
        "plan_payload": {
            "kind": "doc_create",
            "name": "notes-09.06.14.30.md",
            "body": "# Hi",
            "content_user_id": "u1",
        },
    }
    out = asyncio.run(
        task_run_confirm.apply_companion_task_run_confirmation(
            MagicMock(),
            run=run,
            principal_id="p1",
            decision="confirm",
        )
    )

    assert out["actions"] == [
        {
            "type": "open_app",
            "app_component": "DocEditor",
            "unified_content_id": "uc-new-doc",
            "companion_surface_only": True,
        }
    ]
