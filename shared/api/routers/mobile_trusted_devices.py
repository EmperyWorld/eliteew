#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP API for trusted MobileAndroid device binding, device listing, revoke, and WireGuard key rotation.
# Invariants:
# - Routes never accept or return device, WireGuard, or GAF private keys.
# - Binding requires trusted-user status, a live pairing challenge, and a device signature.
# Related:
# - api.services.mobile_trusted_device_service, documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
# ---

from __future__ import annotations

import logging
import time
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status  # type: ignore[import-untyped]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.routers.desktop_admin import require_admin_user
from api.schemas.mobile_trusted_devices import (
    MobileActiveTunnelMetadataResponse,
    MobileDeviceAuditEventListResponse,
    MobileDevicePairingChallengeCreate,
    MobileDevicePairingChallengeResolveRequest,
    MobileDevicePairingChallengeResolveResponse,
    MobileDevicePairingChallengeResponse,
    MobileDeviceTransferAdminDecisionRequest,
    MobileDeviceTransferCompleteRequest,
    MobileDeviceTransferCompleteResponse,
    MobileDeviceTransferEmailConfirmRequest,
    MobileDeviceTransferListResponse,
    MobileDeviceTransferOldConfirmRequest,
    MobileDeviceTransferResponse,
    MobileDeviceTransferStartRequest,
    MobileTrustedDeviceBindRequest,
    MobileTrustedDeviceBindResponse,
    MobileTrustedDeviceListResponse,
    MobileTrustedDeviceRevokeRequest,
    MobileTrustedDeviceRotateWgRequest,
    MobileTrustedDeviceRotateWgResponse,
)
from api.services.mobile_trusted_device_service import MobileTrustedDeviceService

router = APIRouter(prefix="/mobile-devices", tags=["Mobile Trusted Devices"])
logger = logging.getLogger(__name__)
FRESH_AUTH_MAX_AGE_SECONDS = 10 * 60


def _apply_no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store, no-cache, max-age=0, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Vary"] = "Authorization"


def _request_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.client.host if request.client else None


def _request_user_agent(request: Request) -> str | None:
    user_agent = request.headers.get("user-agent")
    return user_agent[:1024] if user_agent else None


def _require_fresh_auth(request: Request) -> None:
    raw_auth_time = getattr(request.state, "oidc_auth_time_epoch", None)
    try:
        auth_time = int(raw_auth_time)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Fresh Keycloak authentication is required for device binding.",
        ) from exc
    if int(time.time()) - auth_time > FRESH_AUTH_MAX_AGE_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Re-authenticate before starting trusted-device binding.",
        )


async def _current_db_user_id(
    current_user: AuthUser,
    db_pool: asyncpg.Pool,
) -> UUID:
    return await resolve_db_user_uuid_with_pool(current_user, db_pool)


async def get_mobile_trusted_device_service(
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
) -> MobileTrustedDeviceService:
    return MobileTrustedDeviceService(db_pool)


