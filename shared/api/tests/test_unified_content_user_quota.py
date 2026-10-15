# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for current-user content quota helper and E2E seed gate.
# Invariants:
# - No live Postgres/Redis; pool and env are mocked.
# Related:
# - api/services/unified_content/content_admin_ops_service.py
# - api/services/unified_content/content_e2e_fixture_service.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.services.unified_content import content_admin_ops_service as ops
from api.services.unified_content import content_e2e_fixture_service as e2e


class _AcquireCtx:
    def __init__(self, conn) -> None:
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *_args):
        return False


class _FakePool:
    def __init__(self, conn) -> None:
        self.conn = conn

    def acquire(self):
        return _AcquireCtx(self.conn)


@pytest.mark.asyncio
async def test_get_current_user_quota_computes_remaining() -> None:
    user_id = str(uuid4())
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=1024 * 1024 * 100)
    pool = _FakePool(conn)

    payload = await ops.get_current_user_quota(pool, user_id)  # type: ignore[arg-type]

    assert payload["user_id"] == user_id
    assert payload["storage_used_bytes"] == 1024 * 1024 * 100
    assert payload["storage_remaining_bytes"] == ops.ContentStorageService.USER_QUOTA_BYTES - 1024 * 1024 * 100
    assert payload["storage_used_mb"] == 100.0


def test_content_e2e_seed_enabled_truthy_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(e2e.CONTENT_E2E_SEED_ENV, "1")
    assert e2e.content_e2e_seed_enabled() is True
    monkeypatch.setenv(e2e.CONTENT_E2E_SEED_ENV, "true")
    assert e2e.content_e2e_seed_enabled() is True


def test_content_e2e_seed_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(e2e.CONTENT_E2E_SEED_ENV, raising=False)
    assert e2e.content_e2e_seed_enabled() is False


def test_assert_content_e2e_seed_enabled_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(e2e.CONTENT_E2E_SEED_ENV, raising=False)
    with pytest.raises(PermissionError):
        e2e.assert_content_e2e_seed_enabled()


@pytest.mark.asyncio
async def test_teardown_content_e2e_fixtures_requires_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(e2e.CONTENT_E2E_SEED_ENV, raising=False)
    with pytest.raises(PermissionError):
        await e2e.teardown_content_e2e_fixtures(object())  # type: ignore[arg-type]
