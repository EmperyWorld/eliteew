# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# GET /desktop/install-profile — active edition + install profile + enabled app_components.
# Invariants:
# - OAuth2 required; mounted without extra prefix under parent ``/desktop``.
# - Misconfigured edition/profile → 503 fail closed (not silent cloud-full).
# - FoFline OAuth (empery-fofline) → fofline-connected surface (not cloud-full).
# - Access mode describes service entitlement; it never bypasses OIDC/RBAC.
# - AI provider fields are best-effort (misconfig does not break Start catalog).
# Related:
# - api/services/desktop_app_manifests/runtime.py
# - api/services/ai_provider_router/runtime.py
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §6
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17.5
# ---
"""Desktop install-profile runtime exposure."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field

from api.core.auth import User as AuthUser
from api.core.oauth2_auth import require_oauth2_user
from api.services.ai_provider_router import (
    AiProviderKind,
    AiProviderNotConfiguredError,
    get_active_ai_provider_snapshot,
    probe_all_providers,
)
from api.services.desktop_app_manifests.runtime import (
    InstallProfileConfigError,
    get_install_snapshot_for_oauth_client,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["desktop"])


class DesktopInstallProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int = 3
    edition: str
    profile_id: str
    mode: str
    access_mode: str
    seat_activation_required: bool
    include_legacy: bool
    enabled_app_components: list[str] = Field(default_factory=list)
    ai_provider: str | None = None
    ai_providers_allowlist: list[str] = Field(default_factory=list)
    ai_eliteew_configured: bool | None = None
    ai_local_configured: bool | None = None
    ai_third_party_configured: bool | None = None
    ai_active_configured: bool | None = None


@router.get(
    "/install-profile",
    response_model=DesktopInstallProfileResponse,
    summary="Active product edition install profile",
)
async def get_desktop_install_profile(
    request: Request,
    _current_user: AuthUser = Depends(require_oauth2_user),
) -> DesktopInstallProfileResponse:
    """Expose install profile for FE Start/catalog filtering (FoFline → fofline-connected)."""
    try:
        azp = getattr(request.state, "oidc_azp", None)
        snap = get_install_snapshot_for_oauth_client(azp if isinstance(azp, str) else None)
    except InstallProfileConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    ai_provider: str | None = None
    ai_allow: list[str] = []
    ai_eliteew: bool | None = None
    ai_local: bool | None = None
    ai_third: bool | None = None
    ai_active: bool | None = None
    try:
        ai = get_active_ai_provider_snapshot()
        ai_provider = ai.provider.value
        ai_allow = sorted(k.value for k in ai.allowlist)
        probes = probe_all_providers()
        ai_local = probes[AiProviderKind.LOCAL].configured
        ai_third = probes[AiProviderKind.THIRD_PARTY].configured
        ai_eliteew = probes[AiProviderKind.ELITEEW].configured
        ai_active = probes[ai.provider].configured
    except AiProviderNotConfiguredError:
        logger.debug("[STEP] desktop_install_profile_ai_skip", exc_info=True)

    return DesktopInstallProfileResponse(
        edition=snap.edition,
        profile_id=snap.profile_id,
        mode=snap.mode,
        access_mode=snap.access_mode,
        seat_activation_required=snap.seat_activation_required,
        include_legacy=snap.include_legacy,
        enabled_app_components=sorted(snap.enabled_app_components),
        ai_provider=ai_provider,
        ai_providers_allowlist=ai_allow,
        ai_eliteew_configured=ai_eliteew,
        ai_local_configured=ai_local,
        ai_third_party_configured=ai_third,
        ai_active_configured=ai_active,
    )
