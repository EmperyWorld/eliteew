# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent asset create + job enqueue helpers for KBSEW ingestion HTTP entry.
# Invariants:
# - Completed skip only when payload digest matches stored asset digest (URL without digest requeues).
# - UniqueViolation on create → reuse asset by idempotency_key.
# Related:
# - api/services/ingestion_service.py
# - api/services/barrel_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
from typing import Any

import asyncpg

import api.services.barrel_service as barrel_service
from api.core.config import get_settings
from api.services.ingestion_support import safe_filename

logger = logging.getLogger(__name__)


async def create_asset_or_get(
    *,
    barrel_id: str,
    source_url: str,
    metadata: dict[str, Any],
    idempotency_key: str,
    content_sha256: str | None = None,
) -> dict[str, Any]:
    try:
        return await barrel_service.create_asset(
            barrel_id=barrel_id,
            source_url=source_url,
            metadata=metadata,
            content_sha256=content_sha256,
            idempotency_key=idempotency_key,
        )
    except asyncpg.UniqueViolationError:
        existing = await barrel_service.find_asset_by_idempotency_key(barrel_id, idempotency_key)
        if existing is None:
            raise
        logger.info(
            "[STEP] kbsew_asset_create_race_reuse barrel_id=%s asset_id=%s",
            barrel_id,
            existing.get("id"),
        )
        return existing


def upload_object_key(*, barrel_id: str, content_sha256: str, filename: str) -> str:
    settings = get_settings()
    return f"{settings.object_prefix}{barrel_id}/{content_sha256}_{safe_filename(filename)}"


def job_result(job: dict[str, Any], asset: dict[str, Any]) -> dict[str, Any]:
    return {
        "job_id": job["id"],
        "asset_id": asset["id"],
        "status": job["status"],
        "message": job.get("message"),
    }


def completed_job_is_fresh(
    *,
    asset: dict[str, Any],
    source_kind: str,
    payload: dict[str, Any],
) -> bool:
    """
    True when a completed job may be reused without requeue.

    Upload with matching content_sha256 → fresh.
    URL without a verified digest in the request payload → not fresh (requeue).
    """

    incoming = str(payload.get("content_sha256") or "").strip()
    stored = str(asset.get("content_sha256") or "").strip()
    if incoming and stored:
        return incoming == stored
    # Legacy upload rows may omit digest on the request; keep skip.
    # URL completed without digest must requeue so origin drift is re-checked.
    return source_kind == "upload"


async def queue_existing_or_new_job(
    *,
    barrel_id: str,
    asset: dict[str, Any],
    source_kind: str,
    driver_type: str | None,
    payload: dict[str, Any],
    trace_id: str,
) -> dict[str, Any]:
    """
    Idempotent queue:

    - completed + fresh digest → return existing job (no enqueue).
    - otherwise → enqueue_job (reuses active queued/running; creates otherwise).
    """

    latest = await barrel_service.latest_job_for_asset(str(asset["id"]))
    if (
        latest
        and latest.get("status") == "completed"
        and not bool(payload.get("force_reindex"))
        and completed_job_is_fresh(asset=asset, source_kind=source_kind, payload=payload)
    ):
        return job_result(latest, asset)
    job, created = await barrel_service.enqueue_job(
        barrel_id=barrel_id,
        asset_id=str(asset["id"]),
        source_kind=source_kind,
        driver_type=driver_type,
        payload=payload,
        trace_id=trace_id,
    )
    if created:
        await barrel_service.update_asset(str(asset["id"]), status="pending", error_message=None)
        logger.info(
            "[STEP] kbsew_ingest_requeue asset_id=%s prior_status=%s job_id=%s",
            asset["id"],
            (latest or {}).get("status"),
            job["id"],
        )
    return job_result(job, asset)


async def resolve_existing_upload_asset(
    *,
    barrel_id: str,
    content_sha256: str,
    idempotency_key: str,
) -> dict[str, Any] | None:
    existing = await barrel_service.find_asset_by_idempotency_key(barrel_id, idempotency_key)
    if existing:
        return existing
    # Legacy / partial rows: same bytes already stored under content_sha256.
    by_sha = await barrel_service.find_asset_by_content_sha256(barrel_id, content_sha256)
    if by_sha and not by_sha.get("idempotency_key"):
        await barrel_service.update_asset(
            str(by_sha["id"]),
            idempotency_key=idempotency_key,
            content_sha256=content_sha256,
        )
        return await barrel_service.get_asset(str(by_sha["id"])) or by_sha
    return by_sha
