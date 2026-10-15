# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Continuity W0 lock: declared browser SSO session policy values.
# Invariants:
# - Harden defaults until W1; target matches locked Continuity contract.
# Related:
# - api.services.web_browser_sso_session_policy
# - documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md §W0
# ---

from __future__ import annotations

from api.services.web_browser_sso_session_policy import get_web_browser_sso_session_policy


def test_declared_current_matches_keycloak_harden_defaults() -> None:
    policy = get_web_browser_sso_session_policy(source="declared_current")
    assert policy["client_id"] == "empery-web"
    assert policy["access_token_lifespan_sec"] == 900
    assert policy["sso_session_idle_timeout_sec"] == 43_200
    assert policy["sso_session_max_lifespan_sec"] == 86_400
    assert policy["sso_session_idle_timeout_remember_me_sec"] == 1_209_600
    assert policy["sso_session_max_lifespan_remember_me_sec"] == 1_209_600
    assert policy["revoke_refresh_token"] is True
    assert policy["refresh_token_max_reuse"] == 0


def test_target_locked_matches_continuity_contract() -> None:
    policy = get_web_browser_sso_session_policy(source="target_locked")
    assert policy["sso_session_idle_timeout_sec"] == 43_200
    assert policy["sso_session_max_lifespan_sec"] == 86_400
    current = get_web_browser_sso_session_policy(source="declared_current")
    assert policy["sso_session_idle_timeout_sec"] == current["sso_session_idle_timeout_sec"]
    assert policy["sso_session_max_lifespan_sec"] == current["sso_session_max_lifespan_sec"]


def test_env_override_idle_for_staging_smoke(monkeypatch) -> None:
    monkeypatch.setenv("WEB_SSO_IDLE_TIMEOUT_SEC", "120")
    policy = get_web_browser_sso_session_policy(source="declared_current")
    assert policy["sso_session_idle_timeout_sec"] == 120


def test_harden_script_defaults_match_continuity_w1() -> None:
    from pathlib import Path

    script = Path(__file__).resolve().parents[3] / "docker/scripts/keycloak-harden-empery-realm.sh"
    text = script.read_text(encoding="utf-8")
    assert "KEYCLOAK_SSO_SESSION_IDLE_TIMEOUT_SEC:-43200" in text
    assert "KEYCLOAK_SSO_SESSION_MAX_LIFESPAN_SEC:-86400" in text
    assert "KEYCLOAK_SSO_SESSION_IDLE_TIMEOUT_REMEMBER_ME_SEC:-1209600" in text
    assert "KEYCLOAK_ACCESS_TOKEN_LIFESPAN_SEC:-900" in text
    assert ".ssoSessionIdleTimeout = 7200" not in text
    assert ".ssoSessionMaxLifespan = 28800" not in text
