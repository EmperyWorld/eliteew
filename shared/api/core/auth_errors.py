#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared machine-readable auth error codes/actions for HTTP JSON responses and WebSocket close reasons.
# Invariants:
# - Frontend auth handling depends on stable `reason` / `action` values.
# Related:
# - api.middleware.oauth2_protection; shared/web/frontend/src/services/api/client.ts
# ---
"""Unified authentication error format for consistent UX across API and WebSocket.

All auth-related 401/403 responses and WebSocket close reasons use this format
so the frontend can handle session expiry and login redirect uniformly.
"""

from __future__ import annotations

from typing import Any

# Reason codes for machine-readable handling
AUTH_REASON_TOKEN_MISSING = "token_missing"
AUTH_REASON_TOKEN_EXPIRED = "token_expired"
AUTH_REASON_INVALID_TOKEN = "invalid_token"
AUTH_REASON_FORBIDDEN = "forbidden"
AUTH_REASON_AUTH_FAILED = "authentication_failed"
AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE = "auth_provider_unavailable"
AUTH_REASON_SESSION_REPLACED = "session_replaced"
AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED = "session_replace_confirmation_required"
AUTH_REASON_SSO_REGISTRY_UNAVAILABLE = "sso_registry_unavailable"

# Actions the client should take
AUTH_ACTION_LOGIN = "login"
AUTH_ACTION_REFRESH = "refresh"
AUTH_ACTION_RETRY = "retry"

# WebSocket close code for policy violation (auth failure)
WS_CLOSE_CODE_AUTH = 1008


def build_auth_error_body(
    reason: str,
    action: str = AUTH_ACTION_LOGIN,
    detail: str | None = None,
    *,
    displaced_by: str | None = None,
    xor_partner: str | None = None,
) -> dict[str, Any]:
    """Build unified auth error payload for JSON responses.

    Frontend can check error.reason and error.action to show the right message
    and trigger login/refresh flow. FoFline XOR may set ``displaced_by`` /
    ``xor_partner`` for honest displace copy (no raw codes in UI).
    """
    body: dict[str, Any] = {
        "error": "unauthorized",
        "reason": reason,
        "action": action,
    }
    if detail:
        body["detail"] = detail
    if displaced_by:
        body["displaced_by"] = displaced_by
    if xor_partner:
        body["xor_partner"] = xor_partner
    return body


def build_auth_error_detail(reason: str, action: str = AUTH_ACTION_LOGIN) -> dict[str, Any]:
    """Alias for FastAPI HTTPException detail (same structure)."""
    return build_auth_error_body(reason=reason, action=action)


def ws_close_reason(reason: str) -> str:
    """Short reason text for WebSocket close (code 1008)."""
    return f"auth:{reason}"


def auth_action_for_reason(reason: str) -> str:
    """Map machine-readable auth reason to client action."""
    if reason == AUTH_REASON_TOKEN_EXPIRED:
        return AUTH_ACTION_REFRESH
    if reason == AUTH_REASON_SSO_REGISTRY_UNAVAILABLE:
        return AUTH_ACTION_RETRY
    return AUTH_ACTION_LOGIN


def build_sso_registry_unavailable_detail(
    *,
    detail: str = "SSO session registry temporarily unavailable",
) -> dict[str, Any]:
    """503 payload when stack1 Postgres / sso_user_sessions is unreachable (fail-closed)."""
    body = build_auth_error_body(
        reason=AUTH_REASON_SSO_REGISTRY_UNAVAILABLE,
        action=AUTH_ACTION_RETRY,
        detail=detail,
    )
    body["error"] = "service_unavailable"
    return body
