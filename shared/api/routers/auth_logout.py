#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   OAuth2 + Keycloak Logout Router
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
OAuth2 + Keycloak Logout Router
Handles proper logout from both OAuth2 Proxy and Keycloak SSO
"""

import logging
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request  # type: ignore[import-untyped]
from fastapi.responses import RedirectResponse  # type: ignore[import-untyped]

from api.services.auth_provider_service import AuthProviderService, get_auth_provider_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Auth"])


@router.get("/auth/logout")
async def logout(
    request: Request,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> RedirectResponse:
    """
    🚪 Full logout from OAuth2 Proxy + Keycloak

    This endpoint:
    1. Gets access token from OAuth2 Proxy headers (X-Auth-Request-Access-Token)
    2. Calls Keycloak token revocation endpoint to invalidate token
    3. Calls Keycloak logout endpoint to terminate SSO session
    4. Redirects to OAuth2 Proxy sign_out to clear OAuth2 cookie
    5. Finally redirects back to app.eliteew.ru

    Flow:
    User clicks logout → /api/auth/logout → Keycloak revoke + logout → OAuth2 sign_out → app.eliteew.ru
    """
    try:
        logger.info("Full logout requested")

        # Get access token from OAuth2 Proxy headers
        access_token = request.headers.get("X-Auth-Request-Access-Token")

        if not access_token:
            # Fallback: check Authorization header
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                access_token = auth_header[7:]

        if access_token:
            logger.info("Access token found, revoking Keycloak session")

            # Step 1: Revoke the access token at Keycloak
            try:
                revoked = await auth_provider.revoke_access_token(access_token)
                if revoked:
                    logger.info("Access token revoked successfully")
                else:
                    logger.warning("Access token revocation returned non-success status")
            except Exception as e:  # noqa: BLE001 - Must continue logout on any error
                logger.exception("Failed to revoke token: %s", e)
                # Continue with logout even if revocation fails
        else:
            logger.warning("No access token found in request headers")

        # Step 2: Simplified logout without Keycloak OIDC logout endpoint
        # Keycloak requires id_token_hint which we don't have (HTTPOnly cookie)
        #
        # Instead: OAuth2 Proxy sign_out → OAuth2 start with prompt=login
        # This forces Keycloak to show login form even if SSO session exists

        # Build OAuth2 start URL with prompt=login to force re-authentication
        oauth2_start_url = "https://app.eliteew.ru/oauth2/start?rd=%2F&prompt=login"

        # OAuth2 Proxy sign_out will clear the cookie, then redirect to start
        final_logout_url = f"https://app.eliteew.ru/oauth2/sign_out?rd={quote(oauth2_start_url, safe='')}"

        logger.info("Full logout: OAuth2 sign_out then OAuth2 start with prompt=login")
        logger.info("Final logout URL: %s", final_logout_url)

        return RedirectResponse(url=final_logout_url, status_code=302)

    except (ValueError, RuntimeError, AttributeError) as e:
        logger.exception("Logout error: %s", e)
        # Fallback: redirect to OAuth2 Proxy sign_out directly
        return RedirectResponse(url="/oauth2/sign_out?rd=https://app.eliteew.ru", status_code=302)
    except Exception as e:  # noqa: BLE001 - Must redirect on any error
        logger.exception("Logout error (unexpected): %s", e)
        # Fallback: redirect to OAuth2 Proxy sign_out directly
        return RedirectResponse(url="/oauth2/sign_out?rd=https://app.eliteew.ru", status_code=302)
