"""Expired access token: fast 401 without Keycloak introspection."""

from __future__ import annotations

import asyncio
import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException, status

from api.services.keycloak_service import KeycloakService

_ucs = importlib.import_module("api.services.user_cache_service")


async def _validate_token_expired_signature_skips_introspection() -> None:
    svc = KeycloakService()

    class _FakeCache:
        async def get_cached_token_payload(self, _token: str) -> None:
            return None

        async def cache_token_payload(self, *_a, **_k) -> None:
            raise AssertionError("should not cache expired token")

    fake_cache = _FakeCache()

    with (
        patch.object(
            _ucs,
            "get_user_cache_service",
            new=AsyncMock(return_value=fake_cache),
        ),
        patch.object(svc, "get_public_key", new=AsyncMock(return_value=MagicMock())),
        patch(
            "api.services.keycloak_service.jwt.decode",
            side_effect=jwt.ExpiredSignatureError("expired"),
        ),
        patch("api.services.keycloak_service.get_httpx_client") as gh,
    ):
        gh.side_effect = lambda: (_ for _ in ()).throw(AssertionError("introspection client must not be used"))
        with pytest.raises(HTTPException) as ei:
            await svc.validate_token("dummy.jwt.token")
        assert ei.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in str(ei.value.detail).lower()


def test_validate_token_expired_signature_skips_introspection() -> None:
    asyncio.run(_validate_token_expired_signature_skips_introspection())
