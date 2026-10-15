# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Orchestrates KBSEW ingestion pipeline: validate → metadata → chunk → store → index.
# Queue / index-commit / force-reindex helpers live in sibling modules.
# Invariants:
# - Upload idempotency uses content_sha256 (`upload:<sha>`) with legacy sha fallback.
# - Completed skip only when payload digest matches stored asset digest (URL without digest requeues).
# - Index commit: reject zero chunks; ingest quality gate; upsert then prune stale higher chunk_index.
# - Unchanged-byte skip only when active revision pipeline_version == PIPELINE_VERSION.
# - Force-reindex always enqueues a new job over the same asset (completed is not a skip).
# - Enqueue uses barrel_service.enqueue_job (≤1 active job/asset); disabled barrels rejected at HTTP.
# - URL ingest goes through safe_http (SSRF + size cap); uploads enforce KBSEW_INGEST_MAX_BYTES.
# - Upload path accepts any driver with validate_bytes / extract_metadata_bytes /
#   process_and_chunk_bytes (pdf, markdown, code_python, code_typescript).
# Related:
# - api/services/ingestion_queue.py
# - api/services/ingestion_index.py
# - api/services/ingestion_reindex.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import logging
from typing import Any, cast

import api.services.barrel_service as barrel_service
from api.core.ingest_errors import JobLeaseLostError
from api.core.json_codec import coerce_json_object
from api.drivers.base import BytesUploadDriver
from api.drivers.pdf import PDFIngestionDriver as PDFIngestionDriver
from api.services.ingestion_index import commit_vector_index, unchanged_index_skip
from api.services.ingestion_queue import (
    create_asset_or_get,
    queue_existing_or_new_job,
    resolve_existing_upload_asset,
    upload_object_key,
)
from api.services.ingestion_reindex import (
    enqueue_stale_pipeline_reindexes as _enqueue_stale_pipeline_reindexes_impl,
)
from api.services.ingestion_reindex import (
    force_reindex_asset as _force_reindex_asset_impl,
)
from api.services.ingestion_reindex import (
    force_reindex_barrel as _force_reindex_barrel_impl,
)
from api.services.ingestion_support import (
    job_log,
    progress,
    require_barrel_enabled,
    safe_filename,
    sha256_hex,
)
from api.services.object_store import download_bytes, upload_bytes
from api.services.safe_http import (
    assert_url_safe_for_ingest,
    download_url_capped,
    ensure_payload_within_limit,
)

logger = logging.getLogger(__name__)


def _guess_upload_content_type(*, filename: str, driver_type: str) -> str:
    """Seaweed content-type for raw upload bytes (not used for parsing)."""
    lower = (filename or "").lower().split("?", 1)[0]
    dtype = (driver_type or "").strip().lower()
    if lower.endswith(".pdf") or dtype == "pdf":
        return "application/pdf"
    if lower.endswith((".md", ".markdown")) or dtype == "markdown":
        return "text/markdown; charset=utf-8"
    if lower.endswith((".ts", ".tsx", ".mts", ".cts", ".js", ".jsx")) or dtype == "code_typescript":
        return "text/plain; charset=utf-8"
    if lower.endswith(".py") or dtype == "code_python":
        return "text/x-python; charset=utf-8"
    return "application/octet-stream"


def _require_bytes_upload_driver(driver: object) -> BytesUploadDriver:
    """Upload path needs validate/extract/chunk-on-bytes (PDF, markdown, code_*)."""
    missing = [
        name
        for name in ("validate_bytes", "extract_metadata_bytes", "process_and_chunk_bytes")
        if not callable(getattr(driver, name, None))
    ]
    if missing:
        dtype = getattr(driver, "driver_type", type(driver).__name__)
        raise ValueError(f"File upload is not supported for driver {dtype!r} (missing: {', '.join(missing)})")
    return cast(BytesUploadDriver, driver)


# --- Test / internal aliases (keep private names used by contract tests) ---
_sha256_hex = sha256_hex
_safe_filename = safe_filename
_require_barrel_enabled = require_barrel_enabled
_progress = progress
_job_log = job_log
_create_asset_or_get = create_asset_or_get
_upload_object_key = upload_object_key
_queue_existing_or_new_job = queue_existing_or_new_job
_resolve_existing_upload_asset = resolve_existing_upload_asset
_unchanged_index_skip = unchanged_index_skip
_commit_vector_index = commit_vector_index


async def force_reindex_asset(*, barrel_id: str, asset_id: str) -> dict[str, Any]:
    return await _force_reindex_asset_impl(barrel_id=barrel_id, asset_id=asset_id)


