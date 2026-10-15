#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compose one authenticated folder view from desktop child items and compact Unified Content file rows.
# Invariants:
# - Folder ownership is resolved through the caller's desktop config before any children are returned.
# - File filtering delegates to ContentQueryService so storage-specific folder semantics remain canonical.
# - Read path loads only the parent folder + direct children (no full desktop tree / strip-apps mutation).
# - App allowlist strip remains on GET /desktop/items; folder-view does not mutate installed-app icons.
# Related:
# - api/routers/unified_content.py
# - api/routers/desktop_items.py
# - api/services/desktop_item_nesting.py
# ---
"""Atomic desktop-folder view query service."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.models.desktop import DesktopItem, ItemType
from api.routers import desktop as desktop_router
from api.routers.desktop_bootstrap import ensure_system_folders
from api.routers.desktop_shell import _get_or_create_desktop_config_row
from api.schemas.unified_content import (
    ContentListCompactResponse,
    ContentListItemCompact,
    ContentType,
    FolderViewDesktopChild,
    FolderViewResponse,
)
from api.services.unified_content.content_query_service import ContentQueryService

_DEFAULT_POSITION = {"x": 20, "y": 20}


class FolderViewService:
    """Build a synchronized folder response across desktop and content stores."""

    def __init__(self, db: AsyncSession, query_service: ContentQueryService) -> None:
        self._db = db
        self._query_service = query_service

    async def get_folder_view(
        self,
        *,
        current_user: AuthUser,
        content_user_id: str,
        folder_item_id: str | None,
        folder_unassigned: bool,
        search: str | None,
        sort_field: str | None,
        sort_order: str | None,
        limit: int,
        offset: int,
        content_type: ContentType | None,
        mime_type: str | None = None,
        min_file_size: int | None = None,
        processing_status: str | None = None,
    ) -> FolderViewResponse:
        """Return direct desktop children and compact content rows for one folder context."""
        if folder_item_id is not None and folder_unassigned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="folder_item_id and folder_unassigned cannot be used together",
            )

        normalized_folder_item_id = (folder_item_id or "").strip() or None
        normalized_search = (search or "").strip() or None
        desktop_user_id = await desktop_router.get_desktop_user_id(current_user=current_user, db=self._db)
        config = await _get_or_create_desktop_config_row(self._db, desktop_user_id)
        await ensure_system_folders(self._db, config)
        await self._db.commit()

        parent_item_id_for_children: str | None = None
        parent_pk: UUID | None = None
        if not folder_unassigned and normalized_folder_item_id is not None:
            parent_row = await self._load_desktop_item_by_item_id(config.id, normalized_folder_item_id)
            if parent_row is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desktop folder not found")
            if parent_row.item_type != ItemType.FOLDER:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Requested desktop item is not a folder",
                )
            raw_parent_pk = parent_row.id
            parent_pk = raw_parent_pk if isinstance(raw_parent_pk, UUID) else UUID(str(raw_parent_pk))
            raw_parent_item_id = parent_row.item_id
            parent_item_id_for_children = (
                raw_parent_item_id if isinstance(raw_parent_item_id, str) else str(raw_parent_item_id)
            )

        child_rows = await self._load_direct_desktop_children(
            config_id=config.id,
            parent_pk=parent_pk,
            search=normalized_search,
        )
        desktop_children = [_desktop_child_wire(row, parent_item_id=parent_item_id_for_children) for row in child_rows]

        oauth2_sub = str(getattr(current_user, "id", None) or "").strip() or None
        alternate_user_id = oauth2_sub if oauth2_sub and oauth2_sub != content_user_id else None
        content_rows, total = await self._query_service.list_content(
            user_id=content_user_id,
            content_type=content_type,
            mime_type=mime_type,
            search_query=normalized_search,
            folder_item_id=normalized_folder_item_id,
            folder_unassigned=folder_unassigned,
            sort_field=sort_field,
            sort_order=sort_order,
            offset=offset,
            limit=limit,
            alternate_user_id=alternate_user_id,
            list_profile="compact",
            min_file_size=min_file_size,
            processing_status=processing_status,
        )
        files = ContentListCompactResponse(
            items=[ContentListItemCompact.from_content(item) for item in content_rows],
            total=total,
            page=offset // limit + 1,
            page_size=limit,
            has_more=(offset + limit) < total,
        )
        return FolderViewResponse(
            folder_item_id=normalized_folder_item_id,
            unfiled=folder_unassigned,
            desktop_children=desktop_children,
            files=files,
        )

    async def _load_desktop_item_by_item_id(self, config_id: UUID, item_id: str) -> DesktopItem | None:
        result = await self._db.execute(
            select(DesktopItem).where(
                DesktopItem.config_id == config_id,
                DesktopItem.item_id == item_id,
            )
        )
        return result.scalar_one_or_none()

    async def _load_direct_desktop_children(
        self,
        *,
        config_id: UUID,
        parent_pk: UUID | None,
        search: str | None,
    ) -> list[DesktopItem]:
        """Load only direct children of one parent (or desktop root when parent_pk is None)."""
        stmt = select(DesktopItem).where(DesktopItem.config_id == config_id)
        if parent_pk is None:
            stmt = stmt.where(DesktopItem.parent_id.is_(None))
        else:
            stmt = stmt.where(DesktopItem.parent_id == parent_pk)
        result = await self._db.execute(stmt)
        child_rows = list(result.scalars().all())
        if search:
            search_casefold = search.casefold()
            child_rows = [row for row in child_rows if search_casefold in str(row.name).casefold()]
        child_rows.sort(key=lambda row: (str(row.name).casefold(), str(row.item_id)))
        return child_rows


def _desktop_child_wire(row: DesktopItem, *, parent_item_id: str | None) -> FolderViewDesktopChild:
    return FolderViewDesktopChild(
        id=row.id,
        item_id=row.item_id,
        item_type=row.item_type,
        name=row.name,
        position=_normalized_position(row.position),
        color=row.color,
        gradient=row.gradient,
        is_pinned=bool(row.is_pinned),
        app_component=row.app_component,
        parent_id=row.parent_id,
        parent_item_id=parent_item_id if row.parent_id is not None else None,
        is_system=bool(getattr(row, "is_system", False)),
        system_key=getattr(row, "system_key", None),
        meta=getattr(row, "meta", None) if isinstance(getattr(row, "meta", None), dict) else {},
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _normalized_position(position: object) -> dict[str, int]:
    """Mirror DesktopItemResponse's safe wire position normalization."""
    if not isinstance(position, dict):
        return dict(_DEFAULT_POSITION)
    x = position.get("x")
    y = position.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return dict(_DEFAULT_POSITION)
    if int(x) < _DEFAULT_POSITION["x"] or int(y) < _DEFAULT_POSITION["y"]:
        return dict(_DEFAULT_POSITION)
    return {"x": int(x), "y": int(y)}
