# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ASGI contract tests for KBSEW gateway auth: 401/403 and admin vs
# client service-token (token alone must not bypass admin; token must not be forwarded).
# Invariants:
# - Management routes require require_admin_user; do not weaken auth.
# - Gateway strips client X-KBSEW-Service-Token (kbsew_client injects server-side only).
# Related:
# - api/routers/kbsew_gateway.py
# - api/routers/admin_auth.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.kbsew_gateway import router as kbsew_gateway_router


def _user(role: str) -> User:
    return User(id=str(uuid4()), email="kbsew@test", username="kbsew", role=role)


def _gateway_app(*, role: str | None) -> FastAPI:
    """role=None → simulate missing OAuth (401)."""
    app = FastAPI()
    app.include_router(kbsew_gateway_router)

    async def fake_session() -> AsyncSession:
        return MagicMock(spec=AsyncSession)

    app.dependency_overrides[get_postgres_session] = fake_session

    if role is None:

        async def deny_oauth() -> User:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        app.dependency_overrides[require_oauth2_user] = deny_oauth
    else:

        async def fake_oauth_user() -> User:
            return _user(role)

        app.dependency_overrides[require_oauth2_user] = fake_oauth_user

    return app


class _FakeProxiedResponse:
    def __init__(self, *, status_code: int = 200, content: bytes | None = None) -> None:
        self.status_code = status_code
        self.content = content if content is not None else b'{"driver_types":[]}'
        self.headers = {"content-type": "application/json"}


class _FakeAsyncClient:
    last_request: dict[str, Any] | None = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._args = args
        self._kwargs = kwargs

    async def __aenter__(self) -> _FakeAsyncClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def request(self, method: str, url: str, **kwargs: Any) -> _FakeProxiedResponse:
        type(self).last_request = {"method": method, "url": url, **kwargs}
        # Match path shape expected by gateway response_model validation.
        if url.rstrip("/").endswith("/barrels"):
            return _FakeProxiedResponse(content=b"[]")
        if url.rstrip("/").endswith("/drivers"):
            return _FakeProxiedResponse(content=b'{"driver_types":["pdf"]}')
        return _FakeProxiedResponse()

    async def post(self, url: str, **kwargs: Any) -> _FakeProxiedResponse:
        type(self).last_request = {"method": "POST", "url": url, **kwargs}
        return _FakeProxiedResponse()


@pytest.mark.unit
def test_kbsew_gateway_drivers_unauthenticated_returns_401() -> None:
    client = TestClient(_gateway_app(role=None), raise_server_exceptions=False)
    response = client.get("/api/v1/kbsew/drivers")
    assert response.status_code == 401


@pytest.mark.unit
def test_kbsew_gateway_barrels_non_admin_returns_403() -> None:
    client = TestClient(_gateway_app(role="emperyworld_member"), raise_server_exceptions=False)
    response = client.get("/api/v1/kbsew/barrels")
    assert response.status_code == 403
    assert "Administrator" in str(response.json().get("detail", ""))


@pytest.mark.unit
def test_kbsew_gateway_service_token_alone_does_not_bypass_admin() -> None:
    """X-KBSEW-Service-Token alone must not authenticate the gateway."""
    client = TestClient(_gateway_app(role=None), raise_server_exceptions=False)
    response = client.get(
        "/api/v1/kbsew/drivers",
        headers={"X-KBSEW-Service-Token": "test-service-token"},
    )
    assert response.status_code == 401


@pytest.mark.unit
def test_kbsew_gateway_admin_strips_client_service_token_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _FakeAsyncClient.last_request = None
    monkeypatch.setattr("api.routers.kbsew_gateway.httpx.AsyncClient", _FakeAsyncClient)

    client = TestClient(_gateway_app(role="admin"), raise_server_exceptions=False)
    response = client.get(
        "/api/v1/kbsew/drivers",
        headers={
            "Authorization": "Bearer admin-jwt",
            "X-KBSEW-Service-Token": "leaked-or-client-token",
        },
    )
    assert response.status_code == 200
    assert _FakeAsyncClient.last_request is not None
    fwd = _FakeAsyncClient.last_request.get("headers") or {}
    assert fwd.get("authorization") == "Bearer admin-jwt"
    assert "X-KBSEW-Service-Token" not in fwd
    assert "x-kbsew-service-token" not in {k.lower() for k in fwd}


@pytest.mark.unit
def test_kbsew_gateway_emperyworld_admin_allowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _FakeAsyncClient.last_request = None
    monkeypatch.setattr("api.routers.kbsew_gateway.httpx.AsyncClient", _FakeAsyncClient)

    client = TestClient(_gateway_app(role="emperyworld_admin"), raise_server_exceptions=False)
    response = client.get("/api/v1/kbsew/barrels")
    assert response.status_code == 200
    assert _FakeAsyncClient.last_request is not None
    assert _FakeAsyncClient.last_request["method"] == "GET"
