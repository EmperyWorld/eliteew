# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic In/Out models for the stack0 KBSEW gateway OpenAPI surface.
# Shapes align with KBSEW service schemas (barrels/search/ready), not FE invent.
# Invariants:
# - UUID/datetime fields match upstream JSON serialization (string on the wire).
# - ReadyOut keeps optional FE-degrade fields with defaults (metrics may be absent).
# - Admin search Out chunks are list[str] (same as kbsew_search_with_settings).
# Related:
# - KBSEW/api/schemas/barrels.py
# - KBSEW/api/schemas/search.py
# - shared/api/routers/kbsew_gateway.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class KbsewBarrelCreateIn(BaseModel):
    """Create barrel body — mirrors KBSEW BarrelCreateRequest."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    driver_type: str = Field(default="pdf", max_length=64)
    enabled: bool = True


class KbsewBarrelOut(BaseModel):
    """Barrel row — mirrors KBSEW BarrelResponse."""

    id: UUID
    name: str
    description: str | None = None
    driver_type: str
    enabled: bool
    qdrant_collection: str
    asset_count: int = 0
    created_at: datetime
    updated_at: datetime
    revision: str | None = None
    active_revision_id: UUID | None = None
    revision_indexed_at: datetime | None = None
    revision_chunk_count: int | None = None


class KbsewIngestIn(BaseModel):
    """URL ingest body — mirrors KBSEW IngestRequest (source_url as string on gateway)."""

    source_url: str = Field(min_length=1)
    driver_type: str | None = None


class KbsewIngestOut(BaseModel):
    """Ingest / upload enqueue result — mirrors KBSEW IngestResponse."""

    job_id: UUID
    asset_id: UUID
    status: str
    message: str | None = None


class KbsewForceReindexAssetOut(BaseModel):
    """Single-asset force-reindex — mirrors KBSEW ForceReindexAssetResponse."""

    job_id: UUID | None = None
    asset_id: UUID
    status: str
    message: str | None = None
    queued: bool = True
    reason: str | None = None


class KbsewForceReindexBarrelOut(BaseModel):
    """Barrel-wide force-reindex — mirrors KBSEW ForceReindexBarrelResponse."""

    barrel_id: UUID
    queued: int
    skipped_active: int
    failed: int
    jobs: list[KbsewForceReindexAssetOut] = Field(default_factory=list)


class KbsewIngestJobOut(BaseModel):
    """Job row in barrel status — mirrors KBSEW IngestJobStatusItem."""

    id: UUID
    asset_id: UUID | None = None
    status: str
    progress_pct: int = 0
    message: str | None = None
    updated_at: datetime | None = None
    trace_id: str | None = None
    driver_type: str | None = None


class KbsewBarrelStatusOut(BaseModel):
    """Barrel status — mirrors KBSEW BarrelStatusResponse."""

    barrel_id: UUID
    name: str
    enabled: bool
    driver_type: str
    asset_count: int
    assets_by_status: dict[str, int]
    active_jobs: list[KbsewIngestJobOut]
    completed_jobs: list[KbsewIngestJobOut] = Field(default_factory=list)
    qdrant_collection: str
    revision: str | None = None
    active_revision_id: UUID | None = None
    revision_indexed_at: datetime | None = None
    revision_chunk_count: int | None = None
    pipeline_fresh: bool = True
    stale_asset_count: int = 0
    required_pipeline_version: str | None = None


class KbsewDriversOut(BaseModel):
    """Driver catalog — mirrors KBSEW DriverInfoResponse."""

    driver_types: list[str]


class KbsewReadyOut(BaseModel):
    """
    Gateway ready probe payload.

    Core fields match KBSEW collect_readiness(); optional metrics/detail fields
    are accepted when present for FE Overview degrade (absent → n/a).
    """

    status: str | None = None
    service: str | None = None
    ready: bool | None = None
    degraded: bool | None = None
    detail: str | None = None
    message: str | None = None
    checks: dict[str, Any] | None = None
    metrics: dict[str, Any] | None = None
    active_jobs: int | None = None
    ingest_success_total: int | None = None
    ingest_failure_total: int | None = None


class AdminKbsewSearchBody(BaseModel):
    """Admin Test-search request (stack0 gateway; may apply desktop AI-chat settings)."""

    query: str = Field(min_length=1, max_length=4000)
    barrel_id: UUID
    limit: int | None = Field(default=None, ge=1, le=20)
    apply_admin_settings: bool = True
    retrieval_mode: Literal["dense", "hybrid"] | None = None


class AdminKbsewSearchOut(BaseModel):
    """Admin search result — barrel_id + string chunks (retrieval / passthrough)."""

    barrel_id: UUID
    chunks: list[str] = Field(default_factory=list)
