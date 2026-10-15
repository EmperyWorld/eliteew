#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E8 regression locks: image capacity gate, media step fresh window, reaper batch env,
# Celery rate-limit carve-outs, and image kick stall heuristic.
# Invariants:
# - Unit tests must not contact Redis, Postgres, Celery, or HTTP services.
# Related:
# - api/ewa_platform/companion/jobs/run_capacity.py
# - api/ewa_platform/companion/jobs/step_idempotency.py
# - api/tasks/celery_app.py
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md
# ---

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.capacity.model import CapacityConfig, evaluate_capacity
from api.ewa_platform.companion.jobs import run_capacity, step_idempotency
from api.ewa_platform.companion.jobs.image_run_reconcile import companion_image_reaper_batch_limit
from api.ewa_platform.companion.jobs.music_run_reconcile import companion_music_reaper_batch_limit
from api.ewa_platform.companion.jobs.presentation_run_reconcile import (
    companion_presentation_reaper_batch_limit,
)
from api.ewa_platform.companion.orchestration import companion_image_generation as image_gen

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.unit
def test_image_capacity_exceeded_when_at_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        run_capacity.companion_pg,
        "companion_task_count_active_image_runs",
        AsyncMock(return_value=1),
    )
    monkeypatch.setattr(run_capacity, "image_max_concurrent_per_principal", lambda: 1)
    out = asyncio.run(run_capacity.companion_image_capacity_exceeded(MagicMock(), principal_id="p1"))
    assert out is True


@pytest.mark.unit
def test_image_busy_reply_ru() -> None:
    text = run_capacity.image_busy_reply(ru=True)
    assert "изображен" in text.lower()


@pytest.mark.unit
def test_media_step_fresh_window_wider_than_default() -> None:
    assert step_idempotency.resolve_in_progress_fresh_seconds(step_kind="image_generation_pipeline") >= 240
    assert step_idempotency.resolve_in_progress_fresh_seconds(step_kind="tool_dispatch") == 120


@pytest.mark.unit
def test_evaluate_step_dispatch_keeps_fresh_media_in_progress() -> None:
    now = datetime.now(UTC)
    step = {
        "status": "in_progress",
        "step_kind": "image_generation_pipeline",
        "updated_at": (now - timedelta(seconds=150)).isoformat(),
        "output_payload": {},
    }
    decision = step_idempotency.evaluate_step_dispatch(step, now=now)
    assert decision.should_execute is False
    assert decision.reason == "step_in_progress_active"


@pytest.mark.unit
def test_media_reaper_batch_limit_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_MEDIA_REAPER_BATCH_LIMIT", "120")
    assert companion_music_reaper_batch_limit() == 120
    assert companion_image_reaper_batch_limit() == 120
    assert companion_presentation_reaper_batch_limit() == 120
    monkeypatch.delenv("EWA_MEDIA_REAPER_BATCH_LIMIT", raising=False)
    monkeypatch.setenv("EWA_UNIVERSAL_REAPER_BATCH_LIMIT", "80")
    assert companion_music_reaper_batch_limit() == 80


@pytest.mark.unit
def test_celery_ewa_lanes_exempt_from_global_rate_limit() -> None:
    source = (API_ROOT / "tasks" / "celery_app.py").read_text(encoding="utf-8")
    assert '"rate_limit": "100/m"' in source
    assert '"api.ewa_platform.workers.agentic_step_runner.agentic_step_task"' in source
    assert '"api.ewa_platform.workers.companion_task_runner.companion_run_task"' in source
    # Carve-outs must set rate_limit None for EWA lanes (not only declare the task name in routes).
    assert source.count('"rate_limit": None') >= 5


@pytest.mark.unit
def test_capacity_model_image_enforcement_low_after_e8() -> None:
    report = evaluate_capacity(1000)
    bottlenecks = {item["id"]: item for item in report["bottlenecks"]}
    assert bottlenecks["image_capacity_enforcement"]["severity"] == "low"
    assert "E8" in bottlenecks["rate_limit"]["summary"]


@pytest.mark.unit
def test_capacity_model_image_gap_when_unenforced() -> None:
    report = evaluate_capacity(1000, cfg=CapacityConfig(image_capacity_enforced=False))
    bottlenecks = {item["id"]: item for item in report["bottlenecks"]}
    assert bottlenecks["image_capacity_enforcement"]["severity"] == "high"


@pytest.mark.unit
def test_image_kick_does_not_skip_on_updated_after_created(monkeypatch: pytest.MonkeyPatch) -> None:
    """V-M2: post-claim heartbeat (updated > created) must still be kick-eligible when stalled."""

    now = datetime.now(UTC)
    created = now - timedelta(seconds=120)
    updated = now - timedelta(seconds=90)
    run = {
        "id": "run-img-1",
        "intent_kind": "image_generation_background",
        "status": "running",
        "created_at": created,
        "updated_at": updated,
        "user_message": "draw a cat",
        "plan_payload": {
            "prompt_preview": "a cat",
            "aspect_ratio": "1:1",
            "workflow_parent_run_id": "parent-1",
        },
    }
    step = {
        "id": "step-1",
        "step_index": 1,
        "status": "running",
        "output_payload": {},
        "input_payload": {"catalog_user_id": "cat-1", "prompt": "a cat"},
    }
    parent = {"plan_payload": {"content_catalog_user_id": "cat-1"}}

    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    monkeypatch.setattr(companion_pg, "companion_task_runs_list", AsyncMock(return_value=[run]))
    monkeypatch.setattr(companion_pg, "companion_task_steps_list", AsyncMock(return_value=[step]))
    monkeypatch.setattr(companion_pg, "companion_task_run_fetch", AsyncMock(return_value=parent))

    enqueued: list[dict[str, Any]] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(dict(kwargs))
        return "celery-kick-1"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.config.companion_async_jobs_enabled",
        lambda: True,
    )

    kicked = asyncio.run(
        image_gen.kick_stalled_companion_image_runs_for_principal(
            MagicMock(),
            principal_id="p1",
            min_age_seconds=45.0,
        )
    )
    assert kicked == 1
    assert len(enqueued) == 1
    assert enqueued[0]["run_id"] == "run-img-1"
