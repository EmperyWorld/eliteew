# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Unit tests for :func:`api.core.token_roles.persistable_users_role_from_payload`
#   (PostgreSQL ``users.role`` CHECK vs JWT runtime role label).
# Invariants:
#   - No database; payloads are plain dicts.
# Related:
#   - shared/api/core/token_roles.py, shared/api/core/oauth2_auth.py
# ---
from __future__ import annotations

from api.core.token_roles import persistable_users_role_from_payload


def test_persistable_maps_default_member_token_to_brotherhood_member() -> None:
    payload = {"realm_access": {"roles": ["emperyworld_member"]}}
    assert persistable_users_role_from_payload(payload) == "brotherhood_member"


def test_persistable_retired_brotherhood_token_yields_pg_member_via_default_runtime() -> None:
    """``brotherhood_member`` tokens are stripped → runtime default maps to persisted brotherhood."""
    payload = {"realm_access": {"roles": ["brotherhood_member"]}}
    assert persistable_users_role_from_payload(payload) == "brotherhood_member"


def test_persistable_admin_admin_msi_unchanged() -> None:
    assert persistable_users_role_from_payload({"realm_access": {"roles": ["admin"]}}) == "admin"
    assert persistable_users_role_from_payload({"resource_access": {"empery-api": {"roles": ["msi"]}}}) == "admin"


def test_persistable_emperyworld_admin_maps_to_admin_for_pg_check() -> None:
    """PG users_role_valid has no emperyworld_admin; runtime role stays separate."""
    payload = {"realm_access": {"roles": ["emperyworld_admin"]}}
    assert persistable_users_role_from_payload(payload) == "admin"


def test_persistable_moderator_and_ai_agent_unchanged() -> None:
    assert persistable_users_role_from_payload({"realm_access": {"roles": ["moderator"]}}) == "moderator"
    assert persistable_users_role_from_payload({"realm_access": {"roles": ["ai_agent"]}}) == "ai_agent"
