# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop-client runtime presence heartbeat for Admin Users (version / WG / build).
# Invariants:
# - Auth: optional OIDC (empery-desktop) and/or active license_id+device_id pair.
# - authenticode always stored false until Windows code-sign exists.
# Related:
# - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# ---

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import get_optional_oauth2_user
from api.schemas.desktop_client.models import (
    RuntimePresenceReportRequest,
    RuntimePresenceReportResponse,
)
from api.services.desktop_client.admin_directory_enrich import upsert_runtime_presence

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Desktop Client Runtime"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


@router.post("/runtime/presence", response_model=RuntimePresenceReportResponse)
async def report_runtime_presence(
    body: RuntimePresenceReportRequest,
    request: Request,
    user: AuthUser | None = Depends(get_optional_oauth2_user),  # noqa: B008
) -> RuntimePresenceReportResponse:
    """Upsert launcher heartbeat for Admin Users Desktop enrich."""

    oidc_sub = str(getattr(request.state, "oidc_sub", None) or "").strip() or None
    if user is not None and not oidc_sub:
        oidc_sub = str(getattr(user, "id", "") or "").strip() or None

    license_id = body.license_id
    device_id = body.device_id
    if license_id is None or device_id is None:
        if oidc_sub is None:
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "auth_required",
                    "message": "OIDC token or license_id+device_id required",
                },
            )
        raise HTTPException(
            status_code=400,
            detail={
                "code": "device_required",
                "message": "license_id and device_id required for presence report",
            },
        )

    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT d.id AS device_id, d.status AS device_status,
                   l.id AS license_id, l.status AS license_status,
                   l.bound_keycloak_sub
            FROM desktop_client_devices d
            JOIN desktop_client_licenses l ON l.id = d.license_id
            WHERE d.id = $1 AND d.license_id = $2
            """,
            device_id,
            license_id,
        )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "device_not_found", "message": "device/license not found"},
        )
    if row["device_status"] != "active" or row["license_status"] != "active":
        raise HTTPException(
            status_code=403,
            detail={"code": "device_inactive", "message": "device or license not active"},
        )

    bound_sub = str(row["bound_keycloak_sub"] or "").strip() or None
    if oidc_sub and bound_sub and oidc_sub != bound_sub:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "license_user_mismatch",
                "message": "token sub does not match license bind",
            },
        )
    keycloak_sub = oidc_sub or bound_sub

    integrity = body.integrity
    updater_baked = bool(integrity.updater_pubkey_baked) if integrity else False
    # authenticode intentionally ignored / always false until code-sign pipeline

    channel = (body.build_channel or "").strip().lower() or None
    client_channel = (body.client_channel or "").strip().lower() or None
    if client_channel == "fofline":
        # W5: FoFline heartbeat reuses build_channel column (CHECK allows fofline after migrate).
        channel = "fofline"

    try:
        stored = await upsert_runtime_presence(
            keycloak_sub=keycloak_sub,
            license_id=UUID(str(row["license_id"])),
            device_id=UUID(str(row["device_id"])),
            app_version=(body.app_version or "").strip() or None,
            wg_up=body.wg_up,
            peer_slug=(body.peer_slug or "").strip() or None,
            build_channel=channel,
            updater_pubkey_baked=updater_baked,
            report_ip=_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "presence_incomplete", "message": str(exc)},
        ) from exc

    return RuntimePresenceReportResponse(
        ok=True,
        keycloak_sub=stored.get("keycloak_sub"),
        license_id=stored.get("license_id"),
        device_id=stored.get("device_id"),
        app_version=stored.get("app_version"),
        wg_up=stored.get("wg_up"),
        peer_slug=stored.get("peer_slug"),
        build_channel=stored.get("build_channel"),
        updater_pubkey_baked=bool(stored.get("updater_pubkey_baked")),
        report_ip=stored.get("report_ip"),
        reported_at=stored.get("reported_at"),
    )
