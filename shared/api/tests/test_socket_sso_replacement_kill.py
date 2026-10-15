# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# R-01 integration lock: SSO session replace must kill bound Socket.IO sids immediately (no zombies).
# Invariants:
# - Without notify_sso_session_replaced the binding survives (documents pre-fix failure mode).
# - With kill-switch: auth_error(session_replaced) then disconnect; binding cleared.
# Related:
# - api.services.socket_sso_session_watch; api.services.sso_session_registry
# - api.routers.socketio_handler.connect
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
    clear_socket_sso_binding,
    get_socket_sso_binding,
    register_socket_sso_binding,
    reset_socket_sso_bindings_for_tests,
)
from api.services.sso_session_registry import SsoSessionClaims, SsoSessionRegistry


def _browser_claims(session_id: str = "kc-sid-old") -> SsoSessionClaims:
    return SsoSessionClaims(
        keycloak_sub="kc-user-socket-r01",
        session_id=session_id,
        client_id="empery-web",
        client_class="browser",
        username="socket-r01",
        email="r01@test.local",
        auth_time_epoch=100,
        issued_at_epoch=110,
    )


def _browser_payload(session_id: str, *, auth_time: int = 101, iat: int = 111) -> dict[str, Any]:
    return {
        "sub": "kc-user-socket-r01",
        "sid": session_id,
        "azp": "empery-web",
        "auth_time": auth_time,
        "iat": iat,
        "preferred_username": "socket-r01",
        "email": "r01@test.local",
    }


class _AsyncContext:
    def __init__(self, value: Any = None) -> None:
        self._value = value

    async def __aenter__(self) -> Any:  # noqa: ANN401
        return self._value

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakeSsoConnection:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row
        self.replaced = False
        self.audit_events: list[str] = []

    def transaction(self) -> _AsyncContext:
        return _AsyncContext()

    async def fetchrow(self, _query: str, *_args: Any) -> dict[str, Any] | None:
        return self.row

    async def execute(self, query: str, *args: Any) -> str:
        if "INSERT INTO public.sso_session_audit_events" in query:
            self.audit_events.append(str(args[0]))
        if "SET current_session_id = $3" in query:
            self.replaced = True
        return "OK"


class _FakeSsoPool:
    def __init__(self, conn: _FakeSsoConnection) -> None:
        self.conn = conn

    def acquire(self) -> _AsyncContext:
        return _AsyncContext(self.conn)


async def _enforce_replace(
    monkeypatch: pytest.MonkeyPatch,
    *,
    old_session_id: str = "kc-sid-old",
    new_session_id: str = "kc-sid-new",
) -> _FakeSsoConnection:
    row = {
        "current_session_id": old_session_id,
        "auth_time_epoch": 100,
        "issued_at_epoch": 110,
        "user_agent": "Mozilla/5.0 Chrome/120",
    }
    conn = _FakeSsoConnection(row)
    pool = _FakeSsoPool(conn)

    async def _fake_get_pool() -> _FakeSsoPool:
        return pool

    monkeypatch.setattr("api.services.sso_session_registry_enforce.get_asyncpg_pool", _fake_get_pool)
    decision = await SsoSessionRegistry().enforce_current_session(
        _browser_payload(new_session_id),
        user_agent="Mozilla/5.0 Chrome/120",
        allow_session_replace=True,
        replace_confirm_header="1",
    )
    assert decision.allowed is True
    assert decision.replaced_session_id == old_session_id
    assert conn.replaced is True
    assert "sso_session_replaced" in conn.audit_events
    return conn


def _await_emit_args(emit_mock: AsyncMock) -> tuple[Any, ...]:
    await_args = emit_mock.await_args
    assert await_args is not None
    return await_args.args


@pytest.fixture(autouse=True)
def reset_bindings_fixture() -> Iterator[None]:
    reset_socket_sso_bindings_for_tests()
    yield
    reset_socket_sso_bindings_for_tests()


