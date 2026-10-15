# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for EWA Postgres health aggregation helpers used by ``/api/health``.
# Invariants:
# - No live DB: mocks only.
# Related:
# - api/ewa_platform/desktop/ewa_health_snapshot.py
# - api/main.py
# ---
from __future__ import annotations

from types import SimpleNamespace

import pytest

from api.ewa_platform.desktop.ewa_health_snapshot import (
    build_ewa_postgres_health_payload,
    merge_api_overall_status_with_ewa,
)


@pytest.mark.asyncio
async def test_build_ewa_health_disabled_without_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    app = SimpleNamespace(state=SimpleNamespace(ewa_orchestration_pool=None))
    payload = await build_ewa_postgres_health_payload(app, pg_probe=False)
    assert payload["status"] == "disabled"
    assert payload["configured"] is False


@pytest.mark.asyncio
async def test_build_ewa_health_down_when_dsn_but_no_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@localhost:5432/db")

    async def _no_pool(_app: object) -> None:
        return None

    monkeypatch.setattr(
        "api.ewa_platform.desktop.pool.ensure_ewa_orchestration_pool",
        _no_pool,
    )
    app = SimpleNamespace(state=SimpleNamespace(ewa_orchestration_pool=None))
    payload = await build_ewa_postgres_health_payload(app, pg_probe=False)
    assert payload["status"] == "down"
    assert payload["configured"] is True
    assert payload["pool_open"] is False


@pytest.mark.asyncio
async def test_build_ewa_health_ensure_opens_missing_pool(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    sentinel = object()

    async def _open(app: object) -> object:
        app.state.ewa_orchestration_pool = sentinel  # type: ignore[attr-defined]
        return sentinel

    monkeypatch.setattr(
        "api.ewa_platform.desktop.pool.ensure_ewa_orchestration_pool",
        _open,
    )
    app = SimpleNamespace(state=SimpleNamespace(ewa_orchestration_pool=None))
    payload = await build_ewa_postgres_health_payload(app, pg_probe=False)
    assert payload["status"] == "healthy"
    assert payload["pool_open"] is True
    assert payload.get("pool_ensure") == "opened"


def test_merge_overall_degrades_when_ewa_down() -> None:
    assert merge_api_overall_status_with_ewa("healthy", "down") == "degraded"


def test_merge_overall_unchanged_when_ewa_disabled() -> None:
    assert merge_api_overall_status_with_ewa("healthy", "disabled") == "healthy"
