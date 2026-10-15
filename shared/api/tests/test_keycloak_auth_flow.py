# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 2 Task 0.M regression: Keycloak JWT validation via PyJWT (valid, expired, invalid, lock).
# Invariants:
# - KeycloakService public interface unchanged; RS256 + JWKS + introspection fallback preserved.
# Related:
# - api.services.keycloak_service; api.core.keycloak_jwt
# - docker/builders/stack0-api/requirements/locks/api.lock
# ---
from __future__ import annotations

import asyncio
import base64
import importlib
import importlib.util
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException, status

from api.core.keycloak_jwt import decode_unverified_claims, resolve_jwks_signing_key
from api.services.keycloak_service import KeycloakService

_ucs = importlib.import_module("api.services.user_cache_service")
_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_LOCK = _REPO_ROOT / "docker/builders/stack0-api/requirements/locks/api.lock"


def _b64url_int(value: int) -> str:
    byte_length = (value.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(value.to_bytes(byte_length, "big")).decode().rstrip("=")


def _rsa_keypair() -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    return private_key, public_key


def _sample_jwks(public_key: rsa.RSAPublicKey, *, kid: str = "test-kid") -> dict[str, object]:
    numbers = public_key.public_numbers()
    return {
        "keys": [
            {
                "kty": "RSA",
                "kid": kid,
                "use": "sig",
                "alg": "RS256",
                "n": _b64url_int(numbers.n),
                "e": _b64url_int(numbers.e),
            }
        ]
    }


def test_api_lock_excludes_python_jose() -> None:
    if not _API_LOCK.is_file():
        pytest.skip(f"api.lock not mounted ({_API_LOCK})")
    lock_text = _API_LOCK.read_text(encoding="utf-8")
    assert "python-jose==" not in lock_text
    assert "pyjwt==" in lock_text.lower()


def test_import_python_jose_fails_when_uninstalled() -> None:
    spec = importlib.util.find_spec("jose")
    if spec is not None:
        pytest.skip("python-jose still present in this venv (pre-rebake host)")
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("jose")


def test_decode_unverified_claims_reads_payload() -> None:
    private_key, _ = _rsa_keypair()
    token = jwt.encode({"sub": "abc", "sid": "sess-1"}, private_key, algorithm="RS256")
    claims = decode_unverified_claims(token)
    assert claims.get("sub") == "abc"
    assert claims.get("sid") == "sess-1"


def test_resolve_jwks_signing_key_matches_kid() -> None:
    private_key, public_key = _rsa_keypair()
    jwks = _sample_jwks(public_key, kid="kid-a")
    token = jwt.encode({"sub": "x"}, private_key, algorithm="RS256", headers={"kid": "kid-a"})
    signing_key = resolve_jwks_signing_key(jwks, token)
    payload = jwt.decode(token, signing_key, algorithms=["RS256"], options={"verify_aud": False})
    assert payload["sub"] == "x"


async def _validate_token_valid_rs256() -> None:
    private_key, public_key = _rsa_keypair()
    svc = KeycloakService()
    issuer = f"{svc.keycloak_public_url}/realms/{svc.realm}"
    exp = int(time.time()) + 3600
    token = jwt.encode(
        {
            "sub": "user-1",
            "preferred_username": "operator",
            "iss": issuer,
            "exp": exp,
            "aud": "empery-api",
        },
        private_key,
        algorithm="RS256",
        headers={"kid": "kid-a"},
    )
    jwks = _sample_jwks(public_key, kid="kid-a")
    cached: dict[str, object] = {}

    class _FakeCache:
        async def get_cached_token_payload(self, _token: str) -> None:
            return None

        async def cache_token_payload(self, _token: str, payload: dict[str, object]) -> None:
            cached["payload"] = payload

    with (
        patch.object(_ucs, "get_user_cache_service", new=AsyncMock(return_value=_FakeCache())),
        patch.object(svc, "get_jwks", new=AsyncMock(return_value=jwks)),
    ):
        result = await svc.validate_token(token)

    assert result.get("preferred_username") == "operator"
    assert cached.get("payload") == result


def test_validate_token_valid_rs256() -> None:
    asyncio.run(_validate_token_valid_rs256())


async def _validate_token_invalid_signature_uses_introspection() -> None:
    _, public_key = _rsa_keypair()
    other_private, _ = _rsa_keypair()
    svc = KeycloakService()
    issuer = f"{svc.keycloak_public_url}/realms/{svc.realm}"
    token = jwt.encode(
        {"sub": "user-1", "iss": issuer, "exp": int(time.time()) + 3600},
        other_private,
        algorithm="RS256",
        headers={"kid": "kid-a"},
    )
    jwks = _sample_jwks(public_key, kid="kid-a")

    class _FakeCache:
        async def get_cached_token_payload(self, _token: str) -> None:
            return None

        async def cache_token_payload(self, *_a, **_k) -> None:
            return None

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {
        "active": True,
        "username": "operator",
        "sub": "user-1",
        "client_id": svc.client_id,
        "aud": "empery-api",
    }
    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_response)

    with (
        patch.object(_ucs, "get_user_cache_service", new=AsyncMock(return_value=_FakeCache())),
        patch.object(svc, "get_jwks", new=AsyncMock(return_value=jwks)),
        patch("api.services.keycloak_service.get_httpx_client", return_value=fake_client),
    ):
        result = await svc.validate_token(token)

    assert result.get("active") is True
    fake_client.post.assert_awaited_once()


def test_validate_token_invalid_signature_uses_introspection() -> None:
    asyncio.run(_validate_token_invalid_signature_uses_introspection())


async def _validate_token_expired_returns_401_without_introspection() -> None:
    svc = KeycloakService()

    class _FakeCache:
        async def get_cached_token_payload(self, _token: str) -> None:
            return None

        async def cache_token_payload(self, *_a, **_k) -> None:
            raise AssertionError("should not cache expired token")

    private_key, public_key = _rsa_keypair()
    issuer = f"{svc.keycloak_public_url}/realms/{svc.realm}"
    token = jwt.encode(
        {"sub": "user-1", "iss": issuer, "exp": int(time.time()) - 60},
        private_key,
        algorithm="RS256",
        headers={"kid": "kid-a"},
    )
    jwks = _sample_jwks(public_key, kid="kid-a")

    with (
        patch.object(_ucs, "get_user_cache_service", new=AsyncMock(return_value=_FakeCache())),
        patch.object(svc, "get_jwks", new=AsyncMock(return_value=jwks)),
        patch("api.services.keycloak_service.get_httpx_client") as gh,
    ):
        gh.side_effect = lambda: (_ for _ in ()).throw(AssertionError("introspection must not run"))
        with pytest.raises(HTTPException) as ei:
            await svc.validate_token(token)
        assert ei.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in str(ei.value.detail).lower()


def test_validate_token_expired_returns_401_without_introspection() -> None:
    asyncio.run(_validate_token_expired_returns_401_without_introspection())
