#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Server-side HTML bootstrap for MobileAndroid EWA companion WebView (native AppAuth → embedded SPA).
# Invariants:
# - Access token is validated via auth provider; refresh token is passed through to SPA localStorage only.
# - Tokens are never logged; endpoint requires X-EliteEW-Mobile-WebView marker header.
# Related:
# - MobileAndroid EmperyEwaCompanionWebViewActivity.kt; documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# ---
"""Mobile embedded WebView session bootstrap (RFC 8252 / native-first OAuth pattern)."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status  # type: ignore[import-untyped]
from fastapi.responses import HTMLResponse  # type: ignore[import-untyped]

from api.core.unified_config import unified_settings
from api.services.auth_provider_service import AuthProviderService, get_auth_provider_service
from api.utils.json_safe import opaque_token_ref

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/mobile-embedded", tags=["Mobile Embedded WebView Auth"])

MOBILE_EMBEDDED_TOKEN_STORAGE_KEY = "eliteew.keycloak.mobileEmbedded.oidcTokens.v1"
MOBILE_EMBEDDED_FLAG_STORAGE_KEY = "eliteew.mobileEmbeddedClient.v1"
MOBILE_EMBEDDED_SPA_HASH_DEFAULT = "mobile-ewa-companion"
ALLOWED_MOBILE_EMBEDDED_SPA_HASHES = frozenset(
    {
        "mobile-ewa-companion",
        "mobile-handbook",
        "mobile-social-hub",
        "mobile-feedback-hub",
        "mobile-notifications",
        "mobile-content-manager",
        "mobile-ewdesk",
        "mobile-professional-worlds",
        "mobile-app-store",
        "mobile-desktop-settings",
    }
)
MOBILE_WEBVIEW_MARKER_HEADER = "x-eliteew-mobile-webview"
MOBILE_REFRESH_HEADER = "x-eliteew-mobile-refresh"
MIN_REFRESH_TOKEN_LEN = 8


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
        )
    return token.strip()


def _assert_mobile_webview_request(
    *,
    mobile_webview_marker: str | None,
    user_agent: str | None,
) -> None:
    marker = (mobile_webview_marker or "").strip()
    if marker != "1":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mobile embedded WebView marker required",
        )
    ua = (user_agent or "").lower()
    if not any(
        token in ua
        for token in (
            "emperymobileewawebview",
            "emperymobilehandbookwebview",
            "emperymobilesocialhubwebview",
            "emperymobilefeedbackhubwebview",
            "emperymobilenotificationswebview",
            "emperymobilecontentmanagerwebview",
            "emperymobileewdeskwebview",
            "emperymobileprofessionalworldswebview",
            "emperymobileappstorewebview",
            "emperymobiledesktopsettingswebview",
        )
    ):
        logger.warning("mobile embedded webview-shell: unexpected user-agent")


def _assert_mobile_client_token(payload: dict[str, Any]) -> None:
    expected_client = unified_settings.keycloak_mobile_client_id
    azp = str(payload.get("azp") or "").strip()
    if azp and azp != expected_client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access token must be issued for the mobile public client",
        )


def _request_web_origin(request: Request) -> str:
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",")[0].strip()
    host = forwarded_host or (request.headers.get("host") or "").split(",")[0].strip()
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    if not host:
        return "https://app.eliteew.ru"
    return f"{proto}://{host}".rstrip("/")


def _build_webview_shell_html(
    *,
    web_origin: str,
    access_token: str,
    refresh_token: str,
    spa_hash: str,
) -> str:
    storage_payload = {
        "token": access_token,
        "refreshToken": refresh_token,
        "persistence": "local",
        "savedAt": int(time.time() * 1000),
    }
    payload_js = json.dumps(storage_payload, ensure_ascii=True)
    redirect_url = f"{web_origin.rstrip('/')}/#/{spa_hash}"
    page_title = {
        "mobile-handbook": "Reference Navigation",
        "mobile-social-hub": "Social Hub",
        "mobile-feedback-hub": "Feedback",
        "mobile-notifications": "Notifications",
        "mobile-content-manager": "Файловый менеджер",
        "mobile-ewdesk": "EWDesk",
        "mobile-professional-worlds": "Professional Worlds",
        "mobile-app-store": "App Store",
        "mobile-desktop-settings": "Desktop Settings",
    }.get(spa_hash, "EWA")
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>{page_title}</title>
</head>
<body>
<script>
(function () {{
  try {{
    var payload = {payload_js};
    localStorage.setItem({json.dumps(MOBILE_EMBEDDED_TOKEN_STORAGE_KEY)}, JSON.stringify(payload));
    localStorage.setItem({json.dumps(MOBILE_EMBEDDED_FLAG_STORAGE_KEY)}, "1");
    location.replace({json.dumps(redirect_url)});
  }} catch (e) {{
    document.body.textContent = "Bootstrap failed";
  }}
}})();
</script>
</body>
</html>"""


@router.get(
    "/webview-shell",
    response_class=HTMLResponse,
    include_in_schema=False,
)
async def mobile_embedded_webview_shell(
    request: Request,
    authorization: str | None = Header(default=None),
    mobile_refresh: str | None = Header(default=None, alias="X-EliteEW-Mobile-Refresh"),
    mobile_webview_marker: str | None = Header(default=None, alias="X-EliteEW-Mobile-WebView"),
    spa: str | None = None,
    auth_provider: AuthProviderService = Depends(get_auth_provider_service),
) -> HTMLResponse:
    """
    Seed SPA localStorage for empery-mobile embedded profile, then redirect to a mobile SPA hash.

    Query `spa`: `mobile-ewa-companion` (default) or `mobile-handbook`.
    """
    _assert_mobile_webview_request(
        mobile_webview_marker=mobile_webview_marker,
        user_agent=request.headers.get("user-agent"),
    )

    access_token = _extract_bearer_token(authorization)
    refresh_token = (mobile_refresh or "").strip()
    if len(refresh_token) < MIN_REFRESH_TOKEN_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-EliteEW-Mobile-Refresh required",
        )

    try:
        payload = await auth_provider.validate_token(access_token)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(
            "mobile embedded webview-shell token validation failed ref=%s",
            opaque_token_ref(access_token),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    _assert_mobile_client_token(payload)

    if not payload.get("sub"):
        logger.warning(
            "mobile embedded webview-shell: access token missing sub (check Keycloak sub-access-token mapper)"
        )

    spa_hash = (spa or MOBILE_EMBEDDED_SPA_HASH_DEFAULT).strip().strip("/")
    if spa_hash not in ALLOWED_MOBILE_EMBEDDED_SPA_HASHES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported embedded SPA route",
        )

    html = _build_webview_shell_html(
        web_origin=_request_web_origin(request),
        access_token=access_token,
        refresh_token=refresh_token,
        spa_hash=spa_hash,
    )
    return HTMLResponse(
        content=html,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
        },
    )
