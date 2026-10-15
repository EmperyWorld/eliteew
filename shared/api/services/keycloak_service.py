#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Keycloak adapter for OIDC login URLs, public-client token exchange/refresh/logout, JWT validation and Admin API helpers.
# Invariants:
# - Browser and native mobile use public PKCE clients; confidential `empery-api` is only for server-side introspection/admin calls.
# - Raw JWT/refresh tokens are never logged; use opaque token references for diagnostics.
# Related:
# - api.services.auth_provider_service; api.services.sso_session_registry; documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# ---
"""Keycloak SSO integration service."""

import json
import logging
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import httpx  # type: ignore[import-not-found]
import jwt  # type: ignore[import-untyped]
from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_ACTION_REFRESH,
    AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
    AUTH_REASON_TOKEN_EXPIRED,
    build_auth_error_detail,
)
from api.core.http_clients import get_httpx_client
from api.core.keycloak_jwt import decode_unverified_claims, resolve_jwks_signing_key
from api.core.unified_config import unified_settings
from api.services.sso_session_registry import (
    allowed_public_client_ids,
    public_client_id_for_redirect_uri,
    public_client_id_from_token_payload,
)
from api.utils.json_safe import opaque_token_ref, truncate_for_log

# Per-request timeout for Keycloak calls (matches former AsyncClient(timeout=5.0)).
_KEYCLOAK_REQUEST_TIMEOUT = 5.0

logger = logging.getLogger(__name__)


def _validate_keycloak_audience_claim(payload: dict[str, Any], allowed_csv: str) -> None:
    """Ensure access token ``aud`` intersects ``JWT_AUDIENCE`` (comma-separated)."""
    allowed = {a.strip() for a in allowed_csv.split(",") if a.strip()}
    if not allowed:
        return
    aud = payload.get("aud")
    if aud is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing audience claim",
        )
    aud_values: set[str]
    if isinstance(aud, str):
        aud_values = {aud}
    elif isinstance(aud, list):
        aud_values = {str(x) for x in aud}
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid audience claim",
        )
    if not (aud_values & allowed):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
        )


def _validate_keycloak_introspection_claims(payload: dict[str, Any]) -> None:
    """Fail closed for active introspection payloads whose client/audience does not belong to EliteEW."""
    if unified_settings.keycloak_verify_audience:
        _validate_keycloak_audience_claim(payload, unified_settings.jwt_audience)

    allowed_clients = {
        unified_settings.keycloak_client_id,
        unified_settings.keycloak_web_client_id,
        unified_settings.keycloak_mobile_client_id,
        *allowed_public_client_ids(),
    }
    allowed_clients = {client_id for client_id in allowed_clients if client_id}
    claim_values = {
        str(payload.get("azp") or "").strip(),
        str(payload.get("client_id") or "").strip(),
    }
    claim_values = {value for value in claim_values if value}
    if claim_values and allowed_clients and not (claim_values & allowed_clients):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token client",
        )


