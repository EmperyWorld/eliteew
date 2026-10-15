#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Keycloak refresh error classification (invalid token vs provider unavailable).
# Invariants:
# - No live Keycloak calls; tests patch HTTP client and assert machine-readable auth detail.
# Related:
# - api.services.keycloak_service.KeycloakService.refresh_token; api.core.auth_errors
# ---
"""Unit tests for Keycloak refresh error mapping."""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import httpx
import pytest
from fastapi import HTTPException, status

from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_ACTION_REFRESH,
    AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
    AUTH_REASON_TOKEN_EXPIRED,
)
from api.services.keycloak_service import KeycloakService


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, str] | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {}

    def json(self) -> dict[str, str]:
        return self._payload


async def _refresh_invalid_grant_returns_401() -> None:
    svc = KeycloakService()

    class _FakeClient:
        async def post(self, *_args, **_kwargs):  # type: ignore[no-untyped-def]
            return _FakeResponse(status_code=400, payload={"error": "invalid_grant"})

    with patch("api.services.keycloak_service.get_httpx_client", return_value=_FakeClient()):
        with pytest.raises(HTTPException) as ei:
            await svc.refresh_token("refresh-token")

    assert ei.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert isinstance(ei.value.detail, dict)
    assert ei.value.detail["reason"] == AUTH_REASON_TOKEN_EXPIRED
    assert ei.value.detail["action"] == AUTH_ACTION_LOGIN


async def _refresh_request_error_returns_503() -> None:
    svc = KeycloakService()

    class _FakeClient:
        async def post(self, *_args, **_kwargs):  # type: ignore[no-untyped-def]
            raise httpx.ReadTimeout("timeout")

    with patch("api.services.keycloak_service.get_httpx_client", return_value=_FakeClient()):
        with pytest.raises(HTTPException) as ei:
            await svc.refresh_token("refresh-token")

    assert ei.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert isinstance(ei.value.detail, dict)
    assert ei.value.detail["reason"] == AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE
    assert ei.value.detail["action"] == AUTH_ACTION_REFRESH


async def _refresh_keycloak_5xx_returns_503() -> None:
    svc = KeycloakService()

    class _FakeClient:
        async def post(self, *_args, **_kwargs):  # type: ignore[no-untyped-def]
            return _FakeResponse(status_code=502, payload={"error": "server_error"})

    with patch("api.services.keycloak_service.get_httpx_client", return_value=_FakeClient()):
        with pytest.raises(HTTPException) as ei:
            await svc.refresh_token("refresh-token")

    assert ei.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert isinstance(ei.value.detail, dict)
    assert ei.value.detail["reason"] == AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE
    assert ei.value.detail["action"] == AUTH_ACTION_REFRESH


def test_refresh_invalid_grant_returns_401() -> None:
    asyncio.run(_refresh_invalid_grant_returns_401())


def test_refresh_request_error_returns_503() -> None:
    asyncio.run(_refresh_request_error_returns_503())


def test_refresh_keycloak_5xx_returns_503() -> None:
    asyncio.run(_refresh_keycloak_5xx_returns_503())
