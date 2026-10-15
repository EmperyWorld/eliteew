# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Device challenge / prove / revoke for native desktop-client.
# Invariants:
# - Challenge+proof required for return visits (Wave 2 binding hash; Ed25519 later).
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import hmac
import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from api.core.database_manager import get_asyncpg_pool
from api.schemas.desktop_client.models import (
    DeviceChallengeRequest,
    DeviceChallengeResponse,
    DeviceProveRequest,
    DeviceProveResponse,
    OpsAckResponse,
    RevokeDeviceRequest,
)
from api.services.desktop_client import DesktopClientError, DesktopClientLicenseService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Desktop Client Devices"])


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


@router.post("/devices/challenge", response_model=DeviceChallengeResponse)
async def device_challenge(
    body: DeviceChallengeRequest,
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> DeviceChallengeResponse:
    try:
        nonce, ttl = service.issue_challenge(device_pubkey=body.device_pubkey)
    except DesktopClientError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": exc.message}) from exc
    return DeviceChallengeResponse(challenge=nonce, expires_in_sec=ttl)


@router.post("/devices/prove", response_model=DeviceProveResponse)
async def device_prove(
    body: DeviceProveRequest,
    request: Request,
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> DeviceProveResponse:
    try:
        view = await service.prove(
            device_pubkey=body.device_pubkey,
            machine_fingerprint=body.machine_fingerprint,
            challenge=body.challenge,
            proof=body.challenge_proof,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": exc.message}) from exc
    return DeviceProveResponse(
        license_id=view.license_id,
        device_id=view.device_id,
        edition=view.edition,
        profile_id=view.profile_id,
        apps=view.apps,
        status=view.status,
    )


@router.post("/devices/revoke", response_model=OpsAckResponse)
async def revoke_device(
    body: RevokeDeviceRequest,
    request: Request,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientLicenseService = Depends(get_desktop_client_license_service),  # noqa: B008
) -> OpsAckResponse:
    _require_ops_token(x_desktop_client_ops_token)
    try:
        await service.revoke_device(
            device_id=body.device_id,
            reason=body.reason,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "message": exc.message}) from exc
    return OpsAckResponse(ok=True, status="revoked")
