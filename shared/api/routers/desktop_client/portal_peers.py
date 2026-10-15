# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ops endpoints for desktop-client portal peers (Wave 3b / 3b.1).
# Invariants:
# - Ops token only on this router; admin JWT twin lives under platform-ops.
# - Private key only on create response; import never invents private keys.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import hmac
import logging
import os
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from api.core.database_manager import get_asyncpg_pool
from api.schemas.desktop_client.models import (
    PortalPeerCreateRequest,
    PortalPeerCreateResponse,
    PortalPeerListResponse,
    PortalPeerManifestImportRequest,
    PortalPeerManifestImportResponse,
    PortalPeerRevokeRequest,
    PortalPeerSyncResponse,
    PortalPeerViewResponse,
)
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.portal_edge_sync import (
    DesktopPortalEdgeSyncError,
    reconcile_portal_peers_to_edge,
    schedule_desktop_portal_edge_reconcile,
)
from api.services.desktop_client.portal_manifest_import import import_manifest_peers
from api.services.desktop_client.portal_peer_service import (
    DesktopClientPortalPeerService,
    PortalPeerView,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Desktop Client Portal Peers"])


async def get_portal_peer_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientPortalPeerService:
    return DesktopClientPortalPeerService(pool)


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


@router.get("/portal-peers", response_model=PortalPeerListResponse)
async def list_portal_peers(
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientPortalPeerService = Depends(get_portal_peer_service),  # noqa: B008
) -> PortalPeerListResponse:
    _require_ops_token(x_desktop_client_ops_token)
    peers = await service.list_peers()
    return PortalPeerListResponse(peers=[_view_response(p) for p in peers])


@router.post("/portal-peers", response_model=PortalPeerCreateResponse)
async def create_portal_peer(
    body: PortalPeerCreateRequest,
    request: Request,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientPortalPeerService = Depends(get_portal_peer_service),  # noqa: B008
) -> PortalPeerCreateResponse:
    _require_ops_token(x_desktop_client_ops_token)
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
    return PortalPeerCreateResponse(
        peer=_view_response(result.peer),
        private_key=result.private_key,
        client_conf=result.client_conf,
        edge_sync_enqueued=result.edge_sync_enqueued,
    )


@router.post("/portal-peers/import", response_model=PortalPeerManifestImportResponse)
async def import_portal_peers_manifest(
    body: PortalPeerManifestImportRequest,
    request: Request,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> PortalPeerManifestImportResponse:
    """Wave 3b.1: upsert peers.manifest.json rows (pubkey required; historical IPs OK)."""
    _require_ops_token(x_desktop_client_ops_token)
    try:
        result = await import_manifest_peers(
            pool,
            peers=body.peers,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return PortalPeerManifestImportResponse(
        imported=result.imported,
        updated=result.updated,
        skipped=result.skipped,
        errors=result.errors,
        edge_sync_enqueued=result.edge_sync_enqueued,
    )


@router.post("/portal-peers/{peer_id}/revoke", response_model=PortalPeerViewResponse)
async def revoke_portal_peer(
    peer_id: str,
    request: Request,
    body: PortalPeerRevokeRequest | None = None,
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
    service: DesktopClientPortalPeerService = Depends(get_portal_peer_service),  # noqa: B008
) -> PortalPeerViewResponse:
    _require_ops_token(x_desktop_client_ops_token)
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
async def sync_portal_peers(
    x_desktop_client_ops_token: str | None = Header(default=None, alias="X-Desktop-Client-Ops-Token"),
) -> PortalPeerSyncResponse:
    _require_ops_token(x_desktop_client_ops_token)
    # Prefer enqueue; if broker down, run inline for ops smoke.
    if schedule_desktop_portal_edge_reconcile(trigger="ops_sync"):
        return PortalPeerSyncResponse(
            ok=True,
            configured=True,
            skipped=False,
            message="enqueued",
        )
    try:
        result = await reconcile_portal_peers_to_edge(trigger="ops_sync_inline")
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
