# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for scheduled unified_content hard-purge beat registration and task wiring.
# Related:
# - api/tasks/unified_content_hard_purge.py
# - api/tasks/celery_app.py
# - api/services/unified_content/storage_migrate_service.py
# ---

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.services.unified_content.storage_migrate_service import (
    unified_content_hard_purge_batch_limit,
    unified_content_hard_purge_beat_enabled,
    unified_content_hard_purge_interval_hours,
)
from api.tasks.unified_content_hard_purge import (
    _run_unified_content_hard_purge,
    run_unified_content_hard_purge_task,
)

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.unit
def test_hard_purge_beat_enabled_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("UNIFIED_CONTENT_HARD_PURGE_BEAT_ENABLED", raising=False)
    assert unified_content_hard_purge_beat_enabled() is False
    monkeypatch.setenv("UNIFIED_CONTENT_HARD_PURGE_BEAT_ENABLED", "1")
    assert unified_content_hard_purge_beat_enabled() is True


@pytest.mark.unit
def test_hard_purge_interval_and_batch_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("UNIFIED_CONTENT_HARD_PURGE_INTERVAL_HOURS", raising=False)
    monkeypatch.delenv("UNIFIED_CONTENT_HARD_PURGE_BATCH_LIMIT", raising=False)
    assert unified_content_hard_purge_interval_hours() == 24
    assert unified_content_hard_purge_batch_limit() == 500


@pytest.mark.unit
def test_celery_beat_registers_unified_content_hard_purge_conditionally() -> None:
    source = (API_ROOT / "tasks" / "celery_app.py").read_text(encoding="utf-8")
    assert "unified-content-hard-purge" in source
    assert "unified_content_hard_purge_beat_enabled()" in source
    assert "api.tasks.unified_content_hard_purge.run_unified_content_hard_purge_task" in source


@pytest.mark.asyncio
async def test_hard_purge_run_noop_when_beat_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UNIFIED_CONTENT_HARD_PURGE_BEAT_ENABLED", "0")
    out = await _run_unified_content_hard_purge()
    assert out == {"skipped": True, "reason": "beat_disabled"}


@pytest.mark.asyncio
async def test_hard_purge_run_delegates_to_service(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UNIFIED_CONTENT_HARD_PURGE_BEAT_ENABLED", "1")
    expected = {"scanned": 2, "purged": 2, "skipped": 0, "failed": 0, "dry_run": False, "older_than_days": 30}

    mock_service = AsyncMock()
    mock_service.hard_purge_soft_deleted = AsyncMock(return_value=expected)
    monkeypatch.setattr(
        "api.tasks.unified_content_hard_purge.StorageMigrateService",
        lambda pool: mock_service,
    )
    monkeypatch.setattr(
        "api.core.database_manager.get_asyncpg_pool",
        AsyncMock(return_value=object()),
    )

    out = await _run_unified_content_hard_purge()
    assert out == expected
    mock_service.hard_purge_soft_deleted.assert_awaited_once()
    call_kwargs = mock_service.hard_purge_soft_deleted.await_args.kwargs
    assert call_kwargs["dry_run"] is False


@pytest.mark.unit
def test_hard_purge_task_records_metrics_on_success(monkeypatch: pytest.MonkeyPatch) -> None:
    stats = {"scanned": 1, "purged": 1, "failed": 0}
    calls: list[tuple[str, dict[str, Any]]] = []

    monkeypatch.setattr(
        "api.tasks.unified_content_hard_purge.run_celery_async",
        lambda coro: stats,
    )
    monkeypatch.setattr(
        "api.tasks.unified_content_hard_purge.record_unified_content_hard_purge_run",
        lambda **kwargs: calls.append(("metric", kwargs)),
    )

    out = run_unified_content_hard_purge_task()
    assert out == stats
    assert ("metric", {"stats": stats, "ok": True}) in calls
