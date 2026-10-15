# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Keycloak JWT admin auth for KBSEW (aligned with stack0 require_admin_user).
# Invariants:
# - JWKS cache TTL (default 300s); kid-miss forces one refetch (single-flight).
# - Internal service token yields role kbsew_service; never emperyworld_admin.
# - Mutations: require_admin_user (JWT) OR require_admin_or_service_mutate when
#   KBSEW_SERVICE_CAN_MUTATE=true (ops ingest only; default off).
# Related:
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.algorithms import RSAAlgorithm

from api.core.config import get_settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# JWKS cache: body + monotonic expiry; refetch is single-flight under _jwks_lock.
JWKS_CACHE_TTL_SEC = 300.0
_jwks_cache: dict[str, Any] | None = None
_jwks_cache_expires_at: float = 0.0
_jwks_lock = asyncio.Lock()

ROLE_SERVICE = "kbsew_service"
ROLE_ADMIN = "admin"
ROLE_EMPERYWORLD_ADMIN = "emperyworld_admin"


@dataclass(frozen=True, slots=True)
class AdminUser:
    sub: str
    email: str | None
    role: str


def _realm_base() -> str:
    settings = get_settings()
    base = settings.keycloak_url.rstrip("/")
    return f"{base}/realms/{settings.keycloak_realm}"


def reset_jwks_cache_for_tests() -> None:
    """Clear JWKS cache state (unit tests only)."""
    global _jwks_cache, _jwks_cache_expires_at  # noqa: PLW0603
    _jwks_cache = None
    _jwks_cache_expires_at = 0.0


def _jwks_cache_valid(now: float | None = None) -> bool:
    ts = time.monotonic() if now is None else now
    return _jwks_cache is not None and ts < _jwks_cache_expires_at


def _jwk_for_kid(jwks: dict[str, Any], kid: str | None) -> Any | None:
    if not kid:
        return None
    for jwk in jwks.get("keys", []):
        if jwk.get("kid") == kid:
            return RSAAlgorithm.from_jwk(jwk)
    return None


async def _download_jwks() -> dict[str, Any]:
    url = f"{_realm_base()}/protocol/openid-connect/certs"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        body = response.json()
    if not isinstance(body, dict):
        raise ValueError("JWKS response is not a JSON object")
    return body


async def _fetch_jwks(*, force: bool = False) -> dict[str, Any]:
    """Return cached JWKS or refetch. Single-flight under lock when refreshing."""
    global _jwks_cache, _jwks_cache_expires_at  # noqa: PLW0603
    now = time.monotonic()
    if not force and _jwks_cache_valid(now):
        assert _jwks_cache is not None
        return _jwks_cache

    async with _jwks_lock:
        now = time.monotonic()
        if not force and _jwks_cache_valid(now):
            assert _jwks_cache is not None
            return _jwks_cache
        body = await _download_jwks()
        _jwks_cache = body
        _jwks_cache_expires_at = time.monotonic() + JWKS_CACHE_TTL_SEC
        logger.debug(
            "[STEP] kbsew_jwks_refetch force=%s ttl_sec=%s keys=%s",
            force,
            JWKS_CACHE_TTL_SEC,
            len(body.get("keys") or []),
        )
        return body


async def _resolve_signing_key(kid: str | None) -> Any:
    """Resolve RSA key by kid; on miss, force one JWKS refetch then retry."""
    jwks = await _fetch_jwks(force=False)
    key = _jwk_for_kid(jwks, kid)
    if key is not None:
        return key
    logger.info("[STEP] kbsew_jwks_kid_miss kid=%s — forcing refetch", kid)
    jwks = await _fetch_jwks(force=True)
    key = _jwk_for_kid(jwks, kid)
    if key is None:
        raise HTTPException(status_code=401, detail="JWT key not found")
    return key


def _extract_role(payload: dict[str, Any]) -> str | None:
    resource_access = payload.get("resource_access") or {}
    for client in ("empery-web", "empery-api", "empery-mobile"):
        roles = resource_access.get(client, {}).get("roles") or []
        if ROLE_EMPERYWORLD_ADMIN in roles:
            return ROLE_EMPERYWORLD_ADMIN
        if ROLE_ADMIN in roles:
            return ROLE_ADMIN
    realm_access = payload.get("realm_access") or {}
    realm_roles = realm_access.get("roles") or []
    if ROLE_EMPERYWORLD_ADMIN in realm_roles:
        return ROLE_EMPERYWORLD_ADMIN
    if ROLE_ADMIN in realm_roles:
        return ROLE_ADMIN
    return None


def is_service_principal(user: AdminUser) -> bool:
    return user.role == ROLE_SERVICE


async def require_admin_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> AdminUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )
    token = credentials.credentials
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = await _resolve_signing_key(kid)
        payload = jwt.decode(
            token,
            key=key,
            algorithms=["RS256"],
            audience=settings.keycloak_audience,
            options={"verify_aud": bool(settings.keycloak_audience)},
        )
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        logger.debug("[STEP] kbsew_auth_jwt_fail reason=%s", exc)
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    except httpx.HTTPError as exc:
        logger.warning("[STEP] kbsew_auth_jwks_unreachable reason=%s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keycloak JWKS unavailable",
        ) from exc

    role = _extract_role(payload)
    if role not in (ROLE_ADMIN, ROLE_EMPERYWORLD_ADMIN):
        raise HTTPException(status_code=403, detail="Administrator privileges required")
    return AdminUser(
        sub=str(payload.get("sub") or ""), email=payload.get("email"), role=role
    )


def _service_token_user(service_token: str | None) -> AdminUser | None:
    settings = get_settings()
    expected = (settings.kbsew_internal_service_token or "").strip()
    provided = (service_token or "").strip()
    if expected and provided and provided == expected:
        return AdminUser(sub="internal-service", email=None, role=ROLE_SERVICE)
    return None


async def require_kbsew_api_access(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    service_token: str | None = Header(default=None, alias="X-KBSEW-Service-Token"),
) -> AdminUser:
    """
    Allow JWT admin **or** internal service token.

    Service token is read-oriented (`role=kbsew_service`): use only on list/search
    unless ``KBSEW_SERVICE_CAN_MUTATE`` and ``require_admin_or_service_mutate``.
    """

    user = _service_token_user(service_token)
    if user is not None:
        logger.debug("[STEP] kbsew_auth_service_token_ok")
        return user
    return await require_admin_user(credentials)


async def require_admin_or_service_mutate(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    service_token: str | None = Header(default=None, alias="X-KBSEW-Service-Token"),
) -> AdminUser:
    """
    Mutation gate: JWT admin always; service token only when KBSEW_SERVICE_CAN_MUTATE.
    """

    settings = get_settings()
    if settings.kbsew_service_can_mutate:
        user = _service_token_user(service_token)
        if user is not None:
            logger.info("[STEP] kbsew_auth_service_mutate_ok")
            return user
    return await require_admin_user(credentials)
