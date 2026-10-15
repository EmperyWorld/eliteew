#!/usr/bin/env python3
"""
Command-side facade for Unified Content domain operations.
"""

from __future__ import annotations

from uuid import UUID

from api.schemas.unified_content import Content, ContentUpdate
from api.services.unified_content.content_storage_service import ContentStorageService


class ContentCommandService:
    """Mutating operations composed over ContentStorageService."""

    def __init__(self, storage: ContentStorageService):
        self._storage = storage

    async def update_content(
        self,
        *,
        content_id: UUID,
        user_id: str,
        updates: ContentUpdate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        return await self._storage.update_content(
            content_id=content_id,
            user_id=user_id,
            updates=updates,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def delete_content(
        self,
        *,
        content_id: UUID,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        allow_delete_as_platform_admin: bool = False,
    ) -> None:
        await self._storage.delete_content(
            content_id=content_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            allow_delete_as_platform_admin=allow_delete_as_platform_admin,
        )

    async def restore_content(
        self,
        *,
        content_id: UUID,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        return await self._storage.restore_content(
            content_id=content_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