@pytest.mark.asyncio
async def test_socket_sso_replace_zombie_without_kill_switch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Phase 0 evidence: without notify, registry replace leaves socket binding alive (zombie)."""
    sid = "sid-token-a-zombie"
    register_socket_sso_binding(sid, _browser_claims("kc-sid-old"))

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()

    async def _noop_notify(**_kwargs: Any) -> int:
        return 0

    monkeypatch.setattr(
        "api.services.socket_sso_session_watch.notify_sso_session_replaced",
        _noop_notify,
    )

    with (
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
    ):
        await _enforce_replace(monkeypatch)

    binding = get_socket_sso_binding(sid)
    assert binding is not None
    assert binding.session_id == "kc-sid-old"
    emit_mock.assert_not_awaited()
    disconnect_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_socket_sso_replace_kill_switch_on_registry_replace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R-01 fix proof: registry replace notifies watch → auth_error + disconnect + binding cleared."""
    sid = "sid-token-a-killed"
    register_socket_sso_binding(sid, _browser_claims("kc-sid-old"))

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()

    with (
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
    ):
        await _enforce_replace(monkeypatch)

    emit_mock.assert_awaited_once()
    emit_args = _await_emit_args(emit_mock)
    assert emit_args[0] == "auth_error"
    payload = emit_args[1]
    assert payload["reason"] == AUTH_REASON_SESSION_REPLACED
    assert payload["error"] == "unauthorized"
    disconnect_mock.assert_awaited_once_with(sid)
    assert get_socket_sso_binding(sid) is None


@pytest.mark.asyncio
async def test_socket_sso_replace_does_not_kill_unrelated_session_sids(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: sockets bound to a different session_id stay connected."""
    sid_old = "sid-bound-old"
    sid_other = "sid-bound-other"
    register_socket_sso_binding(sid_old, _browser_claims("kc-sid-old"))
    register_socket_sso_binding(sid_other, _browser_claims("kc-sid-other"))

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()

    with (
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
    ):
        await _enforce_replace(monkeypatch)

    disconnect_mock.assert_awaited_once_with(sid_old)
    assert get_socket_sso_binding(sid_old) is None
    other = get_socket_sso_binding(sid_other)
    assert other is not None
    assert other.session_id == "kc-sid-other"


@pytest.mark.asyncio
async def test_socket_sso_replace_connect_registers_then_replace_kills(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end: connect(token_A) registers sid → registry replace kills that sid only."""
    sid = "sid-connect-token-a"
    token_payload = _browser_payload("kc-sid-old", auth_time=100, iat=110)

    fake_user = MagicMock(id="db-user-r01")
    fake_provider = MagicMock(validate_token=AsyncMock(return_value=token_payload))

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()

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
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
        patch.object(socketio_handler.sio, "enter_room", AsyncMock()),
    ):
        ok = await socketio_handler.connect(
            sid=sid,
            environ={"HTTP_USER_AGENT": "Mozilla/5.0"},
            auth={"token": "access-token-a"},
        )
        assert ok is True
        assert get_socket_sso_binding(sid) is not None

        emit_mock.reset_mock()
        disconnect_mock.reset_mock()
        await _enforce_replace(monkeypatch)

    emit_mock.assert_awaited_once()
    emit_args = _await_emit_args(emit_mock)
    assert emit_args[0] == "auth_error"
    assert emit_args[1]["reason"] == AUTH_REASON_SESSION_REPLACED
    disconnect_mock.assert_awaited_once_with(sid)
    assert get_socket_sso_binding(sid) is None


def test_socket_sso_replace_disconnect_clears_session_mapping() -> None:
    """Cleanup: natural disconnect removes sid from session_id → sids map (no leak)."""
    sid = "sid-natural-disconnect"
    register_socket_sso_binding(sid, _browser_claims("kc-sid-cleanup"))
    assert get_socket_sso_binding(sid) is not None

    async def _run() -> None:
        with patch(
            "api.services.presence_service.record_disconnect",
            new=AsyncMock(),
        ):
            await socketio_handler.disconnect(sid)

    asyncio.run(_run())
    assert get_socket_sso_binding(sid) is None


def test_socket_sso_replace_reregister_moves_sid_bucket() -> None:
    """Re-connect same sid with new session_id moves mapping without duplicate entries."""
    sid = "sid-reregister"
    register_socket_sso_binding(sid, _browser_claims("kc-sid-first"))
    register_socket_sso_binding(sid, _browser_claims("kc-sid-second"))
    binding = get_socket_sso_binding(sid)
    assert binding is not None
    assert binding.session_id == "kc-sid-second"
    clear_socket_sso_binding(sid)
    assert get_socket_sso_binding(sid) is None


