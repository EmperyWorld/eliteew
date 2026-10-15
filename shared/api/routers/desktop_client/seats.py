# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ops seat package issue for native desktop-client (desktop-client-014).
# Invariants:
# - JWT-skip + X-Desktop-Client-Ops-Token (same as license/issue).
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import hmac
import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from api.core.database_manager import get_asyncpg_pool
from api.schemas.desktop_client.models import SeatIssueRequest, SeatIssueResponse
from api.services.desktop_client import DesktopClientError, DesktopClientLicenseService
from api.services.desktop_client.license_modes import normalize_seat_mode
from api.services.desktop_client.portal_peer_service import DesktopClientPortalPeerService
from api.services.desktop_client.seat_package import DesktopClientSeatService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Desktop Client Seats"])


async def get_desktop_client_seat_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientSeatService:
    return DesktopClientSeatService(
        license_service=DesktopClientLicenseService(pool),
        peer_service=DesktopClientPortalPeerService(pool),
    )


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


@router.post("/seats/issue", response_model=SeatIssueResponse)
async def issue_seat(
    body: SeatIssueRequest,
    request: Request,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientSeatService = Depends(get_desktop_client_seat_service),  # noqa: B008
) -> SeatIssueResponse:
    """Ops: mint one seat JSON package (license + entitlement and/or WG conf)."""
    _require_ops_token(x_desktop_client_ops_token)
    try:
        mode = normalize_seat_mode(body.mode)
        dr = body.device_request.model_dump() if body.device_request is not None else None
        result = await service.issue_seat(
            mode=mode,
            label=body.label,
            slug=body.slug,
            client_ip=_client_ip(request),
            allowed_email=body.allowed_email,
            allow_fofline=bool(body.allow_fofline),
            expires_at=body.expires_at,
            device_request=dr,
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return SeatIssueResponse(filename=result.filename, package=result.package)
