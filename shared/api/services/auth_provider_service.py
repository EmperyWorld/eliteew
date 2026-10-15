#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Provider-agnostic SSO facade used by routers, middleware and tests to call the configured auth backend.
# Invariants:
# - Only Keycloak is implemented in production; unsupported provider names fail fast.
# - Public OAuth clients are selected by the adapter, not by exposing client secrets to callers.
# Related:
# - api.services.keycloak_service; api.routers.auth_keycloak; documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# ---
"""Provider-agnostic auth facade (SSO token validation and OAuth helpers).

Primary backend is Keycloak via :class:`api.services.keycloak_service.KeycloakService`.
`AUTH_PROVIDER_BACKEND` selects the adapter; unsupported values fail fast with a clear error.
"""

from __future__ import annotations

import logging
from typing import Any

from api.core.unified_config import unified_settings
from api.services.keycloak_service import KeycloakService, get_keycloak_service

logger = logging.getLogger(__name__)


class AuthProviderService:
    """Delegates SSO operations to a concrete adapter (Keycloak today)."""

    def __init__(self, adapter: KeycloakService, *, provider_name: str) -> None:
        self._adapter = adapter
        self.provider_name = provider_name

    async def validate_token(self, token: str) -> dict[str, Any]:
        return await self._adapter.validate_token(token)

    async def get_user_info(self, token: str) -> dict[str, Any]:
        return await self._adapter.get_user_info(token)

    async def exchange_code_for_token(
        self,
        code: str,
        redirect_uri: str,
        code_verifier: str | None = None,
        client_id: str | None = None,
    ) -> dict[str, Any]:
        return await self._adapter.exchange_code_for_token(code, redirect_uri, code_verifier, client_id=client_id)

    async def refresh_token(self, refresh_token: str, client_id: str | None = None) -> dict[str, Any]:
        return await self._adapter.refresh_token(refresh_token, client_id=client_id)

    async def logout(self, refresh_token: str, client_id: str | None = None) -> bool:
        return await self._adapter.logout(refresh_token, client_id=client_id)

    def get_login_url(
        self,
        redirect_uri: str,
        state: str | None = None,
        code_challenge: str | None = None,
        code_challenge_method: str | None = None,
        client_id: str | None = None,
    ) -> str:
        return self._adapter.get_login_url(
            redirect_uri,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            client_id=client_id,
        )

    def get_logout_url(self, redirect_uri: str) -> str:
        return self._adapter.get_logout_url(redirect_uri)

    async def revoke_access_token(self, access_token: str) -> bool:
        return await self._adapter.revoke_access_token(access_token)

    async def create_user(
        self,
        email: str,
        username: str,
        password: str,
        first_name: str | None = None,
        last_name: str | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self._adapter.create_user(
            email,
            username,
            password,
            first_name=first_name,
            last_name=last_name,
            attributes=attributes,
        )

    async def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        return await self._adapter.get_user_by_username(username)


def build_provider_adapter_by_name(name: str) -> tuple[KeycloakService, str]:
    """Build concrete adapter for diagnostics/CLI; only Keycloak is implemented in-tree."""
    normalized = (name or "").strip().lower()
    if normalized in ("", "keycloak", "kc"):
        return get_keycloak_service(), "keycloak"
    if normalized == "oidc_generic":
        msg = (
            "AUTH_PROVIDER_BACKEND=oidc_generic is not available (OIDC adapter was removed). "
            "Set AUTH_PROVIDER_BACKEND=keycloak."
        )
        raise ValueError(msg)
    msg = f"Unknown AUTH_PROVIDER_BACKEND={name!r} (supported: keycloak)"
    raise ValueError(msg)


_auth_provider_singleton: AuthProviderService | None = None


def get_auth_provider_service() -> AuthProviderService:
    """FastAPI dependency: single shared facade for the configured backend."""
    global _auth_provider_singleton
    if _auth_provider_singleton is not None:
        return _auth_provider_singleton

    backend = (unified_settings.auth_provider_backend or "keycloak").strip().lower()
    adapter, provider_name = build_provider_adapter_by_name(backend)
    logger.info("[AUTH] provider selected primary=%s shadow=%s", provider_name, "disabled")
    _auth_provider_singleton = AuthProviderService(adapter=adapter, provider_name=provider_name)
    return _auth_provider_singleton
