# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Socket.IO runtime SSO revalidation (audit A-01): replaced sessions must lose active channels.
# Invariants:
# - No real Socket.IO server; sio.emit/disconnect are mocked.
# - Stale sid receives auth_error with reason session_replaced before disconnect.
# Related:
# - api.services.socket_sso_session_watch
# - api.routers.socketio_handler.emperyworld_client_heartbeat
# ---

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.core.auth_errors import AUTH_REASON_SESSION_REPLACED
from api.routers import socketio_handler
from api.services.socket_sso_session_watch import (
    notify_sso_session_replaced,
    register_socket_sso_binding,
    reset_socket_sso_bindings_for_tests,
)
from api.services.sso_session_registry import SsoSessionClaims


def _browser_claims(session_id: str = "kc-sid-old") -> SsoSessionClaims:
    return SsoSessionClaims(
        keycloak_sub="kc-user-websocket",
        session_id=session_id,
        client_id="empery-web",
        client_class="browser",
        username="socket-user",
        email="socket@test.local",
        auth_time_epoch=100,
        issued_at_epoch=110,
    )


def _await_call_args(mock: AsyncMock) -> tuple[Any, ...]:
    """Type-safe access to the single awaited call args on an AsyncMock."""
    await_args = mock.await_args
    assert await_args is not None
    return await_args.args


@pytest.fixture(autouse=True)
def reset_bindings_fixture() -> Iterator[None]:
    reset_socket_sso_bindings_for_tests()
    yield
    reset_socket_sso_bindings_for_tests()


@pytest.mark.asyncio
async def test_session_replacement_disconnects_bound_socket_with_auth_error() -> None:
    """Event-driven path: registry replace notifies watch → auth_error + disconnect."""
    sid = "sid-stale-after-replace"
    register_socket_sso_binding(sid, _browser_claims("kc-sid-old"))

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()
    with (
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
    ):
        disconnected = await notify_sso_session_replaced(
            keycloak_sub="kc-user-websocket",
            client_class="browser",
            replaced_session_id="kc-sid-old",
        )

    assert disconnected == 1
    emit_mock.assert_awaited_once()
    emit_args = _await_call_args(emit_mock)
    assert emit_args[0] == "auth_error"
    payload = emit_args[1]
    assert payload["reason"] == AUTH_REASON_SESSION_REPLACED
    assert payload["error"] == "unauthorized"
    disconnect_mock.assert_awaited_once_with(sid)


@pytest.mark.asyncio
async def test_heartbeat_disconnects_when_registry_session_no_longer_matches() -> None:
    """Runtime heartbeat path: lookup shows new current_session_id → disconnect stale sid."""
    sid = "sid-heartbeat-stale"
    register_socket_sso_binding(sid, _browser_claims("kc-sid-old"))

    registry = MagicMock()
    registry.lookup_current_session_id = AsyncMock(return_value="kc-sid-new")

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()
    touch_mock = AsyncMock()

    with (
        patch(
            "api.services.sso_session_registry.get_sso_session_registry",
            return_value=registry,
        ),
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
        patch(
            "api.services.presence_service.touch_heartbeat",
            touch_mock,
        ),
    ):
        await socketio_handler.emperyworld_client_heartbeat(sid, {})

    emit_mock.assert_awaited_once()
    emit_args = _await_call_args(emit_mock)
    assert emit_args[0] == "auth_error"
    assert emit_args[1]["reason"] == AUTH_REASON_SESSION_REPLACED
    disconnect_mock.assert_awaited_once_with(sid)
    touch_mock.assert_not_awaited()
    from api.services.socket_sso_session_watch import get_socket_sso_binding

    assert get_socket_sso_binding(sid) is None


@pytest.mark.asyncio
async def test_heartbeat_keeps_valid_session_and_extends_presence() -> None:
    sid = "sid-heartbeat-valid"
    register_socket_sso_binding(sid, _browser_claims("kc-sid-current"))

    registry = MagicMock()
    registry.lookup_current_session_id = AsyncMock(return_value="kc-sid-current")

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()
    touch_mock = AsyncMock()

    with (
        patch(
            "api.services.sso_session_registry.get_sso_session_registry",
            return_value=registry,
        ),
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
        patch(
            "api.services.presence_service.touch_heartbeat",
            touch_mock,
        ),
    ):
        await socketio_handler.emperyworld_client_heartbeat(sid, {})

    emit_mock.assert_not_awaited()
    disconnect_mock.assert_not_awaited()
    touch_mock.assert_awaited_once_with(sid)
    registry.lookup_current_session_id.assert_awaited_once()


def test_connect_registers_sso_binding_when_token_has_sid_claims() -> None:
    """Layer B: successful connect with sid registers binding for later revalidation."""
    payload = {
        "sub": "kc-user-websocket",
        "sid": "kc-sid-connect",
        "azp": "empery-web",
        "preferred_username": "socket-user",
        "email": "socket@test.local",
        "auth_time": 100,
        "iat": 110,
    }

    async def _run() -> None:
        fake_user = MagicMock(id="db-user-1")
        fake_provider = MagicMock(validate_token=AsyncMock(return_value=payload))
        with (
            patch(
                "api.services.auth_provider_service.get_auth_provider_service",
                return_value=fake_provider,
            ),
            patch(
                "api.core.websocket_auth.validate_websocket_token",
                new=AsyncMock(return_value=(fake_user, None)),
            ),
            patch(
                "api.services.client_build_service.validate_client_build",
                return_value=(True, None),
            ),
            patch(
                "api.services.client_build_service.get_server_app_build_id",
                return_value="test-build",
            ),
            patch(
                "api.services.presence_service.try_claim_browser_socket_lease",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "api.services.presence_service.record_connect",
                new=AsyncMock(),
            ),
            patch.object(socketio_handler.sio, "emit", AsyncMock()),
            patch.object(socketio_handler.sio, "enter_room", AsyncMock()),
        ):
            ok = await socketio_handler.connect(
                sid="sid-connect-bind",
                environ={"HTTP_USER_AGENT": "Mozilla/5.0"},
                auth={"token": "access-token"},
            )
        assert ok is True
        from api.services.socket_sso_session_watch import get_socket_sso_binding

        binding = get_socket_sso_binding("sid-connect-bind")
        assert binding is not None
        assert binding.session_id == "kc-sid-connect"
        assert binding.keycloak_sub == "kc-user-websocket"

    asyncio.run(_run())
