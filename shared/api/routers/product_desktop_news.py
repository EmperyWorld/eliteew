# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   EWDesk company news: CRUD, linked media, AI polish, user read/starred sync, feed summary.
# Invariants:
#   - Published posts require is_published and published_at; hero media mutually exclusive.
#   - Static /news/* paths (counts, my-state) registered before /news/{post_id}.
#   - Linked media streams only when referenced by a published post.
# Related:
#   - api/routers/product_desktop.py (parent router include)
#   - documentation/product/desktop/EWDESK-NEWS.md
# ---
"""EWDesk (company news) routes for product desktop API."""

from __future__ import annotations

import io
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Self
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from PIL import Image  # type: ignore[import-untyped]
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.desktop import get_desktop_user_id
from api.routers.desktop_admin import require_admin_user
from api.routers.ugs import get_ugs_service
from api.routers.unified_content import get_content_service
from api.schemas.unified_content import ContentType, Visibility, build_content_create
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.storage_backends.minio_storage import SeaweedFileCorruptedError

logger = logging.getLogger(__name__)

news_router = APIRouter(tags=["product-desktop"])

from api.services.product_desktop.ewdesk_news_contract import (
    EW_MARK_BODY as _EW_MARK_BODY,
)
from api.services.product_desktop.ewdesk_news_contract import (
    EW_MARK_TITLE as _EW_MARK_TITLE,
)
from api.services.product_desktop.ewdesk_news_contract import (
    MAX_NEWS_IMAGE_URL_LEN as _MAX_NEWS_IMAGE_URL_LEN,
)
from api.services.product_desktop.ewdesk_news_contract import (
    build_news_list_user_filter_sql as _build_news_list_user_filter_sql,
)
from api.services.product_desktop.ewdesk_news_contract import (
    decode_news_list_cursor as _decode_news_list_cursor,
)
from api.services.product_desktop.ewdesk_news_contract import (
    encode_news_list_cursor as _encode_news_list_cursor,
)
from api.services.product_desktop.ewdesk_news_contract import (
    news_combined_search_params as _news_combined_search_params,
)
from api.services.product_desktop.ewdesk_news_contract import (
    news_combined_search_sql_clause as _news_combined_search_sql_clause,
)
from api.services.product_desktop.ewdesk_news_contract import (
    news_list_keyset_params as _news_list_keyset_params,
)
from api.services.product_desktop.ewdesk_news_contract import (
    news_list_keyset_where_sql as _news_list_keyset_where_sql,
)
from api.services.product_desktop.ewdesk_news_contract import (
    news_list_order_sql as _news_list_order_sql,
)
from api.services.product_desktop.ewdesk_news_contract import (
    normalize_news_list_sort as _normalize_news_list_sort,
)
from api.services.product_desktop.ewdesk_news_contract import (
    normalize_news_search_query as _normalize_news_search_query,
)
from api.services.product_desktop.ewdesk_news_contract import (
    normalize_optional_news_image_url as _normalize_optional_news_image_url,
)
from api.services.product_desktop.ewdesk_news_contract import (
    parse_ewdesk_polish_response as _parse_ewdesk_polish_response,
)


async def _emit_ewdesk_feed_updated(*, post_id: UUID, reason: str) -> None:
    """Best-effort Socket.IO push so desktop clients refresh feed/badge."""
    try:
        from api.routers.socketio_handler import emit_ewdesk_news_updated

        await emit_ewdesk_news_updated({"post_id": str(post_id), "reason": reason})
    except Exception:
        logger.warning(
            "EWDesk feed emit failed post_id=%s reason=%s",
            post_id,
            reason,
            exc_info=True,
        )


def _unified_content_is_image(*, mime_type: str | None, content_type: str | None) -> bool:
    mt = (mime_type or "").lower()
    if mt.startswith("image/"):
        return True
    return (content_type or "").lower() == "image"


def _storage_backend_name_for_factory(storage_backend: Any) -> str:
    """Map StorageBackendType from DB to backend names used by StorageBackendFactory."""
    if storage_backend is None:
        return "postgresql"
    raw = storage_backend.value if hasattr(storage_backend, "value") else str(storage_backend)
    return "seaweedfs" if raw == "minio" else raw


