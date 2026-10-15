#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structural lock for keycloak-auth-003 SSO registry atomization.
# Invariants:
# - Facade ≤200 LOC; claims/enforce/query each ≤800 LOC.
# - Public import path api.services.sso_session_registry re-exports symbols.
# Related:
# - api.services.sso_session_registry*; documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# ---
"""SSO session registry atomization contract."""

from __future__ import annotations

from pathlib import Path

import api.services.sso_session_registry as facade

SERVICES = Path(__file__).resolve().parents[1] / "services"


def _loc(name: str) -> int:
    return len((SERVICES / name).read_text(encoding="utf-8").splitlines())


def test_sso_registry_modules_under_loc_caps() -> None:
    assert _loc("sso_session_registry.py") <= 200
    for name in (
        "sso_session_claims.py",
        "sso_session_registry_enforce.py",
        "sso_session_registry_query.py",
    ):
        assert _loc(name) <= 800, name


def test_facade_reexports_public_symbols() -> None:
    for symbol in (
        "SsoSessionRegistry",
        "SsoSessionRegistryUnavailable",
        "get_sso_session_registry",
        "enrich_sso_payload_for_registry",
        "sso_claims_from_payload",
        "batch_sso_sessions_for_user_ids",
        "list_sso_login_history_for_user",
        "should_require_session_replace_confirmation",
    ):
        assert hasattr(facade, symbol), symbol
