# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# List, folder-view, tags, quota, and view-history query routes.
# Invariants:
# - Mounted without extra prefix under unified_content parent.
# Related:
# - api/routers/unified_content_deps.py
# ---

from __future__ import annotations

import logging
from datetime import UTC
from typing import Any, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request  # type: ignore[import-untyped]
from starlette import status

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user
from api.core.project_scope_access import (
    assert_company_accessible,
    assert_project_accessible,
    fetch_project_company_id,
)
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.models import User
from api.routers.unified_content_deps import (
    _raise_internal_server_error,
    _raise_max_batch_size_exceeded,
    _raise_max_tags_exceeded,
    get_content_query_service,
    get_content_service,
    get_db_pool,
    get_folder_view_service,
)
from api.schemas.unified_content import (
    Content,
    ContentListCompactResponse,
    ContentListItemCompact,
    ContentListResponse,
    FolderViewResponse,
    Visibility,
)
from api.services.unified_content.content_list_filters import (
    normalize_content_list_min_file_size,
    normalize_content_list_processing_status,
)
from api.services.unified_content.content_query_service import ContentQueryService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.content_storage_shared import SQL_LIST_EXCLUDE_GAF_CHAT_VOICE
from api.services.unified_content.content_type_filters import resolve_content_type_query_filters
from api.services.unified_content.folder_view_service import FolderViewService
from api.services.unified_content.unified_content_list import (
    build_next_content_list_cursor,
    content_list_supports_keyset,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content"])


@router.get("/content/debug")
async def get_content_list(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    query: str = "",
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
) -> tuple[list[Content], int]:
    """Debug with timing"""
    import datetime

    datetime.datetime.now(UTC).strftime("%H:%M:%S.%f")[:-3]

    # Note: request is not available in list endpoint, using optional_request would require refactoring

    # Add a small delay to see the sequence
    import asyncio

    await asyncio.sleep(0.1)

    content_service = await get_content_service()
    return await content_service.list_content(
        user_id=content_user_id,
        search_query=query if query else None,
        limit=limit,
        offset=offset,
    )


@router.get("/content/folder-view", response_model=FolderViewResponse)
async def get_content_folder_view(
    folder_item_id: str | None = Query(None),
    folder_unassigned: bool = Query(False),
    search: str | None = Query(None, description="Search file and direct child names"),
    sort_field: str | None = Query(None, description="File sort field: name, date, modified, size, type"),
    sort_order: str | None = Query(None, description="File sort order: asc, desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    content_type: str | None = Query(None),
    mime_type: str | None = Query(None, description="Filter by MIME type (exact or prefix ending with /)"),
    min_file_size: int | None = Query(
        None,
        ge=0,
        description="Minimum file_size in bytes (inclusive)",
    ),
    processing_status: str | None = Query(
        None,
        description="Filter by processing_status: pending, processing, completed, failed",
    ),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: FolderViewService = Depends(get_folder_view_service),
) -> FolderViewResponse:
    """Return direct desktop children and compact files for one folder context."""
    if folder_item_id is not None and folder_unassigned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="folder_item_id and folder_unassigned cannot be used together",
        )
    try:
        normalized_min_file_size = normalize_content_list_min_file_size(min_file_size)
        normalized_processing_status = normalize_content_list_processing_status(processing_status)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    resolved_content_type, resolved_mime_type = resolve_content_type_query_filters(
        content_type=content_type,
        mime_type=mime_type,
    )
    return await service.get_folder_view(
        current_user=cast(AuthUser, current_user),
        content_user_id=content_user_id,
        folder_item_id=folder_item_id,
        folder_unassigned=folder_unassigned,
        search=search,
        sort_field=sort_field,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
        content_type=resolved_content_type,
        mime_type=resolved_mime_type,
        min_file_size=normalized_min_file_size,
        processing_status=normalized_processing_status,
    )


@router.get("/content/folder-totals")
async def get_content_folder_totals(
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
) -> dict[str, Any]:
    """
    One-shot counts of non-deleted library rows grouped by desktop ``folder_item_id``.

    Used by idle desktop folder badges instead of N× ``GET /content?limit=1`` probes.
    """
    try:
        oauth2_sub = str(getattr(current_user, "id", None) or "")
        alternate = oauth2_sub if (oauth2_sub and oauth2_sub != content_user_id) else None
        user_id_condition = "((user_id)::text = $1 OR (user_id)::text = $2)" if alternate else "(user_id)::text = $1"
        params: list[str] = [content_user_id]
        if alternate:
            params.append(alternate)

        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT folder_item_id, COUNT(*)::bigint AS cnt
                FROM unified_content
                WHERE {user_id_condition}
                  AND deleted_at IS NULL
                  AND {SQL_LIST_EXCLUDE_GAF_CHAT_VOICE}
                GROUP BY folder_item_id
                """,
                *params,
            )

        by_folder: dict[str, int] = {}
        unfiled = 0
        total = 0
        for row in rows:
            count = int(row["cnt"] or 0)
            total += count
            folder_id = row["folder_item_id"]
            if folder_id is None or str(folder_id).strip() == "":
                unfiled += count
            else:
                by_folder[str(folder_id)] = count

        return {
            "by_folder_item_id": by_folder,
            "unfiled": unfiled,
            "total": total,
        }
    except Exception as e:
        logger.exception("Folder totals failed")
        _raise_internal_server_error("get_content_folder_totals", e)


_FOLDER_PREVIEW_MAX_IDS = 64
_FOLDER_PREVIEW_PER_FOLDER = 4


@router.get("/content/folder-previews")
async def get_content_folder_previews(
    folder_item_ids: str = Query(
        ...,
        description="Comma-separated desktop folder item ids (max 64)",
        min_length=1,
        max_length=8_192,
    ),
    per_folder_limit: int = Query(
        _FOLDER_PREVIEW_PER_FOLDER,
        ge=1,
        le=8,
        description="Max compact rows per folder (desktop mosaic)",
    ),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
) -> dict[str, Any]:
    """
    One-shot top-N compact library rows per folder for desktop icon mosaics.

    Replaces N× ``GET /content?limit=4&list_profile=compact&folder_item_id=…``.
    """
    raw_ids = [part.strip() for part in folder_item_ids.split(",") if part.strip()]
    # Preserve caller order for debugging; dedupe for SQL ANY().
    folder_ids: list[str] = list(dict.fromkeys(raw_ids))
    if not folder_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="folder_item_ids must contain at least one id",
        )
    if len(folder_ids) > _FOLDER_PREVIEW_MAX_IDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"folder_item_ids exceeds max {_FOLDER_PREVIEW_MAX_IDS}",
        )

    try:
        oauth2_sub = str(getattr(current_user, "id", None) or "")
        alternate = oauth2_sub if (oauth2_sub and oauth2_sub != content_user_id) else None
        user_id_condition = "((user_id)::text = $1 OR (user_id)::text = $2)" if alternate else "(user_id)::text = $1"
        params: list[Any] = [content_user_id]
        if alternate:
            params.append(alternate)
        folder_param_idx = len(params) + 1
        limit_param_idx = folder_param_idx + 1
        params.append(folder_ids)
        params.append(per_folder_limit)

        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                WITH ranked AS (
                    SELECT
                        id,
                        folder_item_id,
                        content_type,
                        mime_type,
                        ROW_NUMBER() OVER (
                            PARTITION BY folder_item_id
                            ORDER BY LOWER(COALESCE(name, '')) ASC, created_at ASC NULLS LAST
                        ) AS rn
                    FROM unified_content
                    WHERE {user_id_condition}
                      AND deleted_at IS NULL
                      AND coalesce(storage_integrity_status, '') <> 'broken_quarantined'
                      AND {SQL_LIST_EXCLUDE_GAF_CHAT_VOICE}
                      AND folder_item_id IS NOT NULL
                      AND (folder_item_id)::text = ANY(${folder_param_idx}::text[])
                )
                SELECT id, folder_item_id, content_type, mime_type
                FROM ranked
                WHERE rn <= ${limit_param_idx}
                ORDER BY folder_item_id ASC, rn ASC
                """,
                *params,
            )

        by_folder: dict[str, list[dict[str, Any]]] = {fid: [] for fid in folder_ids}
        for row in rows:
            folder_id = str(row["folder_item_id"] or "").strip()
            if not folder_id:
                continue
            bucket = by_folder.setdefault(folder_id, [])
            bucket.append(
                {
                    "id": str(row["id"]),
                    "content_type": str(row["content_type"] or ""),
                    "mime_type": row["mime_type"],
                }
            )

        return {
            "by_folder_item_id": by_folder,
            "per_folder_limit": per_folder_limit,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Folder previews failed")
        _raise_internal_server_error("get_content_folder_previews", e)


@router.get("/content", response_model=ContentListResponse | ContentListCompactResponse)
async def list_content(
    content_type: str | None = Query(None),
    mime_type: str | None = Query(None, description="Filter by MIME type (exact or prefix ending with /)"),
    tags: str | None = Query(None, description="Comma-separated tags"),
    search: str | None = Query(None, description="Search in name/description"),
    visibility: Visibility | None = Query(None),
    company_id: UUID | None = Query(None, description="Filter by company (Plan 3)"),
    project_id: UUID | None = Query(None, description="Filter by project (Plan 3)"),
    folder_item_id: str | None = Query(None, description="Filter by desktop folder (content group)"),
    folder_unassigned: bool = Query(
        False, description="Only content not assigned to a desktop folder (folder_item_id IS NULL)"
    ),
    exclude_folder_item_id: str | None = Query(
        None,
        description="Exclude rows whose folder_item_id equals this desktop folder item_id (e.g. batch demos in «projects»).",
    ),
    source_service: str | None = Query(None, description="Filter by source service"),
    sort_field: str | None = Query(None, description="Sort field: name, date, modified, size, type"),
    sort_order: str | None = Query(None, description="Sort order: asc, desc"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(
        None,
        description="Keyset cursor for stable pagination without search ranking (mutually exclusive with offset>0)",
    ),
    group_by_type: bool = Query(False, description="Group results by content type"),
    owner_only: bool = Query(False, description="Return only content owned by the current user"),
    list_profile: Literal["full", "compact"] = Query(
        "full",
        description="compact: list rows without heavy fields (metadata, extracted_text, paths)",
    ),
    min_file_size: int | None = Query(
        None,
        ge=0,
        description="Minimum file_size in bytes (inclusive)",
    ),
    processing_status: str | None = Query(
        None,
        description="Filter by processing_status: pending, processing, completed, failed",
    ),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    query_service: ContentQueryService = Depends(get_content_query_service),
) -> ContentListResponse | ContentListCompactResponse:
    """
    List user's content with filters and pagination

    - Supports filtering by type, tags, visibility
    - Full-text search in name/description
    - Pagination (max 200 per page)
    - Optional grouping by content type (group_by_type=true)
    """
    try:
        tag_list = [t.strip() for t in tags.split(",")] if tags else None
        user_id = content_user_id
        oauth2_sub = str(current_user.id) if getattr(current_user, "id", None) else None
        alternate_user_id = oauth2_sub if (oauth2_sub and oauth2_sub != content_user_id) else None
        # Normalize empty folder_item_id so we don't filter by '' (DB has NULL for "no folder")
        folder_item_id = (
            (folder_item_id.strip() or None) if (folder_item_id and isinstance(folder_item_id, str)) else folder_item_id
        )
        if folder_unassigned:
            folder_item_id = None

        exclude_folder_item_id_norm = (
            (exclude_folder_item_id.strip() or None)
            if (exclude_folder_item_id and isinstance(exclude_folder_item_id, str))
            else exclude_folder_item_id
        )

        # Маркетинговый кабинет и др.: нельзя фильтровать чужой project_id / company_id без членства.
        db_pool = await get_db_pool()
        if project_id is not None:
            db_user_uuid = await resolve_db_user_uuid_with_pool(
                cast(AuthUser, current_user),
                db_pool,
            )
            await assert_project_accessible(db_pool, project_id, db_user_uuid)
            if company_id is not None:
                p_company = await fetch_project_company_id(db_pool, project_id)
                if p_company is None or p_company != company_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="project_id does not match company_id",
                    )
        elif company_id is not None:
            db_user_uuid = await resolve_db_user_uuid_with_pool(
                cast(AuthUser, current_user),
                db_pool,
            )
            await assert_company_accessible(db_pool, company_id, db_user_uuid)

        logger.debug("CONTENT LIST user_id=%s alternate=%s", content_user_id, bool(alternate_user_id))

        resolved_content_type, resolved_mime_type = resolve_content_type_query_filters(
            content_type=content_type,
            mime_type=mime_type,
        )

        use_keyset = bool(cursor) and content_list_supports_keyset(
            search_query=search,
            group_by_type=group_by_type,
        )
        if use_keyset and offset > 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="cursor and offset are mutually exclusive",
            )

        try:
            normalized_min_file_size = normalize_content_list_min_file_size(min_file_size)
            normalized_processing_status = normalize_content_list_processing_status(processing_status)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

        try:
            content_list, total = await query_service.list_content(
                user_id=user_id,
                content_type=resolved_content_type,
                mime_type=resolved_mime_type,
                tags=tag_list,
                search_query=search,
                visibility=visibility,
                company_id=company_id,
                project_id=project_id,
                folder_item_id=folder_item_id,
                folder_unassigned=folder_unassigned,
                exclude_folder_item_id=exclude_folder_item_id_norm,
                source_service=source_service,
                sort_field=sort_field,
                sort_order=sort_order,
                offset=offset,
                limit=limit,
                cursor=cursor,
                group_by_type=group_by_type,
                alternate_user_id=alternate_user_id,
                owner_only=owner_only,
                list_profile=list_profile,
                min_file_size=normalized_min_file_size,
                processing_status=normalized_processing_status,
            )
        except ValueError as exc:
            if str(exc) in {"invalid cursor", "cursor sort mismatch", "cursor too long"}:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(exc),
                ) from exc
            raise

        logger.debug("CONTENT LIST returned=%s alternate=%s", len(content_list), bool(alternate_user_id))

        next_cursor = build_next_content_list_cursor(
            items=content_list,
            sort_field=sort_field,
            sort_order=sort_order,
            limit=limit,
            search_query=search,
            group_by_type=group_by_type,
        )
        page_num = 1 if use_keyset else offset // limit + 1
        page_has_more = next_cursor is not None if use_keyset else (offset + limit) < total
        if list_profile == "compact":
            return ContentListCompactResponse(
                items=[ContentListItemCompact.from_content(c) for c in content_list],
                total=total,
                page=page_num,
                page_size=limit,
                has_more=page_has_more,
                next_cursor=next_cursor,
            )
        return ContentListResponse(
            items=content_list,
            total=total,
            page=page_num,
            page_size=limit,
            has_more=page_has_more,
            next_cursor=next_cursor,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("List failed")
        _raise_internal_server_error("list_content", e)


@router.get("/content/statistics")
async def get_statistics(
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
) -> dict[str, Any]:
    """
    Get content statistics for current user (same user_id as profile stats: DB users.id)
    """
    try:
        oauth2_sub = str(getattr(current_user, "id", None) or "")
        alternate = oauth2_sub if (oauth2_sub and oauth2_sub != content_user_id) else None
        user_id_condition = "((user_id)::text = $1 OR (user_id)::text = $2)" if alternate else "(user_id)::text = $1"
        params = [content_user_id]
        if alternate:
            params.append(alternate)

        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            stats_hide_voice = f" AND {SQL_LIST_EXCLUDE_GAF_CHAT_VOICE}"
            total_files = await conn.fetchval(
                f"SELECT COUNT(*) FROM unified_content WHERE {user_id_condition} AND deleted_at IS NULL{stats_hide_voice}",
                *params,
            )
            total_size = await conn.fetchval(
                f"SELECT COALESCE(SUM(file_size), 0) FROM unified_content WHERE {user_id_condition} AND deleted_at IS NULL{stats_hide_voice}",
                *params,
            )
            type_rows = await conn.fetch(
                f"SELECT content_type, COUNT(*) as count FROM unified_content WHERE {user_id_condition} AND deleted_at IS NULL{stats_hide_voice} GROUP BY content_type",
                *params,
            )
            type_distribution = {row["content_type"]: row["count"] for row in type_rows}

            tag_params = [content_user_id]
            if alternate:
                tag_params.append(alternate)
            tag_condition = "((user_id)::text = $1 OR (user_id)::text = $2)" if alternate else "(user_id)::text = $1"
            tag_rows = await conn.fetch(
                f"""
                SELECT tag, usage_count
                FROM content_tags
                WHERE {tag_condition}
                ORDER BY usage_count DESC
                LIMIT 10
                """,
                *tag_params,
            )
            top_tags = [{"tag": row["tag"], "count": row["usage_count"]} for row in tag_rows]

            recent_activity = await conn.fetchval(
                f"SELECT COUNT(*) FROM unified_content WHERE {user_id_condition} AND deleted_at IS NULL{stats_hide_voice} AND created_at > NOW() - INTERVAL '7 days'",
                *params,
            )

            stats = {
                "totalFiles": total_files or 0,
                "totalSize": total_size or 0,
                "typeDistribution": type_distribution,
                "topTags": top_tags,
                "recentActivity": recent_activity or 0,
            }

            return stats

    except Exception as e:
        logger.exception("Statistics failed")
        _raise_internal_server_error("get_statistics", e)


@router.get("/content/tags/popular")
async def get_popular_tags(
    limit: int = Query(20, ge=1, le=100, description="Number of tags to return"),
    search: str | None = Query(None, description="Filter tags by search term"),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
) -> dict[str, Any]:
    """
    Get popular tags for autocomplete and tag cloud

    Query Parameters:
    - limit: Maximum number of tags (1-100, default 20)
    - search: Optional search term for filtering tags

    Returns:
    - List of tags with usage counts
    - Sorted by usage count (descending)
    - Filtered by search term if provided
    """
    try:
        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            if search:
                # Filter tags by search term (case-insensitive)
                tag_rows = await conn.fetch(
                    """
                    SELECT tag, usage_count
                    FROM content_tags
                    WHERE (user_id)::text = $1 AND LOWER(tag) LIKE LOWER($2)
                    ORDER BY usage_count DESC
                    LIMIT $3
                    """,
                    content_user_id,
                    f"%{search}%",
                    limit,
                )
            else:
                # Get all popular tags
                tag_rows = await conn.fetch(
                    """
                    SELECT tag, usage_count
                    FROM content_tags
                    WHERE (user_id)::text = $1
                    ORDER BY usage_count DESC
                    LIMIT $2
                    """,
                    content_user_id,
                    limit,
                )

            tags = [{"tag": row["tag"], "count": row["usage_count"]} for row in tag_rows]

            return {"tags": tags, "total": len(tags), "limit": limit, "search": search}

    except Exception as e:
        logger.exception("Get popular tags failed")
        _raise_internal_server_error("get_popular_tags", e)


@router.post("/content/tags/reconcile")
async def reconcile_tag_counters(
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """
    Rebuild tag counters for current user from actual content rows.
    """
    try:
        total_tags = await service.reconcile_tag_usage_counts(content_user_id)
        return {"ok": True, "tags_reconciled": total_tags}
    except Exception as e:
        _raise_internal_server_error("reconcile_tag_counters", e)


@router.get("/content/tags/recent")
async def get_recent_tags(
    limit: int = Query(10, ge=1, le=50, description="Number of recent tags"),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
) -> dict[str, Any]:
    """
    Get recently used tags for quick access

    Query Parameters:
    - limit: Maximum number of tags (1-50, default 10)

    Returns:
    - List of recently used tags
    - Sorted by last used (most recent first)
    """
    try:
        db_pool = await get_db_pool()
        async with db_pool.acquire() as conn:
            # Get tags from recent content (last 30 days)
            tag_rows = await conn.fetch(
                """
                SELECT DISTINCT unnest(tags) as tag
                FROM unified_content
                WHERE (user_id)::text = $1
                  AND deleted_at IS NULL
                  AND created_at > NOW() - INTERVAL '30 days'
                ORDER BY tag
                LIMIT $2
                """,
                content_user_id,
                limit,
            )

            tags = [row["tag"] for row in tag_rows]

            return {"tags": tags, "total": len(tags)}

    except Exception as e:
        _raise_internal_server_error("get_recent_tags", e)


@router.post("/content/tags/batch-update")
async def batch_update_tags(
    content_ids: list[UUID],
    tags_to_add: list[str] | None = None,
    tags_to_remove: list[str] | None = None,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """
    Batch update tags for multiple content items

    Body:
    - content_ids: List of content UUIDs
    - tags_to_add: Tags to add to all items
    - tags_to_remove: Tags to remove from all items

    Returns:
    - Updated count
    - Errors (if any)
    """
    if tags_to_remove is None:
        tags_to_remove = []
    if tags_to_add is None:
        tags_to_add = []
    try:
        if len(content_ids) > 100:
            _raise_max_batch_size_exceeded(100)

        if len(tags_to_add) > 20:
            _raise_max_tags_exceeded()

        db_pool = await get_db_pool()
        updated_count = 0
        errors = []

        async with db_pool.acquire() as conn, conn.transaction():
            for content_id in content_ids:
                try:
                    # Check ownership
                    owner = await conn.fetchval(
                        "SELECT user_id FROM unified_content WHERE id = $1 AND deleted_at IS NULL",
                        content_id,
                    )

                    if not owner or str(owner) != str(content_user_id):
                        errors.append({"content_id": str(content_id), "error": "Not found or no access"})
                        continue

                    # Get current tags
                    current_tags = await conn.fetchval("SELECT tags FROM unified_content WHERE id = $1", content_id)
                    current_tags = current_tags or []

                    # Add new tags
                    new_tags = set(current_tags)
                    for tag in tags_to_add:
                        new_tags.add(tag.strip().lower())

                    # Remove tags
                    for tag in tags_to_remove:
                        new_tags.discard(tag.strip().lower())

                    # Update content
                    await conn.execute(
                        "UPDATE unified_content SET tags = $1, updated_at = NOW() WHERE id = $2",
                        list(new_tags),
                        content_id,
                    )

                    # Update tag usage counts
                    for tag in tags_to_add:
                        await conn.execute("SELECT increment_tag_usage($1::uuid, $2)", content_user_id, tag)

                    for tag in tags_to_remove:
                        await conn.execute("SELECT decrement_tag_usage($1::uuid, $2)", content_user_id, tag)

                    updated_count += 1

                except Exception as e:
                    errors.append({"content_id": str(content_id), "error": str(e)})

        return {
            "updated_count": updated_count,
            "total_requested": len(content_ids),
            "errors": errors,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Batch tag update failed")
        _raise_internal_server_error("batch_update_tags", e)


@router.get("/content/batch")
async def get_content_batch(
    ids: str = Query(..., description="Comma-separated content UUIDs"),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Content]:
    """
    Batch get multiple content items by IDs

    Efficient endpoint for fetching multiple files at once.
    Returns only items user has access to.

    Query Parameters:
    - ids: Comma-separated UUIDs (e.g., "uuid1,uuid2,uuid3")

    Returns:
    - (dict[str, Any]) mapping content_id -> Content object
    - Items with no access are excluded (not 403 error)

    Example:
    GET /api/content/batch?ids=f47ac10b-58cc-4372-a567-0e02b2c3d479,a8d3f10b-58cc-4372-a567-0e02b2c3d480

    Response:
    {
      "f47ac10b-58cc-4372-a567-0e02b2c3d479": {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "name": "document.pdf",
        ...
      },
      "a8d3f10b-58cc-4372-a567-0e02b2c3d480": {
        "id": "a8d3f10b-58cc-4372-a567-0e02b2c3d480",
        "name": "image.jpg",
        ...
      }
    }
    """
    try:
        # Parse UUIDs from comma-separated string
        try:
            content_ids = [UUID(id_str.strip()) for id_str in ids.split(",")]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid UUID format: {e!s}") from e

        # Limit batch size (prevent abuse)
        if len(content_ids) > 100:
            _raise_max_batch_size_exceeded(100)

        if not content_ids:
            return {}

        # Fetch batch
        return await service.get_content_batch(content_ids, content_user_id)

    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_server_error("get_content_batch", e)


@router.get("/content/me")
async def get_content_me(
    content_user_id: str = Depends(get_content_user_id),
) -> dict[str, str]:
    """Return the resolved database user id for the current content session."""
    return {"user_id": content_user_id}


@router.get("/content/quota/me")
async def get_content_quota_me(
    content_user_id: str = Depends(get_content_user_id),
    pool=Depends(get_asyncpg_pool),
) -> dict[str, int | float | str]:
    """Current user's unified content storage usage and quota."""
    from api.services.unified_content.content_admin_ops_service import (  # noqa: PLC0415
        get_current_user_quota,
    )

    return await get_current_user_quota(pool, content_user_id)


@router.get("/content/manager/activity")
async def get_manager_activity(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """Recent content_audit_log rows for the current user (Content Manager stats tab)."""
    try:
        items = await service.list_manager_activity(content_user_id, limit=limit)
        return {"items": items}
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_server_error("get_manager_activity", e)


@router.get("/content/view-history")
async def get_view_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, Any]:
    """Per-user file view history (database-backed, not localStorage)."""
    try:
        raw = await service.list_user_view_history(content_user_id, limit=limit)
        return {
            "items": [
                {
                    "content": item["content"].model_dump(mode="json"),
                    "view_count": item["view_count"],
                    "last_viewed_at": item["last_viewed_at"],
                }
                for item in raw
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_server_error("get_view_history", e)


@router.delete("/content/view-history")
async def clear_view_history(
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, bool]:
    try:
        await service.clear_user_view_history(content_user_id)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_server_error("clear_view_history", e)


@router.post("/content/{content_id:uuid}/record-view")
async def record_content_view(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
) -> dict[str, bool]:
    try:
        await service.record_user_content_view(content_id, content_user_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        _raise_internal_server_error("record_content_view", e)


@router.get("/content/multi-version", response_model=ContentListResponse)
async def list_content_multi_version(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    query_service: ContentQueryService = Depends(get_content_query_service),
) -> ContentListResponse:
    """
    Files owned by the current user that have more than one row in content_versions
    (version history / snapshots).
    """
    try:
        oauth2_sub = str(current_user.id) if getattr(current_user, "id", None) else None
        alternate_user_id = oauth2_sub if (oauth2_sub and oauth2_sub != content_user_id) else None
        content_list, total = await query_service.list_content_multi_version(
            user_id=content_user_id,
            alternate_user_id=alternate_user_id,
            offset=offset,
            limit=limit,
        )
        return ContentListResponse(
            items=content_list,
            total=total,
            page=offset // limit + 1,
            page_size=limit,
            has_more=(offset + limit) < total,
        )
    except HTTPException:
        raise
    except Exception as e:
        _raise_internal_server_error("list_content_multi_version", e)
