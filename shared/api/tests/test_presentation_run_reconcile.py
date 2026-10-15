# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for companion presentation run reconcile (EWRP completed → repair failed companion run).
# Invariants:
# - Tests mock DB layers; no live Postgres required.
# Related:
# - api/ewa_platform/companion/jobs/presentation_run_reconcile.py
# ---

from __future__ import annotations

import importlib
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

reconcile = importlib.import_module("api.ewa_platform.companion.jobs.presentation_run_reconcile")


@pytest.mark.asyncio
async def test_reconcile_repairs_failed_companion_when_ewrp_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    run_id = str(uuid.uuid4())
    principal_id = str(uuid.uuid4())
    ewrp_job_id = str(uuid.uuid4())
    run = {
        "id": run_id,
        "principal_id": principal_id,
        "intent_kind": "presentation_generation_background",
        "status": "failed",
        "user_message": "Презентация",
        "plan_payload": {"title": "T", "topic_preview": "topic", "num_slides": 7, "presentation_theme": "aurora"},
    }
    steps = [
        {
            "id": str(uuid.uuid4()),
            "output_payload": {"ewrp_job_id": ewrp_job_id, "progress": 50, "status": "generating_images"},
        }
    ]
    job = SimpleNamespace(
        id=uuid.UUID(ewrp_job_id),
        user_id=uuid.UUID(principal_id),
        status="completed",
        progress=100,
        error_message=None,
        pdf_path="/tmp/presentation.pdf",
        slides_json=[{"title": "Intro", "bullets": ["a"]}],
        topic="topic",
        title="T",
        num_slides=7,
        presentation_theme="aurora",
        updated_at=None,
    )

    pool = MagicMock()
    monkeypatch.setattr(reconcile, "companion_task_steps_list", AsyncMock(return_value=steps))
    terminalize = AsyncMock(return_value=True)
    monkeypatch.setattr(reconcile, "_terminalize_companion_presentation_run", terminalize)
    monkeypatch.setattr(reconcile, "fetch_ewrp_job_for_user", AsyncMock(return_value=job))
    monkeypatch.setattr(
        reconcile,
        "ewrp_build_status_response",
        AsyncMock(
            return_value=SimpleNamespace(
                model_dump=lambda *, mode: {
                    "status": "completed",
                    "progress": 100,
                    "title": "T",
                    "topic": "topic",
                    "num_slides": 7,
                    "presentation_theme": "aurora",
                    "pdf_url": f"/api/v1/ewrp/{ewrp_job_id}/pdf",
                    "pdf_download_token": "tok",
                    "slides": [{"title": "Intro", "bullets": ["a"]}],
                }
            )
        ),
    )
    monkeypatch.setattr(
        reconcile,
        "build_companion_presentation_result_payload",
        lambda status_payload, **kwargs: {"ewrp_job_id": ewrp_job_id, "status": "completed", "progress": 100},
    )

    db = MagicMock()
    changed = await reconcile.reconcile_companion_presentation_run_with_ewrp(pool, db, run=run, force_stale=False)

    assert changed is True
    terminalize.assert_awaited_once()
    terminal_call = terminalize.await_args
    assert terminal_call is not None
    assert terminal_call.kwargs["terminal_status"] == "completed"
    assert terminal_call.kwargs["stage"] == "ewrp-completed"


def test_ewrp_job_id_from_run_steps_reads_output_payload() -> None:
    steps = [{"output_payload": {"ewrp_job_id": "abc-123"}}]
    assert reconcile._ewrp_job_id_from_run_steps(steps) == "abc-123"
