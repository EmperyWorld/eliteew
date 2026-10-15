#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typing anchor for ContentStorageService mixins — declares host attributes and methods mixins delegate to.
# Invariants:
# - Not instantiated alone; ContentStorageService implements the full surface.
# Related:
# - api/services/unified_content/content_storage_{create,list,delete}.py
# - api/services/unified_content/content_storage_service.py
# ---
"""Mixin host typing surface for Unified Content storage modules."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.schemas.unified_content import Content, ContentUpdate
from api.services.unified_content.audit_logger import AuditLogger
from api.services.unified_content.storage_backends.factory import StorageBackendFactory


class ContentStorageMixinHost:
    """Declared host surface for storage mixins (implemented on ``ContentStorageService``)."""

    db_pool: asyncpg.Pool
    storage_factory: StorageBackendFactory
    audit_logger: AuditLogger
    search_service: Any | None

    @staticmethod
    def _normalize_search_scope(search_scope: str | None) -> str: ...

    @staticmethod
    def _metadata_search_match_sql(param_index: int) -> str: ...

    @staticmethod
    def _body_search_match_sql(param_index: int) -> str: ...

    @staticmethod
    def _body_search_degraded_match_sql(param_index: int) -> str: ...

    @staticmethod
    def _search_annotation_select_sql(param_index: int | None) -> str: ...

    async def _check_quota(self, user_id: str, additional_size: int) -> None: ...

    async def _check_mutual_friendship(
        self,
        conn: asyncpg.Connection,
        owner_user_id: UUID | str,
        requester_user_id: str,
    ) -> bool: ...

    async def _apply_row_delete_permissions(
        self,
        conn: asyncpg.Connection,
        row_dict: dict[str, Any],
        viewer_id: str,
        *,
        project_vault_active_cache: dict[UUID, bool] | None = None,
        shared_content_ids: set[UUID] | None = None,
        mutual_friend_owner_ids: set[str] | None = None,
    ) -> None: ...

    async def _apply_rows_delete_permissions(
        self,
        conn: asyncpg.Connection,
        row_dicts: list[dict[str, Any]],
        viewer_id: str,
        *,
        project_vault_active_cache: dict[UUID, bool] | None = None,
        shared_content_ids: set[UUID] | None = None,
        mutual_friend_owner_ids: set[str] | None = None,
    ) -> None: ...

    async def get_content(self, content_id: UUID, user_id: str, check_permissions: bool = True) -> Content: ...

    async def update_content(
        self,
        content_id: UUID,
        user_id: str,
        updates: ContentUpdate,
        *,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content: ...
