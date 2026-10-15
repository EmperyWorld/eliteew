# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fail-closed remote-tools allowlist for client edition hosts
# (ELITEEW_PRODUCT_EDITION=client).
# Invariants:
# - Cloud/onprem hosts are not gated here (RBAC / FoFline gate apply).
# - tools.remote deny-by-default: only bootstrap + mapped manifest tools + env extras.
# - /api/v1/desktop/admin and factory/marketing families stay denied.
# Related:
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §3.4 / §12
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md
# - api/services/fofline_remote_tools.py (sibling pattern)
# ---

from __future__ import annotations

import logging
from typing import Final

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

# Bootstrap surface for optional online redeem / OIDC / install-profile — not full Desktop SPA.
_CLIENT_CORE_ALLOW_PREFIXES: Final[tuple[str, ...]] = (
    "/api/health",
    "/api/version",
    "/api/v1/auth",
    "/api/v1/desktop-client",
    "/api/v1/desktop/install-profile",
    "/api/v1/profile",
    "/api/v1/users/me",
)

_CLIENT_DENY_PREFIXES: Final[tuple[str, ...]] = (
    "/api/v1/admin",
    "/api/admin",
    "/api/v1/platform-ops",
    "/api/v1/desktop/admin",
    "/api/v1/marketing",
    "/api/v1/amka",
    "/api/v1/factory",
    "/api/v1/desktop-app-manifests/factory",
    "/api/v1/product-desktop/admin",
)

# Manifest `client.remote_tools_allowlist` tool ids → API path prefixes (API enforcement).
_REMOTE_TOOL_ID_PREFIXES: Final[dict[str, tuple[str, ...]]] = {
    "llm.eliteew": ("/api/v1/desktop/ai-chat",),
}


def should_apply_client_remote_tools_gate() -> bool:
    """True when this stack0 host is configured as the client product edition."""

    edition = str(getattr(unified_settings, "eliteew_product_edition", "cloud") or "cloud").strip()
    return edition == "client"


def _extra_allow_prefixes() -> tuple[str, ...]:
    raw = str(getattr(unified_settings, "client_remote_tools_extra_prefixes", "") or "").strip()
    if not raw:
        return ()
    out: list[str] = []
    for part in raw.split(","):
        p = part.strip()
        if p.startswith("/"):
            out.append(p.rstrip("/") or p)
    return tuple(out)


def _manifest_remote_tool_prefixes() -> tuple[str, ...]:
    """Union path prefixes declared via enabled apps' remote_tools_allowlist."""

    try:
        from api.services.desktop_app_manifests.loader import load_manifests
        from api.services.desktop_app_manifests.runtime import get_active_install_snapshot
    except Exception:
        logger.debug("[STEP] client_remote_tools_manifest_skip", exc_info=True)
        return ()

    try:
        snap = get_active_install_snapshot()
        enabled = set(snap.enabled_app_components)
        prefixes: list[str] = []
        for manifest in load_manifests():
            component = manifest.surfaces.desktop.app_component
            if component not in enabled:
                continue
            client = manifest.client
            if client is None:
                continue
            for tool_id in client.remote_tools_allowlist:
                mapped = _REMOTE_TOOL_ID_PREFIXES.get(str(tool_id).strip())
                if mapped:
                    prefixes.extend(mapped)
                else:
                    logger.info(
                        "[STEP] client_remote_tools_unmapped_tool tool=%s app=%s",
                        tool_id,
                        manifest.id,
                    )
        return tuple(dict.fromkeys(prefixes))
    except Exception:
        logger.debug("[STEP] client_remote_tools_manifest_resolve_skip", exc_info=True)
        return ()


def client_remote_tools_allow_prefixes() -> tuple[str, ...]:
    """Effective allow prefixes (core + manifest tools + Config Plane extras)."""

    return _CLIENT_CORE_ALLOW_PREFIXES + _manifest_remote_tool_prefixes() + _extra_allow_prefixes()


def normalize_api_path(path: str | None) -> str:
    normalized = (path or "").split("?", 1)[0].strip() or "/"
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    return normalized


def client_path_allowed(path: str | None) -> bool:
    """Fail-closed: deny listed families first, then require allow prefix match."""

    normalized = normalize_api_path(path)
    for deny in _CLIENT_DENY_PREFIXES:
        if normalized == deny or normalized.startswith(f"{deny}/"):
            return False
    for allow in client_remote_tools_allow_prefixes():
        if normalized == allow or normalized.startswith(f"{allow}/"):
            return True
    return False


def client_remote_tools_deny_reason(path: str | None) -> str | None:
    """Return machine reason when client edition must not call this path; else None."""

    if client_path_allowed(path):
        return None
    logger.info(
        "[STEP] client_remote_tools_deny path=%s",
        normalize_api_path(path),
    )
    return "client_remote_tools_denied"
