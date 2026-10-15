# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   POST /api/auth/refresh — JSON body refresh for MobileAndroid (Keycloak via AuthProviderService).
# Invariants:
#   - Not used by SPA OIDC (keycloak.ts / api client); SPA must not call this path.
#   - Mounted only under /api/auth (no /api/v1 mirror) — see domains/auth.py.
# Related:
#   - MobileAndroid AuthApiContracts.kt; documentation/api/FRONTEND-BACKEND-HTTP.md
# ------------------------------------------------------------------------------
"""POST /api/auth/refresh — JSON body refresh for MobileAndroid (Keycloak)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import-untyped]
from pydantic import BaseModel  # type: ignore[import-untyped]

from api.core.auth_errors import (
    AUTH_ACTION_REFRESH,
    AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
    build_auth_error_detail,
)
from api.services.auth_provider_service import AuthProviderService, get_auth_provider_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Auth - Token Refresh (Legacy)"])


class RefreshRequest(BaseModel):
    """JSON body for token refresh (MobileAndroid → Keycloak refresh grant)."""

    refresh_token: str


@router.post("/refresh")
async def auth_refresh(
    body: RefreshRequest,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> dict[str, Any]:
    """
    Refresh access token using refresh_token from JSON body.
    Consumer: MobileAndroid AuthApi. SPA OIDC refresh is Keycloak via the web client, not this route.
    """
    try:
        token_response = await auth_provider.refresh_token(body.refresh_token)
        logger.info("Token refreshed successfully (auth/refresh)")
        return {
            "access_token": token_response["access_token"],
            "refresh_token": token_response.get("refresh_token", body.refresh_token),
            "expires_in": token_response["expires_in"],
            "token_type": token_response.get("token_type", "Bearer"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token refresh failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail=build_auth_error_detail(
                AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
                action=AUTH_ACTION_REFRESH,
            ),
        ) from e
