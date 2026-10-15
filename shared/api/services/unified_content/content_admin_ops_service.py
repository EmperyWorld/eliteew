# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin-only unified content diagnostics: overview counts, storage/redis probes, quota pages, failures.
# Invariants:
# - Never return raw file bytes or user secrets in admin ops payloads.
# Related:
# - api/routers/desktop_admin_content_ops.py
# - api/services/unified_content/performance_metrics.py
# ---

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
import httpx

from api.core.database_manager import get_database_manager
from api.core.unified_config import unified_settings
from api.services.chat_memory_service import EMBEDDING_DIMENSION
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.performance_metrics import get_metrics
from api.services.unified_content.storage_backends.minio_storage import SeaweedFSStorage
from api.utils.tool_router_sidecar_runtime import shared_tool_router_base_url

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ContentProbeResult:
    target: str
    ok: bool
    latency_ms: int
    error_code: str | None
    message: str
    details: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "target": self.target,
            "ok": self.ok,
            "latency_ms": self.latency_ms,
            "error_code": self.error_code,
            "message": self.message,
        }
        if self.details:
            payload["details"] = self.details
        return payload


async def build_content_ops_overview(pool: asyncpg.Pool) -> dict[str, Any]:
    """Aggregate unified_content row counts for admin overview."""
    from api.services.unified_content.storage_migrate_service import (
        hard_purge_retention_days,
        unified_content_hard_purge_beat_enabled,
    )

    retention_days = hard_purge_retention_days()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)::bigint AS total_rows,
                COUNT(*) FILTER (
                    WHERE processing_status = 'failed' AND deleted_at IS NULL
                )::bigint AS failed_processing,
                COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::bigint AS deleted_count,
                COUNT(*) FILTER (
                    WHERE deleted_at IS NOT NULL
                      AND deleted_at <= NOW() - ($1::int * INTERVAL '1 day')
                )::bigint AS purge_eligible_count
            FROM unified_content
            """,
            retention_days,
        )
    total_rows = int((row["total_rows"] if row else 0) or 0)
    failed_processing = int((row["failed_processing"] if row else 0) or 0)
    deleted_count = int((row["deleted_count"] if row else 0) or 0)
    purge_eligible_count = int((row["purge_eligible_count"] if row else 0) or 0)
    active_rows = max(0, total_rows - deleted_count)
    return {
        "total_rows": total_rows,
        "active_rows": active_rows,
        "failed_processing": failed_processing,
        "deleted_count": deleted_count,
        "hard_purge_retention_days": retention_days,
        "hard_purge_beat_enabled": unified_content_hard_purge_beat_enabled(),
        "soft_deleted_purge_eligible": purge_eligible_count,
    }


async def probe_seaweed_storage() -> ContentProbeResult:
    """Probe SeaweedFS S3 backend configured for unified content."""
    backend = SeaweedFSStorage(
        endpoint=unified_settings.minio_endpoint,
        access_key=unified_settings.minio_access_key,
        secret_key=unified_settings.minio_secret_key,
        secure=unified_settings.minio_secure,
        enable_encryption=unified_settings.s3_use_bucket_default_sse,
        bucket_name=unified_settings.s3_bucket,
    )
    outcome = await backend.probe_health()
    return ContentProbeResult(
        target="seaweedfs",
        ok=bool(outcome.get("ok")),
        latency_ms=int(outcome.get("latency_ms") or 0),
        error_code=outcome.get("error_code") if outcome.get("error_code") else None,  # type: ignore[arg-type]
        message=str(outcome.get("message") or "SeaweedFS probe finished"),
        details={key: outcome[key] for key in ("bucket", "endpoint") if key in outcome},
    )


async def probe_download_ticket_redis() -> ContentProbeResult:
    """Check Redis availability for ContentDownloadTicketService."""
    started = time.perf_counter()
    probe_key = "unified_content:admin_probe:v1"
    try:
        manager = await get_database_manager()
        redis = await manager.get_redis_client()
        if redis is None:
            return ContentProbeResult(
                target="download_ticket_redis",
                ok=False,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error_code="redis_unavailable",
                message="Redis client is not configured for content download tickets",
            )
        ping = getattr(redis, "ping", None)
        if callable(ping):
            await ping()
        await redis.setex(probe_key, 30, "1")
        raw = await redis.get(probe_key)
        await redis.delete(probe_key)
        if raw is None:
            return ContentProbeResult(
                target="download_ticket_redis",
                ok=False,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error_code="redis_read_failed",
                message="Redis round-trip failed for content download ticket probe",
            )
        return ContentProbeResult(
            target="download_ticket_redis",
            ok=True,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_code=None,
            message="Redis is available for content download tickets",
        )
    except Exception as exc:
        logger.debug("[STEP] content_admin_redis_probe_skip err=%s", exc, exc_info=True)
        return ContentProbeResult(
            target="download_ticket_redis",
            ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_code="redis_probe_failed",
            message=str(exc),
        )


async def probe_content_dependencies() -> dict[str, Any]:
    """Run all content admin dependency probes."""
    seaweed, redis_probe = await probe_seaweed_storage(), await probe_download_ticket_redis()
    return {
        "results": [seaweed.as_dict(), redis_probe.as_dict()],
    }


async def _probe_http_health(*, target: str, url: str) -> ContentProbeResult:
    started = time.perf_counter()
    health_url = url.rstrip("/") + "/health"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(health_url)
        latency = int((time.perf_counter() - started) * 1000)
        ok = resp.status_code == 200
        return ContentProbeResult(
            target=target,
            ok=ok,
            latency_ms=latency,
            error_code=None if ok else f"http_{resp.status_code}",
            message=f"{health_url} -> {resp.status_code}",
        )
    except Exception as exc:
        return ContentProbeResult(
            target=target,
            ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_code="http_probe_failed",
            message=str(exc),
        )


async def probe_qdrant_collections() -> ContentProbeResult:
    """List Qdrant collections and compare vector sizes to AI_EMBEDDINGS_DIMENSION."""
    started = time.perf_counter()
    try:
        manager = await get_database_manager()
        client = manager.get_qdrant_client()
        if client is None:
            return ContentProbeResult(
                target="qdrant",
                ok=False,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error_code="qdrant_unavailable",
                message="Qdrant client is not configured",
            )
        collections_resp = await client.get_collections()
        collections = getattr(collections_resp, "collections", []) or []
        names = [str(getattr(c, "name", "")) for c in collections]
        details: dict[str, Any] = {"collections": names, "expected_dim": EMBEDDING_DIMENSION}
        dim_mismatch: list[str] = []
        for name in names:
            if not name:
                continue
            info = await client.get_collection(name)
            cfg = getattr(info, "config", None)
            params = getattr(cfg, "params", None) if cfg else None
            vectors = getattr(params, "vectors", None) if params else None
            size = getattr(vectors, "size", None)
            if size is not None and int(size) != int(EMBEDDING_DIMENSION):
                dim_mismatch.append(name)
            details[f"{name}_points"] = getattr(info, "points_count", None)
            details[f"{name}_vector_size"] = size
        ok = not dim_mismatch
        return ContentProbeResult(
            target="qdrant",
            ok=ok,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_code="dim_mismatch" if dim_mismatch else None,
            message="Qdrant reachable" if ok else f"Vector dim mismatch in collections: {', '.join(dim_mismatch)}",
            details=details,
        )
    except Exception as exc:
        logger.debug("[STEP] content_admin_qdrant_probe_skip err=%s", exc, exc_info=True)
        return ContentProbeResult(
            target="qdrant",
            ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_code="qdrant_probe_failed",
            message=str(exc),
        )


async def probe_elasticsearch() -> ContentProbeResult:
    started = time.perf_counter()
    try:
        manager = await get_database_manager()
        es = manager.elasticsearch_client
        if es is None:
            return ContentProbeResult(
                target="elasticsearch",
                ok=False,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error_code="es_unavailable",
                message="Elasticsearch client is not configured",
            )
        ping = getattr(es, "ping", None)
        if callable(ping):
            ok = bool(await ping())
        else:
            info = getattr(es, "info", None)
            ok = bool(await info()) if callable(info) else False
        return ContentProbeResult(
            target="elasticsearch",
            ok=ok,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_code=None if ok else "es_ping_failed",
            message="Elasticsearch ping ok" if ok else "Elasticsearch ping failed",
        )
    except Exception as exc:
        return ContentProbeResult(
            target="elasticsearch",
            ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_code="es_probe_failed",
            message=str(exc),
        )


def _sidecar_url(setting_name: str, fallback: str = "") -> str:
    raw = str(getattr(unified_settings, setting_name, None) or fallback or "").strip().rstrip("/")
    return raw


async def build_content_ops_diagnostics() -> dict[str, Any]:
    """Aggregated diagnostics checks for admin UI (id, ok, latency_ms, message)."""
    probes = await probe_content_dependencies()
    extra = await asyncio_gather_probes()
    checks: list[dict[str, Any]] = []
    for item in probes.get("results", []):
        checks.append(
            {
                "id": str(item.get("target") or "unknown"),
                "ok": bool(item.get("ok")),
                "latency_ms": item.get("latency_ms"),
                "message": str(item.get("message") or ""),
            }
        )
    for probe in extra:
        checks.append(
            {
                "id": probe.target,
                "ok": probe.ok,
                "latency_ms": probe.latency_ms,
                "message": probe.message,
            }
        )
    return {"checks": checks}


async def asyncio_gather_probes() -> list[ContentProbeResult]:
    import asyncio

    embed_url = (
        _sidecar_url("llama_embedding_url")
        or str(getattr(unified_settings, "llama_embeddings_service_base", "") or "").strip()
    )
    rerank_url = str(getattr(unified_settings, "rag_rerank_base_url", "") or "").strip()
    tool_url = shared_tool_router_base_url()
    tasks = [
        probe_qdrant_collections(),
        probe_elasticsearch(),
    ]
    if embed_url:
        tasks.append(_probe_http_health(target="llama_embedding", url=embed_url))
    if rerank_url:
        tasks.append(_probe_http_health(target="rag_rerank", url=rerank_url))
    if tool_url:
        tasks.append(_probe_http_health(target="tool_router", url=tool_url))
    return list(await asyncio.gather(*tasks))


async def build_content_ops_meta(pool: asyncpg.Pool) -> dict[str, Any]:
    """Summary meta for Content Admin overview tab."""
    overview = await build_content_ops_overview(pool)
    async with pool.acquire() as conn:
        pending = int(
            await conn.fetchval(
                """
                SELECT COUNT(*)::bigint FROM unified_content
                WHERE processing_status IN ('pending', 'processing') AND deleted_at IS NULL
                """
            )
            or 0
        )
        storage = int(
            await conn.fetchval(
                """
                SELECT COALESCE(SUM(file_size), 0)::bigint
                FROM unified_content WHERE deleted_at IS NULL
                """
            )
            or 0
        )
    return {
        "total_content_rows": overview["active_rows"],
        "total_storage_bytes": storage,
        "processing_pending": pending,
        "processing_failed": overview["failed_processing"],
        "workers_healthy": True,
        "updated_at": datetime.now(UTC).isoformat(),
    }


async def list_user_quota_page(
    pool: asyncpg.Pool,
    *,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Paginated user storage usage via get_user_storage_used()."""
    safe_limit = max(1, min(int(limit), 200))
    safe_offset = max(0, int(offset))
    async with pool.acquire() as conn:
        total = int(await conn.fetchval("SELECT COUNT(*)::bigint FROM users") or 0)
        rows = await conn.fetch(
            """
            SELECT
                u.id AS user_id,
                u.email,
                get_user_storage_used(u.id) AS storage_used_bytes
            FROM users u
            ORDER BY storage_used_bytes DESC, u.email NULLS LAST, u.id
            LIMIT $1 OFFSET $2
            """,
            safe_limit,
            safe_offset,
        )
    quota_bytes = ContentStorageService.USER_QUOTA_BYTES
    items = [
        {
            "user_id": str(row["user_id"]),
            "email": row["email"],
            "storage_used_bytes": int(row["storage_used_bytes"] or 0),
            "storage_quota_bytes": quota_bytes,
            "storage_remaining_bytes": max(
                0,
                quota_bytes - int(row["storage_used_bytes"] or 0),
            ),
        }
        for row in rows
    ]
    return {
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
        "items": items,
    }