async def _maybe_convert_news_image_to_webp(
    source_content_id: UUID,
    admin_user_id: str,
    service: ContentStorageService,
) -> UUID:
    """
    Best-effort conversion for EWDesk hero images.

    If conversion fails for any reason, returns original source_content_id.
    """
    try:
        src = await service.get_content(source_content_id, admin_user_id, check_permissions=True)
    except Exception:
        logger.exception("EWDesk image fetch failed; keep original image_content_id=%s", source_content_id)
        return source_content_id

    mime = (src.mime_type or "").lower()
    if mime == "image/webp" or mime == "image/svg+xml":
        return source_content_id

    backend_name = _storage_backend_name_for_factory(src.storage_backend)
    backend = service.storage_factory.get_backend_by_name(backend_name)

    try:
        source_bytes = await backend.retrieve(src.file_path or "", source_content_id, fail_fast=True)
    except (ValueError, FileNotFoundError, SeaweedFileCorruptedError):  # fmt: skip
        logger.info(
            "EWDesk image retrieve skipped (missing/unreadable blob) image_content_id=%s",
            source_content_id,
        )
        return source_content_id
    except Exception:
        logger.exception(
            "EWDesk image retrieve failed; keep original image_content_id=%s",
            source_content_id,
        )
        return source_content_id

    if not source_bytes:
        return source_content_id

    try:
        with Image.open(io.BytesIO(source_bytes)) as image:
            if getattr(image, "is_animated", False):
                # Keep original for animated formats (GIF/WebP animation).
                return source_content_id
            image.load()
            if image.mode not in ("RGB", "RGBA"):
                has_alpha = "A" in image.getbands()
                image = image.convert("RGBA" if has_alpha else "RGB")
            out = io.BytesIO()
            image.save(out, format="WEBP", quality=82, method=6)
            webp_bytes = out.getvalue()
    except Exception:
        logger.exception(
            "EWDesk image conversion to webp failed; keep original image_content_id=%s",
            source_content_id,
        )
        return source_content_id

    # Keep original if conversion does not improve payload size enough.
    if not webp_bytes or len(webp_bytes) >= int(len(source_bytes) * 0.98):
        return source_content_id

    base_name = (src.name or "EWDesk image").strip()
    webp_name = base_name if base_name.lower().endswith("webp") else f"{base_name} (WebP)"
    source_filename = src.original_filename or base_name or "ewdesk-image"
    webp_filename = f"{Path(source_filename).stem or 'ewdesk-image'}.webp"

    metadata = dict(src.metadata or {})
    metadata.update(
        {
            "derived_for": "ewdesk_news",
            "derived_format": "image/webp",
            "derived_from_content_id": str(source_content_id),
        }
    )

    try:
        created = await service.create_content(
            content_data=build_content_create(
                user_id=admin_user_id,
                name=webp_name[:500],
                description=src.description,
                tags=list(src.tags or []),
                content_type=ContentType.IMAGE,
                mime_type="image/webp",
                sub_type=src.sub_type,
                visibility=Visibility.PRIVATE,
                metadata=metadata,
                company_id=src.company_id,
                project_id=src.project_id,
                friend_visibility=src.friend_visibility,
                original_filename=webp_filename[:255],
                source_service="product_desktop",
                source_id=str(source_content_id),
                related_content=[source_content_id],
                folder_item_id=src.folder_item_id,
            ),
            file_data=webp_bytes,
            user_id=admin_user_id,
        )
        return created.id
    except Exception:
        logger.exception(
            "EWDesk webp content create failed; keep original image_content_id=%s",
            source_content_id,
        )
        return source_content_id


async def _validate_admin_news_image_content_id(
    content_id: UUID,
    admin_user_id: str,
    service: ContentStorageService,
) -> None:
    """Ensure admin can access the file and it is an image."""
    try:
        content = await service.get_content(content_id, admin_user_id, check_permissions=True)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404, detail=str(e)) from e
    if not _unified_content_is_image(mime_type=content.mime_type, content_type=content.content_type):
        raise HTTPException(
            status_code=status.HTTP_400,
            detail="image_content_id must refer to an image file",
        )


def _unified_content_is_video(*, mime_type: str | None, content_type: str | None) -> bool:
    mt = (mime_type or "").lower()
    if mt.startswith("video/"):
        return True
    return (content_type or "").lower() == "video"


async def _validate_admin_news_video_content_id(
    content_id: UUID,
    admin_user_id: str,
    service: ContentStorageService,
) -> None:
    """Ensure admin can access the file and it is a video."""
    try:
        content = await service.get_content(content_id, admin_user_id, check_permissions=True)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404, detail=str(e)) from e
    if not _unified_content_is_video(mime_type=content.mime_type, content_type=content.content_type):
        raise HTTPException(
            status_code=status.HTTP_400,
            detail="video_content_id must refer to a video file",
        )


def _unified_content_is_audio(*, mime_type: str | None, content_type: str | None) -> bool:
    mt = (mime_type or "").lower()
    if mt.startswith("audio/"):
        return True
    return (content_type or "").lower() == "audio"


async def _validate_admin_news_audio_content_id(
    content_id: UUID,
    admin_user_id: str,
    service: ContentStorageService,
) -> None:
    """Ensure admin can access the file and it is audio."""
    try:
        content = await service.get_content(content_id, admin_user_id, check_permissions=True)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404, detail=str(e)) from e
    if not _unified_content_is_audio(mime_type=content.mime_type, content_type=content.content_type):
        raise HTTPException(
            status_code=status.HTTP_400,
            detail="audio_content_id must refer to an audio file",
        )


# --- Models: news ---


class CompanyNewsPostOut(BaseModel):
    id: UUID
    title: str
    body: str
    pinned: bool
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    image_url: str | None = None
    image_content_id: UUID | None = None
    video_content_id: UUID | None = None
    audio_content_id: UUID | None = None


class CompanyNewsPostListItemOut(BaseModel):
    """Feed list item without full body (excerpt only for client search)."""

    id: UUID
    title: str
    body_excerpt: str | None = None
    pinned: bool
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    image_url: str | None = None
    image_content_id: UUID | None = None
    video_content_id: UUID | None = None
    audio_content_id: UUID | None = None


