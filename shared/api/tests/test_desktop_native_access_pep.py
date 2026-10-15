# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 4 native access PEP: claim-mode contract, binding check, HTTP/WS deny mapping.
# Related:
# - api/services/desktop_client/native_access_pep.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from api.middleware.oauth2_protection import OAuth2ProtectionMiddleware
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.atomic_conditional_access_contract import (
    GENERIC_AUTH_POLICY_DENY_CODE,
    REQUIRED_BINDING_ACR,
    NativeAccessPepMode,
    native_access_pep_mode,
)
from api.services.desktop_client.auth_binding import DesktopClientAuthBindingService
from api.services.desktop_client.limits import ChallengeStore, SlidingTokenBucket
from api.services.desktop_client.native_access_pep import (
    enforce_native_access_pep,
    reset_native_access_pep_allow_cache,
)
from api.tests.test_desktop_client_auth_binding import (
    _AuthBindingFakeConn,
    _FakePool,
    _license_row,
)

API_ROOT = Path(__file__).resolve().parents[1]


def _native_claims(**overrides: Any) -> dict[str, Any]:
    claims: dict[str, Any] = {
        "azp": "empery-desktop",
        "sub": "kc-sub-abc",
        "acr": REQUIRED_BINDING_ACR,
        "eliteew_binding_id": "bind_opaque_1",
        "eliteew_binding_epoch": 3,
        "cnf": {"jkt": "thumbprint"},
    }
    claims.update(overrides)
    return claims


def test_native_access_pep_mode_web_skips() -> None:
    assert (
        native_access_pep_mode(
            claims={"azp": "empery-web", "sub": "u"},
            enforce_missing_claims=True,
        )
        is NativeAccessPepMode.SKIP
    )


def test_native_access_pep_mode_missing_claims_respects_enforce() -> None:
    native = {"azp": "empery-desktop", "sub": "u"}
    assert native_access_pep_mode(claims=native, enforce_missing_claims=False) is NativeAccessPepMode.SKIP
    assert native_access_pep_mode(claims=native, enforce_missing_claims=True) is NativeAccessPepMode.DENY


def test_native_access_pep_mode_binding_claims_always_require() -> None:
    assert (
        native_access_pep_mode(claims=_native_claims(), enforce_missing_claims=False)
        is NativeAccessPepMode.REQUIRE_CURRENT_BINDING
    )


@pytest.mark.asyncio
async def test_access_pep_from_claims_allows_current_binding() -> None:
    license_id = uuid4()
    binding_id = "bind_opaque_1"
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row={
            "id": binding_id,
            "license_id": license_id,
            "device_id": None,
            "keycloak_sub": "kc-sub-abc",
            "dpop_jkt": "thumbprint",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 3,
        },
    )
    svc = DesktopClientAuthBindingService(
        _FakePool(conn),  # type: ignore[arg-type]
        rate_limiter=SlidingTokenBucket(capacity=100, refill_per_sec=100),
        challenges=ChallengeStore(ttl_sec=300),
    )
    await svc.access_pep_from_claims(_native_claims())
    assert "auth_pep_deny" not in conn.audits


@pytest.mark.asyncio
async def test_access_pep_from_claims_denies_stale_epoch() -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row={
            "id": "bind_opaque_1",
            "license_id": license_id,
            "device_id": None,
            "keycloak_sub": "kc-sub-abc",
            "dpop_jkt": "thumbprint",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 9,
        },
    )
    svc = DesktopClientAuthBindingService(
        _FakePool(conn),  # type: ignore[arg-type]
        rate_limiter=SlidingTokenBucket(capacity=100, refill_per_sec=100),
        challenges=ChallengeStore(ttl_sec=300),
    )
    with pytest.raises(DesktopClientError) as ei:
        await svc.access_pep_from_claims(_native_claims())
    assert ei.value.code == GENERIC_AUTH_POLICY_DENY_CODE
    assert "auth_pep_deny" in conn.audits


@pytest.mark.asyncio
async def test_enforce_pep_skips_native_without_claims_when_enforce_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ELITEEW_KC_ATOMIC_AUTH_ENFORCE", "0")
    reset_native_access_pep_allow_cache()
    assert await enforce_native_access_pep({"azp": "empery-desktop", "sub": "u"}) is False


