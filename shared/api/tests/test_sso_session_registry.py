#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit coverage for SSO session replacement decisions, enforcement, and WebSocket auth semantics.
# Invariants:
# - No network or database access; tests exercise the boundary where stale sessions can be silently accepted.
# Related:
# - api.services.sso_session_registry; api.core.websocket_auth
# ---
"""SSO session registry helpers."""

from __future__ import annotations

import asyncio
import base64
import json
from typing import Any

import pytest

from api.core.auth_errors import AUTH_REASON_SESSION_REPLACED, ws_close_reason
from api.core.token_roles import token_roles_list
from api.core.websocket_auth import validate_websocket_token
from api.services.sso_session_registry import (
    SsoSessionDecision,
    SsoSessionRegistry,
    client_class_for_client_id,
    enrich_sso_payload_for_registry,
    enrich_sso_payload_from_token_response,
    is_ewpower_operator_client_id,
    public_client_id_for_redirect_uri,
    should_replace_existing_session,
    should_require_session_replace_confirmation,
    sso_claims_from_payload,
)


def _fake_id_token(payload: dict[str, object]) -> str:
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"eyJhbGciOiJub25lIn0.{body}."


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
        self.fetchrow_args: tuple[Any, ...] | None = None
        self.audit_events: list[str] = []
        self.replaced = False
        self.touched_current = False

    def transaction(self) -> _AsyncContext:
        return _AsyncContext()

    async def fetchrow(self, _query: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_args = args
        return self.row

    async def execute(self, query: str, *args: Any) -> str:
        if "INSERT INTO public.sso_session_audit_events" in query:
            self.audit_events.append(str(args[0]))
        if "SET current_session_id = $3" in query:
            self.replaced = True
        if "SET last_seen_at = now()" in query:
            self.touched_current = True
        return "OK"


class _FakeSsoPool:
    def __init__(self, conn: _FakeSsoConnection) -> None:
        self.conn = conn

    def acquire(self) -> _AsyncContext:
        return _AsyncContext(self.conn)


def _patch_sso_pool(monkeypatch: pytest.MonkeyPatch, row: dict[str, Any] | None) -> _FakeSsoConnection:
    conn = _FakeSsoConnection(row)
    pool = _FakeSsoPool(conn)

    async def _fake_get_pool() -> _FakeSsoPool:
        return pool

    monkeypatch.setattr("api.services.sso_session_registry_enforce.get_asyncpg_pool", _fake_get_pool)
    return conn


def _browser_payload(session_id: str, *, auth_time: int = 100, iat: int = 110) -> dict[str, Any]:
    return {
        "sub": "kc-user-1",
        "sid": session_id,
        "azp": "empery-web",
        "auth_time": auth_time,
        "iat": iat,
        "preferred_username": "keysray",
        "email": "keysray@example.com",
    }


def _mobile_payload(session_id: str, *, auth_time: int = 100, iat: int = 110) -> dict[str, Any]:
    payload = _browser_payload(session_id, auth_time=auth_time, iat=iat)
    payload["azp"] = "empery-mobile"
    return payload


def _desktop_payload(session_id: str, *, auth_time: int = 100, iat: int = 110) -> dict[str, Any]:
    payload = _browser_payload(session_id, auth_time=auth_time, iat=iat)
    payload.update(
        {
            "azp": "empery-desktop",
            "acr": "eliteew-device-bound",
            "eliteew_binding_id": "bind_opaque_1",
            "eliteew_binding_epoch": 3,
            "cnf": {"jkt": "thumbprint"},
        }
    )
    return payload


async def _enforce_with_fake_pool(
    monkeypatch: pytest.MonkeyPatch,
    row: dict[str, Any] | None,
    payload: dict[str, Any],
    **kwargs: Any,
) -> tuple[SsoSessionDecision, _FakeSsoConnection]:
    conn = _patch_sso_pool(monkeypatch, row)
    decision = await SsoSessionRegistry().enforce_current_session(
        payload, user_agent="Mozilla/5.0 Chrome/120", **kwargs
    )
    return decision, conn


@pytest.mark.unit
def test_mobile_redirect_uses_mobile_public_client() -> None:
    assert public_client_id_for_redirect_uri("world.empery.mobile:/oauth2redirect") == "empery-mobile"
    assert public_client_id_for_redirect_uri("world.empery.mobile.dev:/oauth2redirect") == "empery-mobile"


@pytest.mark.unit
def test_browser_redirect_uses_web_public_client() -> None:
    assert public_client_id_for_redirect_uri("https://app.eliteew.ru/") == "empery-web"


@pytest.mark.unit
def test_sso_claims_classifies_mobile_azp() -> None:
    claims = sso_claims_from_payload(
        {
            "sub": "user-1",
            "sid": "sid-mobile",
            "azp": "empery-mobile",
            "auth_time": 10,
            "iat": 12,
            "preferred_username": "poet",
        }
    )
    assert claims is not None
    assert claims.client_class == "mobile"
    assert claims.client_id == "empery-mobile"


@pytest.mark.unit
def test_token_roles_include_mobile_client_roles() -> None:
    payload = {"resource_access": {"empery-mobile": {"roles": ["msi"]}}}
    assert token_roles_list(payload) == ["msi"]


@pytest.mark.unit
def test_sso_claims_defaults_unknown_public_client_to_browser() -> None:
    claims = sso_claims_from_payload({"sub": "user-1", "session_state": "sid-web", "azp": "legacy-web"})
    assert claims is not None
    assert claims.client_class == "browser"
    assert claims.client_id == "empery-web"
    assert client_class_for_client_id("empery-web") == "browser"


@pytest.mark.unit
def test_sso_claims_prefers_oauth_client_id_for_mobile_callback() -> None:
    claims = sso_claims_from_payload(
        {
            "sub": "user-1",
            "sid": "sid-mobile",
            "azp": "empery-web",
            "auth_time": 10,
            "iat": 12,
        },
        oauth_client_id="empery-mobile",
    )
    assert claims is not None
    assert claims.client_class == "mobile"
    assert claims.client_id == "empery-mobile"


@pytest.mark.unit
def test_enrich_sso_payload_takes_sid_from_id_token() -> None:
    access = {"sub": "user-1", "azp": "empery-mobile"}
    token_response = {"id_token": _fake_id_token({"sid": "sid-from-id-token", "sub": "user-1"})}
    enriched = enrich_sso_payload_from_token_response(access, token_response)
    claims = sso_claims_from_payload(enriched, oauth_client_id="empery-mobile")
    assert claims is not None
    assert claims.session_id == "sid-from-id-token"
    assert claims.client_class == "mobile"


@pytest.mark.unit
def test_enrich_sso_payload_uses_userinfo_when_access_token_lacks_sub() -> None:
    access = {"azp": "empery-mobile"}
    token_response = {
        "id_token": _fake_id_token({"sid": "sid-mobile", "sub": "kc-sub-1", "preferred_username": "poet"})
    }
    user_info = {"sub": "kc-sub-1", "preferred_username": "poet", "email": "poet@example.com"}
    enriched = enrich_sso_payload_for_registry(access, token_response=token_response, user_info=user_info)
    claims = sso_claims_from_payload(enriched, oauth_client_id="empery-mobile")
    assert claims is not None
    assert claims.keycloak_sub == "kc-sub-1"
    assert claims.session_id == "sid-mobile"
    assert claims.username == "poet"
    assert claims.client_class == "mobile"


@pytest.mark.unit
def test_sso_session_live_window_is_shorter_than_active() -> None:
    from datetime import UTC, datetime, timedelta

    from api.services.sso_session_claims import (
        SSO_SESSION_ACTIVE_WINDOW,
        SSO_SESSION_LIVE_WINDOW,
    )
    from api.services.sso_session_registry_query import (
        _session_row_is_active,
        _session_row_is_live,
    )

    assert SSO_SESSION_LIVE_WINDOW < SSO_SESSION_ACTIVE_WINDOW
    recent = datetime.now(UTC) - timedelta(minutes=1)
    stale = datetime.now(UTC) - timedelta(minutes=10)
    assert _session_row_is_live(recent) is True
    assert _session_row_is_active(recent) is True
    assert _session_row_is_live(stale) is False
    assert _session_row_is_active(stale) is True


@pytest.mark.unit
def test_replacement_decision_prefers_newer_auth_time_and_iat() -> None:
    assert (
        should_replace_existing_session(
            existing_auth_time_epoch=100,
            existing_issued_at_epoch=105,
            incoming_auth_time_epoch=101,
            incoming_issued_at_epoch=101,
        )
        is True
    )
    assert (
        should_replace_existing_session(
            existing_auth_time_epoch=100,
            existing_issued_at_epoch=105,
            incoming_auth_time_epoch=100,
            incoming_issued_at_epoch=106,
        )
        is True
    )
    assert (
        should_replace_existing_session(
            existing_auth_time_epoch=100,
            existing_issued_at_epoch=105,
            incoming_auth_time_epoch=99,
            incoming_issued_at_epoch=120,
        )
        is False
    )


@pytest.mark.unit
def test_browser_session_replace_requires_explicit_confirmation_header() -> None:
    ua = "Mozilla/5.0 Chrome/120"
    assert (
        should_require_session_replace_confirmation(
            client_class="browser",
            replace_confirm_header=None,
            existing_user_agent=ua,
            incoming_user_agent="Mozilla/5.0 Firefox/121",
        )
        is True
    )
    assert (
        should_require_session_replace_confirmation(
            client_class="browser",
            replace_confirm_header=None,
            existing_user_agent=ua,
            incoming_user_agent=ua,
        )
        is True
    )
    assert (
        should_require_session_replace_confirmation(
            client_class="browser",
            replace_confirm_header="1",
            existing_user_agent=ua,
            incoming_user_agent="Mozilla/5.0 Firefox/121",
        )
        is False
    )


@pytest.mark.unit
def test_mobile_session_replace_does_not_require_browser_confirmation() -> None:
    assert (
        should_require_session_replace_confirmation(
            client_class="mobile",
            replace_confirm_header=None,
        )
        is False
    )


@pytest.mark.unit
def test_ewpower_web_client_skips_browser_sso_slot_classification() -> None:
    assert is_ewpower_operator_client_id("ewpower-web") is True
    assert is_ewpower_operator_client_id("empery-web") is False
    assert client_class_for_client_id("ewpower-web") == "browser"


@pytest.mark.unit
def test_current_registry_session_is_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    row = {
        "current_session_id": "sid-current",
        "auth_time_epoch": 100,
        "issued_at_epoch": 110,
        "user_agent": "Mozilla/5.0 Chrome/120",
    }
    decision, conn = asyncio.run(_enforce_with_fake_pool(monkeypatch, row, _browser_payload("sid-current")))

    assert decision.allowed is True
    assert decision.claims is not None
    assert decision.claims.client_class == "browser"
    assert conn.touched_current is True
    assert conn.replaced is False


@pytest.mark.unit
def test_normal_api_check_rejects_newer_non_current_browser_sid_without_replacing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = {
        "current_session_id": "sid-current",
        "auth_time_epoch": 100,
        "issued_at_epoch": 110,
        "user_agent": "Mozilla/5.0 Chrome/120",
    }
    decision, conn = asyncio.run(
        _enforce_with_fake_pool(
            monkeypatch,
            row,
            _browser_payload("sid-newer", auth_time=101, iat=111),
        )
    )

    assert decision.allowed is False
    assert decision.reason == "session_replaced"
    assert decision.replaced_session_id == "sid-current"
    assert conn.replaced is False
    assert conn.audit_events == ["sso_session_rejected"]


@pytest.mark.unit
def test_callback_replace_requires_browser_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.sso_session_registry_enforce.fofline_browser_xor_policy",
        lambda: "off",
    )
    row = {
        "current_session_id": "sid-current",
        "auth_time_epoch": 100,
        "issued_at_epoch": 110,
        "user_agent": "Mozilla/5.0 Chrome/120",
    }
    decision, conn = asyncio.run(
        _enforce_with_fake_pool(
            monkeypatch,
            row,
            _browser_payload("sid-newer", auth_time=101, iat=111),
            allow_session_replace=True,
        )
    )

    assert decision.allowed is False
    assert decision.reason == "session_replace_confirmation_required"
    assert conn.replaced is False
    assert conn.audit_events == ["sso_session_replace_confirmation_required"]

    confirmed_decision, confirmed_conn = asyncio.run(
        _enforce_with_fake_pool(
            monkeypatch,
            row,
            _browser_payload("sid-newer", auth_time=101, iat=111),
            allow_session_replace=True,
            replace_confirm_header="1",
        )
    )

    assert confirmed_decision.allowed is True
    assert confirmed_decision.replaced_session_id == "sid-current"
    assert confirmed_conn.replaced is True
    assert confirmed_conn.audit_events == ["sso_session_replaced"]


