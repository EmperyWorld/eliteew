# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E1 regression locks for generic companion stale reaper (V-H1 / V-C3).
# Related:
# - api/ewa_platform/companion/jobs/generic_run_reconcile.py
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.jobs.generic_run_reconcile import (
    MEDIA_ASYNC_INTENT_KINDS,
    is_media_async_intent,
    terminalize_stale_companion_run,
)


@pytest.mark.unit
def test_media_async_intent_allowlist_covers_music_image_presentation() -> None:
    assert is_media_async_intent("music_generation_background")
    assert is_media_async_intent("image_generation_background")
    assert is_media_async_intent("presentation_generation_background")
    assert not is_media_async_intent("action_workflow")
    assert not is_media_async_intent("doc_create")
    assert "music_generation_xl_base_background" in MEDIA_ASYNC_INTENT_KINDS


@pytest.mark.asyncio
async def test_terminalize_skips_awaiting_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    updated = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.generic_run_reconcile.companion_task_run_update",
        updated,
    )
    ok = await terminalize_stale_companion_run(
        AsyncMock(),
        run={
            "id": "r1",
            "principal_id": "p1",
            "status": "awaiting_confirmation",
            "intent_kind": "action_workflow",
        },
    )
    assert ok is False
    updated.assert_not_awaited()


@pytest.mark.asyncio
async def test_terminalize_skips_terminal_status(monkeypatch: pytest.MonkeyPatch) -> None:
    updated = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.generic_run_reconcile.companion_task_run_update",
        updated,
    )
    ok = await terminalize_stale_companion_run(
        AsyncMock(),
        run={
            "id": "r1",
            "principal_id": "p1",
            "status": "cancelled",
            "intent_kind": "doc_create",
        },
    )
    assert ok is False
    updated.assert_not_awaited()


@pytest.mark.asyncio
async def test_terminalize_fails_running_non_media(monkeypatch: pytest.MonkeyPatch) -> None:
    published: list[dict[str, Any]] = []

    async def _update(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        return {"id": kwargs["run_id"], "status": kwargs["status"]}

    async def _publish(**kwargs: Any) -> None:
        published.append(dict(kwargs))

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.generic_run_reconcile.companion_task_steps_list",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.generic_run_reconcile.companion_task_run_update",
        _update,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.generic_run_reconcile.publish_task_event_async",
        _publish,
    )

    ok = await terminalize_stale_companion_run(
        AsyncMock(),
        run={
            "id": "r-stale",
            "principal_id": "p1",
            "status": "running",
            "intent_kind": "action_workflow",
            "execution_mode": "async",
        },
    )
    assert ok is True
    assert published
    assert published[0]["event_name"] == "task_failed"
    assert published[0]["payload"]["run_id"] == "r-stale"
