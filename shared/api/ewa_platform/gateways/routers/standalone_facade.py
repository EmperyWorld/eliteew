# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Neutral HTTP facade for **EWA**: driver metadata catalog (authenticated) and core alignments outside Marketing Cabinet.
# Invariants:
# - Reuses `AmkaCoreAlignmentOut` for UGS alignments; catalog returns only metadata from `driver_catalog` (no DB).
# - UGS routes require the same UGS admin access as `/api/v1/ugs/admin/*`.
# - UGS alignment endpoints mirror marketing AMKA weak ETag + ``Cache-Control: private, max-age=60`` (304 on If-None-Match).
# Related:
# - api/services/ugs/ewa_ugs_alignment_facade.py (delegates to ``amka_core``; keeps ``ewa_platform`` free of direct ``amka_core`` imports)
# - api/schemas/marketing_cabinet/amka.py
# - documentation/product/amka-seed-album/AMKA-ENTRYPOINTS.md
# ---
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status  # type: ignore[import-untyped]
from fastapi.responses import JSONResponse  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.schemas.pydantic.companion import EwaDriverCatalogEntryOut
from api.schemas.marketing_cabinet.amka import AmkaCoreAlignmentOut
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.ewa_ugs_alignment_facade import (
    build_ugs_generation_inventory_core_alignment,
    build_ugs_model_routing_core_alignment,
    serialize_ewa_ugs_driver_catalog,
    ugs_generation_inventory_core_alignment_weak_etag,
    ugs_model_routing_core_alignment_weak_etag,
)

router = APIRouter(tags=["EWA - Standalone facade"])


@router.get(
    "/driver-catalog",
    response_model=list[EwaDriverCatalogEntryOut],
    summary="EWA driver/profile catalog (metadata only)",
)
async def get_ewa_driver_catalog(
    _: AuthUser = Depends(require_oauth2_user),  # noqa: B008
) -> list[EwaDriverCatalogEntryOut]:
    """Return the static list of known EWA drivers for clients and operators."""

    return [EwaDriverCatalogEntryOut.model_validate(row) for row in serialize_ewa_ugs_driver_catalog()]


@router.get(
    "/ugs/model-routing/core-alignment",
    response_model=AmkaCoreAlignmentOut,
    summary="UGS model routing core alignment (AmkaCoreEngine, read-only)",
    responses={304: {"description": "Not Modified — repeat If-None-Match"}},
)
async def get_ugs_model_routing_core_alignment(
    request: Request,
    _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AmkaCoreAlignmentOut | Response:
    etag = await ugs_model_routing_core_alignment_weak_etag(db)
    cache_hdr = {"ETag": etag, "Cache-Control": "private, max-age=60"}
    inm = request.headers.get("if-none-match")
    if inm and inm.strip() == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=cache_hdr)
    payload = await build_ugs_model_routing_core_alignment(db)
    body = AmkaCoreAlignmentOut.model_validate(payload)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=body.model_dump(mode="json"),
        headers=cache_hdr,
    )


@router.get(
    "/ugs/generation-inventory/core-alignment",
    response_model=AmkaCoreAlignmentOut,
    summary="UGS generation inventory core alignment (Admin v2 snapshot, read-only)",
    responses={304: {"description": "Not Modified — repeat If-None-Match"}},
)
async def get_ugs_generation_inventory_core_alignment(
    request: Request,
    _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AmkaCoreAlignmentOut | Response:
    etag = await ugs_generation_inventory_core_alignment_weak_etag(db)
    cache_hdr = {"ETag": etag, "Cache-Control": "private, max-age=60"}
    inm = request.headers.get("if-none-match")
    if inm and inm.strip() == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=cache_hdr)
    payload = await build_ugs_generation_inventory_core_alignment(db)
    body = AmkaCoreAlignmentOut.model_validate(payload)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=body.model_dump(mode="json"),
        headers=cache_hdr,
    )