class CompanyNewsPostListPageOut(BaseModel):
    items: list[CompanyNewsPostListItemOut]
    total: int
    limit: int
    offset: int
    next_cursor: str | None = None


class EwDeskNewsUserStateOut(BaseModel):
    read_post_ids: list[UUID]
    starred_post_ids: list[UUID]
    last_seen_published_at: datetime | None = None


class EwDeskNewsUserStatePatch(BaseModel):
    read_post_ids: list[UUID] | None = None
    starred_post_ids: list[UUID] | None = None
    mark_read_ids: list[UUID] | None = None
    mark_unread_ids: list[UUID] | None = None
    last_seen_published_at: datetime | None = None


class EwDeskNewsCountsOut(BaseModel):
    unread_count: int
    starred_count: int
    pinned_count: int
    total_published: int
    latest_published_at: datetime | None = None


class CompanyNewsPostAdminOut(CompanyNewsPostOut):
    is_published: bool


class CompanyNewsCreateBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1)
    pinned: bool = False
    is_published: bool = False
    published_at: datetime | None = None
    image_url: str | None = Field(None, max_length=_MAX_NEWS_IMAGE_URL_LEN)
    image_content_id: UUID | None = None
    video_content_id: UUID | None = None
    audio_content_id: UUID | None = None

    @field_validator("image_url", mode="before")
    @classmethod
    def _validate_image_url_create(cls, v: Any) -> str | None:
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            msg = "image_url must be a string"
            raise ValueError(msg)
        return _normalize_optional_news_image_url(v)

    @model_validator(mode="after")
    def _exclusive_hero_media_create(self) -> Self:
        parts = [
            self.image_url is not None,
            self.image_content_id is not None,
            self.video_content_id is not None,
        ]
        if sum(1 for p in parts if p) > 1:
            msg = "only one of image_url, image_content_id, video_content_id"
            raise ValueError(msg)
        return self


_EWDESK_POLISH_BODY_MAX_CHARS = 48_000


class EwDeskNewsPolishBody(BaseModel):
    """Draft for AI rewrite (admin)."""

    title: str | None = Field(default=None, max_length=500)
    body: str = Field(..., min_length=1, max_length=_EWDESK_POLISH_BODY_MAX_CHARS)

    @field_validator("body")
    @classmethod
    def _body_non_empty_after_strip(cls, v: str) -> str:
        s = v.strip()
        if not s:
            msg = "body cannot be empty"
            raise ValueError(msg)
        return s


class EwDeskNewsPolishOut(BaseModel):
    body: str
    title: str | None = None


class CompanyNewsUpdateBody(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    body: str | None = Field(None, min_length=1)
    pinned: bool | None = None
    is_published: bool | None = None
    published_at: datetime | None = None
    image_url: str | None = Field(None, max_length=_MAX_NEWS_IMAGE_URL_LEN)
    image_content_id: UUID | None = None
    video_content_id: UUID | None = None
    audio_content_id: UUID | None = None

    @field_validator("image_url", mode="before")
    @classmethod
    def _validate_image_url_update(cls, v: Any) -> str | None:
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            msg = "image_url must be a string"
            raise ValueError(msg)
        return _normalize_optional_news_image_url(v)

    @model_validator(mode="after")
    def _exclusive_hero_media_update(self) -> Self:
        parts = [
            self.image_url is not None,
            self.image_content_id is not None,
            self.video_content_id is not None,
        ]
        if sum(1 for p in parts if p) > 1:
            msg = "only one of image_url, image_content_id, video_content_id"
            raise ValueError(msg)
        return self


# --- News ---


@news_router.get("/news", response_model=CompanyNewsPostListPageOut)
async def list_published_news(
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    cursor: str | None = Query(default=None, max_length=512),
    pinned_only: bool = Query(default=False),
    unread_only: bool = Query(default=False),
    starred_only: bool = Query(default=False),
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
    _user: AuthUser = Depends(require_oauth2_user),
) -> CompanyNewsPostListPageOut:
    search = _normalize_news_search_query(q)
    sort_token = _normalize_news_list_sort(sort)
    use_keyset = cursor is not None and search is None
    if use_keyset and offset > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="cursor and offset are mutually exclusive"
        )
    if use_keyset:
        try:
            cursor_pinned, cursor_published_at, cursor_post_id = _decode_news_list_cursor(cursor or "")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid cursor") from exc

    params: dict[str, Any] = {"limit": limit, "offset": offset if not use_keyset else 0}
    where_sql = "WHERE is_published = true AND published_at IS NOT NULL"
    if search:
        where_sql += f" AND {_news_combined_search_sql_clause(search)}"
        params.update(_news_combined_search_params(search))
    if pinned_only:
        where_sql += " AND pinned = true"
    user_filter_sql, needs_uid = _build_news_list_user_filter_sql(
        unread_only=unread_only,
        starred_only=starred_only,
    )
    where_sql += user_filter_sql
    if needs_uid:
        params["uid"] = str(user_id)
    if use_keyset:
        where_sql += _news_list_keyset_where_sql(sort_token)
        params.update(
            _news_list_keyset_params(
                pinned=cursor_pinned,
                published_at=cursor_published_at,
                post_id=cursor_post_id,
            )
        )

    order_sql = _news_list_order_sql(sort_token, search_active=search is not None)

    count_r = await db.execute(
        text(f"SELECT COUNT(*)::int AS c FROM company_news_posts {where_sql}"),
        params,
    )
    total = int(count_r.scalar_one())

    limit_sql = "LIMIT :limit" if use_keyset else "LIMIT :limit OFFSET :offset"
    result = await db.execute(
        text(
            f"""
            SELECT id, title, LEFT(body, 400) AS body_excerpt, pinned, published_at, created_at, updated_at,
                   image_url, image_content_id, video_content_id, audio_content_id
            FROM company_news_posts
            {where_sql}
            {order_sql}
            {limit_sql}
            """
        ),
        params,
    )
    rows = result.mappings().all()
    items = [CompanyNewsPostListItemOut.model_validate(dict(r)) for r in rows]
    next_cursor: str | None = None
    if search is None and len(items) == limit:
        last = items[-1]
        if last.published_at is not None:
            next_cursor = _encode_news_list_cursor(
                pinned=last.pinned,
                published_at=last.published_at,
                post_id=last.id,
            )
    return CompanyNewsPostListPageOut(
        items=items,
        total=total,
        limit=limit,
        offset=0 if use_keyset else offset,
        next_cursor=next_cursor,
    )


