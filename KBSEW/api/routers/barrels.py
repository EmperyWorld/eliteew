# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FastAPI routes for KBSEW barrel management and ingestion.
# Invariants:
# - Barrel list/status forward optional revision fields for admin FE badges.
# - Force-reindex routes always enqueue over completed assets (idempotent ingest does not).
# Related:
# - api/services/barrel_revision_api.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from api.core.auth import AdminUser, require_admin_or_service_mutate, require_kbsew_api_access
from api.core.config import get_settings
from api.core.ingest_errors import (
    BarrelDisabledError,
    IngestPayloadTooLargeError,
    UnsafeIngestUrlError,
)
from api.drivers.registry import list_driver_types
from api.schemas.barrels import (
    BarrelCreateRequest,
    BarrelResponse,
    BarrelStatusResponse,
    DriverInfoResponse,
    ForceReindexAssetResponse,
    ForceReindexBarrelResponse,
    IngestRequest,
    IngestResponse,
)
from api.services import barrel_service, ingestion_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kbsew", tags=["KBSEW"])


def _barrel_response(row: dict) -> BarrelResponse:
    return BarrelResponse(
        id=row["id"],
        name=row["name"],
        description=row.get("description"),
        driver_type=row["driver_type"],
        enabled=bool(row["enabled"]),
        qdrant_collection=row["qdrant_collection"],
        asset_count=int(row.get("asset_count") or 0),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        revision=row.get("revision"),
        active_revision_id=row.get("active_revision_id"),
        revision_indexed_at=row.get("revision_indexed_at"),
        revision_chunk_count=row.get("revision_chunk_count"),
    )


@router.get("/drivers", response_model=DriverInfoResponse)
async def list_drivers(
    _auth: AdminUser = Depends(require_kbsew_api_access),
) -> DriverInfoResponse:
    """Read-only driver catalog (service token OK; not a mutation)."""
    _ = _auth
    return DriverInfoResponse(driver_types=list_driver_types())


@router.get("/barrels", response_model=list[BarrelResponse])
async def list_barrels(
    _auth: AdminUser = Depends(require_kbsew_api_access),
) -> list[BarrelResponse]:
    rows = await barrel_service.list_barrels()
    return [_barrel_response(row) for row in rows]