@pytest.mark.unit
def test_mobile_replacement_uses_mobile_class_without_browser_confirmation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = {
        "current_session_id": "sid-mobile-current",
        "auth_time_epoch": 100,
        "issued_at_epoch": 110,
        "user_agent": "okhttp/4.12",
    }
    decision, conn = asyncio.run(
        _enforce_with_fake_pool(
            monkeypatch,
            row,
            _mobile_payload("sid-mobile-newer", auth_time=101, iat=111),
            allow_session_replace=True,
        )
    )

    assert decision.allowed is True
    assert decision.claims is not None
    assert decision.claims.client_class == "mobile"
    assert conn.fetchrow_args == ("kc-user-1", "mobile")
    assert conn.replaced is True


@pytest.mark.unit
def test_websocket_auth_rejects_replaced_session_without_starting_replace_flow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _browser_payload("sid-newer", auth_time=101, iat=111)
    calls: list[dict[str, Any]] = []

    class _FakeAuthProvider:
        async def validate_token(self, _token: str) -> dict[str, Any]:
            return payload

    class _FakeRegistry:
        async def enforce_current_session(self, registry_payload: dict[str, Any], **kwargs: Any) -> SsoSessionDecision:
            calls.append(kwargs)
            return SsoSessionDecision(
                allowed=False,
                claims=sso_claims_from_payload(registry_payload),
                replaced_session_id="sid-current",
                reason="session_replaced",
            )

    monkeypatch.setattr("api.core.websocket_auth.get_sso_session_registry", lambda: _FakeRegistry())

    user, reason = asyncio.run(
        validate_websocket_token(
            "access-token",
            _FakeAuthProvider(),  # type: ignore[arg-type]
            connect_user_agent="Mozilla/5.0 Chrome/120",
        )
    )

    assert user is None
    assert reason == ws_close_reason(AUTH_REASON_SESSION_REPLACED)
    assert calls
    assert calls[0].get("allow_session_replace") in (None, False)


