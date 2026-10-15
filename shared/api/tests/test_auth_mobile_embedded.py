#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for mobile embedded WebView bootstrap shell (native AppAuth → SPA localStorage).
# Invariants:
# - No network; auth provider is mocked at the router boundary.
# Related:
# - api.routers.auth_mobile_embedded
# ---
"""Tests for mobile embedded WebView bootstrap shell."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi import HTTPException, status
from starlette.requests import Request

from api.routers.auth_mobile_embedded import (
    MOBILE_EMBEDDED_FLAG_STORAGE_KEY,
    MOBILE_EMBEDDED_TOKEN_STORAGE_KEY,
    mobile_embedded_webview_shell,
)


class _MobileAuthProvider:
    def __init__(self, payload: dict[str, object] | None = None, *, fail: bool = False) -> None:
        self._payload = payload or {"sub": "user-1", "azp": "empery-mobile"}
        self._fail = fail

    async def validate_token(self, _token: str) -> dict[str, object]:
        if self._fail:
            raise RuntimeError("validation unavailable")
        return dict(self._payload)


async def _call_shell(
    *,
    authorization: str = "Bearer access-token",
    refresh: str = "refresh-token-value",
    marker: str = "1",
    user_agent: str = "EmperyMobileEwaWebView/1.0",
    provider: _MobileAuthProvider | None = None,
    host: str = "app.eliteew.ru",
    spa: str | None = None,
):
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/auth/mobile-embedded/webview-shell",
        "headers": [
            (b"user-agent", user_agent.encode()),
            (b"host", host.encode()),
            (b"x-forwarded-proto", b"https"),
        ],
    }
    return await mobile_embedded_webview_shell(
        request=Request(scope),
        authorization=authorization,
        mobile_refresh=refresh,
        mobile_webview_marker=marker,
        spa=spa,
        auth_provider=provider or _MobileAuthProvider(),
    )


def test_webview_shell_seeds_local_storage_and_redirects() -> None:
    response = asyncio.run(_call_shell())
    assert response.status_code == 200
    assert MOBILE_EMBEDDED_TOKEN_STORAGE_KEY in bytes(response.body).decode()
    assert MOBILE_EMBEDDED_FLAG_STORAGE_KEY in bytes(response.body).decode()
    assert "location.replace" in bytes(response.body).decode()
    assert "https://app.eliteew.ru/#/mobile-ewa-companion" in bytes(response.body).decode()
    assert "access-token" in bytes(response.body).decode()
    assert "refresh-token-value" in bytes(response.body).decode()


def test_webview_shell_handbook_route() -> None:
    response = asyncio.run(_call_shell(spa="mobile-handbook"))
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-handbook" in body


def test_webview_shell_social_hub_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-social-hub",
            user_agent="EmperyMobileSocialHubWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-social-hub" in body


def test_webview_shell_feedback_hub_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-feedback-hub",
            user_agent="EmperyMobileFeedbackHubWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-feedback-hub" in body


def test_webview_shell_notifications_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-notifications",
            user_agent="EmperyMobileNotificationsWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-notifications" in body


def test_webview_shell_content_manager_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-content-manager",
            user_agent="EmperyMobileContentManagerWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-content-manager" in body


def test_webview_shell_ewdesk_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-ewdesk",
            user_agent="EmperyMobileEwDeskWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-ewdesk" in body


def test_webview_shell_professional_worlds_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-professional-worlds",
            user_agent="EmperyMobileProfessionalWorldsWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-professional-worlds" in body


def test_webview_shell_app_store_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-app-store",
            user_agent="EmperyMobileAppStoreWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-app-store" in body


def test_webview_shell_desktop_settings_route() -> None:
    response = asyncio.run(
        _call_shell(
            spa="mobile-desktop-settings",
            user_agent="EmperyMobileDesktopSettingsWebView/1.0",
        )
    )
    body = bytes(response.body).decode()
    assert response.status_code == 200
    assert "https://app.eliteew.ru/#/mobile-desktop-settings" in body


def test_webview_shell_rejects_unknown_spa() -> None:
    with pytest.raises(HTTPException) as ei:
        asyncio.run(_call_shell(spa="mobile-unknown"))
    assert ei.value.status_code == status.HTTP_400_BAD_REQUEST


def test_webview_shell_rejects_missing_marker() -> None:
    with pytest.raises(HTTPException) as ei:
        asyncio.run(_call_shell(marker=""))
    assert ei.value.status_code == status.HTTP_403_FORBIDDEN


def test_webview_shell_rejects_wrong_azp() -> None:
    with pytest.raises(HTTPException) as ei:
        asyncio.run(_call_shell(provider=_MobileAuthProvider({"sub": "u", "azp": "empery-web"})))
    assert ei.value.status_code == status.HTTP_403_FORBIDDEN


def test_webview_shell_rejects_short_refresh() -> None:
    with pytest.raises(HTTPException) as ei:
        asyncio.run(_call_shell(refresh="short"))
    assert ei.value.status_code == status.HTTP_400_BAD_REQUEST


def test_webview_shell_html_payload_is_json_safe() -> None:
    token = 'token";alert(1);//'
    refresh = 'refresh";alert(1);//'
    response = asyncio.run(_call_shell(authorization=f"Bearer {token}", refresh=refresh))
    body = bytes(response.body).decode()
    assert "<script>alert" not in body
    assert json.dumps(token) in body or token.replace('"', '\\"') in body
