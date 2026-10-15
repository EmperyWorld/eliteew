# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop admin API: platform ops + portal peers + licenses + soft-revoke denylist (admin JWT).
# Invariants:
# - stack0/egress remain GET-only; portal-peers / licenses / denylist / auth-bindings mutate require require_admin_user.
# - Private key only on create response; never re-fetched.
# - License inventory never returns plaintext keys.
# - Soft denylist ≠ hard license revoke.
# Related:
# - api/services/platform_ops/
# - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.routers.admin_auth import require_admin_user
from api.routers.desktop_admin_air_enroll import router as air_enroll_router
from api.schemas.desktop_client.models import (
    AdminRevokeReasonRequest,
    AtomicBindingFleetInventoryResponse,
    AtomicBindingFleetMigrateRequest,
    AtomicBindingFleetMigrateResponse,
    AuthBindingRecoveryActionRequest,
    AuthBindingRecoveryActionResponse,
    AuthBindingRecoveryItemResponse,
    AuthBindingRecoveryListResponse,
    AuthRiskEventItemResponse,
    DenylistPublishRequest,
    DenylistPublishResponse,
    DenylistStatusResponse,
    FleetMigrationExceptionRequest,
    FleetMigrationStartGraceRequest,
    LicenseCapabilitiesPatchRequest,
    LicenseCapabilitiesResponse,
    LicenseDeviceItemResponse,
    LicenseDeviceListResponse,
    LicenseInventoryItemResponse,
    LicenseListResponse,
    OpsAckResponse,
    PortalPeerCreateRequest,
    PortalPeerCreateResponse,
    PortalPeerListResponse,
    PortalPeerRevokeRequest,
    PortalPeerSyncResponse,
    PortalPeerViewResponse,
    SeatIssueRequest,
    SeatIssueResponse,
    SoftRevokeAddRequest,
    SoftRevokeEntryResponse,
)
from api.services.desktop_client import DesktopClientError, DesktopClientLicenseService
from api.services.desktop_client.auth_binding_fleet import DesktopClientAuthBindingFleetService
from api.services.desktop_client.auth_binding_recovery import DesktopClientAuthRecoveryService
from api.services.desktop_client.denylist_service import DesktopClientDenylistService
from api.services.desktop_client.fleet_migration_service import FleetMigrationService
from api.services.desktop_client.license_modes import mode_from_flags, normalize_seat_mode
from api.services.desktop_client.license_service import (
    LicenseCapabilitiesView,
    LicenseDeviceItem,
    LicenseInventoryItem,
)
from api.services.desktop_client.portal_edge_sync import (
    DesktopPortalEdgeSyncError,
    reconcile_portal_peers_to_edge,
    schedule_desktop_portal_edge_reconcile,
)
from api.services.desktop_client.portal_peer_service import (
    DesktopClientPortalPeerService,
    PortalPeerView,
)
from api.services.desktop_client.seat_package import DesktopClientSeatService
from api.services.platform_ops import build_egress_status, build_stack0_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/platform-ops", tags=["desktop-admin-platform-ops"])
router.include_router(air_enroll_router)


async def get_portal_peer_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientPortalPeerService:
    return DesktopClientPortalPeerService(pool)


async def get_seat_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientSeatService:
    return DesktopClientSeatService(
        license_service=DesktopClientLicenseService(pool),
        peer_service=DesktopClientPortalPeerService(pool),
    )


async def get_license_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientLicenseService:
    return DesktopClientLicenseService(pool)


async def get_denylist_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientDenylistService:
    return DesktopClientDenylistService(pool)


async def get_fleet_migration_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> FleetMigrationService:
    return FleetMigrationService(pool)


async def get_auth_recovery_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientAuthRecoveryService:
    return DesktopClientAuthRecoveryService(pool)


async def get_auth_binding_fleet_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientAuthBindingFleetService:
    return DesktopClientAuthBindingFleetService(pool)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _view_response(view: PortalPeerView) -> PortalPeerViewResponse:
    return PortalPeerViewResponse(
        id=view.id,
        slug=view.slug,
        wg_public_key=view.wg_public_key,
        assigned_ip=view.assigned_ip,
        status=view.status,
        label=view.label,
        license_id=view.license_id,
        edge_sync_status=view.edge_sync_status,
        edge_synced_at=view.edge_synced_at,
        edge_sync_error=view.edge_sync_error,
        created_at=view.created_at,
    )


