#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for single browser Socket.IO presence enforcement helpers.
# Invariants:
# - Mobile sessions must never be classified as browser for supersede logic.
# Related:
# - api.services.presence_service, api.routers.socketio_handler
# ---
"""Browser presence supersede helpers."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from api.services.presence_service import (
    force_claim_browser_socket_lease,
    is_browser_presence_session,
    register_socketio_sid_live_checker,
    release_browser_socket_lease,
    try_claim_browser_socket_lease,
)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("detail", "expected"),
    [
        ({"client_class": "browser", "client_id": "empery-web"}, True),
        ({"client_class": "mobile", "client_id": "empery-mobile"}, False),
        ({"client_class": "", "client_id": ""}, True),
        ({"client_class": "browser", "client_id": "empery-mobile"}, False),
    ],
)
def test_is_browser_presence_session(detail: dict[str, str], expected: bool) -> None:
    assert is_browser_presence_session(detail) is expected


@pytest.mark.unit
@pytest.mark.anyio
async def test_try_claim_browser_socket_lease_first_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    r = AsyncMock()
    r.set = AsyncMock(return_value=True)
    monkeypatch.setattr(
        "api.services.presence_service._redis",
        AsyncMock(return_value=r),
    )
    assert await try_claim_browser_socket_lease("user-1", "sid-a") is True
    r.set.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.anyio
async def test_try_claim_browser_socket_lease_rejects_second(monkeypatch: pytest.MonkeyPatch) -> None:
    r = AsyncMock()
    r.set = AsyncMock(return_value=False)
    r.get = AsyncMock(return_value=b"sid-a")
    r.exists = AsyncMock(return_value=True)
    monkeypatch.setattr(
        "api.services.presence_service._redis",
        AsyncMock(return_value=r),
    )

    async def _live(_sid: str) -> bool:
        return True

    register_socketio_sid_live_checker(_live)
    try:
        assert await try_claim_browser_socket_lease("user-1", "sid-b") is False
    finally:
        register_socketio_sid_live_checker(None)


@pytest.mark.unit
@pytest.mark.anyio
async def test_try_claim_steals_lease_when_holder_not_live(monkeypatch: pytest.MonkeyPatch) -> None:
    r = AsyncMock()
    r.set = AsyncMock(return_value=False)
    r.get = AsyncMock(return_value=b"sid-a")
    r.exists = AsyncMock(return_value=True)
    monkeypatch.setattr(
        "api.services.presence_service._redis",
        AsyncMock(return_value=r),
    )

    async def _dead(_sid: str) -> bool:
        return False

    register_socketio_sid_live_checker(_dead)
    try:
        assert await try_claim_browser_socket_lease("user-1", "sid-b") is True
        assert r.set.await_count >= 2
    finally:
        register_socketio_sid_live_checker(None)


@pytest.mark.unit
@pytest.mark.anyio
async def test_force_claim_browser_socket_lease_overwrites(monkeypatch: pytest.MonkeyPatch) -> None:
    r = AsyncMock()
    r.set = AsyncMock(return_value=True)
    monkeypatch.setattr(
        "api.services.presence_service._redis",
        AsyncMock(return_value=r),
    )
    await force_claim_browser_socket_lease("user-1", "sid-b")
    r.set.assert_awaited_once()
    args, kwargs = r.set.await_args
    assert args[1] == "sid-b"
    assert "nx" not in kwargs


@pytest.mark.unit
@pytest.mark.anyio
async def test_release_browser_socket_lease_only_holder(monkeypatch: pytest.MonkeyPatch) -> None:
    r = AsyncMock()
    r.get = AsyncMock(return_value=b"sid-a")
    r.delete = AsyncMock()
    monkeypatch.setattr(
        "api.services.presence_service._redis",
        AsyncMock(return_value=r),
    )
    await release_browser_socket_lease("user-1", "sid-a")
    r.delete.assert_awaited_once()