async def force_reindex_barrel(*, barrel_id: str) -> dict[str, Any]:
    """Uses this module's force_reindex_asset so monkeypatches apply."""

    return await _force_reindex_barrel_impl(
        barrel_id=barrel_id,
        force_reindex_fn=force_reindex_asset,
    )


async def enqueue_stale_pipeline_reindexes(*, limit: int = 50) -> dict[str, int]:
    """Auto-heal wrapper: uses this module's force_reindex_asset (monkeypatch-friendly)."""

    return await _enqueue_stale_pipeline_reindexes_impl(
        limit=limit,
        force_reindex_fn=force_reindex_asset,
    )


async def _download_raw(source_url: str) -> tuple[bytes, str]:
    return await download_url_capped(source_url)


async def execute_url_ingestion(
    *,
    barrel_id: str,
    asset_id: str,
    job_id: str,
    source_url: str,
    driver_type: str | None,
    worker_id: str,
    trace_id: str | None = None,
    force_reindex: bool = False,
) -> int:
    barrel = await barrel_service.get_barrel(barrel_id)
    if barrel is None:
        raise LookupError("Barrel not found")
    require_barrel_enabled(barrel)

    driver = barrel_service.resolve_driver(driver_type, str(barrel["driver_type"]))
    collection = str(barrel["qdrant_collection"])

    job_log(
        trace_id=trace_id,
        job_id=job_id,
        asset_id=asset_id,
        barrel_id=barrel_id,
        stage="start",
        status="running",
    )
    await progress(job_id, worker_id=worker_id, progress_pct=5, message="Validating source")
    await barrel_service.update_asset(asset_id, status="running")

    asset = await barrel_service.get_asset(asset_id) or {}
    metadata = coerce_json_object(asset.get("metadata"))
    object_key = str(asset.get("object_key") or metadata.get("object_key") or "")
    filename = str(metadata.get("filename") or source_url.rsplit("/", 1)[-1].split("?", 1)[0] or "document.pdf")

    if not object_key and not await driver.validate(source_url):
        raise ValueError("Source URL is not supported by the selected driver")

    await progress(job_id, worker_id=worker_id, progress_pct=15, message="Extracting metadata")
    if not object_key:
        extracted_metadata = await driver.extract_metadata(source_url)
        metadata = {**metadata, **extracted_metadata}

    await progress(job_id, worker_id=worker_id, progress_pct=30, message="Uploading raw object")
    raw_bytes: bytes | None = None
    if object_key:
        raw_bytes = await download_bytes(object_key)
    else:
        raw_bytes, filename = await _download_raw(source_url)
        object_key = await upload_bytes(
            raw_bytes,
            barrel_id=barrel_id,
            filename=filename,
            content_type=_guess_upload_content_type(
                filename=filename,
                driver_type=str(getattr(driver, "driver_type", "") or ""),
            ),
        )
    metadata["object_key"] = object_key
    metadata.setdefault("filename", filename)
    metadata.setdefault("source_kind", "url")
    content_sha256 = ""
    if raw_bytes is not None:
        content_sha256 = sha256_hex(raw_bytes)
        metadata["content_sha256"] = content_sha256
    else:
        content_sha256 = str(asset.get("content_sha256") or metadata.get("content_sha256") or "")

    skip_chunks = await _unchanged_index_skip(asset=asset, content_sha256=content_sha256, force_reindex=force_reindex)
    if skip_chunks is not None:
        logger.info(
            "[STEP] kbsew_ingest_unchanged_skip asset_id=%s job_id=%s chunks=%s",
            asset_id,
            job_id,
            skip_chunks,
        )
        await barrel_service.update_asset(
            asset_id,
            metadata=metadata,
            object_key=object_key,
            content_sha256=content_sha256 or None,
            status="indexed",
            chunk_count=skip_chunks,
            error_message=None,
        )
        return skip_chunks

    await barrel_service.update_asset(
        asset_id,
        metadata=metadata,
        object_key=object_key,
        content_sha256=content_sha256 or None,
    )

    await progress(job_id, worker_id=worker_id, progress_pct=55, message="Parsing and chunking")
    process_bytes = getattr(driver, "process_and_chunk_bytes", None)
    if raw_bytes is not None and callable(process_bytes):
        chunks = await process_bytes(raw_bytes, filename, source_url=source_url)
    else:
        chunks = await driver.process_and_chunk(source_url)

    return await _commit_vector_index(
        driver=driver,
        chunks=chunks,
        barrel_id=barrel_id,
        collection=collection,
        asset_id=asset_id,
        content_sha256=content_sha256 or None,
        job_id=job_id,
        worker_id=worker_id,
        barrel_id_for_log=barrel_id,
        trace_id=trace_id,
    )


