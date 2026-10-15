#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for APK distribution SSO registry exemptions.
# Invariants:
# - Only one-time ticket download bypasses registry enforcement; authenticated mobile APIs must not.
# Related:
# - api.services.sso_session_registry; api.routers.mobile_app
# ---

from __future__ import annotations

from api.core.unified_config import unified_settings
from api.services.sso_session_registry import (
    client_class_for_client_id,
    is_apk_distribution_redirect_uri,
    is_sso_registry_exempt_api_path,
)


def test_apk_download_redirect_uri_detected() -> None:
    assert is_apk_distribution_redirect_uri("https://app.eliteew.ru/mobile-app/")
    assert is_apk_distribution_redirect_uri("https://app.eliteew.ru/mobile-app")


def test_apk_download_redirect_uri_not_desktop() -> None:
    assert not is_apk_distribution_redirect_uri("https://app.eliteew.ru/")
    assert not is_apk_distribution_redirect_uri("https://app.eliteew.ru/#/desktop")


def test_apk_client_maps_to_mobile_registry_class() -> None:
    assert client_class_for_client_id(unified_settings.keycloak_apk_download_client_id) == "mobile"


def test_only_ticket_download_path_is_registry_exempt() -> None:
    assert is_sso_registry_exempt_api_path("/api/v1/mobile-app/download-by-ticket")
    assert is_sso_registry_exempt_api_path("/api/v1/mobile-app/download-by-ticket?ticket=abc")
    assert not is_sso_registry_exempt_api_path("/api/v1/mobile-app/overview")
    assert not is_sso_registry_exempt_api_path("/api/v1/mobile-app/download")
    assert not is_sso_registry_exempt_api_path("/api/v1/mobile-app/profile")
    assert not is_sso_registry_exempt_api_path("/api/v1/mobile-app/support-reports")
    assert not is_sso_registry_exempt_api_path("/api/v1/profile/me")
