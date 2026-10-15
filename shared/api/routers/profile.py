#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   🔐 OAuth2 Proxy Profile Router
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
🔐 OAuth2 Proxy Profile Router
Provides /api/profile/me endpoint for OAuth2 Proxy authentication
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request  # type: ignore[import-untyped]

from api.core.token_roles import profile_role_label
from api.services.auth_provider_service import AuthProviderService, get_auth_provider_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["OAuth2 Profile"])


@router.get("/profile/me")
async def get_oauth2_proxy_profile_me(
    request: Request, auth_provider: AuthProviderService = Depends(get_auth_provider_service)
) -> dict[str, str | bool | None | dict[str, str]]:
    """
    👤 Get current user profile for OAuth2 Proxy authentication

    This endpoint works with OAuth2 Proxy to validate authentication.
    It checks for tokens in:
    1. X-Auth-Request-Access-Token header (from OAuth2 Proxy)
    2. Authorization header (Bearer token)

    Returns user profile information from the OAuth2 token.
    """
    try:
        # Verbose header dumps belong at DEBUG only (avoid PII / token material in prod INFO logs).
        if logger.isEnabledFor(logging.DEBUG):
            for header_name in (
                "X-Auth-Request-Access-Token",
                "X-Auth-Request-Email",
                "X-Auth-Request-User",
                "X-Auth-Request-Preferred-Username",
                "X-Forwarded-User",
                "gap-auth",
                "Authorization",
            ):
                header_value = request.headers.get(header_name)
                if header_value and ("token" in header_name.lower() or header_name == "Authorization"):
                    logger.debug("%s: present (masked prefix)", header_name)
                elif header_value:
                    logger.debug("%s: %s", header_name, header_value)
                else:
                    logger.debug("%s: not present", header_name)

        # Priority 1: Check OAuth2 Proxy headers
        token = request.headers.get("X-Auth-Request-Access-Token")
        user_email = request.headers.get("X-Auth-Request-Email")
        preferred_username = request.headers.get("X-Auth-Request-Preferred-Username")

        # Priority 2: Check standard Authorization header
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]

        # If no token found, user is not authenticated
        if not token:
            logger.warning("No authentication token found in request")
            detail_msg = "Not authenticated"
            raise HTTPException(status_code=401, detail=detail_msg)

        # Validate token with configured auth provider
        try:
            token_info = await auth_provider.validate_token(token)

            # If token is not valid, return 401
            if not token_info:
                logger.warning("Invalid token provided")
                detail_msg = "Invalid or expired token"
                raise HTTPException(status_code=401, detail=detail_msg)

            # Extract user info from token
            user_id = token_info.get("sub")
            email = token_info.get("email") or user_email
            username = token_info.get("preferred_username") or preferred_username or email
            profile_role = profile_role_label(token_info)

            # Return user profile from token
            logger.info("OAuth2 Proxy auth successful for user: %s", email)
            return {
                "id": user_id,
                "email": email,
                "username": username,
                "role": profile_role,
                "is_active": True,
                "created_at": datetime.now(UTC).isoformat(),
                "full_name": token_info.get("name"),
                "avatar_url": None,
                "bio": None,
                "preferences": {},
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Token validation failed")
            detail_msg = "Token validation failed"
            raise HTTPException(status_code=401, detail=detail_msg) from e

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting user profile")
        detail_msg = "Failed to get user profile"
        raise HTTPException(status_code=500, detail=detail_msg) from e
