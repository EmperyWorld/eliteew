# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop admin API for unified content ops: overview, probes, quota, failures, metrics, storage remediation.
# Invariants:
# - RBAC enforced through require_admin_user; no raw file bytes in responses.
# Related:
# - api/services/unified_content/content_admin_ops_service.py
# - api/routers/desktop_admin.py
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.routers.admin_auth import require_admin_user
from api.services.unified_content.content_admin_ops_service import (
    build_content_ops_diagnostics,
    build_content_ops_meta,
    build_content_ops_overview,
    export_performance_metrics,
    get_user_quota,
    list_processing_failures,
    list_user_quota_page,
    probe_content_dependencies,
    run_hard_purge_soft_deleted,
    run_migrate_pg_blobs_to_seaweed,
    run_scan_missing_storage_blobs,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content-ops", tags=["desktop-admin-content-ops"])


class ContentOpsOverviewResponse(BaseModel):
    total_rows: int
    active_rows: int
    failed_processing: int
    deleted_count: int


class ContentProbeResultRow(BaseModel):
    target: str
    ok: bool
    latency_ms: int
    error_code: str | None
    message: str
    details: dict[str, Any] | None = None


class ContentProbeResponse(BaseModel):
    results: list[ContentProbeResultRow]


class ContentUserQuotaRow(BaseModel):
    user_id: str
    email: str | None = None
    storage_used_bytes: int
    storage_quota_bytes: int
    storage_remaining_bytes: int


class ContentUserQuotaPageResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ContentUserQuotaRow]


class ContentProcessingFailureRow(BaseModel):
    id: str
    user_id: str | None
    name: str | None
    title: str | None
    content_type: str | None
    processing_status: str | None
    processing_error: str | None
    updated_at: str | None


class ContentProcessingFailuresResponse(BaseModel):
    total: int
    limit: int
    items: list[ContentProcessingFailureRow]


class ContentMetricsResponse(BaseModel):
    metrics: dict[str, Any]


class ContentOpsDiagnosticCheckRow(BaseModel):
    id: str
    ok: bool
    latency_ms: int | None = None
    message: str


class ContentOpsDiagnosticsResponse(BaseModel):
    checks: list[ContentOpsDiagnosticCheckRow]


class ContentOpsMetaResponse(BaseModel):
    total_content_rows: int
    total_storage_bytes: int
    processing_pending: int
    processing_failed: int
    workers_healthy: bool
    updated_at: str | None = None


class ContentStorageMigrateResponse(BaseModel):
    scanned: int
    migrated: int
    skipped: int
    failed: int
    dry_run: bool
    failed_ids: list[str]


class ContentStorageHardPurgeResponse(BaseModel):
    scanned: int
    purged: int
    skipped: int
    failed: int
    dry_run: bool
    older_than_days: int
    failed_ids: list[str]


class ContentStorageScanMissingResponse(BaseModel):
    dry_run: bool
    scanned: int
    missing_count: int
    missing_ids: list[str]
    quarantined_ids: list[str]
    stat_errors: list[dict[str, str]]


