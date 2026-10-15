# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public version metadata for SPA cache invalidation / deploy id alignment.
# Invariants:
# - Public ``/api/version`` returns only version, buildHash, appBuildId (no env/clock).
# - No secrets in the response body.
# Related:
# - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
# - api/main.py (legacy duplicate route; router registration wins)
# ---
"""
Version API Router
Provides version information for frontend cache invalidation and update detection
"""

import logging
import os
from typing import Any

from fastapi import APIRouter  # type: ignore[import-untyped]

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Version"])


@router.get("/api/version")
async def get_version() -> dict[str, str | int | None]:
    """Public version metadata (no environment / host clock leakage)."""
    build_hash = os.environ.get("BUILD_HASH") or os.environ.get("GIT_COMMIT") or "unknown"

    from api.services.client_build_service import get_server_app_build_id

    payload: dict[str, str | int | None] = {
        "version": unified_settings.app_version,
        "buildHash": build_hash,
        "appBuildId": get_server_app_build_id(),
    }
    return payload


@router.get("/version")
async def get_version_short() -> dict[str, str]:
    """
    Short version endpoint (alias for /api/version)

    Returns:
        Simplified version information
    """
    build_hash = os.environ.get("BUILD_HASH") or os.environ.get("GIT_COMMIT") or "unknown"

    return {"version": unified_settings.app_version, "buildHash": build_hash}


@router.get("/api/version/domains")
async def get_loaded_domains() -> dict[str, Any]:
    """
    List loaded API domains and selected feature flags.

    This endpoint is used for operational introspection and should remain
    lightweight. It reflects the static domain registration structure and
    key toggles from unified_settings.
    """
    domains = [
        {"name": "auth", "module": "api.domains.auth"},
        {"name": "creative", "module": "api.domains.creative"},
        {"name": "chat", "module": "api.domains.chat"},
        {"name": "content", "module": "api.domains.content"},
        {"name": "voice", "module": "api.domains.voice"},
        {"name": "bi_ugs", "module": "api.domains.bi_ugs"},
        {"name": "desktop", "module": "api.domains.desktop"},
        {"name": "misc", "module": "api.domains.misc"},
    ]

    return {
        "domains": domains,
        "flags": {},
    }
