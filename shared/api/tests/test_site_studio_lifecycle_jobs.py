# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Site Studio lifecycle jobs and worker readiness startup guards.
# Invariants:
# - No live database is required; AsyncSession.execute is faked at the SQLAlchemy result boundary.
# - Startup preflight must fail loudly when queued Site Studio actions require a worker heartbeat.
# Related:
# - api/services/site_studio_lifecycle_jobs.py
# - api/main.py
# ---
"""Site Studio lifecycle job helper tests."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest

from api.services import site_studio_lifecycle_jobs as jobs
from api.utils.datetime_helpers import utc_now_naive


class _FakeMappings:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row

    def first(self) -> dict[str, Any] | None:
        return self._row


class _FakeResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._row)


class _FakeSession:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row

    async def execute(self, *_args: object, **_kwargs: object) -> _FakeResult:
        return _FakeResult(self._row)


def _enable_startup_preflight(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP", "true")
    monkeypatch.setenv("ENABLE_QUEUE_SITE_STUDIO", "true")
    monkeypatch.setenv("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", "false")


def test_site_studio_startup_preflight_respects_queue_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    _enable_startup_preflight(monkeypatch)
    assert jobs.site_studio_startup_preflight_required() is True

    monkeypatch.setenv("ENABLE_QUEUE_SITE_STUDIO", "false")
    assert jobs.site_studio_startup_preflight_required() is False

    monkeypatch.setenv("ENABLE_QUEUE_SITE_STUDIO", "true")
    monkeypatch.setenv("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", "true")
    assert jobs.site_studio_startup_preflight_required() is False


@pytest.mark.asyncio
async def test_require_site_studio_worker_ready_at_startup_fails_without_heartbeat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_startup_preflight(monkeypatch)

    with pytest.raises(RuntimeError, match="Site Studio startup preflight failed") as exc:
        await jobs.require_site_studio_worker_ready_at_startup(_FakeSession(None))  # type: ignore[arg-type]

    assert "no heartbeat row for queue_name=site_studio" in str(exc.value)
    assert "profile site-studio-worker" in str(exc.value)


@pytest.mark.asyncio
async def test_require_site_studio_worker_ready_at_startup_accepts_fresh_heartbeat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_startup_preflight(monkeypatch)
    row = {
        "worker_id": "worker-1",
        "queue_name": "site_studio",
        "last_seen_at": utc_now_naive() - timedelta(seconds=2),
        "metadata_json": {"source": "test"},
        "updated_at": utc_now_naive(),
    }

    readiness = await jobs.require_site_studio_worker_ready_at_startup(_FakeSession(row))  # type: ignore[arg-type]

    assert readiness is not None
    assert readiness["worker_ready"] is True
    assert readiness["worker_id"] == "worker-1"


@pytest.mark.asyncio
async def test_wait_for_site_studio_worker_ready_at_startup_times_out(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_startup_preflight(monkeypatch)
    monkeypatch.setenv("STACK0_SITE_STUDIO_STARTUP_WAIT_SECONDS", "2")
    monkeypatch.setenv("STACK0_SITE_STUDIO_STARTUP_POLL_SECONDS", "1")

    clock = {"value": 0.0}

    def _monotonic() -> float:
        return clock["value"]

    async def _sleep(seconds: float) -> None:
        clock["value"] += seconds

    monkeypatch.setattr(jobs.time, "monotonic", _monotonic)
    monkeypatch.setattr(jobs.asyncio, "sleep", _sleep)

    with pytest.raises(RuntimeError, match="Site Studio startup preflight failed") as exc:
        await jobs.wait_for_site_studio_worker_ready_at_startup(_FakeSession(None))  # type: ignore[arg-type]

    assert "no heartbeat row for queue_name=site_studio" in str(exc.value)


@pytest.mark.asyncio
async def test_wait_for_site_studio_worker_ready_at_startup_succeeds_after_poll(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_startup_preflight(monkeypatch)
    monkeypatch.setenv("STACK0_SITE_STUDIO_STARTUP_WAIT_SECONDS", "10")
    monkeypatch.setenv("STACK0_SITE_STUDIO_STARTUP_POLL_SECONDS", "1")

    row = {
        "worker_id": "worker-1",
        "queue_name": "site_studio",
        "last_seen_at": utc_now_naive() - timedelta(seconds=2),
        "metadata_json": {"source": "test"},
        "updated_at": utc_now_naive(),
    }

    class _PollingSession:
        def __init__(self) -> None:
            self._calls = 0

        async def execute(self, *_args: object, **_kwargs: object) -> _FakeResult:
            self._calls += 1
            if self._calls == 1:
                return _FakeResult(None)
            return _FakeResult(row)

    clock = {"value": 0.0}

    def _monotonic() -> float:
        return clock["value"]

    async def _sleep(seconds: float) -> None:
        clock["value"] += seconds

    monkeypatch.setattr(jobs.time, "monotonic", _monotonic)
    monkeypatch.setattr(jobs.asyncio, "sleep", _sleep)

    readiness = await jobs.wait_for_site_studio_worker_ready_at_startup(_PollingSession())  # type: ignore[arg-type]

    assert readiness is not None
    assert readiness["worker_ready"] is True
    assert readiness["worker_id"] == "worker-1"


@pytest.mark.asyncio
async def test_wait_for_site_studio_worker_skipped_when_preflight_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP", "false")

    readiness = await jobs.wait_for_site_studio_worker_ready_at_startup(_FakeSession(None))  # type: ignore[arg-type]

    assert readiness is None