async def execute_upload_ingestion(
    *,
    barrel_id: str,
    asset_id: str,
    job_id: str,
    source_url: str,
    file_data: bytes,
    filename: str,
    driver_type: str | None,
    worker_id: str,
    trace_id: str | None = None,
    force_reindex: bool = False,
) -> int:
    barrel = await barrel_service.get_barrel(barrel_id)
    if barrel is None:
        raise LookupError("Barrel not found")
    require_barrel_enabled(barrel)
    ensure_payload_within_limit(file_data)

    driver = barrel_service.resolve_driver(driver_type, str(barrel["driver_type"]))
    collection = str(barrel["qdrant_collection"])

    job_log(
        trace_id=trace_id,
        job_id=job_id,
        asset_id=asset_id,
        barrel_id=barrel_id,
        stage="start",
        status="running",
    )
    await progress(job_id, worker_id=worker_id, progress_pct=5, message="Validating upload")
    await barrel_service.update_asset(asset_id, status="running")

    bytes_driver = _require_bytes_upload_driver(driver)
    if not await bytes_driver.validate_bytes(file_data, filename):
        raise ValueError(f"Uploaded file is not supported by driver {getattr(driver, 'driver_type', 'unknown')!r}")

    asset = await barrel_service.get_asset(asset_id) or {}
    existing_meta = coerce_json_object(asset.get("metadata"))
    object_key = str(asset.get("object_key") or existing_meta.get("object_key") or "")
    content_sha256 = sha256_hex(file_data)

    skip_chunks = await _unchanged_index_skip(asset=asset, content_sha256=content_sha256, force_reindex=force_reindex)
    if skip_chunks is not None:
        logger.info(
            "[STEP] kbsew_ingest_unchanged_skip asset_id=%s job_id=%s chunks=%s",
            asset_id,
            job_id,
            skip_chunks,
        )
        return skip_chunks

    await progress(job_id, worker_id=worker_id, progress_pct=15, message="Extracting metadata")
    metadata = await bytes_driver.extract_metadata_bytes(file_data, filename, source_url=source_url)

    await progress(job_id, worker_id=worker_id, progress_pct=30, message="Uploading raw object")
    if not object_key:
        object_key = await upload_bytes(
            file_data,
            barrel_id=barrel_id,
            filename=filename,
            content_type=_guess_upload_content_type(
                filename=filename,
                driver_type=str(getattr(driver, "driver_type", "") or driver_type or ""),
            ),
        )
    metadata.update(
        {
            "object_key": object_key,
            "filename": filename,
            "source_kind": "upload",
            "content_sha256": content_sha256,
        }
    )
    await barrel_service.update_asset(
        asset_id,
        metadata=metadata,
        object_key=object_key,
        content_sha256=content_sha256,
    )

    await progress(job_id, worker_id=worker_id, progress_pct=55, message="Parsing and chunking")
    chunks = await bytes_driver.process_and_chunk_bytes(file_data, filename, source_url=source_url)

    return await _commit_vector_index(
        driver=driver,
        chunks=chunks,
        barrel_id=barrel_id,
        collection=collection,
        asset_id=asset_id,
        content_sha256=content_sha256,
        job_id=job_id,
        worker_id=worker_id,
        barrel_id_for_log=barrel_id,
        trace_id=trace_id,
    )


async def start_ingestion(
    *,
    barrel_id: str,
    source_url: str,
    driver_type: str | None,
) -> dict[str, Any]:
    barrel = await barrel_service.get_barrel(barrel_id)
    if barrel is None:
        raise LookupError("Barrel not found")
    require_barrel_enabled(barrel)
    await assert_url_safe_for_ingest(source_url)
    resolved_driver = (driver_type or str(barrel["driver_type"])).strip().lower()
    idempotency_key = sha256_hex(f"url:{barrel_id}:{resolved_driver}:{source_url}")
    trace_id = str(idempotency_key[:16])
    existing = await barrel_service.find_asset_by_idempotency_key(barrel_id, idempotency_key)
    payload = {"source_url": source_url, "driver_type": resolved_driver}
    if existing:
        return await _queue_existing_or_new_job(
            barrel_id=barrel_id,
            asset=existing,
            source_kind="url",
            driver_type=resolved_driver,
            payload=payload,
            trace_id=trace_id,
        )
    asset = await _create_asset_or_get(
        barrel_id=barrel_id,
        source_url=source_url,
        metadata={"source_kind": "url", "driver_type": resolved_driver},
        idempotency_key=idempotency_key,
    )
    return await _queue_existing_or_new_job(
        barrel_id=barrel_id,
        asset=asset,
        source_kind="url",
        driver_type=resolved_driver,
        payload=payload,
        trace_id=trace_id,
    )