async def get_user_quota(pool: asyncpg.Pool, user_id: UUID) -> dict[str, Any] | None:
    """Single-user storage usage via get_user_storage_used()."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                u.id AS user_id,
                u.email,
                get_user_storage_used(u.id) AS storage_used_bytes
            FROM users u
            WHERE u.id = $1::uuid
            """,
            user_id,
        )
    if row is None:
        return None
    used = int(row["storage_used_bytes"] or 0)
    quota_bytes = ContentStorageService.USER_QUOTA_BYTES
    return {
        "user_id": str(row["user_id"]),
        "email": row["email"],
        "storage_used_bytes": used,
        "storage_quota_bytes": quota_bytes,
        "storage_remaining_bytes": max(0, quota_bytes - used),
    }


async def get_current_user_quota(pool: asyncpg.Pool, user_id: str) -> dict[str, Any]:
    """Resolved DB user storage usage for /content/quota/me."""
    async with pool.acquire() as conn:
        used = int(
            await conn.fetchval(
                "SELECT get_user_storage_used($1::uuid)",
                UUID(str(user_id)),
            )
            or 0
        )
    quota_bytes = ContentStorageService.USER_QUOTA_BYTES
    return {
        "user_id": str(user_id),
        "storage_used_bytes": used,
        "storage_quota_bytes": quota_bytes,
        "storage_remaining_bytes": max(0, quota_bytes - used),
        "storage_used_mb": round(used / (1024 * 1024), 2),
        "storage_quota_mb": round(quota_bytes / (1024 * 1024), 2),
    }


