#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for mobile foreground freshness used by FCM suppress gate.
# Related:
# - api.services.mobile_app_realtime_state_service
# ---

from __future__ import annotations

import time
from unittest.mock import AsyncMock

import pytest

from api.services import mobile_app_realtime_state_service as mrs


@pytest.mark.anyio
async def test_foreground_fresh_when_recent_epoch(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=str(int(time.time()) - 10))
    monkeypatch.setattr(mrs, "_redis", AsyncMock(return_value=redis))

    assert await mrs.user_has_mobile_app_foreground_fresh("11111111-1111-1111-1111-111111111111") is True


@pytest.mark.anyio
async def test_foreground_stale_when_legacy_one(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.get = AsyncMock(return_value="1")
    monkeypatch.setattr(mrs, "_redis", AsyncMock(return_value=redis))

    assert await mrs.user_has_mobile_app_foreground_fresh("11111111-1111-1111-1111-111111111111") is False


@pytest.mark.anyio
async def test_foreground_false_when_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.get = AsyncMock(return_value="0")
    monkeypatch.setattr(mrs, "_redis", AsyncMock(return_value=redis))

    assert await mrs.user_has_mobile_app_foreground_fresh("11111111-1111-1111-1111-111111111111") is False


@pytest.mark.anyio
async def test_mobile_user_receives_realtime_requires_both_fresh(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services import mobile_push_service as mps

    monkeypatch.setattr(mps, "user_has_mobile_app_foreground_fresh", AsyncMock(return_value=True))
    monkeypatch.setattr(mps, "mobile_socket_heartbeat_fresh", AsyncMock(return_value=False))

    assert await mps.mobile_user_receives_realtime_in_app("11111111-1111-1111-1111-111111111111") is False

    monkeypatch.setattr(mps, "mobile_socket_heartbeat_fresh", AsyncMock(return_value=True))
    assert await mps.mobile_user_receives_realtime_in_app("11111111-1111-1111-1111-111111111111") is True