async def start_ingestion_upload(
    *,
    barrel_id: str,
    file_data: bytes,
    filename: str,
    driver_type: str | None,
) -> dict[str, Any]:
    barrel = await barrel_service.get_barrel(barrel_id)
    if barrel is None:
        raise LookupError("Barrel not found")
    require_barrel_enabled(barrel)
    ensure_payload_within_limit(file_data)
    safe_name = safe_filename(filename)
    content_sha256 = sha256_hex(file_data)
    idempotency_key = f"upload:{content_sha256}"
    trace_id = str(content_sha256[:16])
    source_url = f"kbsew-upload://{barrel_id}/{content_sha256}/{safe_name}"
    existing = await _resolve_existing_upload_asset(
        barrel_id=barrel_id,
        content_sha256=content_sha256,
        idempotency_key=idempotency_key,
    )
    resolved_driver = (driver_type or str(barrel["driver_type"])).strip().lower()
    object_key = _upload_object_key(barrel_id=barrel_id, content_sha256=content_sha256, filename=safe_name)
    payload = {
        "source_url": source_url,
        "driver_type": resolved_driver,
        "filename": safe_name,
        "object_key": object_key,
        "content_sha256": content_sha256,
    }
    if existing:
        if not existing.get("object_key"):
            await upload_bytes(
                file_data,
                barrel_id=barrel_id,
                filename=safe_name,
                content_type=_guess_upload_content_type(
                    filename=safe_name,
                    driver_type=resolved_driver,
                ),
                object_key=object_key,
            )
            await barrel_service.update_asset(
                str(existing["id"]),
                object_key=object_key,
                metadata={
                    **coerce_json_object(existing.get("metadata")),
                    **payload,
                    "source_kind": "upload",
                },
                content_sha256=content_sha256,
            )
            existing = await barrel_service.get_asset(str(existing["id"])) or existing
        return await _queue_existing_or_new_job(
            barrel_id=barrel_id,
            asset=existing,
            source_kind="upload",
            driver_type=resolved_driver,
            payload=payload,
            trace_id=trace_id,
        )
    await upload_bytes(
        file_data,
        barrel_id=barrel_id,
        filename=safe_name,
        content_type=_guess_upload_content_type(
            filename=safe_name,
            driver_type=resolved_driver,
        ),
        object_key=object_key,
    )
    asset = await _create_asset_or_get(
        barrel_id=barrel_id,
        source_url=source_url,
        metadata={**payload, "source_kind": "upload"},
        content_sha256=content_sha256,
        idempotency_key=idempotency_key,
    )
    if not asset.get("object_key"):
        await barrel_service.update_asset(str(asset["id"]), object_key=object_key)
        asset = {**asset, "object_key": object_key}
    return await _queue_existing_or_new_job(
        barrel_id=barrel_id,
        asset=asset,
        source_kind="upload",
        driver_type=resolved_driver,
        payload=payload,
        trace_id=trace_id,
    )


async def execute_persisted_job(job: dict[str, Any]) -> int:
    asset_id = str(job["asset_id"])
    asset = await barrel_service.get_asset(asset_id)
    if asset is None:
        raise LookupError("Asset not found")
    payload = coerce_json_object(job.get("payload"))
    source_kind = str(job.get("source_kind") or payload.get("source_kind") or "url")
    driver_type = job.get("driver_type") or payload.get("driver_type")
    trace_id = str(job.get("trace_id") or "")
    force_reindex = bool(payload.get("force_reindex"))
    worker_id = str(job.get("locked_by") or "").strip()
    if not worker_id:
        raise JobLeaseLostError(str(job["id"]), reason="missing_locked_by")
    if source_kind == "upload":
        metadata = coerce_json_object(asset.get("metadata"))
        object_key = str(payload.get("object_key") or asset.get("object_key") or metadata.get("object_key") or "")
        filename = str(payload.get("filename") or metadata.get("filename") or "document.pdf")
        if not object_key:
            raise RuntimeError("Upload job has no object_key")
        file_data = await download_bytes(object_key)
        return await execute_upload_ingestion(
            barrel_id=str(job["barrel_id"]),
            asset_id=asset_id,
            job_id=str(job["id"]),
            source_url=str(payload.get("source_url") or asset["source_url"]),
            file_data=file_data,
            filename=filename,
            driver_type=str(driver_type) if driver_type else None,
            worker_id=worker_id,
            trace_id=trace_id,
            force_reindex=force_reindex,
        )
    return await execute_url_ingestion(
        barrel_id=str(job["barrel_id"]),
        asset_id=asset_id,
        job_id=str(job["id"]),
        source_url=str(payload.get("source_url") or asset["source_url"]),
        driver_type=str(driver_type) if driver_type else None,
        worker_id=worker_id,
        trace_id=trace_id,
        force_reindex=force_reindex,
    )
