#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for unified auth error payloads and machine-readable reason contracts.
# Invariants:
# - Tests stay pure unit-level (no DB, Redis, Keycloak, or network).
# Related:
# - api.core.auth_errors
# ---
"""Unit tests for unified auth error payloads (no DB, no Keycloak)."""

from __future__ import annotations

import pytest

from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_ACTION_REFRESH,
    AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED,
    AUTH_REASON_TOKEN_EXPIRED,
    AUTH_REASON_TOKEN_MISSING,
    WS_CLOSE_CODE_AUTH,
    build_auth_error_body,
    build_auth_error_detail,
    ws_close_reason,
)


@pytest.mark.unit
def test_build_auth_error_body_default_login_action() -> None:
    body = build_auth_error_body(AUTH_REASON_TOKEN_MISSING)
    assert body["error"] == "unauthorized"
    assert body["reason"] == AUTH_REASON_TOKEN_MISSING
    assert body["action"] == AUTH_ACTION_LOGIN
    assert "detail" not in body


@pytest.mark.unit
def test_build_auth_error_body_with_detail() -> None:
    body = build_auth_error_body(
        AUTH_REASON_TOKEN_EXPIRED,
        action=AUTH_ACTION_REFRESH,
        detail="expired",
    )
    assert body["reason"] == AUTH_REASON_TOKEN_EXPIRED
    assert body["action"] == AUTH_ACTION_REFRESH
    assert body["detail"] == "expired"


@pytest.mark.unit
def test_build_auth_error_detail_matches_body_for_fastapi() -> None:
    d = build_auth_error_detail(AUTH_REASON_TOKEN_MISSING)
    assert d == build_auth_error_body(AUTH_REASON_TOKEN_MISSING)


@pytest.mark.unit
def test_confirmation_required_reason_is_supported() -> None:
    body = build_auth_error_body(AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED)
    assert body["reason"] == AUTH_REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED
    assert body["action"] == AUTH_ACTION_LOGIN


@pytest.mark.unit
def test_ws_close_reason_format() -> None:
    assert ws_close_reason(AUTH_REASON_TOKEN_MISSING) == f"auth:{AUTH_REASON_TOKEN_MISSING}"


@pytest.mark.unit
def test_ws_close_code_constant() -> None:
    assert WS_CLOSE_CODE_AUTH == 1008
