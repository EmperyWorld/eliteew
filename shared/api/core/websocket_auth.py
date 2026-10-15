#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate Keycloak bearer tokens for WebSocket entry points and return normalized close reasons.
# Invariants:
# - WebSocket auth enforces SSO registry; session replace on connect only when confirm flag is set.
# - Runtime Socket.IO heartbeats revalidate bindings via socket_sso_session_watch.
# Related:
# - api.core.auth_errors; api.services.sso_session_registry; api.middleware.oauth2_protection
# ---
"""WebSocket authentication helper: validate token and return User or close reason.

Used by doc_editor and chat WebSocket endpoints so auth behavior is consistent
with HTTP API and frontend gets predictable close codes/reasons.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import HTTPException  # type: ignore[import-untyped]

from api.core.auth import User  # type: ignore[reportMissingImports]
from api.core.auth_errors import (
    AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
    AUTH_REASON_INVALID_TOKEN,
    AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED,
    AUTH_REASON_SESSION_REPLACED,
    AUTH_REASON_SSO_REGISTRY_UNAVAILABLE,
    AUTH_REASON_TOKEN_EXPIRED,
    AUTH_REASON_TOKEN_MISSING,
    WS_CLOSE_CODE_AUTH,
    ws_close_reason,
)
from api.core.token_roles import (
    get_effective_role_from_payload,
    payload_has_ew_family,
)
from api.services.desktop_client.native_access_pep import enforce_native_access_pep
from api.services.sso_session_registry import (
    SsoSessionRegistryUnavailable,
    get_sso_session_registry,
    sso_replace_confirm_header_value,
    sso_replace_confirm_is_valid,
)

if TYPE_CHECKING:
    from api.services.auth_provider_service import AuthProviderService

logger = logging.getLogger(__name__)


def replace_confirm_from_socket_auth(auth: Any) -> str | None:
    """Read ``sso_replace_confirm`` from Socket.IO handshake auth (mirrors HTTP X-SSO-Replace-Confirm)."""
    if not isinstance(auth, dict):
        return None
    return sso_replace_confirm_header_value(auth.get("sso_replace_confirm"))


async def resolve_db_user_id_by_email(email: str | None) -> str | None:
    """Канонический ``users.id`` (UUID str), как в HTTP OAuth — не Keycloak ``sub``."""
    if not email or not str(email).strip():
        return None
    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        if not pool:
            return None
        em = email.strip()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM users WHERE lower(trim(email)) = lower(trim($1))",
                em,
            )
        if not row or row.get("id") is None:
            return None
        uid_str = str(row["id"]).strip()
        UUID(uid_str)
    except Exception:
        logger.debug("resolve_db_user_id_by_email failed", exc_info=True)
        return None
    else:
        return uid_str


async def validate_websocket_token(
    token: str | None,
    auth_provider: AuthProviderService,
    *,
    connect_user_agent: str | None = None,
    replace_confirm_header: str | None = None,
) -> tuple[User | None, str | None]:
    """Validate token for WebSocket connection; return User or error reason for close.

    Args:
        token: JWT from query or first message (caller passes what it has).
        auth_provider: Auth provider service instance.

    Returns:
        (User, None) if valid; (None, reason) if invalid. reason is short string
        for WebSocket close (e.g. auth:token_missing). Caller should close with
        code WS_CLOSE_CODE_AUTH (1008) and reason.
    """
    if not token or not token.strip():
        return (None, ws_close_reason(AUTH_REASON_TOKEN_MISSING))

    try:
        payload: dict[str, Any] = await auth_provider.validate_token(token)
    except HTTPException as e:
        if e.status_code == 401:
            reason = AUTH_REASON_TOKEN_EXPIRED if "expired" in str(e.detail).lower() else AUTH_REASON_INVALID_TOKEN
        else:
            reason = AUTH_REASON_INVALID_TOKEN
        return (None, ws_close_reason(reason))
    except Exception as e:
        logger.warning("WebSocket token validation failed: %s", e)
        return (None, ws_close_reason(AUTH_REASON_INVALID_TOKEN))

    if not payload:
        return (None, ws_close_reason(AUTH_REASON_INVALID_TOKEN))

    try:
        native_binding_verified = await enforce_native_access_pep(payload)
    except HTTPException as exc:
        if exc.status_code == 503:
            return (None, ws_close_reason(AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE))
        return (None, ws_close_reason(AUTH_REASON_INVALID_TOKEN))

    allow_session_replace = native_binding_verified or sso_replace_confirm_is_valid(replace_confirm_header)
    try:
        session_decision = await get_sso_session_registry().enforce_current_session(
            payload,
            audit_first_seen=False,
            user_agent=connect_user_agent,
            replace_confirm_header=replace_confirm_header,
            allow_session_replace=allow_session_replace,
        )
    except SsoSessionRegistryUnavailable:
        logger.warning("WebSocket SSO session registry unavailable")
        return (None, ws_close_reason(AUTH_REASON_SSO_REGISTRY_UNAVAILABLE))
    if not session_decision.allowed:
        if session_decision.reason == "session_replace_confirmation_required":
            reason = AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED
        elif session_decision.reason == "session_replaced":
            reason = AUTH_REASON_SESSION_REPLACED
        else:
            reason = AUTH_REASON_SESSION_REPLACED
        return (None, ws_close_reason(reason))

    sub_id = str(payload.get("sub", ""))
    email = str(payload.get("email", ""))
    username = str(payload.get("preferred_username", email.split("@")[0] if email else "user"))
    role = get_effective_role_from_payload(payload)

    db_uid = await resolve_db_user_id_by_email(email)
    effective_id = db_uid if db_uid else sub_id

    user = User(
        id=effective_id,
        email=email,
        username=username,
        role=role,
        is_active=True,
        is_verified=payload.get("email_verified", False),
        full_name=payload.get("name") or username,
        ew_family=payload_has_ew_family(payload),
    )
    return (user, None)


def get_ws_auth_close_code() -> int:
    """Return standard close code for auth failure (1008)."""
    return WS_CLOSE_CODE_AUTH
