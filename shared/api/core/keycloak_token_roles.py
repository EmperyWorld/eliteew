# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backward-compatible import surface for legacy Keycloak token role helper names.
# New code should import shared helpers from api.core.token_roles directly.
# Invariants:
# - Keep this module side-effect free: no DB, network, or request access.
# - Re-export legacy names without changing token role semantics.
# Related:
# - api.core.token_roles
# ---
"""Backward-compatible exports for token role helpers.

Kept for compatibility with existing imports. New code should prefer
`api.core.token_roles`.
"""

from __future__ import annotations

from typing import Any

from api.core.token_roles import (
    collect_token_roles,
    normalized_api_path,
    path_allows_bearer_token_query_param,
    payload_has_admin_access,
    profile_role_label,
    token_roles_list,
)

__all__ = [
    "collect_keycloak_roles",
    "keycloak_payload_has_admin_access",
    "keycloak_profile_role_label",
    "keycloak_roles_list",
    "normalized_api_path",
    "path_allows_bearer_token_query_param",
]


def collect_keycloak_roles(payload: dict[str, Any]) -> set[str]:
    """Compatibility alias for old name."""
    return collect_token_roles(payload)


def keycloak_payload_has_admin_access(payload: dict[str, Any]) -> bool:
    """Compatibility alias for old name."""
    return payload_has_admin_access(payload)


def keycloak_roles_list(payload: dict[str, Any]) -> list[str]:
    """Compatibility alias for old name."""
    return token_roles_list(payload)


def keycloak_profile_role_label(payload: dict[str, Any]) -> str:
    """Compatibility alias for old name."""
    return profile_role_label(payload)