@news_router.get("/news/counts", response_model=EwDeskNewsCountsOut)
async def get_news_counts(
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
    _user: AuthUser = Depends(require_oauth2_user),
) -> EwDeskNewsCountsOut:
    """Aggregate EWDesk feed counts for toolbar badge and in-app filters."""
    row = await _fetch_ewdesk_news_counts_row(db, user_id)
    return EwDeskNewsCountsOut.model_validate(row)


async def _fetch_ewdesk_news_counts_row(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """Single SQL round-trip for EWDesk counts + latest publish watermark."""
    uid = str(user_id)
    row = (
        (
            await db.execute(
                text(
                    """
                SELECT
                  (SELECT COUNT(*)::int FROM company_news_posts
                   WHERE is_published = true AND published_at IS NOT NULL) AS total_published,
                  (SELECT MAX(published_at) FROM company_news_posts
                   WHERE is_published = true AND published_at IS NOT NULL) AS latest_published_at,
                  (SELECT COUNT(*)::int FROM company_news_posts
                   WHERE is_published = true AND published_at IS NOT NULL AND pinned = true) AS pinned_count,
                  (SELECT COUNT(*)::int FROM company_news_posts p
                   WHERE p.is_published = true AND p.published_at IS NOT NULL
                     AND NOT EXISTS (
                       SELECT 1 FROM ewdesk_user_news_state s
                       WHERE s.user_id = CAST(:uid AS uuid)
                         AND s.post_id = p.id
                         AND s.read_at IS NOT NULL
                     )) AS unread_count,
                  (SELECT COUNT(*)::int FROM company_news_posts p
                   WHERE p.is_published = true AND p.published_at IS NOT NULL
                     AND EXISTS (
                       SELECT 1 FROM ewdesk_user_news_state s
                       WHERE s.user_id = CAST(:uid AS uuid)
                         AND s.post_id = p.id
                         AND s.starred = true
                     )) AS starred_count
                """
                ),
                {"uid": uid},
            )
        )
        .mappings()
        .one()
    )
    return dict(row)


async def _fetch_user_news_state(db: AsyncSession, user_id: UUID) -> EwDeskNewsUserStateOut:
    uid = str(user_id)
    meta_r = await db.execute(
        text(
            """
            SELECT last_seen_published_at
            FROM ewdesk_user_feed_meta
            WHERE user_id = CAST(:uid AS uuid)
            """
        ),
        {"uid": uid},
    )
    meta_row = meta_r.mappings().first()
    last_seen = meta_row["last_seen_published_at"] if meta_row else None

    state_r = await db.execute(
        text(
            """
            SELECT post_id, read_at IS NOT NULL AS is_read, starred
            FROM ewdesk_user_news_state
            WHERE user_id = CAST(:uid AS uuid)
            """
        ),
        {"uid": uid},
    )
    read_ids: list[UUID] = []
    starred_ids: list[UUID] = []
    for row in state_r.mappings().all():
        pid = row["post_id"]
        if row["is_read"]:
            read_ids.append(pid)
        if row["starred"]:
            starred_ids.append(pid)
    return EwDeskNewsUserStateOut(
        read_post_ids=read_ids,
        starred_post_ids=starred_ids,
        last_seen_published_at=last_seen,
    )


@news_router.get("/news/my-state", response_model=EwDeskNewsUserStateOut)
async def get_news_my_state(
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
) -> EwDeskNewsUserStateOut:
    return await _fetch_user_news_state(db, user_id)


@news_router.patch("/news/my-state", response_model=EwDeskNewsUserStateOut)
async def patch_news_my_state(
    body: EwDeskNewsUserStatePatch,
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
) -> EwDeskNewsUserStateOut:
    uid = str(user_id)
    now = datetime.now(UTC)

    if body.last_seen_published_at is not None:
        await db.execute(
            text(
                """
                INSERT INTO ewdesk_user_feed_meta (user_id, last_seen_published_at, updated_at)
                VALUES (CAST(:uid AS uuid), :last_seen, :now)
                ON CONFLICT (user_id) DO UPDATE SET
                    last_seen_published_at = GREATEST(
                        COALESCE(ewdesk_user_feed_meta.last_seen_published_at, :last_seen),
                        :last_seen
                    ),
                    updated_at = :now
                """
            ),
            {"uid": uid, "last_seen": body.last_seen_published_at, "now": now},
        )

    if body.read_post_ids is not None:
        await db.execute(
            text(
                """
                UPDATE ewdesk_user_news_state
                SET read_at = NULL, updated_at = :now
                WHERE user_id = CAST(:uid AS uuid) AND read_at IS NOT NULL
                """
            ),
            {"uid": uid, "now": now},
        )
        for pid in body.read_post_ids:
            await db.execute(
                text(
                    """
                    INSERT INTO ewdesk_user_news_state (user_id, post_id, read_at, starred, updated_at)
                    VALUES (CAST(:uid AS uuid), CAST(:pid AS uuid), :now, false, :now)
                    ON CONFLICT (user_id, post_id) DO UPDATE SET read_at = :now, updated_at = :now
                    """
                ),
                {"uid": uid, "pid": str(pid), "now": now},
            )

    if body.starred_post_ids is not None:
        await db.execute(
            text(
                "UPDATE ewdesk_user_news_state SET starred = false, updated_at = :now WHERE user_id = CAST(:uid AS uuid)"
            ),
            {"uid": uid, "now": now},
        )
        for pid in body.starred_post_ids:
            await db.execute(
                text(
                    """
                    INSERT INTO ewdesk_user_news_state (user_id, post_id, read_at, starred, updated_at)
                    VALUES (CAST(:uid AS uuid), CAST(:pid AS uuid), NULL, true, :now)
                    ON CONFLICT (user_id, post_id) DO UPDATE SET starred = true, updated_at = :now
                    """
                ),
                {"uid": uid, "pid": str(pid), "now": now},
            )

    if body.mark_read_ids:
        for pid in body.mark_read_ids:
            await db.execute(
                text(
                    """
                    INSERT INTO ewdesk_user_news_state (user_id, post_id, read_at, starred, updated_at)
                    VALUES (CAST(:uid AS uuid), CAST(:pid AS uuid), :now, false, :now)
                    ON CONFLICT (user_id, post_id) DO UPDATE SET read_at = COALESCE(ewdesk_user_news_state.read_at, :now), updated_at = :now
                    """
                ),
                {"uid": uid, "pid": str(pid), "now": now},
            )

    if body.mark_unread_ids:
        for pid in body.mark_unread_ids:
            await db.execute(
                text(
                    """
                    UPDATE ewdesk_user_news_state SET read_at = NULL, updated_at = :now
                    WHERE user_id = CAST(:uid AS uuid) AND post_id = CAST(:pid AS uuid)
                    """
                ),
                {"uid": uid, "pid": str(pid), "now": now},
            )

    await db.commit()
    return await _fetch_user_news_state(db, user_id)


@news_router.get("/news/{post_id}", response_model=CompanyNewsPostOut)
async def get_published_news(
    post_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _user: AuthUser = Depends(require_oauth2_user),
) -> CompanyNewsPostOut:
    result = await db.execute(
        text(
            """
            SELECT id, title, body, pinned, published_at, created_at, updated_at, image_url, image_content_id, video_content_id, audio_content_id
            FROM company_news_posts
            WHERE id = :id AND is_published = true AND published_at IS NOT NULL
            """
        ),
        {"id": str(post_id)},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return CompanyNewsPostOut.model_validate(dict(row))


@news_router.get("/news-linked-image/{content_id:uuid}")
async def stream_news_linked_image(
    content_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _user: AuthUser = Depends(require_oauth2_user),
    service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """
    Stream bytes for an image linked to *published* EWDesk news.

    Lets any authenticated user load the hero image even when the underlying
    unified_content row is not otherwise visible to them (news acts as curation).
    """
    chk = await db.execute(
        text(
            """
            SELECT 1 FROM company_news_posts
            WHERE image_content_id = :cid
              AND is_published = true
              AND published_at IS NOT NULL
            LIMIT 1
            """
        ),
        {"cid": str(content_id)},
    )
    if chk.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    try:
        content = await service.get_content(content_id, str(_user.id), check_permissions=False)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e

    if not _unified_content_is_image(mime_type=content.mime_type, content_type=content.content_type):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not an image")

    if content.storage_backend is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage backend not set for content",
        )
    storage_backend = content.storage_backend
    backend_name_str = storage_backend.value
    backend = service.storage_factory.get_backend_by_name(backend_name_str)

    try:
        file_data = await backend.retrieve(content.file_path or "", content_id)
    except (ValueError, FileNotFoundError, SeaweedFileCorruptedError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File data not found: {e!s}",
        ) from e
    except Exception as e:
        logger.exception("news-linked-image retrieve failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage error",
        ) from e

    if not file_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empty file")

    raw_name = content.original_filename or content.name or "image"
    try:
        encoded_name = quote(raw_name, safe="")
        content_disp = f"inline; filename*=UTF-8''{encoded_name}"
    except Exception:
        content_disp = 'inline; filename="image"'

    media_type = content.mime_type or "application/octet-stream"
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=media_type,
        headers={
            "Content-Disposition": content_disp,
            "Content-Length": str(len(file_data)),
            "Cache-Control": "private, max-age=3600",
        },
    )


@news_router.get("/news-linked-video/{content_id:uuid}")
async def stream_news_linked_video(
    content_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _user: AuthUser = Depends(require_oauth2_user),
    service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """Stream video bytes for *published* EWDesk news that reference this content."""
    chk = await db.execute(
        text(
            """
            SELECT 1 FROM company_news_posts
            WHERE video_content_id = :cid
              AND is_published = true
              AND published_at IS NOT NULL
            LIMIT 1
            """
        ),
        {"cid": str(content_id)},
    )
    if chk.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    try:
        content = await service.get_content(content_id, str(_user.id), check_permissions=False)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e

    if not _unified_content_is_video(mime_type=content.mime_type, content_type=content.content_type):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not a video")

    if content.storage_backend is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage backend not set for content",
        )
    storage_backend = content.storage_backend
    backend_name_str = storage_backend.value
    backend = service.storage_factory.get_backend_by_name(backend_name_str)

    try:
        file_data = await backend.retrieve(content.file_path or "", content_id)
    except (ValueError, FileNotFoundError, SeaweedFileCorruptedError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File data not found: {e!s}",
        ) from e
    except Exception as e:
        logger.exception("news-linked-video retrieve failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage error",
        ) from e

    if not file_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empty file")

    raw_name = content.original_filename or content.name or "video"
    try:
        encoded_name = quote(raw_name, safe="")
        content_disp = f"inline; filename*=UTF-8''{encoded_name}"
    except Exception:
        content_disp = 'inline; filename="video"'

    media_type = content.mime_type or "application/octet-stream"
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=media_type,
        headers={
            "Content-Disposition": content_disp,
            "Content-Length": str(len(file_data)),
            "Cache-Control": "private, max-age=3600",
        },
    )