@pytest.mark.asyncio
async def test_enforce_pep_returns_native_session_replace_trust_after_binding_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    license_id = uuid4()
    conn = _AuthBindingFakeConn(
        license_row=_license_row(license_id=license_id),
        binding_row={
            "id": "bind_opaque_1",
            "license_id": license_id,
            "device_id": None,
            "keycloak_sub": "kc-sub-abc",
            "dpop_jkt": "thumbprint",
            "channel": "desktop",
            "client_id": "empery-desktop",
            "state": "active",
            "authz_epoch": 3,
        },
    )
    pool = _FakePool(conn)

    async def _get_pool() -> _FakePool:
        return pool

    monkeypatch.setattr("api.core.database_manager.get_asyncpg_pool", _get_pool)
    monkeypatch.setenv("ELITEEW_KC_ATOMIC_AUTH_ENFORCE", "1")
    reset_native_access_pep_allow_cache()
    assert await enforce_native_access_pep(_native_claims()) is True


@pytest.mark.asyncio
async def test_enforce_pep_denies_native_without_claims_when_enforce_on(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ELITEEW_KC_ATOMIC_AUTH_ENFORCE", "1")
    reset_native_access_pep_allow_cache()
    with pytest.raises(HTTPException) as ei:
        await enforce_native_access_pep({"azp": "empery-fofline", "sub": "u"})
    assert ei.value.status_code == 401
    assert ei.value.detail["code"] == GENERIC_AUTH_POLICY_DENY_CODE
    assert ei.value.detail["reason"] == "invalid_token"


@pytest.mark.asyncio
async def test_enforce_pep_db_outage_is_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ELITEEW_KC_ATOMIC_AUTH_ENFORCE", "0")
    reset_native_access_pep_allow_cache()

    async def _boom() -> None:
        raise RuntimeError("pool down")

    monkeypatch.setattr("api.core.database_manager.get_asyncpg_pool", _boom)
    with pytest.raises(HTTPException) as ei:
        await enforce_native_access_pep(_native_claims())
    assert ei.value.status_code == 503
    assert ei.value.detail["reason"] == "auth_provider_unavailable"


def test_middleware_verified_native_binding_can_register_new_session() -> None:
    payload = _native_claims(
        sid="sid-desktop-new",
        auth_time=101,
        iat=111,
        preferred_username="poet",
    )

    class _Provider:
        async def validate_token(self, _token: str) -> dict[str, Any]:
            return payload

    registry = SimpleNamespace(
        enforce_current_session=AsyncMock(
            return_value=SimpleNamespace(
                allowed=True,
                claims=SimpleNamespace(client_class="desktop"),
                reason=None,
                displaced_by=None,
                xor_partner=None,
            )
        )
    )
    app = FastAPI()

    async def native_session_probe() -> dict[str, bool]:
        return {"ok": True}

    app.add_api_route("/api/v1/native-session-probe", native_session_probe, methods=["GET"])
    app.add_middleware(OAuth2ProtectionMiddleware)

    with (
        patch(
            "api.middleware.oauth2_protection.get_auth_provider_service",
            return_value=_Provider(),
        ),
        patch(
            "api.middleware.oauth2_protection.get_sso_session_registry",
            return_value=registry,
        ),
        patch(
            "api.middleware.oauth2_protection.is_sso_registry_exempt_api_path",
            return_value=False,
        ),
        patch(
            "api.middleware.oauth2_protection.enforce_native_access_pep",
            new=AsyncMock(return_value=True),
        ),
    ):
        response = TestClient(app).get(
            "/api/v1/native-session-probe",
            headers={"Authorization": "Bearer test-token"},
        )

    assert response.status_code == 200, response.text
    assert registry.enforce_current_session.await_count == 1
    assert registry.enforce_current_session.await_args.kwargs["allow_session_replace"] is True


def test_oauth2_and_websocket_wire_native_pep() -> None:
    oauth = (API_ROOT / "core/oauth2_auth.py").read_text(encoding="utf-8")
    ws = (API_ROOT / "core/websocket_auth.py").read_text(encoding="utf-8")
    middleware = (API_ROOT / "middleware/oauth2_protection.py").read_text(encoding="utf-8")
    assert "enforce_native_access_pep" in oauth
    assert "enforce_native_access_pep" in ws
    assert "enforce_native_access_pep" in middleware
    assert "allow_session_replace=native_binding_verified" in oauth
    assert "allow_session_replace=native_binding_verified" in middleware
