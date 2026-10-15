# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for production fetch_url allowlist enforcement.
# Related:
# - api/services/desktop_chat/fetch_url_policy.py
# ---

from __future__ import annotations

import pytest


def test_fetch_url_blocked_when_prod_and_empty_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_chat.fetch_url_policy import fetch_url_policy_blocked

    monkeypatch.setenv("ELITEEW_RUNTIME_PROFILE", "prod")
    monkeypatch.delenv("DESKTOP_FETCH_URL_REQUIRE_ALLOWLIST", raising=False)
    msg = fetch_url_policy_blocked([])
    assert msg is not None
    assert "fetch_url_allow_hosts" in msg


def test_fetch_url_allowed_when_dev_and_empty_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_chat.fetch_url_policy import fetch_url_policy_blocked

    monkeypatch.setenv("ELITEEW_RUNTIME_PROFILE", "dev")
    assert fetch_url_policy_blocked([]) is None


def test_merge_allow_hosts_env_and_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.desktop_chat.fetch_url_policy import merge_fetch_url_allow_hosts

    monkeypatch.setenv("DESKTOP_FETCH_URL_ALLOW_HOSTS", "example.com, wikipedia.org")
    merged = merge_fetch_url_allow_hosts({"fetch_url_allow_hosts": ["eliteew.ru"]})
    assert merged == ["eliteew.ru", "example.com", "wikipedia.org"]


def test_admin_defaults_merge_rejects_empty_allowlist_in_prod(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi import HTTPException

    from api.routers.desktop_admin_ai_chat import _validate_defaults_merge

    monkeypatch.setenv("ELITEEW_RUNTIME_PROFILE", "prod")
    with pytest.raises(HTTPException) as exc:
        _validate_defaults_merge({}, {"tools_fetch_url_enabled": True, "fetch_url_allow_hosts": []})
    assert exc.value.status_code == 400
    assert "fetch_url_allow_hosts" in str(exc.value.detail)
