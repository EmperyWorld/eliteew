# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E1 locks for universal orphan reaper beat registration and orchestrator wiring.
# Related:
# - api/tasks/ewa_universal_orphan_reaper.py
# - api/tasks/celery_app.py
# ---

from __future__ import annotations

from collections.abc import Coroutine
from contextlib import suppress
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.tasks.ewa_universal_orphan_reaper import (
    _run_ewa_universal_orphan_sweep,
    ewa_universal_orphan_reaper_enabled,
    run_ewa_universal_orphan_sweep_task,
)

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.unit
def test_universal_reaper_enabled_default_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_UNIVERSAL_ORPHAN_REAPER_ENABLED", raising=False)
    assert ewa_universal_orphan_reaper_enabled() is True
    monkeypatch.setenv("EWA_UNIVERSAL_ORPHAN_REAPER_ENABLED", "0")
    assert ewa_universal_orphan_reaper_enabled() is False


@pytest.mark.unit
def test_celery_beat_registers_universal_orphan_reaper() -> None:
    source = (API_ROOT / "tasks" / "celery_app.py").read_text(encoding="utf-8")
    assert "ewa-universal-orphan-reaper" in source
    assert "api.tasks.ewa_universal_orphan_reaper.run_ewa_universal_orphan_sweep_task" in source


@pytest.mark.asyncio
async def test_universal_sweep_noop_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_UNIVERSAL_ORPHAN_REAPER_ENABLED", "false")
    out = await _run_ewa_universal_orphan_sweep()
    assert out["generic"] == 0
    assert out["music"] == 0
    assert out["agentic_orphans_swept"] == 0


@pytest.mark.asyncio
async def test_universal_sweep_aggregates_domain_counts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_UNIVERSAL_ORPHAN_REAPER_ENABLED", "1")

    async def _agentic() -> dict[str, int]:
        return {"reclaimed": 1, "gates_expired": 2, "orphans_swept": 3}

    monkeypatch.setattr(
        "api.tasks.agentic_lease_reaper._run_agentic_lease_reaper_sweep",
        _agentic,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.music_run_reconcile.reap_stale_companion_music_runs",
        AsyncMock(return_value=4),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.image_run_reconcile.reap_stale_companion_image_runs",
        AsyncMock(return_value=5),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.presentation_run_reconcile.reap_stale_companion_presentation_runs",
        AsyncMock(return_value=6),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.generic_run_reconcile.reap_stale_companion_generic_runs",
        AsyncMock(return_value=7),
    )

    out = await _run_ewa_universal_orphan_sweep()
    assert out == {
        "agentic_reclaimed": 1,
        "agentic_gates_expired": 2,
        "agentic_orphans_swept": 3,
        "music": 4,
        "image": 5,
        "presentation": 6,
        "generic": 7,
    }


@pytest.mark.unit
def test_universal_sweep_task_records_e6_observability(monkeypatch: pytest.MonkeyPatch) -> None:
    counts = {
        "agentic_reclaimed": 0,
        "agentic_gates_expired": 0,
        "agentic_orphans_swept": 3,
        "music": 1,
        "image": 2,
        "presentation": 0,
        "generic": 4,
    }
    calls: list[tuple[str, dict[str, Any]]] = []

    def _run_celery_async(coro: Coroutine[Any, Any, dict[str, int]]) -> dict[str, int]:
        with suppress(Exception):
            coro.close()
        return counts

    monkeypatch.setattr("api.tasks.ewa_universal_orphan_reaper.run_celery_async", _run_celery_async)
    monkeypatch.setattr(
        "api.tasks.ewa_universal_orphan_reaper.record_ewa_universal_reaper_sweep",
        lambda **kwargs: calls.append(("sweep", kwargs)),
    )
    monkeypatch.setattr(
        "api.tasks.ewa_universal_orphan_reaper.record_ewa_celery_beat_success",
        lambda **kwargs: calls.append(("beat", kwargs)),
    )

    out = run_ewa_universal_orphan_sweep_task()

    assert out == counts
    assert ("sweep", {"counts": counts, "ok": True}) in calls
    assert ("beat", {"task": "ewa_universal_orphan_reaper"}) in calls