@pytest.mark.asyncio
async def test_websocket_token_with_replace_confirm_sets_allow_session_replace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _browser_payload("sid-newer", auth_time=101, iat=111)
    calls: list[dict[str, Any]] = []

    class _FakeAuthProvider:
        async def validate_token(self, _token: str) -> dict[str, Any]:
            return payload

    class _FakeRegistry:
        async def enforce_current_session(self, registry_payload: dict[str, Any], **kwargs: Any) -> SsoSessionDecision:
            calls.append(kwargs)
            return SsoSessionDecision(
                allowed=True,
                claims=sso_claims_from_payload(registry_payload),
            )

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
    assert calls[0].get("allow_session_replace") is True
    assert calls[0].get("replace_confirm_header") == "1"


@pytest.mark.asyncio
async def test_websocket_verified_native_binding_can_register_new_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _desktop_payload("sid-desktop-new", auth_time=101, iat=111)
    calls: list[dict[str, Any]] = []

    class _FakeAuthProvider:
        async def validate_token(self, _token: str) -> dict[str, Any]:
            return payload

    class _FakeRegistry:
        async def enforce_current_session(
            self,
            registry_payload: dict[str, Any],
            **kwargs: Any,
        ) -> SsoSessionDecision:
            calls.append(kwargs)
            return SsoSessionDecision(
                allowed=True,
                claims=sso_claims_from_payload(registry_payload),
                replaced_session_id="sid-desktop-old",
            )

    async def _verified_native_pep(_payload: dict[str, Any]) -> bool:
        return True

    monkeypatch.setattr("api.core.websocket_auth.get_sso_session_registry", lambda: _FakeRegistry())
    monkeypatch.setattr(
        "api.core.websocket_auth.enforce_native_access_pep",
        _verified_native_pep,
    )

    user, reason = await validate_websocket_token(
        "access-token",
        _FakeAuthProvider(),  # type: ignore[arg-type]
        connect_user_agent="EliteEW Desktop",
    )

    assert user is not None
    assert reason is None
    assert calls
    assert calls[0].get("allow_session_replace") is True
    assert calls[0].get("replace_confirm_header") is None