def test_replace_confirm_from_socket_auth_normalizes_handshake_flag() -> None:
    from api.core.websocket_auth import replace_confirm_from_socket_auth

    assert replace_confirm_from_socket_auth({"sso_replace_confirm": 1}) == "1"
    assert replace_confirm_from_socket_auth({"sso_replace_confirm": True}) == "1"
    assert replace_confirm_from_socket_auth({"sso_replace_confirm": "confirm"}) == "confirm"
    assert replace_confirm_from_socket_auth({}) is None


@pytest.mark.asyncio
async def test_websocket_token_forwards_sso_replace_confirm_to_registry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R-01 sync-lock: Socket handshake confirm must set allow_session_replace on registry enforce."""
    from api.core.websocket_auth import validate_websocket_token

    payload = _browser_payload("kc-sid-new", auth_time=101, iat=111)
    calls: list[dict[str, Any]] = []

    class _FakeAuthProvider:
        async def validate_token(self, _token: str) -> dict[str, Any]:
            return payload

    class _FakeRegistry:
        async def enforce_current_session(self, registry_payload: dict[str, Any], **kwargs: Any) -> Any:
            calls.append(kwargs)
            from api.services.sso_session_registry import SsoSessionDecision, sso_claims_from_payload

            return SsoSessionDecision(allowed=True, claims=sso_claims_from_payload(registry_payload))

    monkeypatch.setattr("api.core.websocket_auth.get_sso_session_registry", lambda: _FakeRegistry())

    user, reason = await validate_websocket_token(
        "access-token",
        _FakeAuthProvider(),  # type: ignore[arg-type]
        connect_user_agent="Mozilla/5.0 Chrome/120",
        replace_confirm_header="1",
    )
    assert user is not None
    assert reason is None
    assert calls
    assert calls[0]["allow_session_replace"] is True
    assert calls[0]["replace_confirm_header"] == "1"


@pytest.mark.asyncio
async def test_socket_sso_replace_confirm_handshake_old_killed_new_connects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end: connect with sso_replace_confirm replaces registry and kills old bound sid."""
    sid_old = "sid-handshake-old"
    sid_new = "sid-handshake-new"
    register_socket_sso_binding(sid_old, _browser_claims("kc-sid-old"))

    row = {
        "current_session_id": "kc-sid-old",
        "auth_time_epoch": 100,
        "issued_at_epoch": 110,
        "user_agent": "Mozilla/5.0 Chrome/120",
    }
    conn = _FakeSsoConnection(row)
    pool = _FakeSsoPool(conn)

    async def _fake_get_pool() -> _FakeSsoPool:
        return pool

    monkeypatch.setattr("api.services.sso_session_registry_enforce.get_asyncpg_pool", _fake_get_pool)

    token_payload = _browser_payload("kc-sid-new", auth_time=101, iat=111)
    fake_provider = MagicMock(validate_token=AsyncMock(return_value=token_payload))

    emit_mock = AsyncMock()
    disconnect_mock = AsyncMock()

    with (
        patch(
            "api.services.auth_provider_service.get_auth_provider_service",
            return_value=fake_provider,
        ),
        patch(
            "api.core.websocket_auth.resolve_db_user_id_by_email",
            new=AsyncMock(return_value=None),
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
        patch.object(socketio_handler.sio, "emit", emit_mock),
        patch.object(socketio_handler.sio, "disconnect", disconnect_mock),
        patch.object(socketio_handler.sio, "enter_room", AsyncMock()),
    ):
        ok = await socketio_handler.connect(
            sid=sid_new,
            environ={"HTTP_USER_AGENT": "Mozilla/5.0 Chrome/120"},
            auth={"token": "access-token-b", "sso_replace_confirm": 1},
        )

    assert ok is True
    disconnect_mock.assert_awaited_once_with(sid_old)
    auth_errors = [c for c in emit_mock.await_args_list if c.args[0] == "auth_error"]
    assert len(auth_errors) == 1
    assert auth_errors[0].args[1]["reason"] == AUTH_REASON_SESSION_REPLACED
    assert get_socket_sso_binding(sid_old) is None
    new_binding = get_socket_sso_binding(sid_new)
    assert new_binding is not None
    assert new_binding.session_id == "kc-sid-new"
    confirmed = [c for c in emit_mock.await_args_list if c.args[0] == "sso_replace_confirmed"]
    assert len(confirmed) == 1
    assert conn.replaced is True
