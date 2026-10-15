"""Keycloak JWT role helpers (no DB, no network)."""

from __future__ import annotations

import pytest

from api.core.keycloak_token_roles import (
    keycloak_payload_has_admin_access,
    keycloak_profile_role_label,
    keycloak_roles_list,
    normalized_api_path,
    path_allows_bearer_token_query_param,
)


@pytest.mark.unit
def test_keycloak_payload_has_admin_access_msi_on_api_client() -> None:
    payload = {"resource_access": {"empery-api": {"roles": ["msi"]}}}
    assert keycloak_payload_has_admin_access(payload) is True


@pytest.mark.unit
def test_keycloak_payload_has_admin_access_admin_on_web_client() -> None:
    payload = {"resource_access": {"empery-web": {"roles": ["admin"]}}}
    assert keycloak_payload_has_admin_access(payload) is True


@pytest.mark.unit
def test_keycloak_payload_has_admin_access_realm_admin() -> None:
    payload = {"realm_access": {"roles": ["admin"]}}
    assert keycloak_payload_has_admin_access(payload) is True


@pytest.mark.unit
def test_keycloak_payload_has_admin_access_retired_alias_roles_ignored() -> None:
    """Former realm role names are stripped; they must not grant privileges."""
    payload = {"realm_access": {"roles": ["brotherhood_admin"]}}
    assert keycloak_payload_has_admin_access(payload) is False


@pytest.mark.unit
def test_keycloak_payload_has_admin_access_emperyworld_admin_maps_to_admin() -> None:
    payload = {"realm_access": {"roles": ["emperyworld_admin"]}}
    assert keycloak_payload_has_admin_access(payload) is True


@pytest.mark.unit
def test_get_effective_role_preserves_emperyworld_admin() -> None:
    from api.core.token_roles import get_effective_role_from_payload

    payload = {"realm_access": {"roles": ["emperyworld_admin"]}}
    assert get_effective_role_from_payload(payload) == "emperyworld_admin"


@pytest.mark.unit
def test_get_effective_role_msi_is_admin() -> None:
    from api.core.token_roles import get_effective_role_from_payload

    payload = {"resource_access": {"empery-api": {"roles": ["msi"]}}}
    assert get_effective_role_from_payload(payload) == "admin"


@pytest.mark.unit
def test_get_effective_role_prefers_emperyworld_admin_over_admin() -> None:
    from api.core.token_roles import get_effective_role_from_payload

    payload = {"realm_access": {"roles": ["admin", "emperyworld_admin"]}}
    assert get_effective_role_from_payload(payload) == "emperyworld_admin"


@pytest.mark.unit
def test_keycloak_payload_has_admin_access_member_only() -> None:
    payload = {"realm_access": {"roles": ["emperyworld_member"]}}
    assert keycloak_payload_has_admin_access(payload) is False


@pytest.mark.unit
def test_keycloak_payload_has_admin_access_retired_member_alias_strips_to_empty() -> None:
    payload = {"realm_access": {"roles": ["brotherhood_member"]}}
    assert keycloak_payload_has_admin_access(payload) is False
    assert keycloak_roles_list(payload) == []


@pytest.mark.unit
def test_keycloak_roles_list_sorted_union() -> None:
    payload = {
        "realm_access": {"roles": ["zebra", "alpha"]},
        "resource_access": {"empery-api": {"roles": ["msi"]}},
    }
    assert keycloak_roles_list(payload) == ["alpha", "msi", "zebra"]


@pytest.mark.unit
def test_path_allows_bearer_token_query_param_allowlist() -> None:
    assert path_allows_bearer_token_query_param("/api/doc-editor/ai/image/view") is True
    assert path_allows_bearer_token_query_param("/api/doc-editor/ai/image/view/") is True
    assert path_allows_bearer_token_query_param("/api/v1/doc-editor/ai/image/view") is False
    assert path_allows_bearer_token_query_param("/api/doc-editor/ai/image/preview") is False


@pytest.mark.unit
def test_normalized_api_path() -> None:
    assert normalized_api_path("/api/foo/") == "/api/foo"
    assert normalized_api_path("/") == "/"


@pytest.mark.unit
def test_keycloak_profile_role_label_retired_admin_alias_defaults_to_member() -> None:
    payload = {"realm_access": {"roles": ["brotherhood_admin"]}}
    assert keycloak_profile_role_label(payload) == "emperyworld_member"


@pytest.mark.unit
def test_keycloak_profile_role_label_emperyworld_admin() -> None:
    payload = {"realm_access": {"roles": ["emperyworld_admin"]}}
    assert keycloak_profile_role_label(payload) == "emperyworld_admin"


@pytest.mark.unit
def test_keycloak_profile_role_label_emperyworld_member() -> None:
    payload = {"realm_access": {"roles": ["emperyworld_member"]}}
    assert keycloak_profile_role_label(payload) == "emperyworld_member"


@pytest.mark.unit
def test_keycloak_profile_role_label_retired_member_alias_defaults_to_member() -> None:
    payload = {"realm_access": {"roles": ["brotherhood_member"]}}
    assert keycloak_profile_role_label(payload) == "emperyworld_member"


@pytest.mark.unit
def test_keycloak_profile_role_label_msi_is_admin() -> None:
    payload = {"resource_access": {"empery-api": {"roles": ["msi"]}}}
    assert keycloak_profile_role_label(payload) == "admin"
