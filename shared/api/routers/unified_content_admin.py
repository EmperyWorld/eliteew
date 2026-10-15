# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator/admin unified content maintenance routes (reindex, blob scan, hard purge).
# Invariants:
# - Mounted without extra prefix under unified_content parent.
# Related:
# - api/routers/unified_content_deps.py
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]  # type: ignore[import-untyped]
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query  # type: ignore[import-untyped]

from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.models import User
from api.routers.unified_content_deps import (
    _raise_internal_server_error,
    _raise_reindex_rate_limit_exceeded,
    get_content_service,
    get_db_pool,
    get_es_client,
    get_reindex_rate_limiter,
    require_content_admin,
)
from api.services.rate_limiter import RateLimiter
from api.services.unified_content.content_storage_service import ContentStorageService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content"])


@router.get("/content/duplicates")
async def find_duplicates(
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """
    Find duplicate files by hash and size

    Returns:
    - Groups of duplicate files
    - Files grouped by hash (exact duplicates)
    - Files grouped by size (potential duplicates)
    """
    try:
        db_pool = await get_db_pool()

        async with db_pool.acquire() as conn:
            # Find duplicates by hash (exact duplicates)
            hash_duplicates = await conn.fetch(
                """
                SELECT
                    file_hash,
                    COUNT(*) as count,
                    array_agg(id ORDER BY created_at) as content_ids,
                    array_agg(name ORDER BY created_at) as names,
                    array_agg(file_size ORDER BY created_at) as sizes,
                    array_agg(created_at ORDER BY created_at) as created_dates
                FROM unified_content
                WHERE (user_id)::text = $1
                    AND deleted_at IS NULL
                    AND coalesce(storage_integrity_status, '') <> 'broken_quarantined'
                    AND file_hash IS NOT NULL
                GROUP BY file_hash
                HAVING COUNT(*) > 1
                ORDER BY count DESC
            """,
                content_user_id,
            )

            # Find potential duplicates by size (same size, different hash or no hash)
            size_duplicates = await conn.fetch(
                """
                SELECT
                    file_size,
                    COUNT(*) as count,
                    array_agg(id ORDER BY created_at) as content_ids,
                    array_agg(name ORDER BY created_at) as names,
                    array_agg(COALESCE(file_hash, '') ORDER BY created_at) as hashes,
                    array_agg(created_at ORDER BY created_at) as created_dates
                FROM unified_content
                WHERE (user_id)::text = $1
                    AND deleted_at IS NULL
                    AND coalesce(storage_integrity_status, '') <> 'broken_quarantined'
                    AND file_size > 0
                GROUP BY file_size
                HAVING COUNT(*) > 1
                ORDER BY count DESC, file_size DESC
                LIMIT 50
            """,
                content_user_id,
            )

        # Format results
        exact_duplicates = []
        for row in hash_duplicates:
            exact_duplicates.append(
                {
                    "hash": row["file_hash"],
                    "count": row["count"],
                    "files": [
                        {
                            "id": str(content_id),
                            "name": name,
                            "size": size,
                            "created_at": created_at.isoformat() if created_at else None,
                        }
                        for content_id, name, size, created_at in zip(
                            row["content_ids"],
                            row["names"],
                            row["sizes"],
                            row["created_dates"],
                            strict=False,
                        )
                    ],
                    "total_size": sum(row["sizes"]),
                    "wasted_space": row["sizes"][0] * (row["count"] - 1),  # Space wasted by duplicates
                }
            )

        potential_duplicates = []
        for row in size_duplicates:
            # Only include if not already in exact duplicates
            hashes = [h for h in row["hashes"] if h]
            if len(set(hashes)) > 1 or len(hashes) < row["count"]:  # Different hashes or missing hashes
                potential_duplicates.append(
                    {
                        "size": row["file_size"],
                        "count": row["count"],
                        "files": [
                            {
                                "id": str(content_id),
                                "name": name,
                                "hash": hash_val if hash_val else None,
                                "size": row["file_size"],
                                "created_at": created_at.isoformat() if created_at else None,
                            }
                            for content_id, name, hash_val, created_at in zip(
                                row["content_ids"],
                                row["names"],
                                row["hashes"],
                                row["created_dates"],
                                strict=False,
                            )
                        ],
                    }
                )

        total_wasted_space = sum(d["wasted_space"] for d in exact_duplicates)

        return {
            "exact_duplicates": exact_duplicates,
            "potential_duplicates": potential_duplicates,
            "summary": {
                "exact_duplicate_groups": len(exact_duplicates),
                "potential_duplicate_groups": len(potential_duplicates),
                "total_wasted_space": total_wasted_space,
                "total_wasted_space_formatted": f"{total_wasted_space / (1024 * 1024):.2f} MB",
            },
        }

    except Exception as e:
        logger.exception("Find duplicates failed")
        _raise_internal_server_error("find_duplicates", e)


@router.post("/content/reindex-all")
async def reindex_all_content(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_content_admin),
    rate_limiter: RateLimiter = Depends(get_reindex_rate_limiter),
) -> dict:
    """
    Reindex all content from PostgreSQL to Elasticsearch.

    This is an admin operation to sync ES with PostgreSQL.
    Runs in background to avoid timeout.
    """
    is_allowed, retry_after = rate_limiter.check_rate_limit(str(current_user.id))
    if not is_allowed:
        _raise_reindex_rate_limit_exceeded(retry_after)

    logger.warning(
        "Reindex requested by privileged user id=%s role=%s",
        current_user.id,
        current_user.role,
    )

    async def do_reindex():
        db_pool = await get_db_pool()
        es_client = get_es_client()

        try:
            # Get all content IDs from PostgreSQL
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("SELECT id, user_id FROM unified_content WHERE deleted_at IS NULL")

            total = len(rows)
            indexed = 0
            failed = 0

            logger.info("Starting reindex of %s content items to Elasticsearch", total)

            for row in rows:
                try:
                    content_id = row["id"]
                    row["user_id"]

                    # Fetch full content
                    async with db_pool.acquire() as conn:
                        content_row = await conn.fetchrow(
                            """
                            SELECT id, user_id, content_type, name, description,
                                   tags, extracted_text, metadata, created_at,
                                   visibility, file_size, mime_type, updated_at
                            FROM unified_content
                            WHERE id = $1 AND deleted_at IS NULL
                            """,
                            content_id,
                        )

                        if not content_row:
                            continue

                        # Fetch shared users
                        shared_rows = await conn.fetch(
                            """
                            SELECT shared_with_user_id FROM content_shares
                            WHERE content_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
                            """,
                            content_id,
                        )

                    # Parse metadata
                    metadata = {}
                    if content_row["metadata"]:
                        import json

                        try:
                            if isinstance(content_row["metadata"], str):
                                metadata = json.loads(content_row["metadata"])
                            else:
                                metadata = dict(content_row["metadata"])
                        except Exception:
                            metadata = {}

                    # Build ES document
                    doc = {
                        "id": str(content_row["id"]),
                        "user_id": str(content_row["user_id"]),
                        "content_type": content_row["content_type"],
                        "name": content_row["name"],
                        "description": content_row["description"] or "",
                        "tags": content_row["tags"] or [],
                        "extracted_text": content_row["extracted_text"] or "",
                        "metadata": metadata,
                        "created_at": content_row["created_at"].isoformat() if content_row["created_at"] else None,
                        "updated_at": content_row["updated_at"].isoformat() if content_row["updated_at"] else None,
                        "visibility": content_row["visibility"],
                        "file_size": content_row["file_size"],
                        "mime_type": content_row["mime_type"] or "",
                        "shared_with_user_ids": [str(s["shared_with_user_id"]) for s in shared_rows],
                    }

                    # Index to Elasticsearch
                    await es_client.index(
                        index="unified_content",
                        id=str(content_id),
                        document=doc,
                        refresh=False,
                    )
                    indexed += 1

                    if indexed % 50 == 0:
                        logger.info(f"🔄 Reindex progress: {indexed}/{total}")

                except Exception as e:
                    failed += 1
                    logger.warning(f"Failed to reindex {content_id}: {e}")

            # Force refresh
            await es_client.indices.refresh(index="unified_content")

            logger.info("Reindex completed: %s indexed, %s failed, %s total", indexed, failed, total)

        except Exception as e:
            logger.exception(f"Reindex failed: {e}")

    background_tasks.add_task(do_reindex)

    return {
        "status": "started",
        "message": "Reindex started in background. Check logs for progress.",
        "requested_by": str(current_user.id),
    }