@router.get("/stack0-status")
async def platform_ops_stack0_status(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """In-process stack0 runtime line / deploy id rollup."""
    return build_stack0_status()


@router.get("/egress-status")
async def platform_ops_egress_status(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Podman egress monitor JSON (read-only; may be unavailable without mount)."""
    return build_egress_status()


@router.get("/portal-peers", response_model=PortalPeerListResponse)
async def admin_list_portal_peers(
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientPortalPeerService = Depends(get_portal_peer_service),  # noqa: B008
) -> PortalPeerListResponse:
    peers = await service.list_peers()
    return PortalPeerListResponse(peers=[_view_response(p) for p in peers])


@router.post("/seats/issue", response_model=SeatIssueResponse)
async def admin_issue_seat(
    body: SeatIssueRequest,
    request: Request,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientSeatService = Depends(get_seat_service),  # noqa: B008
) -> SeatIssueResponse:
    """Admin JWT: issue downloadable seat package (offline or cloud)."""
    try:
        mode = normalize_seat_mode(body.mode)
        result = await service.issue_seat(
            mode=mode,
            label=body.label,
            slug=body.slug,
            client_ip=_client_ip(request),
            allowed_email=body.allowed_email,
            allow_fofline=bool(body.allow_fofline),
            expires_at=body.expires_at,
            device_request=(body.device_request.model_dump() if body.device_request is not None else None),
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    logger.info(
        "[STEP] admin_seat_issue admin=%s mode=%s license_id=%s",
        getattr(_admin, "id", None) or getattr(_admin, "sub", None),
        mode,
        result.package.get("license_id"),
    )
    return SeatIssueResponse(filename=result.filename, package=result.package)


def _admin_capabilities_response(
    view: LicenseCapabilitiesView,
    *,
    remint_entitlement: bool = False,
) -> LicenseCapabilitiesResponse:
    from api.services.desktop_client.entitlement_sign import try_mint_entitlement

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


def _inventory_item(view: LicenseInventoryItem) -> LicenseInventoryItemResponse:
    return LicenseInventoryItemResponse(
        license_id=view.license_id,
        status=view.status,
        edition=view.edition,
        profile_id=view.profile_id,
        label=view.label,
        allow_offline=view.allow_offline,
        allow_online=view.allow_online,
        allow_fofline=view.allow_fofline,
        allowed_email=view.allowed_email,
        bound_keycloak_sub=view.bound_keycloak_sub,
        expires_at=view.expires_at,
        created_at=view.created_at,
        revoked_at=view.revoked_at,
        device_count_active=view.device_count_active,
        mode=mode_from_flags(
            allow_offline=view.allow_offline,
            allow_online=view.allow_online,
        ),
    )


def _device_item(view: LicenseDeviceItem) -> LicenseDeviceItemResponse:
    return LicenseDeviceItemResponse(
        device_id=view.device_id,
        license_id=view.license_id,
        status=view.status,
        machine_fingerprint=view.machine_fingerprint,
        device_pubkey=view.device_pubkey,
        last_seen_at=view.last_seen_at,
        created_at=view.created_at,
        revoked_at=view.revoked_at,
    )


@router.get("/licenses", response_model=LicenseListResponse)
async def admin_list_licenses(
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientLicenseService = Depends(get_license_service),  # noqa: B008
    status: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> LicenseListResponse:
    """Admin JWT: license inventory (no plaintext keys)."""
    try:
        items, total = await service.list_licenses(
            status=status,
            mode=mode,
            q=q,
            limit=limit,
            offset=offset,
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return LicenseListResponse(
        licenses=[_inventory_item(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/licenses/{license_id}", response_model=LicenseCapabilitiesResponse)
async def admin_get_license(
    license_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientLicenseService = Depends(get_license_service),  # noqa: B008
) -> LicenseCapabilitiesResponse:
    try:
        view = await service.get_capabilities(license_id=license_id)
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return _admin_capabilities_response(view)


@router.patch("/licenses/{license_id}", response_model=LicenseCapabilitiesResponse)
async def admin_patch_license(
    license_id: UUID,
    body: LicenseCapabilitiesPatchRequest,
    request: Request,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientLicenseService = Depends(get_license_service),  # noqa: B008
) -> LicenseCapabilitiesResponse:
    """Admin JWT: patch license capabilities / allowed_email without key rotation."""
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
    return _admin_capabilities_response(view, remint_entitlement=True)


@router.post("/licenses/{license_id}/revoke", response_model=OpsAckResponse)
async def admin_revoke_license(
    license_id: UUID,
    request: Request,
    body: AdminRevokeReasonRequest | None = None,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientLicenseService = Depends(get_license_service),  # noqa: B008
) -> OpsAckResponse:
    """Admin JWT: hard revoke license + active devices (DB). Soft denylist = Wave B."""
    try:
        await service.revoke_license(
            license_id=license_id,
            reason=(body.reason if body else None),
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    logger.info(
        "[STEP] admin_license_revoke admin=%s license_id=%s",
        getattr(_admin, "id", None) or getattr(_admin, "sub", None),
        license_id,
    )
    return OpsAckResponse(ok=True, status="revoked")


@router.get("/licenses/{license_id}/devices", response_model=LicenseDeviceListResponse)
async def admin_list_license_devices(
    license_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientLicenseService = Depends(get_license_service),  # noqa: B008
) -> LicenseDeviceListResponse:
    try:
        devices = await service.list_devices(license_id=license_id)
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return LicenseDeviceListResponse(devices=[_device_item(d) for d in devices])


@router.post(
    "/licenses/{license_id}/devices/{device_id}/revoke",
    response_model=OpsAckResponse,
)
async def admin_revoke_license_device(
    license_id: UUID,
    device_id: UUID,
    request: Request,
    body: AdminRevokeReasonRequest | None = None,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientLicenseService = Depends(get_license_service),  # noqa: B008
) -> OpsAckResponse:
    """Admin JWT: hard revoke one device; license_id must own the device."""
    try:
        devices = await service.list_devices(license_id=license_id)
        if not any(d.device_id == device_id for d in devices):
            raise DesktopClientError(
                "not_found",
                "Device not found for license",
                http_status=404,
            )
        await service.revoke_device(
            device_id=device_id,
            reason=(body.reason if body else None),
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    logger.info(
        "[STEP] admin_device_revoke admin=%s license_id=%s device_id=%s",
        getattr(_admin, "id", None) or getattr(_admin, "sub", None),
        license_id,
        device_id,
    )
    return OpsAckResponse(ok=True, status="revoked")


def _soft_revoke_entry(entry) -> SoftRevokeEntryResponse:
    return SoftRevokeEntryResponse(
        license_id=entry.license_id,
        reason=entry.reason,
        created_at=entry.created_at,
        created_by=entry.created_by,
        license_label=entry.license_label,
        license_status=entry.license_status,
    )


@router.get("/denylist", response_model=DenylistStatusResponse)
async def admin_denylist_status(
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientDenylistService = Depends(get_denylist_service),  # noqa: B008
) -> DenylistStatusResponse:
    """Admin JWT: soft-revoke SoT + last publish metadata (Wave B)."""
    status = await service.status()
    entries = await service.list_entries()
    return DenylistStatusResponse(
        published_at=status.published_at,
        note=status.note,
        revoked_count=status.revoked_count,
        payload_hash=status.payload_hash,
        out_path=status.out_path,
        pending_count=status.pending_count,
        updates_out_configured=status.updates_out_configured,
        signing_key_configured=status.signing_key_configured,
        entries=[_soft_revoke_entry(e) for e in entries],
    )


@router.post("/denylist/entries", response_model=SoftRevokeEntryResponse)
async def admin_denylist_add_entry(
    body: SoftRevokeAddRequest,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientDenylistService = Depends(get_denylist_service),  # noqa: B008
) -> SoftRevokeEntryResponse:
    try:
        entry = await service.add_entry(
            license_id=body.license_id,
            reason=body.reason,
            created_by=str(getattr(_admin, "id", None) or getattr(_admin, "sub", None) or "") or None,
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return _soft_revoke_entry(entry)


@router.delete("/denylist/entries/{license_id}", response_model=OpsAckResponse)
async def admin_denylist_remove_entry(
    license_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientDenylistService = Depends(get_denylist_service),  # noqa: B008
) -> OpsAckResponse:
    try:
        await service.remove_entry(license_id=license_id)
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return OpsAckResponse(ok=True, status="removed")


@router.post("/denylist/publish", response_model=DenylistPublishResponse)
async def admin_denylist_publish(
    body: DenylistPublishRequest | None = None,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientDenylistService = Depends(get_denylist_service),  # noqa: B008
) -> DenylistPublishResponse:
    """Sign + write denylist.json to DESKTOP_CLIENT_UPDATES_OUT (then sync OTA tree)."""
    note = body.note if body is not None else None
    try:
        result = await service.publish(note=note)
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    logger.info(
        "[STEP] admin_denylist_publish admin=%s revoked_count=%s",
        getattr(_admin, "id", None) or getattr(_admin, "sub", None),
        result.revoked_count,
    )
    return DenylistPublishResponse(
        published_at=result.published_at,
        revoked_count=result.revoked_count,
        payload_hash=result.payload_hash,
        out_path=result.out_path,
        note=result.note,
    )


@router.post("/portal-peers", response_model=PortalPeerCreateResponse)
async def admin_create_portal_peer(
    body: PortalPeerCreateRequest,
    request: Request,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientPortalPeerService = Depends(get_portal_peer_service),  # noqa: B008
) -> PortalPeerCreateResponse:
    try:
        result = await service.create_peer(
            slug=body.slug,
            label=body.label,
            license_id=body.license_id,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    logger.info(
        "[STEP] admin_portal_peer_create admin=%s slug=%s peer_id=%s",
        getattr(_admin, "id", None) or getattr(_admin, "sub", None),
        body.slug,
        result.peer.id,
    )
    return PortalPeerCreateResponse(
        peer=_view_response(result.peer),
        private_key=result.private_key,
        client_conf=result.client_conf,
        edge_sync_enqueued=result.edge_sync_enqueued,
    )


@router.post("/portal-peers/{peer_id}/revoke", response_model=PortalPeerViewResponse)
async def admin_revoke_portal_peer(
    peer_id: str,
    request: Request,
    body: PortalPeerRevokeRequest | None = None,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientPortalPeerService = Depends(get_portal_peer_service),  # noqa: B008
) -> PortalPeerViewResponse:
    try:
        pid = UUID(peer_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid peer_id") from exc
    try:
        view = await service.revoke_peer(
            peer_id=pid,
            reason=(body.reason if body else None),
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return _view_response(view)


@router.post("/portal-peers/sync", response_model=PortalPeerSyncResponse)
async def admin_sync_portal_peers(
    _admin: AuthUser = Depends(require_admin_user),
) -> PortalPeerSyncResponse:
    if schedule_desktop_portal_edge_reconcile(trigger="admin_sync"):
        return PortalPeerSyncResponse(
            ok=True,
            configured=True,
            skipped=False,
            message="enqueued",
        )
    try:
        result = await reconcile_portal_peers_to_edge(trigger="admin_sync_inline")
    except DesktopPortalEdgeSyncError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "edge_sync_failed", "message": str(exc)},
        ) from exc
    return PortalPeerSyncResponse(
        ok=True,
        configured=result.configured,
        skipped=result.skipped,
        message=result.message,
        active_peer_count=result.active_peer_count,
        added_or_updated=result.added_or_updated,
        removed=result.removed,
    )


@router.get("/fleet-migration")
async def admin_fleet_migration_summary(
    _admin: AuthUser = Depends(require_admin_user),
    service: FleetMigrationService = Depends(get_fleet_migration_service),  # noqa: B008
) -> dict[str, Any]:
    """Wave 9: Capsule v2 fleet migration rollup (counts only; no secrets)."""
    return await service.summarize()


@router.post("/fleet-migration/{license_id}/exception")
async def admin_fleet_migration_exception(
    license_id: UUID,
    body: FleetMigrationExceptionRequest,
    _admin: AuthUser = Depends(require_admin_user),
    service: FleetMigrationService = Depends(get_fleet_migration_service),  # noqa: B008
) -> dict[str, Any]:
    try:
        return await service.set_exception(
            license_id,
            owner=body.owner,
            until=body.until,
            notes=body.notes,
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc


@router.post("/fleet-migration/{license_id}/start-grace")
async def admin_fleet_migration_start_grace(
    license_id: UUID,
    body: FleetMigrationStartGraceRequest,
    _admin: AuthUser = Depends(require_admin_user),
    service: FleetMigrationService = Depends(get_fleet_migration_service),  # noqa: B008
) -> dict[str, Any]:
    return await service.ensure_grace(license_id, deadline_days=body.deadline_days)


def _binding_item(view) -> AuthBindingRecoveryItemResponse:
    return AuthBindingRecoveryItemResponse(
        binding_id=view.binding_id,
        license_id=view.license_id,
        device_id=view.device_id,
        client_id=view.client_id,
        channel=view.channel,
        state=view.state,
        authz_epoch=view.authz_epoch,
        keycloak_sub=view.keycloak_sub,
        rebind_allowed_until=view.rebind_allowed_until,
        last_risk_at=view.last_risk_at,
        updated_at=view.updated_at,
        events=[AuthRiskEventItemResponse(**ev) for ev in view.events],
    )


@router.get(
    "/licenses/{license_id}/auth-bindings",
    response_model=AuthBindingRecoveryListResponse,
)
async def admin_list_auth_bindings(
    license_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientAuthRecoveryService = Depends(get_auth_recovery_service),  # noqa: B008
) -> AuthBindingRecoveryListResponse:
    views = await service.list_bindings_for_license(license_id=license_id)
    return AuthBindingRecoveryListResponse(bindings=[_binding_item(v) for v in views])


@router.post(
    "/auth-bindings/{binding_id}/actions",
    response_model=AuthBindingRecoveryActionResponse,
)
async def admin_auth_binding_action(
    binding_id: str,
    body: AuthBindingRecoveryActionRequest,
    request: Request,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientAuthRecoveryService = Depends(get_auth_recovery_service),  # noqa: B008
) -> AuthBindingRecoveryActionResponse:
    actor = str(getattr(_admin, "sub", None) or getattr(_admin, "id", "") or "")
    try:
        view = await service.apply_action(
            binding_id=binding_id,
            action=body.action,
            reason=body.reason,
            idempotency_key=body.idempotency_key,
            actor_sub=actor,
            confirm=body.confirm,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    logger.info(
        "[STEP] admin_auth_binding_action admin=%s action=%s binding_id=%s",
        actor,
        body.action,
        binding_id,
    )
    return AuthBindingRecoveryActionResponse(
        ok=view.ok,
        action=view.action,
        binding_id=view.binding_id,
        state=view.state,
        authz_epoch=view.authz_epoch,
        replayed=view.replayed,
        keycloak_touched=view.keycloak_touched,
        license_status_unchanged=view.license_status_unchanged,
    )


@router.get(
    "/atomic-binding-fleet",
    response_model=AtomicBindingFleetInventoryResponse,
)
async def admin_atomic_binding_fleet_inventory(
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientAuthBindingFleetService = Depends(get_auth_binding_fleet_service),  # noqa: B008
) -> AtomicBindingFleetInventoryResponse:
    """Wave 6: read-only inventory counts (no PII) for atomic binding migration."""
    inv = await service.inventory()
    return AtomicBindingFleetInventoryResponse(**inv.__dict__)


@router.post(
    "/atomic-binding-fleet/migrate",
    response_model=AtomicBindingFleetMigrateResponse,
)
async def admin_atomic_binding_fleet_migrate(
    body: AtomicBindingFleetMigrateRequest,
    _admin: AuthUser = Depends(require_admin_user),
    service: DesktopClientAuthBindingFleetService = Depends(get_auth_binding_fleet_service),  # noqa: B008
) -> AtomicBindingFleetMigrateResponse:
    """Wave 6: idempotent bound_keycloak_sub → identity_bindings (exact sub only)."""
    if not body.dry_run and not body.confirm:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "confirm_required",
                "message": "Set confirm=true to apply migration (dry_run=false).",
            },
        )
    result = await service.migrate(dry_run=body.dry_run)
    actor = str(getattr(_admin, "sub", None) or getattr(_admin, "id", "") or "")
    logger.info(
        "[STEP] admin_atomic_binding_fleet_migrate admin=%s dry_run=%s created=%s conflict=%s",
        actor,
        result.dry_run,
        result.created,
        result.conflict,
    )
    return AtomicBindingFleetMigrateResponse(
        dry_run=result.dry_run,
        created=result.created,
        already_migrated=result.already_migrated,
        conflict=result.conflict,
        skip_no_bound_sub=result.skip_no_bound_sub,
        skip_channel_disabled=result.skip_channel_disabled,
        kc_attrs_synced=result.kc_attrs_synced,
        kc_attrs_failed=result.kc_attrs_failed,
        license_status_unchanged=True,
    )
