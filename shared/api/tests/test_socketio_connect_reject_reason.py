#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verifies Socket.IO connect rejects include machine-readable auth reason payload.
# Invariants:
# - No real Socket.IO server/network calls; connect path is tested with patched auth dependencies.
# - Missing token → connect returns False (no Application session).
# Related:
# - api.routers.socketio_handler.connect; api.core.websocket_auth.validate_websocket_token
# ---
"""Socket.IO connect rejection payload contract tests."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from socketio.exceptions import ConnectionRefusedError

from api.routers import socketio_handler


async def _connect_reject_includes_reason_payload() -> None:
    fake_provider = SimpleNamespace(validate_token=AsyncMock(return_value={}))
    with (
        patch("api.services.auth_provider_service.get_auth_provider_service", return_value=fake_provider),
        patch(
            "api.core.websocket_auth.validate_websocket_token",
            new=AsyncMock(return_value=(None, "auth:token_expired")),
        ),
    ):
        with pytest.raises(ConnectionRefusedError) as ei:
            await socketio_handler.connect(
                sid="sid-test",
                environ={"QUERY_STRING": "token=dummy-token"},
                auth={},
            )
    payload = ei.value.args[0]
    assert isinstance(payload, dict)
    assert payload["error"] == "unauthorized"
    assert payload["reason"] == "token_expired"
    assert payload["action"] == "refresh"
    assert payload["ws_reason"] == "auth:token_expired"


async def _connect_reject_maps_registry_unavailable_to_retry() -> None:
    """SSO registry outage → action=retry (same as HTTP 503), not token refresh."""
    fake_provider = SimpleNamespace(validate_token=AsyncMock(return_value={}))
    with (
        patch("api.services.auth_provider_service.get_auth_provider_service", return_value=fake_provider),
        patch(
            "api.core.websocket_auth.validate_websocket_token",
            new=AsyncMock(return_value=(None, "auth:sso_registry_unavailable")),
        ),
    ):
        with pytest.raises(ConnectionRefusedError) as ei:
            await socketio_handler.connect(
                sid="sid-registry",
                environ={"QUERY_STRING": "token=dummy-token", "HTTP_USER_AGENT": "test-agent"},
                auth={"token": "dummy-token"},
            )
    payload = ei.value.args[0]
    assert payload["reason"] == "sso_registry_unavailable"
    assert payload["action"] == "retry"
    assert payload["ws_reason"] == "auth:sso_registry_unavailable"


async def _connect_reject_when_no_token() -> None:
    result = await socketio_handler.connect(
        sid="sid-no-token",
        environ={"QUERY_STRING": ""},
        auth={},
    )
    assert result is False


def test_connect_reject_when_no_token() -> None:
    asyncio.run(_connect_reject_when_no_token())


def test_connect_reject_maps_registry_unavailable_to_retry() -> None:
    asyncio.run(_connect_reject_maps_registry_unavailable_to_retry())


def test_connect_reject_includes_reason_payload() -> None:
    asyncio.run(_connect_reject_includes_reason_payload())


def test_engineio_socket_is_transport_live_closed_or_missing() -> None:
    from types import SimpleNamespace

    from api.routers.socketio_handler import engineio_socket_is_transport_live

    assert engineio_socket_is_transport_live(None) is False
    assert engineio_socket_is_transport_live(SimpleNamespace(closed=True, closing=False)) is False
    assert engineio_socket_is_transport_live(SimpleNamespace(closed=False, closing=True)) is False
    assert engineio_socket_is_transport_live(SimpleNamespace(closed=False, closing=False)) is True
