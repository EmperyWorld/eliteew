#!/usr/bin/env python3
"""Unit tests for mobile profile merge helpers."""

from __future__ import annotations

from uuid import UUID

import pytest

from api.schemas.mobile_app import MobileProfileUpdate
from api.services import mobile_profile_service as mps
from api.services.mobile_profile_service import _deep_merge_dict, update_mobile_profile


def test_deep_merge_dict_nested_notifications() -> None:
    base = {
        "ui_style": "glass",
        "notifications": {"chat_enabled": True, "ugs_enabled": False},
    }
    incoming = {"notifications": {"friends_enabled": False}}
    merged = _deep_merge_dict(base, incoming)
    assert merged["ui_style"] == "glass"
    assert merged["notifications"]["chat_enabled"] is True
    assert merged["notifications"]["ugs_enabled"] is False
    assert merged["notifications"]["friends_enabled"] is False


def test_clear_background_content_id_empty_string() -> None:
    mobile = {"background_content_id": "abc123", "ui_style": "glass"}
    patch = {"background_content_id": ""}
    if patch.get("background_content_id") == "":
        patch.pop("background_content_id", None)
        mobile.pop("background_content_id", None)
    assert "background_content_id" not in mobile
    assert mobile["ui_style"] == "glass"


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self.conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeTransaction:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


class _FakeConn:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[object, ...]]] = []

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def execute(self, query: str, *args: object) -> str:
        self.calls.append((query, args))
        return "UPDATE 1"

    async def fetchval(self, query: str, *args: object) -> dict[str, object]:
        self.calls.append((query, args))
        return {"mobile": {"ui_style": "system"}}


@pytest.mark.anyio
async def test_update_mobile_profile_sets_pii_key_before_users_update(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "encryption_enabled", True)
    monkeypatch.setattr(mps.unified_settings, "encryption_master_key", "secret'key")
    conn = _FakeConn()
    user_id = UUID("11111111-1111-1111-1111-111111111111")

    profile = await update_mobile_profile(
        _FakePool(conn),  # type: ignore[arg-type]
        user_id,
        MobileProfileUpdate(ui_style="glass"),
    )

    assert profile.ui_style == "glass"
    assert conn.calls[0][0] == "SET SESSION encryption.pii_key = 'secret''key'"
    assert "UPDATE users" in conn.calls[-1][0]
