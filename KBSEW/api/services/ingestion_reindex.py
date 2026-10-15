# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Force-reindex and stale-pipeline auto-heal enqueue for KBSEW assets/barrels.
# Invariants:
# - Force-reindex always enqueues a new job over the same asset (completed is not a skip).
# - Enqueue uses barrel_service.enqueue_job (≤1 active job/asset); disabled barrels rejected.
# Related:
# - api/services/ingestion_service.py
# - api/services/revision_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
from typing import Any

import api.services.barrel_service as barrel_service
import api.services.revision_service as revision_service
from api.core.ingest_errors import BarrelDisabledError
from api.core.json_codec import coerce_json_object
from api.services.ingestion_queue import job_result
from api.services.ingestion_support import require_barrel_enabled
from api.services.safe_http import assert_url_safe_for_ingest

logger = logging.getLogger(__name__)


def reindex_payload_for_asset(
    *,
    barrel_id: str,
    asset: dict[str, Any],
    barrel_driver: str,
) -> tuple[str, dict[str, Any]]:
    """Build (source_kind, job payload) from a persisted asset. Raises ValueError if incomplete."""

    metadata = coerce_json_object(asset.get("metadata"))
    object_key = str(asset.get("object_key") or metadata.get("object_key") or "").strip()
    source_url = str(asset.get("source_url") or metadata.get("source_url") or "").strip()
    driver_type = str(metadata.get("driver_type") or barrel_driver or "pdf").strip().lower()
    filename = str(metadata.get("filename") or "document.pdf").strip() or "document.pdf"
    content_sha256 = str(asset.get("content_sha256") or metadata.get("content_sha256") or "").strip()

    if object_key:
        return (
            "upload",
            {
                "source_url": source_url or f"kbsew-upload://{barrel_id}/{content_sha256 or 'reindex'}/{filename}",
                "driver_type": driver_type,
                "filename": filename,
                "object_key": object_key,
                "content_sha256": content_sha256,
                "force_reindex": True,
            },
        )
    if source_url:
        return (
            "url",
            {
                "source_url": source_url,
                "driver_type": driver_type,
                "force_reindex": True,
            },
        )
    raise ValueError("Asset has no object_key or source_url to reindex")


async def force_reindex_asset(
    *,
    barrel_id: str,
    asset_id: str,
) -> dict[str, Any]:
    """
    Always enqueue a new ingestion job for an existing asset (pipeline refresh).

    - queued/running → return existing job (`queued=False`, reason=already_active).
    - completed/failed/missing job → create a new job over the same asset lineage.
    """

    barrel = await barrel_service.get_barrel(barrel_id)
    if barrel is None:
        raise LookupError("Barrel not found")
    require_barrel_enabled(barrel)
    asset = await barrel_service.get_asset(asset_id)
    if asset is None or str(asset["barrel_id"]) != str(barrel_id):
        raise LookupError("Asset not found")

    source_kind, payload = reindex_payload_for_asset(
        barrel_id=barrel_id,
        asset=asset,
        barrel_driver=str(barrel.get("driver_type") or "pdf"),
    )
    if source_kind == "url":
        await assert_url_safe_for_ingest(str(payload.get("source_url") or ""))

    sha_hint = str(asset.get("content_sha256") or asset_id)
    trace_id = f"reindex:{sha_hint[:16]}"
    prior = await barrel_service.latest_job_for_asset(asset_id)
    job, created = await barrel_service.enqueue_job(
        barrel_id=barrel_id,
        asset_id=asset_id,
        source_kind=source_kind,
        driver_type=str(payload.get("driver_type") or barrel.get("driver_type")),
        payload=payload,
        trace_id=trace_id,
    )
    if not created:
        return {
            **job_result(job, asset),
            "queued": False,
            "reason": "already_active",
        }
    await barrel_service.update_asset(asset_id, status="pending", error_message=None)
    logger.info(
        "[STEP] kbsew_force_reindex asset_id=%s prior_job_status=%s job_id=%s source_kind=%s",
        asset_id,
        (prior or {}).get("status"),
        job["id"],
        source_kind,
    )
    return {
        **job_result(job, asset),
        "queued": True,
        "reason": "force_reindex",
    }


async def enqueue_stale_pipeline_reindexes(
    *,
    limit: int = 50,
    force_reindex_fn: Any | None = None,
) -> dict[str, int]:
    """Auto-heal: force-reindex indexed assets on a stale pipeline_version."""

    reindex = force_reindex_fn or force_reindex_asset
    stale = await revision_service.list_stale_indexed_assets(limit=limit)
    queued = 0
    skipped_active = 0
    failed = 0
    for row in stale:
        asset_id = str(row.get("asset_id") or "")
        barrel_id = str(row.get("barrel_id") or "")
        if not asset_id or not barrel_id:
            failed += 1
            continue
        try:
            result = await reindex(barrel_id=barrel_id, asset_id=asset_id)
        except (LookupError, ValueError, BarrelDisabledError) as exc:
            failed += 1
            logger.warning(
                "[STEP] kbsew_stale_pipeline_requeue_fail asset_id=%s reason=%s",
                asset_id,
                exc,
            )
            continue
        if result.get("queued"):
            queued += 1
        else:
            skipped_active += 1
    if stale:
        logger.info(
            "[STEP] kbsew_stale_pipeline_requeue scanned=%s queued=%s skipped_active=%s failed=%s required=%s",
            len(stale),
            queued,
            skipped_active,
            failed,
            revision_service.PIPELINE_VERSION,
        )
    return {
        "scanned": len(stale),
        "queued": queued,
        "skipped_active": skipped_active,
        "failed": failed,
    }


async def force_reindex_barrel(
    *,
    barrel_id: str,
    force_reindex_fn: Any | None = None,
) -> dict[str, Any]:
    """Force-reindex every asset in a barrel. Partial success is reported per asset."""

    reindex = force_reindex_fn or force_reindex_asset
    barrel = await barrel_service.get_barrel(barrel_id)
    if barrel is None:
        raise LookupError("Barrel not found")
    require_barrel_enabled(barrel)
    assets = await barrel_service.list_assets_for_barrel(barrel_id)
    queued = 0
    skipped_active = 0
    failed = 0
    jobs: list[dict[str, Any]] = []
    for asset in assets:
        asset_id = str(asset["id"])
        try:
            result = await reindex(barrel_id=barrel_id, asset_id=asset_id)
        except (ValueError, BarrelDisabledError) as exc:
            failed += 1
            logger.warning(
                "[STEP] kbsew_force_reindex_skip asset_id=%s reason=%s",
                asset_id,
                exc,
            )
            jobs.append(
                {
                    "job_id": None,
                    "asset_id": asset_id,
                    "status": "skipped",
                    "message": str(exc),
                    "queued": False,
                    "reason": "incomplete_asset" if not isinstance(exc, BarrelDisabledError) else "barrel_disabled",
                }
            )
            continue
        if result.get("queued"):
            queued += 1
        else:
            skipped_active += 1
        jobs.append(result)
    return {
        "barrel_id": barrel_id,
        "queued": queued,
        "skipped_active": skipped_active,
        "failed": failed,
        "jobs": jobs,
    }
