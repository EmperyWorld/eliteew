# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow lock for FoFline W1: empery-fofline → client_class=fofline and
# browser↔fofline XOR policy helpers (displace/deny/off).
# Related:
# - api/services/sso_session_claims.py
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
# ---

from __future__ import annotations

from api.core.token_roles import collect_token_roles
from api.services.sso_session_claims import (
    client_class_for_client_id,
    fofline_browser_xor_partner,
    normalize_fofline_browser_xor_policy,
    resolve_public_client_id,
    sso_claims_from_payload,
)


def test_resolve_public_client_id_prefers_fofline_when_allowed() -> None:
    cid = resolve_public_client_id(
        redirect_uri="https://app.eliteew.ru/",
        requested_client_id="empery-fofline",
    )
    assert cid == "empery-fofline"


def test_client_class_fofline() -> None:
    assert client_class_for_client_id("empery-fofline") == "fofline"
    assert client_class_for_client_id("empery-web") == "browser"
    assert client_class_for_client_id("empery-desktop") == "desktop"
    assert client_class_for_client_id("empery-mobile") == "mobile"


def test_sso_claims_oauth_client_id_fofline() -> None:
    claims = sso_claims_from_payload(
        {
            "sub": "user-fofline-1",
            "sid": "sid-fofline-1",
            "azp": "empery-web",
            "preferred_username": "fof",
        },
        oauth_client_id="empery-fofline",
    )
    assert claims is not None
    assert claims.client_class == "fofline"
    assert claims.client_id == "empery-fofline"


def test_fofline_browser_xor_partner_matrix() -> None:
    assert fofline_browser_xor_partner("fofline") == "browser"
    assert fofline_browser_xor_partner("browser") == "fofline"
    assert fofline_browser_xor_partner("desktop") is None
    assert fofline_browser_xor_partner("mobile") is None


def test_normalize_fofline_browser_xor_policy() -> None:
    assert normalize_fofline_browser_xor_policy("displace") == "displace"
    assert normalize_fofline_browser_xor_policy("DENY") == "deny"
    assert normalize_fofline_browser_xor_policy("off") == "off"
    assert normalize_fofline_browser_xor_policy("weird") == "displace"
    assert normalize_fofline_browser_xor_policy(None) == "displace"


def test_token_roles_include_fofline_resource_access() -> None:
    roles = collect_token_roles(
        {
            "realm_access": {"roles": []},
            "resource_access": {
                "empery-fofline": {"roles": ["admin"]},
                "empery-api": {"roles": []},
            },
        }
    )
    assert "admin" in roles
