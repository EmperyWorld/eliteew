# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# License redeem, preflight/heartbeat, ops revoke endpoints for native desktop-client.
# Invariants:
# - Redeem/preflight/heartbeat are pre-OIDC (middleware public allowlist); revoke is ops-token gated —
#   Wave 2 revoke requires X-Desktop-Client-Ops-Token matching env when set.
# - POST /license/issue is retired (HTTP 410); Capsule v2 seats/issue + device_request only.
# - Preflight/heartbeat responses never include email/PII; session/assert remains JWT-required.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §12g
# ---

from __future__ import annotations

import hmac
import logging
import os
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user
from api.schemas.desktop_client.models import (
    LicenseCapabilitiesPatchRequest,
    LicenseCapabilitiesResponse,
    LicenseHeartbeatRequest,
    LicenseHeartbeatResponse,
    LicenseIssueRequest,
    LicenseIssueResponse,
    LicensePreflightRequest,
    LicensePreflightResponse,
    LicenseRedeemRequest,
    LicenseRedeemResponse,
    OpsAckResponse,
    RevokeLicenseRequest,
    SessionAssertRequest,
    SessionAssertResponse,
)
from api.services.desktop_client import DesktopClientError, DesktopClientLicenseService
from api.services.desktop_client.entitlement_sign import try_mint_entitlement
from api.services.desktop_client.license_modes import mode_from_flags
from api.services.desktop_client.license_service import LicenseCapabilitiesView

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Desktop Client License"])


def _capabilities_response(
    view: LicenseCapabilitiesView,
    *,
    remint_entitlement: bool = False,
) -> LicenseCapabilitiesResponse:
    entitlement = None
    if remint_entitlement:
        entitlement = try_mint_entitlement(
            license_id=view.license_id,
            edition=view.edition,
            profile_id=view.profile_id,
            apps=view.apps,
            machine_fingerprint=None,
            device_id=None,
            expires_at=view.expires_at,
            allow_fofline=view.allow_fofline,
            allow_online=view.allow_online,
        )
    return LicenseCapabilitiesResponse(
        license_id=view.license_id,
        status=view.status,
        edition=view.edition,
        profile_id=view.profile_id,
        apps=view.apps,
        expires_at=view.expires_at,
        label=view.label,
        allow_offline=view.allow_offline,
        allow_online=view.allow_online,
        allow_fofline=view.allow_fofline,
        allowed_email=view.allowed_email,
        bound_keycloak_sub=view.bound_keycloak_sub,
        email_bound_at=view.email_bound_at,
        mode=mode_from_flags(
            allow_offline=view.allow_offline,
            allow_online=view.allow_online,
        ),
        entitlement=entitlement,
    )


async def get_desktop_client_license_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientLicenseService:
    return DesktopClientLicenseService(pool)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _require_ops_token(ops_token: str | None) -> None:
    expected = os.environ.get("DESKTOP_CLIENT_OPS_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="DESKTOP_CLIENT_OPS_TOKEN not configured",
        )
    if not ops_token or not hmac.compare_digest(ops_token, expected):
        raise HTTPException(status_code=401, detail="Invalid ops token")