@router.post("/barrels", response_model=BarrelResponse, status_code=status.HTTP_201_CREATED)
async def create_barrel(
    body: BarrelCreateRequest,
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> BarrelResponse:
    try:
        row = await barrel_service.create_barrel(
            name=body.name,
            description=body.description,
            driver_type=body.driver_type,
            enabled=body.enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row["asset_count"] = 0
    return _barrel_response(row)


@router.delete("/barrels/{barrel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_barrel(
    barrel_id: UUID,
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> None:
    deleted = await barrel_service.delete_barrel(str(barrel_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Barrel not found")


@router.patch("/barrels/{barrel_id}/enabled", response_model=BarrelResponse)
async def set_barrel_enabled(
    barrel_id: UUID,
    enabled: bool,
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> BarrelResponse:
    row = await barrel_service.set_barrel_enabled(str(barrel_id), enabled)
    if row is None:
        raise HTTPException(status_code=404, detail="Barrel not found")
    return _barrel_response(row)


@router.post(
    "/barrels/{barrel_id}/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_document(
    barrel_id: UUID,
    body: IngestRequest,
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> IngestResponse:
    try:
        result = await ingestion_service.start_ingestion(
            barrel_id=str(barrel_id),
            source_url=str(body.source_url),
            driver_type=body.driver_type,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BarrelDisabledError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except UnsafeIngestUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IngestPayloadTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    return IngestResponse(
        job_id=result["job_id"],
        asset_id=result["asset_id"],
        status=str(result["status"]),
        message=result.get("message"),
    )


@router.post(
    "/barrels/{barrel_id}/ingest/upload",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_upload(
    barrel_id: UUID,
    file: UploadFile = File(...),
    driver_type: str | None = Form(default=None),
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> IngestResponse:
    max_bytes = get_settings().ingest_max_bytes_clamped
    declared = file.size
    if declared is not None and int(declared) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Ingest payload too large: {declared} bytes (limit {max_bytes})",
        )
    file_data = await file.read()
    if not file_data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(file_data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Ingest payload too large: {len(file_data)} bytes (limit {max_bytes})",
        )
    filename = (file.filename or "document.pdf").strip()
    try:
        result = await ingestion_service.start_ingestion_upload(
            barrel_id=str(barrel_id),
            file_data=file_data,
            filename=filename,
            driver_type=driver_type,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BarrelDisabledError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except IngestPayloadTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    return IngestResponse(
        job_id=result["job_id"],
        asset_id=result["asset_id"],
        status=str(result["status"]),
        message=result.get("message"),
    )


@router.post(
    "/barrels/{barrel_id}/reindex",
    response_model=ForceReindexBarrelResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def reindex_barrel(
    barrel_id: UUID,
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> ForceReindexBarrelResponse:
    """Force-reindex all assets in a barrel (bypasses completed-job idempotency)."""

    try:
        result = await ingestion_service.force_reindex_barrel(barrel_id=str(barrel_id))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BarrelDisabledError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ForceReindexBarrelResponse(
        barrel_id=result["barrel_id"],
        queued=int(result["queued"]),
        skipped_active=int(result["skipped_active"]),
        failed=int(result["failed"]),
        jobs=[
            ForceReindexAssetResponse(
                job_id=item.get("job_id"),
                asset_id=item["asset_id"],
                status=str(item.get("status") or "unknown"),
                message=item.get("message"),
                queued=bool(item.get("queued")),
                reason=item.get("reason"),
            )
            for item in result.get("jobs") or []
        ],
    )


@router.post(
    "/barrels/{barrel_id}/assets/{asset_id}/reindex",
    response_model=ForceReindexAssetResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def reindex_asset(
    barrel_id: UUID,
    asset_id: UUID,
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> ForceReindexAssetResponse:
    """Force-reindex one asset (new job even when latest job is completed)."""

    try:
        result = await ingestion_service.force_reindex_asset(
            barrel_id=str(barrel_id),
            asset_id=str(asset_id),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BarrelDisabledError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except UnsafeIngestUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ForceReindexAssetResponse(
        job_id=result.get("job_id"),
        asset_id=result["asset_id"],
        status=str(result.get("status") or "unknown"),
        message=result.get("message"),
        queued=bool(result.get("queued")),
        reason=result.get("reason"),
    )


@router.get("/barrels/{barrel_id}/status", response_model=BarrelStatusResponse)
async def barrel_status(
    barrel_id: UUID,
    _admin: AdminUser = Depends(require_admin_or_service_mutate),
) -> BarrelStatusResponse:
    status_row = await barrel_service.get_barrel_status(str(barrel_id))
    if status_row is None:
        raise HTTPException(status_code=404, detail="Barrel not found")
    return BarrelStatusResponse(
        barrel_id=status_row["id"],
        name=status_row["name"],
        enabled=bool(status_row["enabled"]),
        driver_type=status_row["driver_type"],
        asset_count=int(status_row.get("asset_count") or 0),
        assets_by_status=status_row.get("assets_by_status") or {},
        active_jobs=status_row.get("active_jobs") or [],
        completed_jobs=status_row.get("completed_jobs") or [],
        qdrant_collection=status_row["qdrant_collection"],
        revision=status_row.get("revision"),
        active_revision_id=status_row.get("active_revision_id"),
        revision_indexed_at=status_row.get("revision_indexed_at"),
        revision_chunk_count=status_row.get("revision_chunk_count"),
        pipeline_fresh=bool(status_row.get("pipeline_fresh", True)),
        stale_asset_count=int(status_row.get("stale_asset_count") or 0),
        required_pipeline_version=status_row.get("required_pipeline_version"),
    )
