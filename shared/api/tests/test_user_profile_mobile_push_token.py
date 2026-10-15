#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for user profile mobile push token lifecycle helpers.
# Invariants:
# - Tests never use raw production tokens or a real database.
# Related:
# - api.services.user_profile_service, api.routers.user_profile
# ---

from __future__ import annotations

from uuid import UUID

import pytest

from api.services.user_profile_service import UserProfileService


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self.conn

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

    async def execute(self, query: str, *args: object) -> str:
        self.calls.append((query, args))
        return "DELETE 1"


@pytest.mark.anyio
async def test_delete_mobile_push_token_scopes_current_user_and_device() -> None:
    conn = _FakeConn()
    service = UserProfileService(db_pool=_FakePool(conn))  # type: ignore[arg-type]
    user_id = UUID("11111111-1111-1111-1111-111111111111")

    deleted = await service.delete_mobile_push_token(
        user_id,
        token="test-token",
        platform="android",
        device_id="device-1",
    )

    assert deleted == 1
    assert len(conn.calls) == 1
    query, args = conn.calls[0]
    assert "DELETE FROM user_mobile_push_tokens" in query
    assert args == (user_id, "android", "device-1", "test-token")


@pytest.mark.anyio
async def test_upsert_mobile_push_token_supersedes_orphan_device_rows() -> None:
    """Clear-data creates a new device_id; upsert must drop non-trusted orphans."""
    conn = _FakeConn()
    service = UserProfileService(db_pool=_FakePool(conn))  # type: ignore[arg-type]
    user_id = UUID("11111111-1111-1111-1111-111111111111")

    await service.upsert_mobile_push_token(
        user_id,
        token="fresh-fcm-token",
        platform="android",
        device_id="device-new",
    )

    assert len(conn.calls) == 3
    insert_q, insert_args = conn.calls[0]
    assert "INSERT INTO user_mobile_push_tokens" in insert_q
    assert insert_args == (user_id, "android", "device-new", "fresh-fcm-token")
    same_token_q, same_token_args = conn.calls[1]
    assert "DELETE FROM user_mobile_push_tokens" in same_token_q
    assert "token = $3" in same_token_q.replace("\n", " ")
    assert same_token_args == (user_id, "android", "fresh-fcm-token", "device-new")
    orphan_q, orphan_args = conn.calls[2]
    assert "mobile_trusted_devices" in orphan_q
    assert orphan_args == (user_id, "android", "device-new")
