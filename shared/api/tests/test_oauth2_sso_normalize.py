"""SSO email normalization for Keycloak sync (unit, no DB)."""

from __future__ import annotations

import pytest

from api.core.oauth2_auth import _normalize_sso_email


@pytest.mark.unit
def test_normalize_sso_email_strips_and_lowers() -> None:
    assert _normalize_sso_email("  Tanya@Empery.World \n") == "tanya@eliteew.ru"


@pytest.mark.unit
def test_normalize_sso_email_empty() -> None:
    assert _normalize_sso_email(None) == ""
    assert _normalize_sso_email("") == ""
    assert _normalize_sso_email("   ") == ""
