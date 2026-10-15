# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for companion image run reconcile (UGS completed → repair failed companion run).
# Related:
# - api/ewa_platform/companion/jobs/image_run_reconcile.py
# ---

from __future__ import annotations

import importlib
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

reconcile = importlib.import_module("api.ewa_platform.companion.jobs.image_run_reconcile")


@pytest.mark.asyncio
async def test_reconcile_repairs_failed_companion_when_ugs_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    run_id = str(uuid.uuid4())
    principal_id = str(uuid.uuid4())
    run = {
        "id": run_id,
        "principal_id": principal_id,
        "intent_kind": "image_generation_background",
        "status": "failed",
        "user_message": "Картинка",
        "plan_payload": {"prompt_preview": "sunset", "aspect_ratio": "1:1"},
    }
    ugs_row = {
        "request_id": str(uuid.uuid4()),
        "status": "completed",
        "output_data": {
            "result": {
                "content_id": "content-123",
                "public_url": "https://cdn.example/img.png",
                "mime_type": "image/png",
            }
        },
    }
    pool = MagicMock()
    db = MagicMock()
    terminalize = AsyncMock(return_value=True)
    monkeypatch.setattr(reconcile, "_terminalize_companion_image_run", terminalize)

    ok = await reconcile.reconcile_companion_image_run_with_ugs(
        pool,
        db,
        run=run,
        ugs_row=ugs_row,
    )

    assert ok is True
    terminalize.assert_awaited_once()
    call = terminalize.await_args
    assert call is not None
    assert call.kwargs["terminal_status"] == "completed"
    assert call.kwargs["result_payload"] is not None
    assert call.kwargs["result_payload"].get("content_id") == "content-123"


@pytest.mark.asyncio
async def test_reconcile_skips_already_completed_companion_run() -> None:
    run = {
        "id": str(uuid.uuid4()),
        "principal_id": str(uuid.uuid4()),
        "intent_kind": "image_generation_background",
        "status": "completed",
    }
    pool = MagicMock()
    db = MagicMock()
    ok = await reconcile.reconcile_companion_image_run_with_ugs(
        pool,
        db,
        run=run,
        ugs_row={"status": "completed", "output_data": {}},
    )
    assert ok is False


@pytest.mark.asyncio
async def test_terminalize_blocks_failed_to_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    run = {
        "id": str(uuid.uuid4()),
        "principal_id": str(uuid.uuid4()),
        "intent_kind": "image_generation_background",
        "status": "failed",
    }
    pool = MagicMock()
    monkeypatch.setattr(reconcile, "companion_task_steps_list", AsyncMock(return_value=[]))
    monkeypatch.setattr(reconcile, "companion_task_run_update", AsyncMock())
    monkeypatch.setattr(reconcile, "companion_task_step_update", AsyncMock())
    monkeypatch.setattr(reconcile, "publish_task_event_async", AsyncMock())

    ok = await reconcile._terminalize_companion_image_run(
        pool,
        run=run,
        terminal_status="failed",
        message="already failed",
        stage="test",
    )
    assert ok is False
