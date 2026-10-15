#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for SSO admin guard and logout body handling.
# Invariants:
# - Migration/diagnostic SSO helpers require app admin role.
# - Logout receives refresh tokens from JSON body, not query strings.
# Related:
# - api.routers.auth_keycloak
# ---

from __future__ import annotations

import pytest
from fastapi import HTTPException  # type: ignore[import-untyped]
from starlette.requests import Request  # type: ignore[import-untyped]

import api.routers.auth_keycloak as auth_keycloak
from api.core.auth import User
from api.routers.auth_keycloak import (
    OAuthCallbackRequest,
    SsoLogoutRequest,
    require_sso_admin_user,
    sso_callback,
    sso_logout,
)
from api.services.sso_session_registry import SsoSessionDecision


def _user(role: str) -> User:
    return User(id="user-1", email="user@example.com", username="user", role=role)


@pytest.mark.asyncio
async def test_sso_admin_guard_allows_application_admins() -> None:
    assert await require_sso_admin_user(_user("admin"))
    assert await require_sso_admin_user(_user("emperyworld_admin"))


@pytest.mark.asyncio
async def test_sso_admin_guard_rejects_regular_mobile_user() -> None:
    with pytest.raises(HTTPException) as exc:
        await require_sso_admin_user(_user("emperyworld_member"))

    assert exc.value.status_code == 403


class _LogoutProvider:
    def __init__(self) -> None:
        self.seen_refresh_token: str | None = None

    async def logout(self, refresh_token: str) -> bool:
        self.seen_refresh_token = refresh_token
        return True

    def get_logout_url(self, redirect_uri: str) -> str:
        return f"https://auth.example/logout?redirect_uri={redirect_uri}"


@pytest.mark.asyncio
async def test_sso_logout_uses_refresh_token_from_body() -> None:
    provider = _LogoutProvider()

    response = await sso_logout(
        SsoLogoutRequest(refresh_token="refresh-body", redirect_uri="world.empery.mobile:/oauth2redirect"),
        auth_provider=provider,  # type: ignore[arg-type]
    )

    assert provider.seen_refresh_token == "refresh-body"
    assert response["message"] == "Logout successful"
    assert response["logout_url"].startswith("https://auth.example/logout")


class _CallbackProvider:
    async def exchange_code_for_token(
        self,
        *,
        code: str,
        redirect_uri: str,
        code_verifier: str | None,
        client_id: str,
    ) -> dict[str, object]:
        assert code == "code-1"
        assert redirect_uri == "https://app.eliteew.ru/"
        assert code_verifier == "verifier-1"
        assert client_id == "empery-web"
        return {
            "access_token": "access-1",
            "refresh_token": "refresh-1",
            "expires_in": 300,
            "token_type": "Bearer",
            "id_token": "id-1",
        }

    async def get_user_info(self, _access_token: str) -> dict[str, object]:
        return {
            "sub": "kc-user-1",
            "preferred_username": "poet",
            "email": "poet@example.test",
            "email_verified": True,
            "realm_access": {"roles": ["user"]},
        }

    async def validate_token(self, _access_token: str) -> dict[str, object]:
        return {
            "sub": "kc-user-1",
            "sid": "sid-web-1",
            "preferred_username": "poet",
            "email": "poet@example.test",
            "azp": "empery-web",
            "auth_time": 100,
            "iat": 110,
        }


class _AllowingRegistry:
    def __init__(self) -> None:
        self.kwargs: dict[str, object] | None = None

    async def enforce_current_session(self, _payload: dict[str, object], **kwargs: object) -> SsoSessionDecision:
        self.kwargs = kwargs
        return SsoSessionDecision(allowed=True)


@pytest.mark.asyncio
async def test_sso_callback_returns_id_token_and_uses_replace_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    registry = _AllowingRegistry()
    monkeypatch.setattr(auth_keycloak, "get_sso_session_registry", lambda: registry)
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/sso/callback",
            "headers": [(b"user-agent", b"pytest")],
        }
    )

    response = await sso_callback(
        OAuthCallbackRequest(
            code="code-1",
            state="state-1",
            redirect_uri="https://app.eliteew.ru/",
            code_verifier="verifier-1",
        ),
        request,
        auth_provider=_CallbackProvider(),  # type: ignore[arg-type]
    )

    assert response["tokens"]["id_token"] == "id-1"
    assert registry.kwargs is not None
    assert registry.kwargs["oauth_client_id"] == "empery-web"
    assert registry.kwargs["allow_session_replace"] is True