@news_router.get("/news-linked-audio/{content_id:uuid}")
async def stream_news_linked_audio(
    content_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _user: AuthUser = Depends(require_oauth2_user),
    service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """Stream audio bytes for *published* EWDesk news that reference this content."""
    chk = await db.execute(
        text(
            """
            SELECT 1 FROM company_news_posts
            WHERE audio_content_id = :cid
              AND is_published = true
              AND published_at IS NOT NULL
            LIMIT 1
            """
        ),
        {"cid": str(content_id)},
    )
    if chk.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio not found")

    try:
        content = await service.get_content(content_id, str(_user.id), check_permissions=False)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e

    if not _unified_content_is_audio(mime_type=content.mime_type, content_type=content.content_type):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not audio")

    if content.storage_backend is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage backend not set for content",
        )
    storage_backend = content.storage_backend
    backend_name_str = storage_backend.value
    backend = service.storage_factory.get_backend_by_name(backend_name_str)

    try:
        file_data = await backend.retrieve(content.file_path or "", content_id)
    except (ValueError, FileNotFoundError, SeaweedFileCorruptedError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File data not found: {e!s}",
        ) from e
    except Exception as e:
        logger.exception("news-linked-audio retrieve failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage error",
        ) from e

    if not file_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empty file")

    raw_name = content.original_filename or content.name or "audio"
    try:
        encoded_name = quote(raw_name, safe="")
        content_disp = f"inline; filename*=UTF-8''{encoded_name}"
    except Exception:
        content_disp = 'inline; filename="audio"'

    media_type = content.mime_type or "application/octet-stream"
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=media_type,
        headers={
            "Content-Disposition": content_disp,
            "Content-Length": str(len(file_data)),
            "Cache-Control": "private, max-age=3600",
        },
    )


