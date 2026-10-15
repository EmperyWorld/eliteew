# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic request/response schemas for KBSEW barrel and ingestion API.
# Invariants:
# - Barrel list/status may include optional revision fields from asset_revisions.
# - Barrel status active_jobs/completed_jobs expose trace_id for admin Job Monitor.
# - Barrel status may include pipeline_fresh / stale_asset_count for admin.
# - Force-reindex responses report queued vs already_active / incomplete_asset.
# Related:
# - api/services/revision_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class BarrelCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    driver_type: str = Field(default="pdf", max_length=64)
    enabled: bool = True


class BarrelResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    driver_type: str
    enabled: bool
    qdrant_collection: str
    asset_count: int = 0
    created_at: datetime
    updated_at: datetime
    # Latest active asset revision in the barrel (FE badge uses `revision`).
    revision: str | None = None
    active_revision_id: UUID | None = None
    revision_indexed_at: datetime | None = None
    revision_chunk_count: int | None = None


class IngestRequest(BaseModel):
    source_url: HttpUrl
    driver_type: str | None = None


class IngestResponse(BaseModel):
    job_id: UUID
    asset_id: UUID
    status: str
    message: str | None = None


class ForceReindexAssetResponse(BaseModel):
    """Single-asset force-reindex result (new job or already-active latest job)."""

    job_id: UUID | None = None
    asset_id: UUID
    status: str
    message: str | None = None
    queued: bool = True
    reason: str | None = None


class ForceReindexBarrelResponse(BaseModel):
    """Barrel-wide force-reindex summary."""

    barrel_id: UUID
    queued: int
    skipped_active: int
    failed: int
    jobs: list[ForceReindexAssetResponse] = Field(default_factory=list)


class IngestJobStatusItem(BaseModel):
    """One row in barrel status active_jobs / completed_jobs (admin Job Monitor)."""

    id: UUID
    asset_id: UUID | None = None
    status: str
    progress_pct: int = 0
    message: str | None = None
    updated_at: datetime | None = None
    trace_id: str | None = None
    driver_type: str | None = None


class BarrelStatusResponse(BaseModel):
    barrel_id: UUID
    name: str
    enabled: bool
    driver_type: str
    asset_count: int
    assets_by_status: dict[str, int]
    active_jobs: list[IngestJobStatusItem]
    # Recent terminal jobs for admin Job Monitor (bounded; optional on older clients).
    completed_jobs: list[IngestJobStatusItem] = Field(default_factory=list)
    qdrant_collection: str
    # Latest active asset revision (FE badge: `revision` = content_sha256 prefix).
    revision: str | None = None
    active_revision_id: UUID | None = None
    revision_indexed_at: datetime | None = None
    revision_chunk_count: int | None = None
    pipeline_fresh: bool = True
    stale_asset_count: int = 0
    required_pipeline_version: str | None = None


class DriverInfoResponse(BaseModel):
    driver_types: list[str]