@router.post("/content/admin/scan-missing-blobs")
async def admin_scan_missing_blobs(
    dry_run: bool = Query(
        True,
        description="If true, report missing ids only; if false, soft-delete rows (quarantine)",
    ),
    limit: int = Query(500, ge=1, le=10_000),
    only_content_id: UUID | None = Query(
        None,
        description="Check a single content UUID (SeaweedFS/minio backend only)",
    ),
    current_user: User = Depends(require_content_admin),
    operator_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """
    Detect unified_content rows whose S3 stat_object fails (orphan filer / lost volume chunk).
    Quarantine = soft-delete + ES drop + storage_integrity_status=blob_missing (needs migration).
    """
    logger.warning(
        "scan-missing-blobs: dry_run=%s limit=%s only=%s by user=%s",
        dry_run,
        limit,
        only_content_id,
        current_user.id,
    )
    try:
        return await service.admin_scan_missing_storage_blobs(
            operator_id,
            dry_run=dry_run,
            limit=limit,
            only_content_id=only_content_id,
        )
    except asyncpg.UndefinedColumnError as exc:
        logger.error("scan-missing-blobs: DB schema missing storage_integrity_status: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Apply migration pending/20260325_unified_content_storage_integrity.sql first",
        ) from exc


@router.post("/content/admin/migrate-pg-blobs")
async def admin_migrate_pg_blobs(
    dry_run: bool = Query(
        True,
        description="If true, count candidates only; if false, migrate BYTEA to SeaweedFS",
    ),
    limit: int = Query(500, ge=1, le=10_000),
    only_content_id: UUID | None = Query(None, description="Migrate a single content UUID"),
    current_user: User = Depends(require_content_admin),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """
    Migrate live PostgreSQL BYTEA rows that belong on SeaweedFS per factory thresholds
    (non-audio ≥1MB, audio ≥40MB). SeaweedFS offline → row fails closed (BYTEA kept).
    """
    from api.services.unified_content.storage_migrate_service import StorageMigrateService

    logger.warning(
        "migrate-pg-blobs: dry_run=%s limit=%s only=%s by user=%s",
        dry_run,
        limit,
        only_content_id,
        current_user.id,
    )
    migrate = StorageMigrateService(service.db_pool, storage_factory=service.storage_factory)
    return await migrate.migrate_pg_blobs_to_seaweed(
        dry_run=dry_run,
        limit=limit,
        only_content_id=only_content_id,
    )


@router.post("/content/admin/hard-purge-soft-deleted")
async def admin_hard_purge_soft_deleted(
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
    current_user: User = Depends(require_content_admin),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """Hard-purge soft-deleted unified_content older than retention (BYTEA + S3 + row)."""
    from api.services.unified_content.storage_migrate_service import StorageMigrateService

    logger.warning(
        "hard-purge-soft-deleted: dry_run=%s limit=%s days=%s only=%s by user=%s",
        dry_run,
        limit,
        older_than_days,
        only_content_id,
        current_user.id,
    )
    migrate = StorageMigrateService(service.db_pool, storage_factory=service.storage_factory)
    return await migrate.hard_purge_soft_deleted(
        dry_run=dry_run,
        limit=limit,
        older_than_days=older_than_days,
        only_content_id=only_content_id,
    )


#
# Unified Content relies on global application startup/shutdown for infrastructure.
