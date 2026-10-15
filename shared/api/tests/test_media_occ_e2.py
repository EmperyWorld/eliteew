# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E2 locks: media cancel wins over late worker completion (OCC + step terminal guard).
# Related:
# - api/ewa_platform/companion/orchestration/run_lifecycle.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py (facade re-exports)
# - api/ewa_platform/persistence_pg/companion_task_asyncpg.py (task SQL)
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (V-C2)
# ---

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.orchestration import companion_image_generation as img
from api.ewa_platform.companion.orchestration.run_lifecycle import apply_companion_run_terminal
from api.ewa_platform.persistence_pg import companion_task_asyncpg as companion_task_pg


@pytest.mark.asyncio
async def test_apply_companion_run_terminal_skips_cancelled(monkeypatch: pytest.MonkeyPatch) -> None:
    updated = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_update",
        updated,
    )
    out = await apply_companion_run_terminal(
        AsyncMock(),
        run={
            "id": "r1",
            "principal_id": "p1",
            "status": "cancelled",
            "run_revision": 3,
        },
        status="completed",
        context="image_job_complete",
        result_payload={"ok": True},
    )
    assert out is None
    updated.assert_not_awaited()


@pytest.mark.asyncio
async def test_apply_companion_run_terminal_passes_expect_revision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[dict[str, Any]] = []

    async def _update(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        seen.append(dict(kwargs))
        return {"id": kwargs["run_id"], "status": kwargs["status"], "run_revision": 4}

    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_update",
        _update,
    )
    out = await apply_companion_run_terminal(
        AsyncMock(),
        run={
            "id": "r1",
            "principal_id": "p1",
            "status": "running",
            "run_revision": 3,
        },
        status="completed",
        context="music_job_complete",
        result_payload={"content_id": "c1"},
    )
    assert out is not None
    assert seen[0]["expect_revision"] == 3
    assert seen[0]["status"] == "completed"


@pytest.mark.asyncio
async def test_apply_companion_run_terminal_force_skips_revision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[dict[str, Any]] = []

    async def _update(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        seen.append(dict(kwargs))
        return {"id": "r1", "status": "failed"}

    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_update",
        _update,
    )
    out = await apply_companion_run_terminal(
        AsyncMock(),
        run={
            "id": "r1",
            "principal_id": "p1",
            "status": "running",
            "run_revision": 9,
        },
        status="failed",
        context="stale-reaper",
        error_payload={"message": "stale"},
        force=True,
    )
    assert out is not None
    assert seen[0]["expect_revision"] is None


@pytest.mark.unit
def test_companion_task_step_update_sql_guards_cancelled_overwrite() -> None:
    """E2: step UPDATE must refuse cancelled→completed (source contract)."""

    source = Path(companion_task_pg.__file__).read_text(encoding="utf-8")
    assert "status NOT IN ('cancelled', 'completed')" in source
    assert "OR status = $2" in source


@pytest.mark.asyncio
async def test_fail_image_run_noop_when_cancelled(monkeypatch: pytest.MonkeyPatch) -> None:
    step_updates: list[Any] = []
    publishes: list[Any] = []

    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_fetch",
        AsyncMock(
            return_value={
                "id": "r1",
                "principal_id": "p1",
                "status": "cancelled",
                "run_revision": 2,
            }
        ),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_update",
        AsyncMock(side_effect=lambda *a, **k: step_updates.append(k) or {"id": "s1"}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.task_events.publish_task_event_async",
        AsyncMock(side_effect=lambda **k: publishes.append(k)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_async_resume.maybe_fail_workflow_from_child_run",
        AsyncMock(return_value=False),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.child_reconcile.maybe_complete_agentic_awaiting_child_from_run",
        AsyncMock(return_value=False),
    )

    await img._fail_image_run(
        AsyncMock(),
        principal_id="p1",
        run_id="r1",
        step_id="s1",
        message="late_fail",
        stage="ugs_status",
    )
    assert step_updates == []
    assert publishes == []


@pytest.mark.asyncio
async def test_fail_presentation_run_noop_when_cancelled(monkeypatch: pytest.MonkeyPatch) -> None:
    """V-C2 residual: presentation fail must not overwrite cancelled runs."""

    from api.ewa_platform.companion.orchestration import companion_presentation_generation as pres

    step_updates: list[Any] = []
    publishes: list[Any] = []

    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_fetch",
        AsyncMock(
            return_value={
                "id": "r1",
                "principal_id": "p1",
                "status": "cancelled",
                "run_revision": 2,
            }
        ),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_update",
        AsyncMock(side_effect=lambda *a, **k: step_updates.append(k) or {"id": "s1"}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.task_events.publish_task_event_async",
        AsyncMock(side_effect=lambda **k: publishes.append(k)),
    )

    await pres._fail_presentation_run(
        AsyncMock(),
        principal_id="p1",
        run_id="r1",
        step_id="s1",
        message="late_fail",
        stage="ewrp_status",
    )
    assert step_updates == []
    assert publishes == []


@pytest.mark.unit
def test_presentation_job_uses_apply_companion_run_terminal() -> None:
    """Source contract: presentation complete/fail paths must OCC via lifecycle helper."""

    from api.ewa_platform.companion.orchestration import companion_presentation_generation as pres

    source = Path(pres.__file__).read_text(encoding="utf-8")
    assert "apply_companion_run_terminal" in source
    assert 'context="presentation_job_complete"' in source
    assert 'context="presentation_job_fail"' in source
