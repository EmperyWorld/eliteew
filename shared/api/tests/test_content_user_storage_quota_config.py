# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for CONTENT_USER_STORAGE_QUOTA_BYTES config and ContentStorageService quota enforcement.
# Invariants:
# - No live Postgres; pool and unified_settings are mocked or freshly constructed.
# Related:
# - api/core/unified_config.py
# - api/services/unified_content/content_storage_service.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from api.core.unified_config import UnifiedConfig
from api.services.unified_content.content_storage_service import (
    ContentStorageService,
    get_content_user_storage_quota_bytes,
)

_DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024


def _settings_with_quota(quota_bytes: int) -> SimpleNamespace:
    return SimpleNamespace(content_user_storage_quota_bytes=quota_bytes)


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


def test_unified_config_content_user_storage_quota_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CONTENT_USER_STORAGE_QUOTA_BYTES", raising=False)
    cfg = UnifiedConfig()  # pyright: ignore[reportCallIssue]
    assert cfg.content_user_storage_quota_bytes == _DEFAULT_QUOTA_BYTES


def test_unified_config_content_user_storage_quota_env_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    custom = 5 * 1024 * 1024 * 1024
    monkeypatch.setenv("CONTENT_USER_STORAGE_QUOTA_BYTES", str(custom))
    cfg = UnifiedConfig()  # pyright: ignore[reportCallIssue]
    assert cfg.content_user_storage_quota_bytes == custom


def test_content_storage_service_user_quota_bytes_reads_unified_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    custom = 7 * 1024 * 1024 * 1024
    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        _settings_with_quota(custom),
    )
    assert ContentStorageService.USER_QUOTA_BYTES == custom
    assert get_content_user_storage_quota_bytes() == custom


@pytest.mark.asyncio
async def test_check_quota_uses_configured_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    quota_bytes = 1024
    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        _settings_with_quota(quota_bytes),
    )
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=900)
    service = ContentStorageService.__new__(ContentStorageService)
    service.db_pool = _FakePool(conn)  # type: ignore[attr-defined]

    await service._check_quota("user-1", 100)

    conn.fetchval.assert_awaited_once()


@pytest.mark.asyncio
async def test_check_quota_raises_when_configured_limit_exceeded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    quota_bytes = 1024
    monkeypatch.setattr(
        "api.core.unified_config.unified_settings",
        _settings_with_quota(quota_bytes),
    )
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=900)
    service = ContentStorageService.__new__(ContentStorageService)
    service.db_pool = _FakePool(conn)  # type: ignore[attr-defined]

    with pytest.raises(ValueError, match="Quota exceeded"):
        await service._check_quota("user-1", 200)
