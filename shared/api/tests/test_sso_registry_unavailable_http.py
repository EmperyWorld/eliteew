#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer C: SSO registry PG failure maps to structured HTTP 503 (callback + deps).
# Invariants:
# - Fail-closed; reason=sso_registry_unavailable; action=retry.
# Related:
# - api.core.auth_errors; api.routers.auth_keycloak; api.core.oauth2_auth
# ---
"""Tests for SSO registry unavailable HTTP mapping."""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, status

from api.core.auth_errors import (
    AUTH_ACTION_RETRY,
    AUTH_REASON_SSO_REGISTRY_UNAVAILABLE,
    build_sso_registry_unavailable_detail,
)
from api.core.oauth2_auth import get_oauth2_user
from api.routers.auth_keycloak import OAuthCallbackRequest, sso_callback
from api.services.sso_session_registry import (
    SsoSessionRegistryUnavailable,
    _is_transient_sso_registry_error,
)


def test_build_sso_registry_unavailable_detail_shape() -> None:
    body = build_sso_registry_unavailable_detail()
    assert body["error"] == "service_unavailable"
    assert body["reason"] == AUTH_REASON_SSO_REGISTRY_UNAVAILABLE
    assert body["action"] == AUTH_ACTION_RETRY
    assert "unavailable" in str(body["detail"]).lower()


def test_transient_classifier_accepts_connection_errors() -> None:
    assert _is_transient_sso_registry_error(TimeoutError("timeout"))
    assert _is_transient_sso_registry_error(RuntimeError("connection refused"))
    assert not _is_transient_sso_registry_error(ValueError("bad claims"))


async def _sso_callback_registry_unavailable_is_503() -> None:
    class _Provider:
        async def exchange_code_for_token(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
            return {
                "access_token": "at",
                "refresh_token": "rt",
                "expires_in": 60,
                "token_type": "Bearer",
                "id_token": "id",
            }

        async def get_user_info(self, _token: str) -> dict[str, Any]:
            return {
                "sub": "user-1",
                "preferred_username": "u1",
                "email": "u1@example.com",
                "email_verified": True,
                "name": "U1",
                "realm_access": {"roles": []},
            }

        async def validate_token(self, _token: str) -> dict[str, Any]:
            return {"sub": "user-1", "sid": "sid-1", "azp": "empery-web"}

    request = MagicMock()
    request.headers = {}
    registry = MagicMock()
    registry.enforce_current_session = AsyncMock(side_effect=SsoSessionRegistryUnavailable("down"))

    with (
        patch(
            "api.routers.auth_keycloak.get_sso_session_registry",
            return_value=registry,
        ),
        patch(
            "api.routers.auth_keycloak.enrich_sso_payload_for_registry",
            side_effect=lambda *_a, **_k: {
                "sub": "user-1",
                "sid": "sid-1",
                "azp": "empery-web",
            },
        ),
        pytest.raises(HTTPException) as ei,
    ):
        await sso_callback(
            OAuthCallbackRequest(
                code="code",
                redirect_uri="https://app.eliteew.ru/",
                code_verifier="verifier",
            ),
            request,
            _Provider(),
        )

    assert ei.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert isinstance(ei.value.detail, dict)
    assert ei.value.detail["reason"] == AUTH_REASON_SSO_REGISTRY_UNAVAILABLE
    assert ei.value.detail["action"] == AUTH_ACTION_RETRY


def test_sso_callback_registry_unavailable_is_503() -> None:
    asyncio.run(_sso_callback_registry_unavailable_is_503())


async def _get_oauth2_user_registry_unavailable_is_503() -> None:
    request = MagicMock()
    request.url.path = "/api/v1/desktop/config"
    request.state = type("State", (), {})()
    request.headers = {"Authorization": "Bearer tok"}
    request.query_params = {}

    registry = MagicMock()
    registry.enforce_current_session = AsyncMock(side_effect=SsoSessionRegistryUnavailable("down"))
    provider = MagicMock()
    provider.validate_token = AsyncMock(return_value={"sub": "user-1", "sid": "sid-1", "azp": "empery-web"})
    db = MagicMock()

    with (
        patch(
            "api.core.oauth2_auth.get_sso_session_registry",
            return_value=registry,
        ),
        patch(
            "api.core.oauth2_auth.is_sso_registry_exempt_api_path",
            return_value=False,
        ),
        pytest.raises(HTTPException) as ei,
    ):
        await get_oauth2_user(request, provider, db)

    assert ei.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert isinstance(ei.value.detail, dict)
    assert ei.value.detail["reason"] == AUTH_REASON_SSO_REGISTRY_UNAVAILABLE


def test_get_oauth2_user_registry_unavailable_is_503() -> None:
    asyncio.run(_get_oauth2_user_registry_unavailable_is_503())
