#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Query-side facade for Unified Content reads and catalogue search; keeps higher-level EWA/runtime callers decoupled from
# the storage service implementation while preserving authenticated access checks.
# Invariants:
# - Delegates permission-sensitive reads/searches to ``ContentStorageService``.
# - When ``project_id`` is set, ``assert_project_accessible`` runs before any project SQL filter (404/403, no list leak).
# - Additive parameters must keep legacy callers working with default metadata search.
# Related:
# - api/services/unified_content/content_storage_service.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# ---
"""
Query-side facade for Unified Content domain operations.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from api.core.project_scope_access import assert_project_accessible
from api.schemas.unified_content import Content, ContentType, Visibility
from api.services.unified_content.content_storage_service import ContentStorageService


class ContentQueryService:
    """Read-only/query operations composed over ContentStorageService."""

    def __init__(self, storage: ContentStorageService):
        self._storage = storage

    async def list_content(
        self,
        *,
        user_id: str,
        content_type: ContentType | None = None,
        mime_type: str | None = None,
        tags: list[str] | None = None,
        search_query: str | None = None,
        visibility: Visibility | None = None,
        company_id: UUID | None = None,
        project_id: UUID | None = None,
        folder_item_id: str | None = None,
        folder_unassigned: bool = False,
        exclude_folder_item_id: str | None = None,
        sort_field: str | None = None,
        sort_order: str | None = None,
        offset: int = 0,
        limit: int = 50,
        cursor: str | None = None,
        group_by_type: bool = False,
        source_service: str | None = None,
        alternate_user_id: str | None = None,
        owner_only: bool = False,
        list_profile: str = "full",
        search_scope: str = "metadata",
        min_file_size: int | None = None,
        processing_status: str | None = None,
    ) -> tuple[list[Content], int]:
        if project_id is not None:
            project_uuid = project_id if isinstance(project_id, UUID) else UUID(str(project_id))
            await assert_project_accessible(
                self._storage.db_pool,
                project_uuid,
                UUID(str(user_id).strip()),
            )
        return await self._storage.list_content(
            user_id=user_id,
            content_type=content_type,
            mime_type=mime_type,
            tags=tags,
            search_query=search_query,
            visibility=visibility,
            company_id=company_id,
            project_id=project_id,
            folder_item_id=folder_item_id,
            folder_unassigned=folder_unassigned,
            exclude_folder_item_id=exclude_folder_item_id,
            sort_field=sort_field,
            sort_order=sort_order,
            offset=offset,
            limit=limit,
            cursor=cursor,
            group_by_type=group_by_type,
            source_service=source_service,
            alternate_user_id=alternate_user_id,
            owner_only=owner_only,
            list_profile=list_profile,
            search_scope=search_scope,
            min_file_size=min_file_size,
            processing_status=processing_status,
        )

    async def list_content_multi_version(
        self,
        *,
        user_id: str,
        offset: int,
        limit: int,
        alternate_user_id: str | None = None,
    ) -> tuple[list[Content], int]:
        return await self._storage.list_content_multi_version(
            user_id=user_id,
            offset=offset,
            limit=limit,
            alternate_user_id=alternate_user_id,
        )

    async def get_content(self, content_id: UUID, user_id: str) -> Content:
        return await self._storage.get_content(content_id, user_id)

    async def get_content_list_item(
        self,
        content_id: UUID,
        user_id: str,
    ) -> dict[str, Any]:
        content = await self.get_content(content_id, user_id)
        return content.model_dump()

    async def count_indexed_body_corpus(
        self,
        *,
        user_id: str,
        alternate_user_id: str | None = None,
        visibility: Visibility | None = None,
        owner_only: bool = False,
    ) -> int:
        """Count accessible catalogue rows with non-empty ``extracted_text`` for body-search diagnostics."""

        return await self._storage.count_indexed_body_corpus(
            user_id=user_id,
            alternate_user_id=alternate_user_id,
            visibility=visibility,
            owner_only=owner_only,
        )
