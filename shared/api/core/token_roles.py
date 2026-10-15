# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Map Keycloak JWT ``realm_access`` / ``resource_access`` roles into API/runtime labels and Postgres-safe persistence.
# Invariants:
#   - Retired role tokens are stripped from privilege sets; Postgres ``users.role`` uses ``persistable_*`` helpers.
# Related:
#   - shared/api/core/oauth2_auth.py; Keycloak mapper notes under documentation/platform.
# ---
"""Runtime imports re-export JWT role helpers (module summary kept for doctest-friendly browsing)."""

from __future__ import annotations

from typing import Any

from api.core.unified_config import unified_settings

# Retired realm/client role strings from a former product id (no longer accepted).
_RETIRED_ROLE_TOKENS = frozenset({"brotherhood_admin", "brotherhood_member"})

_ADMIN_ACCESS_ROLES = frozenset({"admin", "emperyworld_admin", "msi"})


def _configured_resource_client_ids() -> list[str]:
    fallback = [
        str(unified_settings.keycloak_client_id or "empery-api").strip(),
        str(unified_settings.keycloak_web_client_id or "empery-web").strip(),
        str(unified_settings.keycloak_mobile_client_id or "empery-mobile").strip(),
        str(unified_settings.keycloak_desktop_client_id or "empery-desktop").strip(),
        str(unified_settings.keycloak_fofline_client_id or "empery-fofline").strip(),
    ]
    raw = (unified_settings.auth_role_client_ids or "").strip()
    if raw:
        configured = [part.strip() for part in raw.split(",") if part.strip()]
        return configured + [client_id for client_id in fallback if client_id and client_id not in configured]
    return fallback


def _realm_roles(payload: dict[str, Any]) -> list[str]:
    ra = payload.get("realm_access")
    if not isinstance(ra, dict):
        return []
    roles = ra.get("roles")
    if not isinstance(roles, list):
        return []
    return [str(r) for r in roles]


def _resource_roles(payload: dict[str, Any]) -> list[str]:
    rc = payload.get("resource_access")
    if not isinstance(rc, dict):
        return []
    out: list[str] = []
    for cid in _configured_resource_client_ids():
        bucket = rc.get(cid)
        if not isinstance(bucket, dict):
            continue
        roles = bucket.get("roles")
        if not isinstance(roles, list):
            continue
        out.extend(str(r) for r in roles)
    return out


def collect_token_roles(payload: dict[str, Any]) -> set[str]:
    combined = set(_realm_roles(payload) + _resource_roles(payload))
    return combined - _RETIRED_ROLE_TOKENS


def token_roles_list(payload: dict[str, Any]) -> list[str]:
    return sorted(collect_token_roles(payload))


def payload_has_admin_access(payload: dict[str, Any]) -> bool:
    return bool(collect_token_roles(payload) & _ADMIN_ACCESS_ROLES)


def payload_has_ew_family(payload: dict[str, Any]) -> bool:
    return "ew_family" in collect_token_roles(payload)


def get_effective_role_from_payload(payload: dict[str, Any]) -> str:
    """Map JWT roles to runtime ``User.role`` string (SPA / API-facing label).

    Privilege precedence (highest first):
    - ``emperyworld_admin`` — required by ``require_emperyworld_admin`` (revoke/purge, etc.)
    - ``admin`` / ``msi`` — generic admin (``require_admin_user``)
    """

    roles = collect_token_roles(payload)
    if "emperyworld_admin" in roles:
        return "emperyworld_admin"
    if roles & ({"admin", "msi"}):
        return "admin"
    if "moderator" in roles:
        return "moderator"
    if "ai_agent" in roles:
        return "ai_agent"
    return "emperyworld_member"


def persistable_users_role_from_payload(payload: dict[str, Any]) -> str:
    """Map JWT payload to ``public.users.role`` values allowed by PostgreSQL CHECK.

    Production ``users_role_valid`` allows ``admin``, ``brotherhood_member``, ``ai_agent``,
    ``moderator`` — not JWT/runtime labels ``emperyworld_member`` / ``emperyworld_admin``.

    Runtime ``User.role`` must still use :func:`get_effective_role_from_payload` (do **not**
    collapse ``emperyworld_admin`` there — ``require_emperyworld_admin`` depends on it).
    Persisting ``emperyworld_admin`` into ``users.role`` causes CHECK failures and SSO sync
    storms (every request retries UPDATE).
    """
    mapped = get_effective_role_from_payload(payload)
    if mapped == "emperyworld_member":
        return "brotherhood_member"
    if mapped == "emperyworld_admin":
        return "admin"
    return mapped


def profile_role_label(payload: dict[str, Any]) -> str:
    """Short UI label derived from JWT roles (canonical Empery World names only)."""

    roles = collect_token_roles(payload)
    # Same precedence as get_effective_role_from_payload — do not collapse EW admin → admin.
    if "emperyworld_admin" in roles:
        return "emperyworld_admin"
    if "admin" in roles or "msi" in roles:
        return "admin"
    if "emperyworld_member" in roles:
        return "emperyworld_member"
    if roles:
        return sorted(roles)[0]
    return "emperyworld_member"


def normalized_api_path(path: str) -> str:
    if path == "/":
        return "/"
    return path.rstrip("/") or "/"


def path_allows_bearer_token_query_param(path: str) -> bool:
    """Allow ``?token=`` only where ``Authorization`` cannot be sent (e.g. image tags)."""
    p = normalized_api_path(path)
    return p == "/api/doc-editor/ai/image/view"