class KeycloakService:
    """
    Service for integrating with Keycloak SSO
    Handles token validation, user management, and OAuth flows

    ⚠️ ВАЖНО: ПЕРЕД ИЗМЕНЕНИЯМИ ПРОЧИТАЙТЕ ДОКУМЕНТАЦИЮ
    📖 Документация: documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
    📖 Документация: documentation/platform/REDIS_ARCHITECTURE.md

    Этот сервис отвечает за валидацию токенов Keycloak.
    НЕ изменяйте логику валидации без понимания архитектуры авторизации!
    """

    def __init__(self) -> None:
        # Keycloak server configuration
        # ВАЖНО: Используем внутренний URL для серверных вызовов через Docker сеть
        # Но issuer должен быть публичным URL для проверки токенов от клиентов
        # Токены выдаются Keycloak с issuer = публичный URL (https://auth.eliteew.ru/realms/empery)
        # Поэтому при валидации токена issuer должен совпадать с публичным URL!
        self.keycloak_base_url = unified_settings.keycloak_base_url.rstrip("/")
        self.keycloak_public_url = unified_settings.keycloak_public_url.rstrip("/")
        self.realm = unified_settings.keycloak_realm

        # Confidential client: introspection, revoke (секрет), серверные вызовы
        self.client_id = unified_settings.keycloak_client_id
        self.client_secret = unified_settings.keycloak_client_secret
        if not self.client_secret:
            msg = "KEYCLOAK_CLIENT_SECRET environment variable must be set"
            raise ValueError(msg)
        # Публичный клиент: браузер (SPA), PKCE (Jitsi), refresh/callback без secret
        self.web_client_id = unified_settings.keycloak_web_client_id
        # Публичный клиент: native mobile (AppAuth / backend SSO facade), PKCE без secret
        self.mobile_client_id = unified_settings.keycloak_mobile_client_id

        # URLs
        self.token_url = f"{self.keycloak_base_url}/realms/{self.realm}/protocol/openid-connect/token"
        self.userinfo_url = f"{self.keycloak_base_url}/realms/{self.realm}/protocol/openid-connect/userinfo"
        self.introspect_url = f"{self.keycloak_base_url}/realms/{self.realm}/protocol/openid-connect/token/introspect"
        self.jwks_url = f"{self.keycloak_base_url}/realms/{self.realm}/protocol/openid-connect/certs"
        # Browser-facing redirects must use public URL reachable from user devices.
        self.auth_url = f"{self.keycloak_public_url}/realms/{self.realm}/protocol/openid-connect/auth"
        self.logout_url = f"{self.keycloak_public_url}/realms/{self.realm}/protocol/openid-connect/logout"

        # Admin API URLs
        self.admin_url = f"{self.keycloak_base_url}/admin/realms/{self.realm}"

        # Cache for JWKS
        self._jwks_cache: dict[str, Any] | None = None
        self._jwks_cache_time: datetime | None = None
        self._jwks_cache_ttl = 3600  # 1 hour

        logger.info(f"Keycloak Service initialized for realm: {self.realm}")

    def _public_client_id_or_default(self, client_id: str | None = None) -> str:
        """Return an allowed public PKCE client id, falling back to the browser client."""

        value = (client_id or "").strip()
        if value in allowed_public_client_ids():
            return value
        if value:
            logger.warning(
                "Keycloak public client %r is not configured; falling back to %s",
                value,
                self.web_client_id,
            )
        return self.web_client_id

    def _public_client_id_for_refresh_token(self, refresh_token: str, client_id: str | None = None) -> str:
        """Infer public client id from a Keycloak refresh token when the caller did not pass one."""

        explicit = (client_id or "").strip()
        if explicit:
            return self._public_client_id_or_default(explicit)
        try:
            payload = decode_unverified_claims(refresh_token)
            if isinstance(payload, dict):
                return self._public_client_id_or_default(public_client_id_from_token_payload(payload))
        except Exception:
            logger.debug("Could not infer public client id from refresh token; using browser client")
        return self.web_client_id

    async def get_jwks(self) -> dict[str, Any]:
        """Get JSON Web Key Set from Keycloak"""
        now = datetime.now(UTC)

        # Check cache (total_seconds() handles cache older than 24h vs .seconds)
        if (
            self._jwks_cache
            and self._jwks_cache_time
            and (now - self._jwks_cache_time).total_seconds() < self._jwks_cache_ttl
        ):
            return self._jwks_cache

        # Fetch new JWKS
        try:
            client = get_httpx_client()
            response = await client.get(self.jwks_url, timeout=_KEYCLOAK_REQUEST_TIMEOUT)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Keycloak temporarily unavailable (JWKS)",
                )

            jwks_data = response.json()
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as conn_err:
            logger.warning("Keycloak unreachable (JWKS): %s", conn_err)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak temporarily unavailable. See docker/docs-api-500-troubleshooting.md",
            ) from conn_err

        try:
            if not isinstance(jwks_data, dict):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Keycloak temporarily unavailable (invalid JWKS)",
                )
            # Type narrowing: jwks_data is guaranteed to be dict[str, Any] here
            self._jwks_cache = jwks_data
            self._jwks_cache_time = now
            return jwks_data
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Keycloak JWKS parse error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak temporarily unavailable",
            ) from e

    async def get_public_key(self, token: str | None = None) -> Any:  # noqa: ANN401
        """Get public key from Keycloak JWKS endpoint for RS256 validation"""
        try:
            logger.debug(f"Getting JWKS from: {self.jwks_url}")
            jwks = await self.get_jwks()

            if not jwks or not jwks.get("keys"):
                logger.error("No keys in JWKS response")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to get JWKS from Keycloak",
                )

            return resolve_jwks_signing_key(jwks, token)

        except Exception as e:
            logger.exception(f"Failed to get public key: {e}")
            raise

    async def validate_token(self, token: str) -> dict[str, Any]:
        """
        Validate JWT token from Keycloak with RS256 algorithm
        Returns decoded token payload if valid

        Uses Redis cache (DB 15) to avoid repeated validations of the same token.
        Cache TTL is based on token expiration time.
        """
        try:
            # Check Redis cache first
            from api.services.user_cache_service import get_user_cache_service

            user_cache = await get_user_cache_service()
            cached_payload = await user_cache.get_cached_token_payload(token)
            if cached_payload:
                logger.debug("Token validated from Redis cache")
                return cached_payload

            logger.debug("Validating token, %s", opaque_token_ref(token))

            try:
                public_key = await self.get_public_key(token)

                # ВАЖНО: issuer должен быть публичным URL!
                # Keycloak выдает токены с issuer = публичный URL (https://auth.eliteew.ru/realms/empery)
                # Если issuer не совпадает, RS256 валидация упадет и переключится на introspection fallback
                # jose не проверяет несколько допустимых aud за один вызов — при включённой проверке делаем вручную
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    issuer=f"{self.keycloak_public_url}/realms/{self.realm}",
                    options={"verify_aud": False},
                )
                if unified_settings.keycloak_verify_audience:
                    _validate_keycloak_audience_claim(payload, unified_settings.jwt_audience)

                logger.debug(f"🔑 Token validated with RS256 for user: {payload.get('preferred_username')}")

                # Cache the result in Redis
                from api.services.user_cache_service import get_user_cache_service

                user_cache = await get_user_cache_service()
                await user_cache.cache_token_payload(token, payload)

                return payload

            except jwt.ExpiredSignatureError:
                # Просроченный access token: introspection с тем же токеном даёт active=false и шум в логах.
                logger.info(
                    "Access token expired (RS256); skipping introspection (%s)",
                    opaque_token_ref(token),
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired",
                ) from None

            except Exception as rs256_error:
                logger.warning(f"RS256 validation failed: {type(rs256_error).__name__}: {rs256_error}")
                logger.warning(f"Expected issuer: {self.keycloak_public_url}/realms/{self.realm}")

                # Try to decode token to see actual issuer
                try:
                    unverified = decode_unverified_claims(token)
                    actual_issuer = unverified.get("iss", "N/A")
                    logger.warning(f"Actual token issuer: {actual_issuer}")
                    logger.warning(
                        f"⛔️ Issuer match: {actual_issuer == f'{self.keycloak_public_url}/realms/{self.realm}'}"
                    )
                except Exception as e:
                    logger.debug(f"Could not decode token to check issuer: {e}")

                logger.info("Trying introspection fallback...")

            client = get_httpx_client()
            response = await client.post(
                self.introspect_url,
                data={
                    "token": token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                timeout=_KEYCLOAK_REQUEST_TIMEOUT,
            )

            if response.status_code != 200:
                logger.error(f"Introspection failed with status {response.status_code}: {response.text[:200]}")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token validation failed")

            introspection = response.json()
            logger.info(
                f"ℹ️ Introspection response: active={introspection.get('active')}, exp={introspection.get('exp')}, username={introspection.get('username')}"
            )

            if not introspection.get("active"):
                logger.warning("Token is not active according to introspection")
                try:
                    intro_preview = truncate_for_log(
                        json.dumps(introspection, ensure_ascii=False),
                        max_chars=800,
                    )
                    logger.warning("Introspection response (truncated): %s", intro_preview)
                except Exception:
                    logger.warning("Introspection response could not be serialized for log")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is not active")

            _validate_keycloak_introspection_claims(introspection)

            logger.debug(f"Token validated via introspection for user: {introspection.get('username')}")

            # Cache introspection result in Redis
            from api.services.user_cache_service import get_user_cache_service

            user_cache = await get_user_cache_service()
            await user_cache.cache_token_payload(token, introspection)

            return introspection

        except httpx.RequestError as e:
            logger.exception(f"Failed to validate token with Keycloak: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable",
            ) from e

    async def get_user_info(self, token: str) -> dict[str, Any]:
        """Get user information from Keycloak using access token"""
        client = get_httpx_client()
        response = await client.get(
            self.userinfo_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )

        if response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to get user info")

        return response.json()

    async def exchange_code_for_token(
        self,
        code: str,
        redirect_uri: str,
        code_verifier: str | None = None,
        *,
        client_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Обмен кода на токены для публичного клиента (empery-web), без client_secret.
        При PKCE передайте code_verifier.
        """
        public_client_id = self._public_client_id_or_default(
            client_id or public_client_id_for_redirect_uri(redirect_uri)
        )
        data: dict[str, str] = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": public_client_id,
        }
        if code_verifier:
            data["code_verifier"] = code_verifier
        client = get_httpx_client()
        response = await client.post(self.token_url, data=data, timeout=_KEYCLOAK_REQUEST_TIMEOUT)

        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for token",
            )

        return response.json()

    async def refresh_token(self, refresh_token: str, *, client_id: str | None = None) -> dict[str, Any]:
        """Refresh access token (токен, выданный публичному клиенту empery-web)."""
        public_client_id = self._public_client_id_for_refresh_token(refresh_token, client_id)
        client = get_httpx_client()
        try:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": public_client_id,
                },
                timeout=_KEYCLOAK_REQUEST_TIMEOUT,
            )
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            logger.warning(
                "Keycloak refresh request failed (%s) token=%s",
                exc.__class__.__name__,
                opaque_token_ref(refresh_token),
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=build_auth_error_detail(
                    AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
                    action=AUTH_ACTION_REFRESH,
                ),
            ) from exc

        if response.status_code == 200:
            return response.json()

        kc_error = ""
        try:
            payload = response.json()
            if isinstance(payload, dict):
                kc_error = str(payload.get("error") or "").strip().lower()
        except Exception as exc:
            logger.debug(
                "Keycloak refresh error body is not JSON: status=%s err=%s",
                response.status_code,
                exc,
            )
            kc_error = ""

        if response.status_code in (400, 401) and kc_error in {
            "invalid_grant",
            "invalid_token",
            "unauthorized_client",
            "invalid_request",
        }:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=build_auth_error_detail(
                    AUTH_REASON_TOKEN_EXPIRED,
                    action=AUTH_ACTION_LOGIN,
                ),
            )

        logger.warning(
            "Keycloak refresh rejected status=%s kc_error=%s token=%s",
            response.status_code,
            kc_error or "-",
            opaque_token_ref(refresh_token),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=build_auth_error_detail(
                AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
                action=AUTH_ACTION_REFRESH,
            ),
        )

    async def logout(self, refresh_token: str, *, client_id: str | None = None) -> bool:
        """Logout user from Keycloak (публичный клиент, без secret)."""
        public_client_id = self._public_client_id_for_refresh_token(refresh_token, client_id)
        client = get_httpx_client()
        response = await client.post(
            self.logout_url,
            data={
                "refresh_token": refresh_token,
                "client_id": public_client_id,
            },
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )

        return response.status_code == 204

    async def revoke_access_token(self, access_token: str) -> bool:
        """Revoke access token in Keycloak (best effort)."""
        revoke_url = f"{self.keycloak_base_url}/realms/{self.realm}/protocol/openid-connect/revoke"
        public_client_id = self.web_client_id
        try:
            payload = decode_unverified_claims(access_token)
            if isinstance(payload, dict):
                public_client_id = self._public_client_id_or_default(public_client_id_from_token_payload(payload))
        except Exception:
            logger.debug("Could not infer public client id from access token; using browser client")
        verify_tls = unified_settings.keycloak_http_verify_tls
        if not verify_tls:
            logger.warning(
                "Keycloak HTTP TLS verification disabled (KEYCLOAK_HTTP_VERIFY_TLS=false); "
                "use only in controlled dev environments"
            )
        client = get_httpx_client()
        try:
            response = await client.post(
                revoke_url,
                data={
                    "client_id": public_client_id,
                    "token": access_token,
                    "token_type_hint": "access_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=_KEYCLOAK_REQUEST_TIMEOUT,
            )
            return response.status_code == 200
        except Exception:
            logger.exception("Failed to revoke access token in Keycloak")
            return False

    async def get_admin_token(self) -> str:
        """Get admin token for Keycloak Admin API"""
        admin_password = unified_settings.keycloak_admin_password
        if not admin_password:
            msg = "KEYCLOAK_ADMIN_PASSWORD environment variable required for admin operations"
            raise ValueError(msg)

        client = get_httpx_client()
        response = await client.post(
            f"{self.keycloak_base_url}/realms/master/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": unified_settings.keycloak_admin_user,
                "password": admin_password,
            },
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get admin token",
            )

        return response.json()["access_token"]

    async def create_user(
        self,
        email: str,
        username: str,
        password: str,
        first_name: str | None = None,
        last_name: str | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create new user in Keycloak"""
        admin_token = await self.get_admin_token()

        user_data = {
            "email": email,
            "username": username,
            "enabled": True,
            "emailVerified": False,
            "firstName": first_name or "",
            "lastName": last_name or "",
            "credentials": [{"type": "password", "value": password, "temporary": False}],
        }

        if attributes:
            user_data["attributes"] = attributes

        client = get_httpx_client()
        response = await client.post(
            f"{self.admin_url}/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=user_data,
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )

        if response.status_code not in [201, 409]:
            logger.error(f"Failed to create user: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create user: {response.text}",
            )

        if response.status_code == 409:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

        # Get created user ID from Location header
        location = response.headers.get("Location")
        user_id = location.split("/")[-1] if location else None

        return {"id": user_id, "username": username, "email": email}

    async def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        """Get user from Keycloak by username"""
        admin_token = await self.get_admin_token()

        client = get_httpx_client()
        response = await client.get(
            f"{self.admin_url}/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"username": username, "exact": "true"},
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )

        if response.status_code != 200:
            return None

        users = response.json()
        return users[0] if users else None

    async def update_user_password(self, user_id: str, new_password: str) -> bool:
        """Update user password in Keycloak"""
        admin_token = await self.get_admin_token()

        client = get_httpx_client()
        response = await client.put(
            f"{self.admin_url}/users/{user_id}/reset-password",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"type": "password", "value": new_password, "temporary": False},
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )

        return response.status_code == 204

    async def clear_user_brute_force(self, user_id: str) -> bool:
        """Clear Keycloak temporary lockout for one user. Does not change EliteEW license state."""
        admin_token = await self.get_admin_token()
        uid = user_id.strip()
        if not uid:
            return False
        client = get_httpx_client()
        response = await client.delete(
            f"{self.admin_url}/attack-detection/brute-force/users/{uid}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )
        if response.status_code not in (200, 204):
            logger.warning(
                "[STEP] keycloak_brute_force_clear_skip user_id=%s status=%s",
                uid,
                response.status_code,
            )
            return False
        logger.info("[STEP] keycloak_brute_force_cleared user_id=%s", uid)
        return True

    async def logout_all_user_sessions(self, user_id: str) -> bool:
        """End all Keycloak sessions for one user. Does not change EliteEW license state."""
        admin_token = await self.get_admin_token()
        uid = user_id.strip()
        if not uid:
            return False
        client = get_httpx_client()
        response = await client.post(
            f"{self.admin_url}/users/{uid}/logout",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )
        if response.status_code not in (200, 204):
            logger.warning(
                "[STEP] keycloak_user_logout_skip user_id=%s status=%s",
                uid,
                response.status_code,
            )
            return False
        logger.info("[STEP] keycloak_user_sessions_logged_out user_id=%s", uid)
        return True

    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        """Fetch one Keycloak user by id (realm user UUID / OIDC sub for local users)."""
        admin_token = await self.get_admin_token()
        uid = user_id.strip()
        if not uid:
            return None
        client = get_httpx_client()
        response = await client.get(
            f"{self.admin_url}/users/{uid}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            logger.warning(
                "[STEP] keycloak_get_user_skip user_id=%s status=%s",
                uid,
                response.status_code,
            )
            return None
        payload = response.json()
        return payload if isinstance(payload, dict) else None

    async def merge_user_attributes_by_id(
        self,
        user_id: str,
        attributes: dict[str, list[str]],
    ) -> bool:
        """Merge managed attributes onto a user by exact id (never email lookup).

        Keycloak Admin PUT replaces the user representation. We PUT the GET body with
        only ``attributes`` merged and credentials stripped — never invent ``enabled=True``.
        """
        uid = user_id.strip()
        if not uid or not attributes:
            return False
        user = await self.get_user_by_id(uid)
        if user is None:
            logger.warning("[STEP] keycloak_merge_attrs_user_missing user_id=%s", uid)
            return False
        if "enabled" not in user:
            logger.warning("[STEP] keycloak_merge_attrs_skip_no_enabled user_id=%s", uid)
            return False
        current = user.get("attributes")
        merged: dict[str, list[str]] = {}
        if isinstance(current, dict):
            for key, value in current.items():
                if isinstance(value, list):
                    merged[str(key)] = [str(item) for item in value]
                elif value is not None:
                    merged[str(key)] = [str(value)]
        for key, value in attributes.items():
            merged[str(key)] = [str(item) for item in value]
        payload = dict(user)
        payload.pop("credentials", None)
        payload.pop("federatedIdentities", None)
        payload["attributes"] = merged
        admin_token = await self.get_admin_token()
        client = get_httpx_client()
        response = await client.put(
            f"{self.admin_url}/users/{uid}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
            timeout=_KEYCLOAK_REQUEST_TIMEOUT,
        )
        if response.status_code not in (200, 204):
            logger.warning(
                "[STEP] keycloak_merge_attrs_fail user_id=%s status=%s",
                uid,
                response.status_code,
            )
            return False
        logger.info("[STEP] keycloak_merge_attrs_ok user_id=%s keys=%s", uid, sorted(attributes))
        return True

    def get_login_url(
        self,
        redirect_uri: str,
        state: str | None = None,
        code_challenge: str | None = None,
        code_challenge_method: str | None = None,
        client_id: str | None = None,
    ) -> str:
        """Generate Keycloak login URL for OAuth flow (публичный клиент SPA)."""
        public_client_id = self._public_client_id_or_default(
            client_id or public_client_id_for_redirect_uri(redirect_uri)
        )
        params = {
            "client_id": public_client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": "openid profile email",
        }

        if state:
            params["state"] = state
        if code_challenge:
            params["code_challenge"] = code_challenge
        if code_challenge_method:
            params["code_challenge_method"] = code_challenge_method

        query_string = urlencode(params)
        return f"{self.auth_url}?{query_string}"

    def get_logout_url(self, redirect_uri: str) -> str:
        """Generate Keycloak logout URL"""
        return f"{self.logout_url}?{urlencode({'redirect_uri': redirect_uri})}"


# Singleton instance
keycloak_service = KeycloakService()


def get_keycloak_service() -> KeycloakService:
    """Dependency injection for Keycloak service"""
    return keycloak_service
