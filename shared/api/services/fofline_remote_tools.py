# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fail-closed remote-tools allowlist for FoFline (empery-fofline) bearer tokens.
# Invariants:
# - Non-FoFline clients are not gated here (RBAC / other guards apply).
# - Default deny for admin / platform-ops / marketing / factory families.
# - Deny desktop Admin + site-manager even under broad `/api/v1/desktop` allow.
# - Extra prefixes only via Config Plane env FOFLINE_REMOTE_TOOLS_EXTRA_PREFIXES (CSV).
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §7 / W5
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §3.4 / §12
# ---

from __future__ import annotations

import logging
from typing import Final

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

# Frozen product allowlist for FoFline connected SPA over WG (same stack0, scoped).
# Keep aligned with shared/apps/_profiles/fofline-connected.yaml surface apps:
# - assistant / ewdesk / surveys → `/api/v1/product-desktop/*` (admin surveys stay denied)
# - ContentManagerPro tenancy filters → `/api/v1/companies`, `/api/v1/projects`
# - calendar → `/api/v1/desktop/calendar` (already under `/api/v1/desktop`)
# - social hub → `/api/v1/friends` (admin reports denied)
# - kursorina → `/api/v1/kursorina`
# - DocEditorV2 → `/api/v1/doc-editor-v2`
# - presentations (EWRP) → `/api/v1/ewrp`
# - image studio → `/api/v1/image-studio`
# - professional worlds → `/api/v1/professional-worlds` (admin denied)
# Desktop shell bootstrap needs `/api/v1/profile/*` (me/preferences/notification-center);
# `/api/v1/users/me` alone is not the living FE profile boundary.
# 1:1 calls start in GAF; signaling is Socket.IO; recovery poll is video-calls.
# Do not treat FOFLINE_REMOTE_TOOLS_EXTRA_PREFIXES as the baseline for these families.
_FOFLINE_ALLOW_PREFIXES: Final[tuple[str, ...]] = (
    "/api/health",
    "/api/version",
    "/api/v1/auth",
    "/api/v1/desktop-client",
    "/api/v1/desktop",
    "/api/v1/product-desktop",
    "/api/v1/ewa",
    "/api/v1/shell",
    "/api/v1/ugs",
    "/api/v1/content",
    "/api/v1/files",
    "/api/v1/profile",
    "/api/v1/users/me",
    "/api/v1/presence",
    "/api/v1/live-voice",
    "/api/v1/companies",
    "/api/v1/projects",
    "/api/v1/gaf-chat",
    "/api/v1/video-calls",
    "/api/v1/friends",
    "/api/v1/kursorina",
    "/api/v1/doc-editor-v2",
    "/api/v1/ewrp",
    "/api/v1/image-studio",
    "/api/v1/professional-worlds",
    "/api/v1/ebrowser",
)

_FOFLINE_DENY_PREFIXES: Final[tuple[str, ...]] = (
    "/api/v1/admin",
    "/api/admin",
    "/api/v1/platform-ops",
    "/api/v1/marketing",
    "/api/v1/amka",
    "/api/v1/factory",
    "/api/v1/desktop-app-manifests/factory",
    # product-desktop allow covers assistant/ewdesk; keep admin survey hub fail-closed at W5
    "/api/v1/product-desktop/admin",
    # Broad `/api/v1/desktop` allow must not open Admin Desktop / site ops (canvas P2)
    "/api/v1/desktop/admin",
    "/api/v1/desktop/site-manager",
    "/api/v1/friends/admin",
    "/api/v1/professional-worlds/admin",
)


def is_fofline_oauth_client(client_id: str | None) -> bool:
    """True when azp / client_id matches configured FoFline public client."""

    cid = (client_id or "").strip()
    if not cid:
        return False
    expected = str(unified_settings.keycloak_fofline_client_id or "empery-fofline").strip()
    return cid == expected


def token_azp_or_client_id(token_info: dict | None) -> str | None:
    """Best-effort OAuth client id from introspection / JWT claims."""

    if not isinstance(token_info, dict):
        return None
    for key in ("azp", "client_id", "clientId"):
        raw = token_info.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def should_apply_fofline_remote_tools_gate(
    token_info: dict | None,
    *,
    client_class: str | None,
) -> bool:
    """
    Apply W5 allowlist when SSO class is fofline **or** token azp is empery-fofline.

    Registry skip (claims=None, allowed=True) must not bypass fail-closed gating
    for FoFline native tokens.
    """

    if (client_class or "").strip() == "fofline":
        return True
    return is_fofline_oauth_client(token_azp_or_client_id(token_info))


def _extra_allow_prefixes() -> tuple[str, ...]:
    raw = str(getattr(unified_settings, "fofline_remote_tools_extra_prefixes", "") or "").strip()
    if not raw:
        return ()
    out: list[str] = []
    for part in raw.split(","):
        p = part.strip()
        if p.startswith("/"):
            out.append(p.rstrip("/") or p)
    return tuple(out)


def fofline_remote_tools_allow_prefixes() -> tuple[str, ...]:
    """Effective allow prefixes (built-in + optional Config Plane extras)."""

    return _FOFLINE_ALLOW_PREFIXES + _extra_allow_prefixes()


def normalize_api_path(path: str | None) -> str:
    normalized = (path or "").split("?", 1)[0].strip() or "/"
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    return normalized


def fofline_path_allowed(path: str | None) -> bool:
    """Fail-closed: deny listed families first, then require allow prefix match."""

    normalized = normalize_api_path(path)
    for deny in _FOFLINE_DENY_PREFIXES:
        if normalized == deny or normalized.startswith(f"{deny}/"):
            return False
    for allow in fofline_remote_tools_allow_prefixes():
        if normalized == allow or normalized.startswith(f"{allow}/"):
            return True
    return False


def fofline_remote_tools_deny_reason(path: str | None) -> str | None:
    """Return machine reason when FoFline must not call this path; else None."""

    if fofline_path_allowed(path):
        return None
    logger.info(
        "[STEP] fofline_remote_tools_deny path=%s",
        normalize_api_path(path),
    )
    return "fofline_remote_tools_denied"