@router.post("/license/redeem", response_model=LicenseRedeemResponse)
async def redeem_license(
    body: LicenseRedeemRequest,
    request: Request,
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> LicenseRedeemResponse:
    try:
        view = await service.redeem(
            license_key=body.license_key,
            device_pubkey=body.device_pubkey,
            machine_fingerprint=body.machine_fingerprint,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": exc.message}) from exc
    entitlement = try_mint_entitlement(
        license_id=view.license_id,
        edition=view.edition,
        profile_id=view.profile_id,
        apps=view.apps,
        machine_fingerprint=body.machine_fingerprint,
        device_id=view.device_id,
        expires_at=view.expires_at,
        allow_fofline=view.allow_fofline,
        allow_online=view.allow_online,
    )
    return LicenseRedeemResponse(
        license_id=view.license_id,
        device_id=view.device_id,
        edition=view.edition,
        profile_id=view.profile_id,
        apps=view.apps,
        expires_at=view.expires_at,
        status=view.status,
        allow_offline=view.allow_offline,
        allow_online=view.allow_online,
        allow_fofline=view.allow_fofline,
        allowed_email=view.allowed_email,
        entitlement=entitlement,
    )


@router.post("/license/preflight", response_model=LicensePreflightResponse)
async def preflight_license(
    body: LicensePreflightRequest,
    request: Request,
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> LicensePreflightResponse:
    """Pre-OIDC Start gate: license active + not expired; optional device active."""
    try:
        view = await service.preflight_license(
            license_id=body.license_id,
            device_id=body.device_id,
            machine_fingerprint=body.machine_fingerprint,
            client_ip=_client_ip(request),
            purpose="preflight",
        )
    except DesktopClientError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": exc.message}) from exc
    return LicensePreflightResponse(
        ok=view.ok,
        code=view.code,
        expires_at=view.expires_at,
        allow_online=view.allow_online,
        allow_offline=view.allow_offline,
        allow_fofline=view.allow_fofline,
    )


@router.post("/license/heartbeat", response_model=LicenseHeartbeatResponse)
async def heartbeat_license(
    body: LicenseHeartbeatRequest,
    request: Request,
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> LicenseHeartbeatResponse:
    """In-session kill-switch: same checks as preflight; touches device last_seen when present."""
    try:
        view = await service.heartbeat_license(
            license_id=body.license_id,
            device_id=body.device_id,
            machine_fingerprint=body.machine_fingerprint,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": exc.message}) from exc
    return LicenseHeartbeatResponse(
        ok=view.ok,
        code=view.code,
        expires_at=view.expires_at,
        allow_online=view.allow_online,
        allow_offline=view.allow_offline,
        allow_fofline=view.allow_fofline,
    )


@router.post("/license/issue", response_model=LicenseIssueResponse)
async def issue_license(
    body: LicenseIssueRequest,
    request: Request,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> LicenseIssueResponse:
    """Retired Wave 9: key-only mint removed — use Capsule v2 seats/issue + device_request."""
    _require_ops_token(x_desktop_client_ops_token)
    _ = (body, request, service)
    raise HTTPException(
        status_code=410,
        detail={
            "code": "license_issue_retired",
            "message": (
                "POST /license/issue is retired. Issue Capsule v2 via "
                "POST /api/v1/desktop-client/seats/issue (or Admin seats) with device_request."
            ),
        },
    )


@router.post("/license/revoke", response_model=OpsAckResponse)
async def revoke_license(
    body: RevokeLicenseRequest,
    request: Request,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> OpsAckResponse:
    _require_ops_token(x_desktop_client_ops_token)
    try:
        await service.revoke_license(
            license_id=body.license_id,
            reason=body.reason,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": exc.message}) from exc
    return OpsAckResponse(ok=True, status="revoked")


@router.get("/licenses/{license_id}", response_model=LicenseCapabilitiesResponse)
async def get_license_capabilities(
    license_id: UUID,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> LicenseCapabilitiesResponse:
    _require_ops_token(x_desktop_client_ops_token)
    try:
        view = await service.get_capabilities(license_id=license_id)
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return _capabilities_response(view)


@router.patch("/licenses/{license_id}", response_model=LicenseCapabilitiesResponse)
async def patch_license_capabilities(
    license_id: UUID,
    body: LicenseCapabilitiesPatchRequest,
    request: Request,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> LicenseCapabilitiesResponse:
    """Ops: change license composition without rotating the key (#015)."""
    _require_ops_token(x_desktop_client_ops_token)
    try:
        view = await service.update_capabilities(
            license_id=license_id,
            client_ip=_client_ip(request),
            allow_offline=body.allow_offline,
            allow_online=body.allow_online,
            allow_fofline=body.allow_fofline,
            apps=body.apps,
            expires_at=body.expires_at,
            set_expires=body.expires_at is not None or body.clear_expires,
            clear_expires=body.clear_expires,
            allowed_email=body.allowed_email,
            set_allowed_email=body.allowed_email is not None or body.clear_allowed_email,
            clear_allowed_email=body.clear_allowed_email,
            clear_account_bind=body.clear_account_bind,
            label=body.label,
            set_label=body.label is not None,
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return _capabilities_response(view, remint_entitlement=True)


@router.post("/session/assert", response_model=SessionAssertResponse)
async def assert_desktop_session(
    body: SessionAssertRequest,
    request: Request,
    user: AuthUser = Depends(require_oauth2_user),
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> SessionAssertResponse:
    """OIDC gate: license must allow online and match bound/claimed email (#015)."""
    oidc_sub = str(getattr(request.state, "oidc_sub", None) or "").strip()
    if not oidc_sub:
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "token sub required"},
        )
    try:
        view = await service.assert_session(
            license_id=body.license_id,
            device_id=body.device_id,
            keycloak_sub=oidc_sub,
            email=user.email,
            client_ip=_client_ip(request),
            channel=body.channel,
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return SessionAssertResponse(
        ok=True,
        license_id=view.license_id,
        allowed_email=view.allowed_email,
        bound_keycloak_sub=view.bound_keycloak_sub,
        claimed=view.claimed,
        allow_online=view.allow_online,
        allow_offline=view.allow_offline,
        allow_fofline=view.allow_fofline,
        channel=view.channel,
    )
