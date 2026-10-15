# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock empery-desktop SSO client resolution and desktop session class (Wave 4).
# Related:
# - api/services/sso_session_claims.py
# ---

from __future__ import annotations

from api.core.token_roles import collect_token_roles
from api.services.sso_session_claims import (
    client_class_for_client_id,
    resolve_public_client_id,
)


def test_resolve_public_client_id_prefers_desktop_when_allowed() -> None:
    cid = resolve_public_client_id(
        redirect_uri="https://app.eliteew.ru/",
        requested_client_id="empery-desktop",
    )
    assert cid == "empery-desktop"


def test_resolve_public_client_id_ignores_unknown_requested() -> None:
    cid = resolve_public_client_id(
        redirect_uri="https://app.eliteew.ru/",
        requested_client_id="not-a-real-client",
    )
    assert cid == "empery-web"


def test_client_class_desktop() -> None:
    assert client_class_for_client_id("empery-desktop") == "desktop"
    assert client_class_for_client_id("empery-web") == "browser"


def test_token_roles_include_desktop_resource_access() -> None:
    roles = collect_token_roles(
        {
            "realm_access": {"roles": []},
            "resource_access": {
                "empery-desktop": {"roles": ["admin"]},
                "empery-api": {"roles": []},
            },
        }
    )
    assert "admin" in roles