async def list_processing_failures(
    pool: asyncpg.Pool,
    *,
    limit: int = 50,
) -> dict[str, Any]:
    """Recent unified_content rows with processing_status failed."""
    safe_limit = max(1, min(int(limit), 200))
    async with pool.acquire() as conn:
        total = int(
            await conn.fetchval(
                """
                SELECT COUNT(*)::bigint
                FROM unified_content
                WHERE processing_status = 'failed' AND deleted_at IS NULL
                """
            )
            or 0
        )
        rows = await conn.fetch(
            """
            SELECT
                id,
                user_id,
                name,
                title,
                content_type,
                processing_status,
                processing_error,
                updated_at
            FROM unified_content
            WHERE processing_status = 'failed' AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $1
            """,
            safe_limit,
        )
    items = [
        {
            "id": str(row["id"]),
            "user_id": str(row["user_id"]) if row["user_id"] else None,
            "name": row["name"],
            "title": row["title"],
            "content_type": row["content_type"],
            "processing_status": row["processing_status"],
            "processing_error": row["processing_error"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
        for row in rows
    ]
    return {"total": total, "limit": safe_limit, "items": items}


def export_performance_metrics() -> dict[str, Any]:
    """Export in-process unified content performance metrics snapshot."""
    return get_metrics().get_summary()


def _content_storage_service(pool: asyncpg.Pool) -> ContentStorageService:
    from api.services.unified_content.audit_logger import AuditLogger
    from api.services.unified_content.storage_backends.factory import get_storage_factory

    storage_factory = get_storage_factory(pool)
    return ContentStorageService(pool, storage_factory, AuditLogger(pool))


async def run_scan_missing_storage_blobs(
    pool: asyncpg.Pool,
    operator_user_id: str,
    *,
    dry_run: bool,
    limit: int,
    only_content_id: UUID | None = None,
) -> dict[str, Any]:
    """Forward orphan blob scan/quarantine to ContentStorageService (admin-only)."""
    service = _content_storage_service(pool)
    return await service.admin_scan_missing_storage_blobs(
        operator_user_id,
        dry_run=dry_run,
        limit=limit,
        only_content_id=only_content_id,
    )


async def run_migrate_pg_blobs_to_seaweed(
    pool: asyncpg.Pool,
    *,
    dry_run: bool,
    limit: int,
    only_content_id: UUID | None = None,
) -> dict[str, Any]:
    """Forward BYTEA→SeaweedFS batch migrate to StorageMigrateService."""
    from api.services.unified_content.storage_backends.factory import get_storage_factory
    from api.services.unified_content.storage_migrate_service import StorageMigrateService

    migrate = StorageMigrateService(pool, storage_factory=get_storage_factory(pool))
    return await migrate.migrate_pg_blobs_to_seaweed(
        dry_run=dry_run,
        limit=limit,
        only_content_id=only_content_id,
    )


async def run_hard_purge_soft_deleted(
    pool: asyncpg.Pool,
    *,
    dry_run: bool,
    limit: int,
    older_than_days: int | None = None,
    only_content_id: UUID | None = None,
) -> dict[str, Any]:
    """Forward soft-delete hard purge to StorageMigrateService."""
    from api.services.unified_content.storage_backends.factory import get_storage_factory
    from api.services.unified_content.storage_migrate_service import StorageMigrateService

    migrate = StorageMigrateService(pool, storage_factory=get_storage_factory(pool))
    return await migrate.hard_purge_soft_deleted(
        dry_run=dry_run,
        limit=limit,
        older_than_days=older_than_days,
        only_content_id=only_content_id,
    )