@news_router.get("/admin/news", response_model=list[CompanyNewsPostAdminOut])
async def admin_list_news(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> list[CompanyNewsPostAdminOut]:
    result = await db.execute(
        text(
            """
            SELECT id, title, body, pinned, is_published, published_at, created_at, updated_at, image_url, image_content_id, video_content_id, audio_content_id
            FROM company_news_posts
            ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC
            LIMIT 500
            """
        )
    )
    rows = result.mappings().all()
    return [CompanyNewsPostAdminOut.model_validate(dict(r)) for r in rows]


@news_router.post("/admin/news", response_model=CompanyNewsPostAdminOut)
async def admin_create_news(
    body: CompanyNewsCreateBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
    content_service: ContentStorageService = Depends(get_content_service),
) -> CompanyNewsPostAdminOut:
    now = datetime.now(UTC)
    pub = body.published_at
    if body.is_published and pub is None:
        pub = now
    image_url = body.image_url
    image_cid = body.image_content_id
    video_cid = body.video_content_id
    if video_cid is not None:
        await _validate_admin_news_video_content_id(video_cid, str(_admin.id), content_service)
        image_url = None
        image_cid = None
    elif image_cid is not None:
        await _validate_admin_news_image_content_id(image_cid, str(_admin.id), content_service)
        image_cid = await _maybe_convert_news_image_to_webp(image_cid, str(_admin.id), content_service)
        image_url = None
        video_cid = None
    else:
        video_cid = None
    audio_cid = body.audio_content_id
    if audio_cid is not None:
        await _validate_admin_news_audio_content_id(audio_cid, str(_admin.id), content_service)
    result = await db.execute(
        text(
            """
            INSERT INTO company_news_posts (title, body, pinned, is_published, published_at, image_url, image_content_id, video_content_id, audio_content_id)
            VALUES (:title, :body, :pinned, :is_published, :published_at, :image_url, :image_content_id, :video_content_id, :audio_content_id)
            RETURNING id, title, body, pinned, is_published, published_at, created_at, updated_at, image_url, image_content_id, video_content_id, audio_content_id
            """
        ),
        {
            "title": body.title,
            "body": body.body,
            "pinned": body.pinned,
            "is_published": body.is_published,
            "published_at": pub,
            "image_url": image_url,
            "image_content_id": image_cid,
            "video_content_id": video_cid,
            "audio_content_id": audio_cid,
        },
    )
    await db.commit()
    row = result.mappings().one()
    out = CompanyNewsPostAdminOut.model_validate(dict(row))
    await _emit_ewdesk_feed_updated(post_id=out.id, reason="created")
    return out


@news_router.patch("/admin/news/{post_id}", response_model=CompanyNewsPostAdminOut)
async def admin_update_news(
    post_id: UUID,
    body: CompanyNewsUpdateBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
    content_service: ContentStorageService = Depends(get_content_service),
) -> CompanyNewsPostAdminOut:
    fields: dict[str, Any] = {}
    if body.title is not None:
        fields["title"] = body.title
    if body.body is not None:
        fields["body"] = body.body
    if body.pinned is not None:
        fields["pinned"] = body.pinned
    if body.is_published is not None:
        fields["is_published"] = body.is_published
    if body.published_at is not None:
        fields["published_at"] = body.published_at
    _patch_dump = body.model_dump(exclude_unset=True)
    if "video_content_id" in _patch_dump:
        vc = _patch_dump["video_content_id"]
        if vc is not None:
            await _validate_admin_news_video_content_id(vc, str(_admin.id), content_service)
            fields["image_url"] = None
            fields["image_content_id"] = None
        fields["video_content_id"] = vc
    if "image_content_id" in _patch_dump:
        ic = _patch_dump["image_content_id"]
        if ic is not None:
            await _validate_admin_news_image_content_id(ic, str(_admin.id), content_service)
            ic = await _maybe_convert_news_image_to_webp(ic, str(_admin.id), content_service)
            fields["image_url"] = None
            fields["video_content_id"] = None
        fields["image_content_id"] = ic
    if "image_url" in _patch_dump:
        u = _patch_dump["image_url"]
        if u is not None:
            fields["image_content_id"] = None
            fields["video_content_id"] = None
        fields["image_url"] = u
    if "audio_content_id" in _patch_dump:
        ac = _patch_dump["audio_content_id"]
        if ac is not None:
            await _validate_admin_news_audio_content_id(ac, str(_admin.id), content_service)
        fields["audio_content_id"] = ac
    if not fields:
        r0 = await db.execute(
            text(
                """
                SELECT id, title, body, pinned, is_published, published_at, created_at, updated_at, image_url, image_content_id, video_content_id, audio_content_id
                FROM company_news_posts WHERE id = :id
                """
            ),
            {"id": str(post_id)},
        )
        row0 = r0.mappings().first()
        if not row0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        return CompanyNewsPostAdminOut.model_validate(dict(row0))

    sets = ", ".join(f"{k} = :{k}" for k in fields)
    params = {k: v for k, v in fields.items()}
    params["id"] = str(post_id)
    params["updated_at"] = datetime.now(UTC)
    await db.execute(
        text(f"UPDATE company_news_posts SET {sets}, updated_at = :updated_at WHERE id = :id"),
        params,
    )
    await db.commit()
    r = await db.execute(
        text(
            """
            SELECT id, title, body, pinned, is_published, published_at, created_at, updated_at, image_url, image_content_id, video_content_id, audio_content_id
            FROM company_news_posts WHERE id = :id
            """
        ),
        {"id": str(post_id)},
    )
    row = r.mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    out = CompanyNewsPostAdminOut.model_validate(dict(row))
    await _emit_ewdesk_feed_updated(post_id=out.id, reason="updated")
    return out


@news_router.delete("/admin/news/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_news(
    post_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> None:
    chk = await db.execute(
        text("SELECT 1 FROM company_news_posts WHERE id = :id"),
        {"id": str(post_id)},
    )
    if chk.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    await db.execute(text("DELETE FROM company_news_posts WHERE id = :id"), {"id": str(post_id)})
    await db.commit()
    await _emit_ewdesk_feed_updated(post_id=post_id, reason="deleted")


@news_router.post("/admin/news/polish-body", response_model=EwDeskNewsPolishOut)
async def admin_polish_news_body(
    body: EwDeskNewsPolishBody,
    _admin: AuthUser = Depends(require_admin_user),
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),
) -> EwDeskNewsPolishOut:
    """
    Rewrite draft news into polished Markdown via UGS (same stack as document editor AI).
    Admin-only.
    """
    from api.services.doc_editor_service import DocEditorService

    db_pool = await get_asyncpg_pool()
    service = DocEditorService(db_pool, ugs_service=ugs_service)
    draft_title = (body.title or "").strip()
    draft_body = body.body.strip()

    _ew_polish_temperature = 0.45
    _ew_polish_max_tokens = 9_000

    _app_links_hint = (
        "[Ассистент](/__eliteew-desktop-open-app__/AssistantApp), "
        "[EWDesk](/__eliteew-desktop-open-app__/EWDeskApp), "
        "[Магазин приложений](/__eliteew-desktop-open-app__/AppStore), "
        "[Редактор документов](/__eliteew-desktop-open-app__/DocEditor), "
        "[GAF Chat](/__eliteew-desktop-open-app__/GAFChatApp), "
        "[Центр уведомлений](/__eliteew-desktop-open-app__/NotificationsApp), "
        "[Файловый менеджер](/__eliteew-desktop-open-app__/ContentManagerPro), "
        "[Музыкальный плеер](/__eliteew-desktop-open-app__/MusicPlayer), "
        "[EWRP](/__eliteew-desktop-open-app__/EWRP), "
        "[Маркетинг-кабинет](/__eliteew-desktop-open-app__/MarketingCabinet), "
        "[Настройки рабочего стола](/__eliteew-desktop-open-app__/EliteEwShellSettings/performance)"
    )

    context = (
        "Ты редактор корпоративной ленты EWDesk. "
        "Нужно переписать черновик в эмоциональный, user-facing пост, готовый к публикации.\n\n"
        "ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:\n"
        "1) Строго русский язык.\n"
        "2) Не выдумывай факты, цифры, сроки и функции.\n"
        "3) Сохраняй смысл черновика, но делай текст живым и читаемым.\n"
        "4) Без технических терминов, внутреннего стека, API, БД, PR.\n"
        "5) Не использовать символ §.\n\n"
        "ШАБЛОН BODY (строго в этом порядке):\n"
        "— Лид: 1-2 коротких предложения.\n"
        "— Разделитель ---\n"
        "— Заголовок: ## Что вы почувствуете\n"
        "— 3-5 пунктов списка, каждый с эмодзи.\n"
        "— Разделитель ---\n"
        "— Заголовок: ## Что это даёт в реальной работе\n"
        "— 2-4 предложения практической пользы.\n"
        "— Если в тексте уместно: блок **Быстрый переход** + 1-3 Markdown-ссылки на приложения.\n"
        "— Разделитель ---\n"
        "— Финальная закрывающая фраза в формате цитаты (> ...).\n\n"
        "ПРАВИЛА ДЛЯ ССЫЛОК НА ПРИЛОЖЕНИЯ:\n"
        "— Используй только формат [Название](/__eliteew-desktop-open-app__/ComponentName).\n"
        "— Добавляй ссылки только если они прямо уместны по теме поста.\n"
        "— Примеры допустимых ссылок: "
        f"{_app_links_hint}.\n\n"
        f"ФОРМАТ ОТВЕТА:\n{_EW_MARK_TITLE}\n[Короткий заголовок поста с эмодзи или NONE]\n"
        f"{_EW_MARK_BODY}\n[Текст поста строго по шаблону выше]"
    )

    prompt = (
        "Перепиши черновик новости в публикацию для EWDesk по заданному шаблону.\n\n"
        "ИСХОДНЫЙ МАТЕРИАЛ:\n"
        f"Заголовок: {draft_title if draft_title else '[Отсутствует]'}\n\n"
        f"Черновик:\n{draft_body}\n\n"
        "Сделай текст выразительным, аккуратным и готовым к публикации без ручной доработки. "
        "Ответ верни строго с маркерами и в требуемом формате."
    )

    try:
        raw = await service.ai_complete(
            prompt=prompt,
            context=context,
            temperature=_ew_polish_temperature,
            max_tokens=_ew_polish_max_tokens,
            user_id=str(_admin.id),
            action_mode="ewdesk_news_polish",
            context_scope="admin",
        )
        out_body, out_title = _parse_ewdesk_polish_response(raw)

        # Дополнительная пост-обработка для улучшения Markdown
        if out_body:
            out_body = _enhance_markdown(out_body)

    except ValueError as e:
        logger.warning("EWDesk polish: parse error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e) or "Could not parse AI response",
        ) from e
    except Exception as e:
        logger.exception("EWDesk polish failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI polish failed: {e!s}",
        ) from e

    return EwDeskNewsPolishOut(body=out_body, title=out_title)


def _enhance_markdown(text: str) -> str:
    """
    Дополнительная обработка Markdown для улучшения читаемости.
    """
    lines = text.split("\n")
    enhanced_lines = []

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            enhanced_lines.append("")
            continue

        # Улучшение заголовков
        if line.startswith("## ") or line.startswith("### "):
            enhanced_lines.append(f"\n{line}\n")
        # Добавление отступов для списков
        elif line.startswith(("- ", "* ", "1. ", "2. ", "3. ", "> ")):
            enhanced_lines.append(
                f"  {line}" if i > 0 and lines[i - 1].startswith(("-", "*", "1.", "2.", "3.", ">")) else line
            )
        else:
            enhanced_lines.append(line)

    # Удаление лишних пустых строк
    result = []
    for i, line in enumerate(enhanced_lines):
        if i == 0 or not (line == "" and enhanced_lines[i - 1] == ""):
            result.append(line)

    return "\n".join(result)