@router.get("/overview", response_model=ContentOpsOverviewResponse)
async def get_content_ops_overview(
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentOpsOverviewResponse:
    _ = admin
    payload = await build_content_ops_overview(pool)
    return ContentOpsOverviewResponse.model_validate(payload)


@router.post("/probe", response_model=ContentProbeResponse)
async def post_content_ops_probe(
    admin: AuthUser = Depends(require_admin_user),
) -> ContentProbeResponse:
    payload = await probe_content_dependencies()
    logger.info("[STEP] content.admin_probe actor=%s", admin.id)
    return ContentProbeResponse.model_validate(payload)


@router.get("/diagnostics", response_model=ContentOpsDiagnosticsResponse)
async def get_content_ops_diagnostics(
    admin: AuthUser = Depends(require_admin_user),
) -> ContentOpsDiagnosticsResponse:
    _ = admin
    payload = await build_content_ops_diagnostics()
    return ContentOpsDiagnosticsResponse.model_validate(payload)


@router.get("/meta", response_model=ContentOpsMetaResponse)
async def get_content_ops_meta(
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentOpsMetaResponse:
    _ = admin
    payload = await build_content_ops_meta(pool)
    return ContentOpsMetaResponse.model_validate(payload)


@router.get("/quota/users", response_model=ContentUserQuotaPageResponse)
async def get_content_user_quota_page(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentUserQuotaPageResponse:
    _ = admin
    payload = await list_user_quota_page(pool, limit=limit, offset=offset)
    return ContentUserQuotaPageResponse.model_validate(payload)


@router.get("/quota/users/{user_id}", response_model=ContentUserQuotaRow)
async def get_content_user_quota(
    user_id: UUID,
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentUserQuotaRow:
    _ = admin
    payload = await get_user_quota(pool, user_id)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return ContentUserQuotaRow.model_validate(payload)


@router.get("/processing-failures", response_model=ContentProcessingFailuresResponse)
async def get_content_processing_failures(
    limit: int = Query(default=50, ge=1, le=200),
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentProcessingFailuresResponse:
    _ = admin
    payload = await list_processing_failures(pool, limit=limit)
    return ContentProcessingFailuresResponse.model_validate(payload)


@router.get("/metrics", response_model=ContentMetricsResponse)
async def get_content_performance_metrics(
    admin: AuthUser = Depends(require_admin_user),
) -> ContentMetricsResponse:
    _ = admin
    return ContentMetricsResponse(metrics=export_performance_metrics())


@router.post("/scan-missing-blobs", response_model=ContentStorageScanMissingResponse)
async def post_content_ops_scan_missing_blobs(
    dry_run: bool = Query(
        True,
        description="If true, report missing ids only; if false, soft-delete rows (quarantine)",
    ),
    limit: int = Query(500, ge=1, le=10_000),
    only_content_id: UUID | None = Query(
        None,
        description="Check a single content UUID (SeaweedFS backend only)",
    ),
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentStorageScanMissingResponse:
    import asyncpg

    logger.warning(
        "[STEP] content_ops_scan_missing_blobs dry_run=%s limit=%s only=%s actor=%s",
        dry_run,
        limit,
        only_content_id,
        admin.id,
    )
    try:
        payload = await run_scan_missing_storage_blobs(
            pool,
            str(admin.id),
            dry_run=dry_run,
            limit=limit,
            only_content_id=only_content_id,
        )
    except asyncpg.UndefinedColumnError as exc:
        logger.error("content_ops_scan_missing_blobs: schema missing storage_integrity_status: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apply migration pending/20260325_unified_content_storage_integrity.sql first",
        ) from exc
    return ContentStorageScanMissingResponse.model_validate(payload)


@router.post("/migrate-pg-blobs", response_model=ContentStorageMigrateResponse)
async def post_content_ops_migrate_pg_blobs(
    dry_run: bool = Query(
        True,
        description="If true, count candidates only; if false, migrate BYTEA to SeaweedFS",
    ),
    limit: int = Query(500, ge=1, le=10_000),
    only_content_id: UUID | None = Query(None, description="Migrate a single content UUID"),
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentStorageMigrateResponse:
    logger.warning(
        "[STEP] content_ops_migrate_pg_blobs dry_run=%s limit=%s only=%s actor=%s",
        dry_run,
        limit,
        only_content_id,
        admin.id,
    )
    payload = await run_migrate_pg_blobs_to_seaweed(
        pool,
        dry_run=dry_run,
        limit=limit,
        only_content_id=only_content_id,
    )
    return ContentStorageMigrateResponse.model_validate(payload)


@router.post("/hard-purge-soft-deleted", response_model=ContentStorageHardPurgeResponse)
async def post_content_ops_hard_purge_soft_deleted(
    dry_run: bool = Query(
        True,
        description="If true, count candidates only; if false, permanently delete rows",
    ),
    limit: int = Query(500, ge=1, le=10_000),
    older_than_days: int | None = Query(
        None,
        ge=1,
        le=3650,
        description="Retention days (default UNIFIED_CONTENT_HARD_PURGE_DAYS or 30)",
    ),
    only_content_id: UUID | None = Query(None, description="Purge a single soft-deleted UUID"),
    pool=Depends(get_asyncpg_pool),
    admin: AuthUser = Depends(require_admin_user),
) -> ContentStorageHardPurgeResponse:
    logger.warning(
        "[STEP] content_ops_hard_purge dry_run=%s limit=%s days=%s only=%s actor=%s",
        dry_run,
        limit,
        older_than_days,
        only_content_id,
        admin.id,
    )
    payload = await run_hard_purge_soft_deleted(
        pool,
        dry_run=dry_run,
        limit=limit,
        older_than_days=older_than_days,
        only_content_id=only_content_id,
    )
    return ContentStorageHardPurgeResponse.model_validate(payload)