@router.post(
    "/pairing-challenges",
    response_model=MobileDevicePairingChallengeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pairing_challenge(
    body: MobileDevicePairingChallengeCreate,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDevicePairingChallengeResponse:
    _require_fresh_auth(request)
    user_id = await _current_db_user_id(current_user, db_pool)
    payload = await service.create_pairing_challenge(
        user_id=user_id,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
        device_label_hint=body.device_label_hint,
        prepare_gaf_e2ee=body.prepare_gaf_e2ee,
    )
    return MobileDevicePairingChallengeResponse(**payload)


@router.post("/pairing-challenges/resolve", response_model=MobileDevicePairingChallengeResolveResponse)
async def resolve_pairing_challenge(
    body: MobileDevicePairingChallengeResolveRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDevicePairingChallengeResolveResponse:
    user_id = await _current_db_user_id(current_user, db_pool)
    payload = await service.resolve_pairing_challenge(
        user_id=user_id,
        pairing_code=body.pairing_code,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    return MobileDevicePairingChallengeResolveResponse(**payload)


@router.post("/bind", response_model=MobileTrustedDeviceBindResponse)
async def bind_trusted_device(
    body: MobileTrustedDeviceBindRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileTrustedDeviceBindResponse:
    user_id = await _current_db_user_id(current_user, db_pool)
    return await service.bind_device(
        user_id=user_id,
        body=body,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )


@router.get("", response_model=MobileTrustedDeviceListResponse)
async def list_trusted_devices(
    response: Response,
    include_inactive: bool = False,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileTrustedDeviceListResponse:
    _apply_no_store(response)
    user_id = await _current_db_user_id(current_user, db_pool)
    return MobileTrustedDeviceListResponse(
        items=await service.list_devices(user_id=user_id, include_inactive=include_inactive)
    )


@router.get("/active/tunnel-metadata", response_model=MobileActiveTunnelMetadataResponse)
async def get_active_tunnel_metadata(
    response: Response,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileActiveTunnelMetadataResponse:
    """Live WG tunnel metadata for pre-connect repair (canonical config plane values)."""
    _apply_no_store(response)
    user_id = await _current_db_user_id(current_user, db_pool)
    device, tunnel = await service.get_active_tunnel_metadata(user_id=user_id)
    return MobileActiveTunnelMetadataResponse(device_id=device.id, tunnel=tunnel)


@router.get("/transfer", response_model=MobileDeviceTransferListResponse)
async def list_transfer_requests(
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferListResponse:
    user_id = await _current_db_user_id(current_user, db_pool)
    return MobileDeviceTransferListResponse(items=await service.list_transfer_requests(user_id=user_id))


@router.post("/transfer/start", response_model=MobileDeviceTransferResponse, status_code=status.HTTP_201_CREATED)
async def start_transfer_request(
    body: MobileDeviceTransferStartRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferResponse:
    _require_fresh_auth(request)
    user_id = await _current_db_user_id(current_user, db_pool)
    transfer = await service.start_transfer(
        user_id=user_id,
        body=body,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    return MobileDeviceTransferResponse(transfer=transfer)


@router.post("/transfer/{transfer_id}/confirm-old", response_model=MobileDeviceTransferResponse)
async def confirm_transfer_old_device(
    transfer_id: UUID,
    body: MobileDeviceTransferOldConfirmRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferResponse:
    user_id = await _current_db_user_id(current_user, db_pool)
    transfer = await service.confirm_transfer_old_device(
        user_id=user_id,
        transfer_id=transfer_id,
        body=body,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    return MobileDeviceTransferResponse(transfer=transfer)


@router.post("/transfer/{transfer_id}/confirm-email", response_model=MobileDeviceTransferResponse)
async def confirm_transfer_email(
    transfer_id: UUID,
    body: MobileDeviceTransferEmailConfirmRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferResponse:
    user_id = await _current_db_user_id(current_user, db_pool)
    transfer = await service.confirm_transfer_email(
        user_id=user_id,
        transfer_id=transfer_id,
        confirmation_token=body.confirmation_token,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    return MobileDeviceTransferResponse(transfer=transfer)


@router.post("/transfer/{transfer_id}/complete", response_model=MobileDeviceTransferCompleteResponse)
async def complete_transfer_request(
    transfer_id: UUID,
    body: MobileDeviceTransferCompleteRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferCompleteResponse:
    user_id = await _current_db_user_id(current_user, db_pool)
    return await service.complete_transfer(
        user_id=user_id,
        transfer_id=transfer_id,
        new_device_id=body.new_device_id,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )


@router.get("/admin/users/{user_id}/devices", response_model=MobileTrustedDeviceListResponse)
async def admin_list_user_trusted_devices(
    user_id: UUID,
    response: Response,
    _admin: AuthUser = Depends(require_admin_user),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileTrustedDeviceListResponse:
    _apply_no_store(response)
    return MobileTrustedDeviceListResponse(items=await service.list_devices(user_id=user_id, include_inactive=True))


@router.get("/admin/users/{user_id}/audit", response_model=MobileDeviceAuditEventListResponse)
async def admin_list_user_trusted_device_audit(
    user_id: UUID,
    limit: int = 80,
    _admin: AuthUser = Depends(require_admin_user),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceAuditEventListResponse:
    return MobileDeviceAuditEventListResponse(items=await service.list_audit_events(user_id=user_id, limit=limit))


@router.get("/admin/transfers", response_model=MobileDeviceTransferListResponse)
async def admin_list_transfer_requests(
    user_id: UUID | None = None,
    status_filter: str | None = None,
    _admin: AuthUser = Depends(require_admin_user),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferListResponse:
    return MobileDeviceTransferListResponse(
        items=await service.list_transfer_requests(user_id=user_id, status_filter=status_filter)
    )


@router.post("/admin/transfers/{transfer_id}/approve", response_model=MobileDeviceTransferResponse)
async def admin_approve_transfer_request(
    transfer_id: UUID,
    request: Request,
    admin: AuthUser = Depends(require_admin_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferResponse:
    admin_user_id = await _current_db_user_id(admin, db_pool)
    transfer = await service.admin_approve_transfer(
        transfer_id=transfer_id,
        admin_user_id=admin_user_id,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    return MobileDeviceTransferResponse(transfer=transfer)


@router.post("/admin/transfers/{transfer_id}/reject", response_model=MobileDeviceTransferResponse)
async def admin_reject_transfer_request(
    transfer_id: UUID,
    body: MobileDeviceTransferAdminDecisionRequest,
    request: Request,
    admin: AuthUser = Depends(require_admin_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileDeviceTransferResponse:
    admin_user_id = await _current_db_user_id(admin, db_pool)
    transfer = await service.admin_reject_transfer(
        transfer_id=transfer_id,
        admin_user_id=admin_user_id,
        reason=body.reason,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    return MobileDeviceTransferResponse(transfer=transfer)


@router.post("/{device_id}/revoke", response_model=MobileTrustedDeviceBindResponse)
async def revoke_trusted_device(
    device_id: UUID,
    body: MobileTrustedDeviceRevokeRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileTrustedDeviceBindResponse:
    _require_fresh_auth(request)
    user_id = await _current_db_user_id(current_user, db_pool)
    device = await service.revoke_device(
        user_id=user_id,
        device_id=device_id,
        actor_user_id=user_id,
        reason=body.reason,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    # Best-effort: revoke must succeed even if GAF socket emit fails (otherwise SPA
    # sees 500 after DB already revoked and the hub can hard-error on refresh).
    try:
        from api.gaf_chat.router import _emit_gaf_e2ee_status_to_participants
        from api.gaf_chat.service import GafChatService

        gaf_service = GafChatService(db_pool)
        for status_row in await gaf_service.suspend_active_e2ee_for_user(str(user_id)):
            await _emit_gaf_e2ee_status_to_participants(
                service=gaf_service,
                chat_id=str(status_row["chat_id"]),
                actor_user_id=str(user_id),
                status_row=status_row,
            )
    except Exception:
        logger.exception(
            "[STEP] trusted_device_revoke_gaf_suspend_skip device_id=%s user_id=%s",
            device_id,
            user_id,
        )
    return MobileTrustedDeviceBindResponse(device=device, tunnel={"status": "pending_edge_peer_removal"})


@router.post("/{device_id}/rotate-wg", response_model=MobileTrustedDeviceRotateWgResponse)
async def rotate_trusted_device_wg_key(
    device_id: UUID,
    body: MobileTrustedDeviceRotateWgRequest,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
    service: MobileTrustedDeviceService = Depends(get_mobile_trusted_device_service),  # noqa: B008
) -> MobileTrustedDeviceRotateWgResponse:
    _require_fresh_auth(request)
    user_id = await _current_db_user_id(current_user, db_pool)
    device = await service.rotate_wg_key(
        user_id=user_id,
        device_id=device_id,
        wg_public_key=body.wg_public_key,
        ip_address=_request_ip(request),
        user_agent=_request_user_agent(request),
    )
    return MobileTrustedDeviceRotateWgResponse(device=device)
