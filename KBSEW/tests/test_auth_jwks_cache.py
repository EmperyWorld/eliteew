# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# JWKS cache TTL and kid-miss refetch contract for KBSEW auth.
# ---

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import AsyncMock

import pytest

import api.core.auth as auth_mod


@pytest.fixture(autouse=True)
def _clear_jwks_cache() -> Iterator[None]:
    auth_mod.reset_jwks_cache_for_tests()
    yield
    auth_mod.reset_jwks_cache_for_tests()


@pytest.mark.asyncio
async def test_jwks_cache_reused_within_ttl(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}

    async def fake_download() -> dict[str, Any]:
        calls["n"] += 1
        return {"keys": [{"kid": "k1", "kty": "RSA"}]}

    monkeypatch.setattr(auth_mod, "_download_jwks", fake_download)
    first = await auth_mod._fetch_jwks()
    second = await auth_mod._fetch_jwks()
    assert first is second
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_jwks_cache_refetch_after_ttl_expiry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}
    clock = {"t": 1000.0}

    async def fake_download() -> dict[str, Any]:
        calls["n"] += 1
        return {"keys": [{"kid": f"k{calls['n']}", "kty": "RSA"}]}

    monkeypatch.setattr(auth_mod, "_download_jwks", fake_download)
    monkeypatch.setattr(auth_mod.time, "monotonic", lambda: clock["t"])

    await auth_mod._fetch_jwks()
    assert calls["n"] == 1

    clock["t"] += auth_mod.JWKS_CACHE_TTL_SEC + 1.0
    body = await auth_mod._fetch_jwks()
    assert calls["n"] == 2
    assert body["keys"][0]["kid"] == "k2"


@pytest.mark.asyncio
async def test_kid_miss_forces_single_refetch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}

    async def fake_download() -> dict[str, Any]:
        calls["n"] += 1
        if calls["n"] == 1:
            return {"keys": [{"kid": "old", "kty": "RSA"}]}
        return {
            "keys": [
                {
                    "kid": "new",
                    "kty": "RSA",
                    "n": "sXZX",
                    "e": "AQAB",
                }
            ]
        }

    monkeypatch.setattr(auth_mod, "_download_jwks", fake_download)

    # First populate cache without the target kid.
    await auth_mod._fetch_jwks()
    assert calls["n"] == 1

    # Avoid real RSA construction: stub _jwk_for_kid to simulate miss then hit.
    seen_kids: list[str | None] = []

    def fake_jwk(jwks: dict[str, Any], kid: str | None) -> object | None:
        seen_kids.append(kid)
        keys = {k.get("kid") for k in jwks.get("keys", [])}
        if kid in keys:
            return object()
        return None

    monkeypatch.setattr(auth_mod, "_jwk_for_kid", fake_jwk)

    key = await auth_mod._resolve_signing_key("new")
    assert key is not None
    assert calls["n"] == 2
    assert seen_kids == ["new", "new"]


@pytest.mark.asyncio
async def test_kid_miss_still_missing_raises_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException

    monkeypatch.setattr(
        auth_mod,
        "_download_jwks",
        AsyncMock(return_value={"keys": [{"kid": "only", "kty": "RSA"}]}),
    )
    monkeypatch.setattr(auth_mod, "_jwk_for_kid", lambda _jwks, _kid: None)

    with pytest.raises(HTTPException) as exc_info:
        await auth_mod._resolve_signing_key("missing")
    assert exc_info.value.status_code == 401
    # Initial fetch + force refetch
    assert auth_mod._download_jwks.await_count == 2


@pytest.mark.asyncio
async def test_service_token_yields_kbsew_service_role_not_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Settings:
        kbsew_internal_service_token = "secret-token"

    monkeypatch.setattr(auth_mod, "get_settings", lambda: _Settings())
    user = await auth_mod.require_kbsew_api_access(
        credentials=None,
        service_token="secret-token",
    )
    assert user.sub == "internal-service"
    assert user.role == auth_mod.ROLE_SERVICE
    assert user.role != auth_mod.ROLE_EMPERYWORLD_ADMIN
    assert auth_mod.is_service_principal(user) is True


@pytest.mark.asyncio
async def test_wrong_service_token_falls_back_to_jwt_and_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    class _Settings:
        kbsew_internal_service_token = "secret-token"

    monkeypatch.setattr(auth_mod, "get_settings", lambda: _Settings())
    with pytest.raises(HTTPException) as exc_info:
        await auth_mod.require_kbsew_api_access(
            credentials=HTTPAuthorizationCredentials(
                scheme="Bearer", credentials="not-a-jwt"
            ),
            service_token="wrong",
        )
    assert exc_info.value.status_code in {401, 403}
