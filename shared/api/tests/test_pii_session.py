# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for ensure_encryption_pii_key and SQLAlchemy connect pii_key helper.
# Invariants:
# - No live DB; execute / cursor mocked.
# - Fail-closed when encryption on but master key missing or SET fails.
# Related:
# - api/core/pii_session.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from api.core import pii_session as mod
from api.core.pii_session import EncryptionPiiKeyError


@pytest.mark.asyncio
async def test_ensure_encryption_pii_key_sets_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod.unified_settings, "encryption_enabled", True)
    monkeypatch.setattr(mod.unified_settings, "encryption_master_key", "secret'key")
    session = MagicMock()
    session.execute = AsyncMock()
    assert await mod.ensure_encryption_pii_key(session) is True
    sql = str(session.execute.await_args.args[0])
    assert "SET SESSION encryption.pii_key" in sql
    assert "secret''key" in sql


@pytest.mark.asyncio
async def test_ensure_encryption_pii_key_noop_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod.unified_settings, "encryption_enabled", False)
    monkeypatch.setattr(mod.unified_settings, "encryption_master_key", "x")
    session = MagicMock()
    session.execute = AsyncMock()
    assert await mod.ensure_encryption_pii_key(session) is False
    session.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_encryption_pii_key_fail_closed_missing_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(mod.unified_settings, "encryption_enabled", True)
    monkeypatch.setattr(mod.unified_settings, "encryption_master_key", None)
    session = MagicMock()
    session.execute = AsyncMock()
    with pytest.raises(EncryptionPiiKeyError):
        await mod.ensure_encryption_pii_key(session)
    session.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_encryption_pii_key_fail_closed_on_execute(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(mod.unified_settings, "encryption_enabled", True)
    monkeypatch.setattr(mod.unified_settings, "encryption_master_key", "k")
    session = MagicMock()
    session.execute = AsyncMock(side_effect=TimeoutError("QueuePool limit of size 6"))
    with pytest.raises(EncryptionPiiKeyError, match="Failed to set encryption.pii_key"):
        await mod.ensure_encryption_pii_key(session)


def test_apply_encryption_pii_key_on_dbapi_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod.unified_settings, "encryption_enabled", True)
    monkeypatch.setattr(mod.unified_settings, "encryption_master_key", "secret'key")
    cursor = MagicMock()
    dbapi = MagicMock()
    dbapi.cursor.return_value = cursor
    assert mod.apply_encryption_pii_key_on_dbapi_connection(dbapi) is True
    cursor.execute.assert_called_once()
    sql = cursor.execute.call_args.args[0]
    assert "SET SESSION encryption.pii_key" in sql
    assert "secret''key" in sql
    cursor.close.assert_called_once()


def test_apply_encryption_pii_key_dbapi_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod.unified_settings, "encryption_enabled", True)
    monkeypatch.setattr(mod.unified_settings, "encryption_master_key", "k")
    cursor = MagicMock()
    cursor.execute.side_effect = OSError("boom")
    dbapi = MagicMock()
    dbapi.cursor.return_value = cursor
    with pytest.raises(EncryptionPiiKeyError):
        mod.apply_encryption_pii_key_on_dbapi_connection(dbapi)
    cursor.close.assert_called_once()
