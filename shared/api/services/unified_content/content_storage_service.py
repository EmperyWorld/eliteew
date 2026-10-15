#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Core Unified Content storage facade: read/update/blocks/quota/admin; create/list/delete live in sibling mixins.
# ``replace_file_content`` supports optional ``expected_version`` optimistic locking (AIP Phase 1) and
# snapshots the previous body into ``content_versions`` before overwrite (non-destructive default).
# Invariants:
# - Access checks are built server-side from the authenticated user; callers cannot widen scope with request data.
# - Per-user storage quota resolves from ``CONTENT_USER_STORAGE_QUOTA_BYTES`` (default 10 GiB) via unified config.
# - List/page can_delete uses batch content_shares + friendship prefetch (no per-row SELECT loops).
# - When ``preserve_version=True`` (default) and file hash changes, ``VersionManager.create_version`` runs
#   **before** old SeaweedFS/BYTEA bytes are destroyed; snapshot failure aborts the replace.
# Related:
# - api/services/unified_content/content_storage_{create,list,delete,shared}.py
# - api/services/unified_content/version_manager.py
# - api/services/unified_content/content_acl_batch.py
# - api/services/unified_content/content_query_service.py
# ---
"""
Content Storage Service
Unified Content System - Phase 1 Week 2

Core CRUD operations with deduplication, quota enforcement, and permission checks.
"""

import json
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.core.project_scope_access import fetch_project_company_id
from api.schemas.unified_content import (
    AuditAction,
    Content,
    ContentType,
    ContentUpdate,
    ProcessingStatus,
    StorageBackendType,
)
from api.services.unified_content.audit_logger import AuditLogger
from api.services.unified_content.content_acl_batch import (
    prefetch_acl_sets_for_rows,
    viewer_can_remove_from_library_with_prefetch,
)
from api.services.unified_content.content_blocks import (
    ContentBlock,
    append_blocks,
    blocks_to_markdown,
    count_words_and_chars,
    load_blocks_from_row,
    parse_block_input,
    patch_block,
    remove_block,
    serialize_content_payload,
)
from api.services.unified_content.content_storage_create import ContentStorageCreateMixin
from api.services.unified_content.content_storage_delete import ContentStorageDeleteMixin
from api.services.unified_content.content_storage_integrity_ops import ContentStorageIntegrityOpsMixin
from api.services.unified_content.content_storage_list import ContentStorageListMixin
from api.services.unified_content.content_storage_shared import (
    LIBRARY_REMOVAL_FILTER_SQL,
    LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE,
    ContentVersionConflictError,
    extracted_text_from_file_data,
    normalize_row_mime,
    resolve_dedup_folder_relocation,
    resolve_upload_folder_item_id,
    storage_backend_name_for_factory,
    upload_requests_folder_placement,
    verify_storage_object_after_write,
)
from api.services.unified_content.storage_backends.factory import StorageBackendFactory
from api.services.unified_content.storage_backends.minio_storage import (
    SeaweedFileCorruptedError,
    SeaweedFileNotFoundError,
)
from api.utils.content_search_scope_sql import (
    body_search_degraded_match_sql,
    body_search_match_sql,
    metadata_search_match_sql,
    normalize_search_scope,
    search_annotation_select_sql,
)
from api.utils.project_vault_lifecycle import resolve_owner_can_edit

logger = logging.getLogger(__name__)

_DEFAULT_CONTENT_USER_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024


def get_content_user_storage_quota_bytes() -> int:
    """Per-user unified content storage quota from unified config (env-backed)."""
    from api.core.unified_config import unified_settings

    return int(unified_settings.content_user_storage_quota_bytes)


class _ContentUserQuotaBytes:
    """Descriptor so ``ContentStorageService.USER_QUOTA_BYTES`` tracks config/env."""

    def __get__(self, _obj: object | None, _objtype: type | None = None) -> int:
        return get_content_user_storage_quota_bytes()

    def __repr__(self) -> str:
        return f"<ContentUserQuotaBytes default={_DEFAULT_CONTENT_USER_STORAGE_QUOTA_BYTES}>"


class ContentStorageService(
    ContentStorageCreateMixin,
    ContentStorageListMixin,
    ContentStorageDeleteMixin,
    ContentStorageIntegrityOpsMixin,
):
    """
    Core content storage service with:
    - SHA256 deduplication
    - Quota enforcement (default 10 GiB per user; env ``CONTENT_USER_STORAGE_QUOTA_BYTES``)
    - Permission-based access control
    - Soft delete with restore
    - Audit logging for all operations
    """

    USER_QUOTA_BYTES = _ContentUserQuotaBytes()

    # Avatars use unified_content with source_service=user_profile and visibility=public.
    # Without this predicate, "OR visibility = 'public'" pulls every user's avatar into everyone else's library.
    _LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE = LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE

    _LIBRARY_REMOVAL_FILTER_SQL = LIBRARY_REMOVAL_FILTER_SQL

    @staticmethod
    def _normalize_search_scope(search_scope: str | None) -> str:
        return normalize_search_scope(search_scope)

    @staticmethod
    def _metadata_search_match_sql(param_index: int) -> str:
        return metadata_search_match_sql(param_index)

    @staticmethod
    def _body_search_match_sql(param_index: int) -> str:
        return body_search_match_sql(param_index)

    @staticmethod
    def _body_search_degraded_match_sql(param_index: int) -> str:
        return body_search_degraded_match_sql(param_index)

    @staticmethod
    def _search_annotation_select_sql(param_index: int | None) -> str:
        return search_annotation_select_sql(param_index)

    def __init__(
        self,
        db_pool: asyncpg.Pool,
        storage_factory: StorageBackendFactory,
        audit_logger: AuditLogger,
        search_service: Any | None = None,  # ContentSearchService (optional to avoid circular import)
    ):
        self.db_pool = db_pool
        self.storage_factory = storage_factory
        self.audit_logger = audit_logger
        self.search_service = search_service

    async def _check_mutual_friendship(
        self,
        conn: asyncpg.Connection,
        owner_user_id: UUID | str,
        requester_user_id: str,
    ) -> bool:
        """Safely check friendship using database user UUIDs."""
        try:
            owner_uuid = UUID(str(owner_user_id).strip())
            requester_uuid = UUID(str(requester_user_id).strip())
        except (TypeError, ValueError):  # fmt: skip
            return False

        is_mutual = await conn.fetchval(
            "SELECT check_mutual_friendship($1::uuid, $2::uuid)",
            str(owner_uuid),
            str(requester_uuid),
        )
        return bool(is_mutual)

    async def _viewer_can_remove_from_library(
        self,
        conn: asyncpg.Connection,
        row: asyncpg.Record | dict[str, Any],
        viewer_id: str,
    ) -> bool:
        """True when viewer may hide shared/friend content or soft-delete own content."""
        shared_ids, friend_ids = await prefetch_acl_sets_for_rows(conn, [row], viewer_id)
        return viewer_can_remove_from_library_with_prefetch(
            row,
            viewer_id,
            shared_content_ids=shared_ids,
            mutual_friend_owner_ids=friend_ids,
        )

    async def _apply_row_delete_permissions(
        self,
        conn: asyncpg.Connection,
        row_dict: dict[str, Any],
        viewer_id: str,
        *,
        project_vault_active_cache: dict[UUID, bool] | None = None,
        shared_content_ids: set[UUID] | None = None,
        mutual_friend_owner_ids: set[str] | None = None,
    ) -> None:
        row_dict["is_owner"] = str(row_dict.get("user_id")) == str(viewer_id)
        row_dict["can_edit"] = await resolve_owner_can_edit(
            conn,
            owner_user_id=row_dict.get("user_id"),
            viewer_user_id=viewer_id,
            project_id=row_dict.get("project_id"),
            project_vault_active_cache=project_vault_active_cache,
        )
        if shared_content_ids is not None and mutual_friend_owner_ids is not None:
            row_dict["can_delete"] = viewer_can_remove_from_library_with_prefetch(
                row_dict,
                viewer_id,
                shared_content_ids=shared_content_ids,
                mutual_friend_owner_ids=mutual_friend_owner_ids,
            )
        else:
            row_dict["can_delete"] = await self._viewer_can_remove_from_library(conn, row_dict, viewer_id)

    async def _apply_rows_delete_permissions(
        self,
        conn: asyncpg.Connection,
        row_dicts: list[dict[str, Any]],
        viewer_id: str,
        *,
        project_vault_active_cache: dict[UUID, bool] | None = None,
        shared_content_ids: set[UUID] | None = None,
        mutual_friend_owner_ids: set[str] | None = None,
    ) -> None:
        """Batch can_delete/can_edit for a page of rows (one shares query + one friendship query)."""
        if not row_dicts:
            return
        vault_cache = project_vault_active_cache if project_vault_active_cache is not None else {}
        if shared_content_ids is None or mutual_friend_owner_ids is None:
            shared_ids, friend_ids = await prefetch_acl_sets_for_rows(conn, row_dicts, viewer_id)
        else:
            shared_ids, friend_ids = shared_content_ids, mutual_friend_owner_ids
        for row_dict in row_dicts:
            await self._apply_row_delete_permissions(
                conn,
                row_dict,
                viewer_id,
                project_vault_active_cache=vault_cache,
                shared_content_ids=shared_ids,
                mutual_friend_owner_ids=friend_ids,
            )

    async def set_content_friend_shared_user_ids(
        self,
        content_id: UUID,
        owner_user_id: str,
        candidate_ids: list[str],
    ) -> None:
        """Persist shared_with_user_ids after upload when friend_visibility + explicit subset."""
        async with self.db_pool.acquire() as conn:
            validated = await self._validate_friend_shared_user_ids(conn, owner_user_id, candidate_ids)
            await conn.execute(
                """
                UPDATE unified_content
                SET shared_with_user_ids = $1::uuid[]
                WHERE id = $2 AND (user_id)::text = $3 AND deleted_at IS NULL
                """,
                validated,
                content_id,
                str(owner_user_id).strip(),
            )

    async def _validate_friend_shared_user_ids(
        self,
        conn: asyncpg.Connection,
        owner_user_id: str,
        candidate_ids: list[str],
    ) -> list[str]:
        """Keep only UUIDs that are mutual friends with owner; de-dupe."""
        seen: set[str] = set()
        out: list[str] = []
        owner_s = str(owner_user_id).strip()
        for raw in candidate_ids:
            try:
                uid = str(UUID(str(raw).strip()))
            except (TypeError, ValueError):  # fmt: skip
                msg = f"Invalid user id in shared_with_user_ids: {raw!r}"
                raise ValueError(msg) from None
            if uid in seen:
                continue
            seen.add(uid)
            if not await self._check_mutual_friendship(conn, owner_s, uid):
                msg = f"User is not a mutual friend: {uid}"
                raise ValueError(msg)
            out.append(uid)
        return out

    async def get_content(self, content_id: UUID, user_id: str, check_permissions: bool = True) -> Content:
        """
        Get content by ID with permission check

        Args:
            content_id: Content UUID
            user_id: User ID (from auth)
            check_permissions: Whether to check access permissions

        Returns:
            Content object

        Raises:
            PermissionError: If user lacks access
            ValueError: If content not found
        """
        async with self.db_pool.acquire() as conn:
            # PERFORMANCE: Select only needed columns instead of SELECT *
            row = await conn.fetchrow(
                """
                SELECT id, name, title, content_type, file_size, mime_type,
                       thumbnail_path, tags, created_at, updated_at,
                       processing_status, visibility, user_id,
                       original_filename, description, metadata,
                       storage_backend, file_path, shared_with_user_ids,
                       file_hash, version, is_public,
                       company_id, project_id, friend_visibility,
                       folder_item_id, extracted_text,
                       sub_type, source_service, source_id, related_content,
                       word_count, character_count, storage_integrity_status
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )

            if not row:
                msg = f"Content {content_id} not found"
                raise ValueError(msg)

            is_owner = str(row["user_id"]) == str(user_id)
            if row.get("storage_integrity_status") == "broken_quarantined" and not is_owner:
                msg = f"Content {content_id} not found"
                raise ValueError(msg)

            # Check permissions (Plan 3: Content Manager Expansion - includes friend_visibility)
            if check_permissions:
                has_access = (
                    is_owner  # Owner
                    or row["visibility"] == "public"  # Public content
                    or user_id in (row["shared_with_user_ids"] or [])  # Shared with user (legacy)
                )

                if not has_access:
                    # Check explicit shares table
                    share = await conn.fetchrow(
                        """
                        SELECT * FROM content_shares
                        WHERE content_id = $1 AND shared_with_user_id = $2
                        AND (expires_at IS NULL OR expires_at > NOW())
                        """,
                        content_id,
                        user_id,
                    )
                    if share:
                        has_access = True

                    # friend_visibility on shared: all mutual friends if shared_with_user_ids empty;
                    # otherwise only listed friends (must still be mutual).
                    if (
                        not has_access
                        and row["friend_visibility"]
                        and await self._check_mutual_friendship(conn, row["user_id"], user_id)
                    ):
                        allowed = row["shared_with_user_ids"] or []
                        if not allowed or str(user_id) in {str(x) for x in allowed}:
                            has_access = True

                    # Visibility "friends": allow owner or mutual friends
                    if (
                        not has_access
                        and row["visibility"] == "friends"
                        and await self._check_mutual_friendship(conn, row["user_id"], user_id)
                    ):
                        has_access = True

                    if not has_access:
                        msg = f"Access denied to content {content_id}"
                        raise PermissionError(msg)

            # Convert JSONB fields from string to dict if needed
            row_dict = dict(row)
            if isinstance(row_dict.get("metadata"), str):
                row_dict["metadata"] = json.loads(row_dict["metadata"])
            normalize_row_mime(row_dict)
            row_dict["is_owner"] = str(row["user_id"]) == str(user_id)
            row_dict["can_edit"] = await resolve_owner_can_edit(
                conn,
                owner_user_id=row["user_id"],
                viewer_user_id=user_id,
                project_id=row.get("project_id"),
            )
            row_dict["can_delete"] = await self._viewer_can_remove_from_library(
                conn,
                row,
                user_id,
            )

            return Content(**row_dict)

    async def read_file_bytes_for_owner(
        self,
        content_id: UUID,
        owner_user_id: str,
    ) -> tuple[bytes, dict[str, Any]]:
        """
        Load raw file bytes for internal flows (e.g. GAF Chat «accept file» copy).
        Verifies ``unified_content.user_id`` matches ``owner_user_id``.
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, user_id, name, mime_type, original_filename, content_type,
                       storage_backend, file_path, file_size
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
        if not row:
            msg = f"Content {content_id} not found"
            raise ValueError(msg)
        if str(row["user_id"]) != str(owner_user_id):
            raise PermissionError(f"Access denied to content {content_id}")
        sb_raw = row["storage_backend"]
        if sb_raw is None:
            msg = "Storage backend not set"
            raise ValueError(msg)
        backend_name = sb_raw.value if hasattr(sb_raw, "value") else str(sb_raw)
        backend = self.storage_factory.get_backend_by_name(backend_name)
        try:
            file_data = await backend.retrieve(row["file_path"] or "", content_id)
        except (SeaweedFileNotFoundError, SeaweedFileCorruptedError) as e:
            msg = "File data empty or missing in storage"
            raise ValueError(msg) from e
        if not file_data:
            msg = "File data empty or missing in storage"
            raise ValueError(msg)
        meta = {
            "name": row["name"],
            "mime_type": row["mime_type"],
            "original_filename": row["original_filename"],
            "content_type": row["content_type"],
            "file_size": row["file_size"],
        }
        return file_data, meta

    async def update_content(
        self,
        content_id: UUID,
        user_id: str,
        updates: ContentUpdate,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        """
        Update content metadata

        Args:
            content_id: Content UUID
            user_id: User ID (from auth)
            updates: Fields to update
            ip_address: Client IP for audit
            user_agent: Client user agent for audit

        Returns:
            Updated Content object

        Raises:
            PermissionError: If user lacks edit access
            ValueError: If content not found
        """
        # Check permissions (must be owner or have edit permission)
        content = await self.get_content(content_id, user_id)
        prev_project_id = content.project_id
        previous_tags_normalized = {str(tag).strip().lower() for tag in (content.tags or []) if str(tag).strip()}

        if content.user_id != user_id:
            msg = "Only owner can update content"
            raise PermissionError(msg)

        # Build update query
        update_fields = []
        params: list[Any] = []
        param_count = 0

        if updates.name is not None:
            param_count += 1
            update_fields.append(f"name = ${param_count}")
            params.append(updates.name)

        if updates.description is not None:
            param_count += 1
            update_fields.append(f"description = ${param_count}")
            params.append(updates.description)

        if updates.tags is not None:
            param_count += 1
            update_fields.append(f"tags = ${param_count}")
            params.append(updates.tags)

        if updates.visibility is not None:
            param_count += 1
            update_fields.append(f"visibility = ${param_count}")
            params.append(updates.visibility.value)

        if updates.metadata is not None:
            param_count += 1
            update_fields.append(f"metadata = ${param_count}::jsonb")
            params.append(json.dumps(updates.metadata))

        if updates.sub_type is not None:
            param_count += 1
            update_fields.append(f"sub_type = ${param_count}")
            params.append(updates.sub_type)

        if updates.source_service is not None:
            param_count += 1
            update_fields.append(f"source_service = ${param_count}")
            params.append(updates.source_service)

        if updates.source_id is not None:
            param_count += 1
            update_fields.append(f"source_id = ${param_count}")
            params.append(updates.source_id)

        if updates.extracted_text is not None:
            param_count += 1
            update_fields.append(f"extracted_text = ${param_count}")
            params.append(updates.extracted_text)

        if updates.word_count is not None:
            param_count += 1
            update_fields.append(f"word_count = ${param_count}")
            params.append(updates.word_count)

        if updates.character_count is not None:
            param_count += 1
            update_fields.append(f"character_count = ${param_count}")
            params.append(updates.character_count)

        patch_keys = updates.model_fields_set
        if "folder_item_id" in patch_keys:
            if updates.folder_item_id is not None:
                param_count += 1
                update_fields.append(f"folder_item_id = ${param_count}")
                params.append(updates.folder_item_id)
            else:
                update_fields.append("folder_item_id = NULL")

        if "friend_visibility" in patch_keys and updates.friend_visibility is not None:
            param_count += 1
            update_fields.append(f"friend_visibility = ${param_count}")
            params.append(updates.friend_visibility)

        if "shared_with_user_ids" in patch_keys:
            async with self.db_pool.acquire() as conn:
                if updates.shared_with_user_ids is None:
                    update_fields.append("shared_with_user_ids = NULL")
                elif len(updates.shared_with_user_ids) == 0:
                    update_fields.append("shared_with_user_ids = ARRAY[]::uuid[]")
                else:
                    validated = await self._validate_friend_shared_user_ids(conn, user_id, updates.shared_with_user_ids)
                    param_count += 1
                    update_fields.append(f"shared_with_user_ids = ${param_count}::uuid[]")
                    params.append(validated)

        # Маркетинговый кабинет / классификация: company_id, project_id
        if "company_id" in patch_keys and updates.company_id is None:
            update_fields.append("company_id = NULL")
            update_fields.append("project_id = NULL")
        elif "company_id" in patch_keys and updates.company_id is not None:
            param_count += 1
            update_fields.append(f"company_id = ${param_count}::uuid")
            params.append(updates.company_id)
            if "project_id" not in patch_keys or updates.project_id is None:
                update_fields.append("project_id = NULL")
            else:
                param_count += 1
                update_fields.append(f"project_id = ${param_count}::uuid")
                params.append(updates.project_id)
        elif "project_id" in patch_keys:
            if updates.project_id is None:
                update_fields.append("project_id = NULL")
            else:
                pc = await fetch_project_company_id(self.db_pool, updates.project_id)
                if pc is None:
                    msg = "Project not found"
                    raise ValueError(msg)
                param_count += 1
                update_fields.append(f"project_id = ${param_count}::uuid")
                params.append(updates.project_id)
                param_count += 1
                update_fields.append(f"company_id = ${param_count}::uuid")
                params.append(pc)

        if not update_fields:
            return content  # Nothing to update

        # Add updated_by and updated_at
        param_count += 1
        update_fields.append(f"updated_by = ${param_count}")
        params.append(user_id)
        update_fields.append("updated_at = NOW()")

        # Add content_id for WHERE clause
        param_count += 1
        params.append(content_id)

        async with self.db_pool.acquire() as conn:
            # Note: update_fields is built from hardcoded field names, params are passed separately
            await conn.execute(
                f"""
                UPDATE unified_content
                SET {", ".join(update_fields)}
                WHERE id = ${param_count}
                """,  # noqa: S608
                *params,
            )

            # Update tag usage if tags changed
            if updates.tags is not None:
                next_tags_normalized = {str(tag).strip().lower() for tag in updates.tags if str(tag).strip()}
                tags_to_increment = next_tags_normalized - previous_tags_normalized
                tags_to_decrement = previous_tags_normalized - next_tags_normalized
                for tag in tags_to_increment:
                    await conn.execute(
                        "SELECT increment_tag_usage($1::uuid, $2)",
                        user_id,
                        tag,
                    )
                for tag in tags_to_decrement:
                    await conn.execute(
                        "SELECT decrement_tag_usage($1::uuid, $2)",
                        user_id,
                        tag,
                    )

        # Audit log
        await self.audit_logger.log(
            content_id=content_id,
            user_id=user_id,
            action=AuditAction.UPDATED,
            details={"updated_fields": list(updates.model_dump(exclude_unset=True).keys())},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Re-index to Elasticsearch (async, non-blocking)
        if self.search_service:
            try:
                await self.search_service.update_index(content_id)
                logger.info("Content re-indexed to Elasticsearch: %s", content_id)
            except Exception:
                logger.exception("Failed to re-index content %s", content_id)
                # Don't fail update if re-indexing fails

        updated = await self.get_content(content_id, user_id)
        try:
            from api.services.marketing_project_rag_service import (
                delete_marketing_rag_chunks_for_content,
                index_unified_content_marketing_rag,
            )

            new_pid = updated.project_id
            if prev_project_id is not None and new_pid != prev_project_id:
                await delete_marketing_rag_chunks_for_content(prev_project_id, content_id)
            if new_pid is not None:
                await index_unified_content_marketing_rag(self.db_pool, content_id)
        except Exception:
            logger.exception("Marketing RAG sync after update failed for %s", content_id)

        try:
            from api.services.unified_content.unified_content_qdrant_service import index_unified_content_qdrant

            await index_unified_content_qdrant(self.db_pool, content_id)
        except Exception:
            logger.exception("Unified content Qdrant sync after update failed for %s", content_id)

        return updated

    async def reconcile_tag_usage_counts(self, user_id: str) -> int:
        """
        Rebuild per-user tag counters from unified_content source of truth.
        """
        async with self.db_pool.acquire() as conn, conn.transaction():
            await conn.execute(
                "DELETE FROM content_tags WHERE user_id = $1::uuid",
                user_id,
            )
            rows = await conn.fetch(
                """
                SELECT LOWER(tag) AS tag, COUNT(*)::int AS usage_count
                FROM unified_content,
                     UNNEST(COALESCE(tags, ARRAY[]::text[])) AS tag
                WHERE user_id = $1::uuid
                  AND deleted_at IS NULL
                  AND COALESCE(tag, '') <> ''
                GROUP BY LOWER(tag)
                """,
                user_id,
            )
            if rows:
                await conn.executemany(
                    """
                    INSERT INTO content_tags (user_id, tag, usage_count, created_at, updated_at)
                    VALUES ($1::uuid, $2, $3, NOW(), NOW())
                    """,
                    [(user_id, row["tag"], row["usage_count"]) for row in rows],
                )
            return len(rows)

    async def replace_file_content(
        self,
        content_id: UUID,
        user_id: str,
        file_data: bytes,
        *,
        original_filename: str | None = None,
        mime_type: str | None = None,
        expected_version: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        preserve_version: bool = True,
        change_description: str | None = None,
    ) -> Content:
        """
        Replace binary file data for an existing content row (same id).

        Handles PostgreSQL BYTEA vs SeaweedFS the same way as create_content,
        including switching backends when the new size crosses the threshold.

        When ``expected_version`` is set, the UPDATE is conditional on the current
        ``unified_content.version`` (optimistic lock — AIP Phase 1).

        When ``preserve_version`` is True (default) and the new file hash differs,
        a full snapshot of the **current** body is written to ``content_versions``
        **before** old storage objects are deleted.
        """
        content = await self.get_content(content_id, user_id)
        if str(content.user_id) != str(user_id):
            msg = "Only owner can replace file data"
            raise PermissionError(msg)

        current_version = int(content.version or 0)
        if expected_version is not None and expected_version != current_version:
            raise ContentVersionConflictError(
                expected_version=expected_version,
                current_version=current_version,
                content_id=content_id,
            )

        old_size = int(content.file_size or 0)
        new_size = len(file_data)
        await self._check_quota(user_id, new_size - old_size)
        file_hash = self._calculate_hash(file_data)

        if preserve_version:
            from api.services.unified_content.version_manager import VersionManager

            version_manager = VersionManager(self.db_pool, self.storage_factory)
            if await version_manager.should_create_version(content_id, file_hash):
                snapshot_id = await version_manager.create_version(
                    content_id=content_id,
                    user_id=user_id,
                    change_description=change_description or "Previous body snapshot before file replace",
                )
                logger.info(
                    "[STEP] replace_file_content_version_snapshot content_id=%s version_id=%s",
                    content_id,
                    snapshot_id,
                )

        ctype_val = content.content_type.value if hasattr(content.content_type, "value") else str(content.content_type)
        backend = self.storage_factory.get_backend(new_size, ctype_val)

        old_sb_name = storage_backend_name_for_factory(content.storage_backend)
        old_path = (content.file_path or "").strip() or None
        filename = (original_filename or content.original_filename or "document.html").strip() or "document.html"
        mime_resolved = (mime_type or content.mime_type or "application/octet-stream").strip()
        extracted_text = extracted_text_from_file_data(file_data, mime_resolved)
        word_count = len(extracted_text.split()) if extracted_text else None
        character_count = len(extracted_text) if extracted_text is not None else None

        async def _raise_version_conflict(conn: asyncpg.Connection) -> None:
            row = await conn.fetchrow(
                "SELECT version FROM unified_content WHERE id = $1 AND deleted_at IS NULL",
                content_id,
            )
            fresh_version = int(row["version"] or 0) if row else current_version
            raise ContentVersionConflictError(
                expected_version=int(expected_version or 0),
                current_version=fresh_version,
                content_id=content_id,
            )

        async def _apply_row_metadata_update(
            conn: asyncpg.Connection,
            *,
            leading_fields: list[tuple[str, Any]],
        ) -> None:
            set_parts: list[str] = []
            params: list[Any] = []
            for field_name, value in leading_fields:
                set_parts.append(f"{field_name} = ${len(params) + 1}")
                params.append(value)
            set_parts.extend(
                [
                    f"file_size = ${len(params) + 1}",
                    f"file_hash = ${len(params) + 2}",
                    f"mime_type = ${len(params) + 3}",
                    f"original_filename = ${len(params) + 4}",
                    "updated_at = NOW()",
                    f"updated_by = ${len(params) + 5}",
                    f"processing_status = ${len(params) + 6}",
                ]
            )
            params.extend(
                [
                    new_size,
                    file_hash,
                    mime_resolved,
                    filename,
                    user_id,
                    ProcessingStatus.PENDING.value,
                ]
            )
            if extracted_text is not None:
                set_parts.append(f"extracted_text = ${len(params) + 1}")
                params.append(extracted_text)
                set_parts.append(f"word_count = ${len(params) + 1}")
                params.append(word_count)
                set_parts.append(f"character_count = ${len(params) + 1}")
                params.append(character_count)
            params.append(content_id)
            where_sql = f"WHERE id = ${len(params)}"
            if expected_version is not None:
                params.append(expected_version)
                where_sql += f" AND version = ${len(params)}"
            status = await conn.execute(
                f"UPDATE unified_content SET {', '.join(set_parts)} {where_sql}",  # noqa: S608
                *params,
            )
            if expected_version is not None and status != "UPDATE 1":
                await _raise_version_conflict(conn)

        async with self.db_pool.acquire() as conn, conn.transaction():
            if old_path and old_sb_name not in ("postgresql",):
                try:
                    old_be = self.storage_factory.get_backend_by_name(old_sb_name)
                    await old_be.delete(old_path, content_id)
                except Exception:
                    logger.warning(
                        "replace_file_content: failed to delete previous object (continuing): content_id=%s",
                        content_id,
                        exc_info=True,
                    )

            if backend.get_backend_name() == "postgresql":
                await backend.store(  # type: ignore[call-overload]
                    content_id,
                    file_data,
                    filename,
                    mime_resolved,
                    conn=conn,  # type: ignore[arg-type]
                )
                await _apply_row_metadata_update(conn, leading_fields=[])
            else:
                await conn.execute(
                    "UPDATE unified_content SET file_data = NULL WHERE id = $1",
                    content_id,
                )
                storage_path = await backend.store(  # type: ignore[call-overload]
                    content_id,
                    file_data,
                    filename,
                    mime_resolved,
                    conn=conn,  # type: ignore[arg-type]
                )
                sb_name = backend.get_backend_name()
                await _apply_row_metadata_update(
                    conn,
                    leading_fields=[
                        ("file_path", storage_path),
                        ("storage_backend", sb_name),
                    ],
                )
                if storage_path:
                    try:
                        await verify_storage_object_after_write(backend, storage_path, content_id)
                    except RuntimeError as exc:
                        raise RuntimeError(str(exc)) from exc
                    except Exception as exc:
                        msg = f"Post-replace storage verification failed: {exc!s}"
                        raise RuntimeError(msg) from exc

        await self.audit_logger.log(
            content_id=content_id,
            user_id=user_id,
            action=AuditAction.FILE_REPLACED,
            details={"file_size": new_size, "storage_backend": backend.get_backend_name()},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        if self.search_service:
            try:
                await self.search_service.update_index(content_id)
                logger.info("Content re-indexed after file replace: %s", content_id)
            except Exception:
                logger.exception("Failed to re-index content %s after replace", content_id)

        updated = await self.get_content(content_id, user_id)
        try:
            from api.services.marketing_project_rag_service import index_unified_content_marketing_rag

            if updated.project_id is not None:
                await index_unified_content_marketing_rag(self.db_pool, content_id)
        except Exception:
            logger.exception("Marketing RAG sync after replace failed for %s", content_id)

        return updated

    async def append_to_content(
        self,
        content_id: UUID,
        user_id: str,
        new_blocks: list[dict[str, Any]],
        *,
        expected_version: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        """Append attributable blocks without rewriting unrelated fragments (AIP Phase 2)."""
        incoming = [parse_block_input(item) for item in new_blocks if isinstance(item, dict)]

        def _mutate(existing: list[ContentBlock]) -> list[ContentBlock]:
            return append_blocks(existing, incoming)

        return await self._mutate_content_blocks(
            content_id,
            user_id,
            expected_version=expected_version,
            mutate=_mutate,
            audit_action=AuditAction.FILE_REPLACED,
            audit_details={"aip_op": "append", "block_count": len(incoming)},
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def patch_content_block(
        self,
        content_id: UUID,
        user_id: str,
        block_id: UUID,
        new_data: dict[str, Any],
        *,
        expected_version: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        """Patch one block by id with optimistic document version check."""

        def _mutate(existing: list[ContentBlock]) -> list[ContentBlock]:
            return patch_block(existing, block_id, new_data)

        return await self._mutate_content_blocks(
            content_id,
            user_id,
            expected_version=expected_version,
            mutate=_mutate,
            audit_action=AuditAction.FILE_REPLACED,
            audit_details={"aip_op": "patch", "block_id": str(block_id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def remove_content_block(
        self,
        content_id: UUID,
        user_id: str,
        block_id: UUID,
        *,
        expected_version: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        """Remove one block by id with optimistic document version check."""

        def _mutate(existing: list[ContentBlock]) -> list[ContentBlock]:
            return remove_block(existing, block_id)

        return await self._mutate_content_blocks(
            content_id,
            user_id,
            expected_version=expected_version,
            mutate=_mutate,
            audit_action=AuditAction.FILE_REPLACED,
            audit_details={"aip_op": "remove", "block_id": str(block_id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def _mutate_content_blocks(
        self,
        content_id: UUID,
        user_id: str,
        *,
        expected_version: int,
        mutate: Callable[[list[ContentBlock]], list[ContentBlock]],
        audit_action: AuditAction,
        audit_details: dict[str, Any],
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        content = await self.get_content(content_id, user_id)
        if str(content.user_id) != str(user_id):
            msg = "Only owner can mutate content blocks"
            raise PermissionError(msg)

        current_version = int(content.version or 0)
        if expected_version != current_version:
            raise ContentVersionConflictError(
                expected_version=expected_version,
                current_version=current_version,
                content_id=content_id,
            )

        async def _raise_version_conflict(conn: asyncpg.Connection) -> None:
            row = await conn.fetchrow(
                "SELECT version FROM unified_content WHERE id = $1 AND deleted_at IS NULL",
                content_id,
            )
            fresh_version = int(row["version"] or 0) if row else current_version
            raise ContentVersionConflictError(
                expected_version=expected_version,
                current_version=fresh_version,
                content_id=content_id,
            )

        async with self.db_pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT content_payload, version, extracted_text, mime_type, original_filename,
                       storage_backend, file_path, file_size
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                FOR UPDATE
                """,
                content_id,
            )
            if not row:
                msg = f"Content {content_id} not found"
                raise ValueError(msg)
            row_version = int(row["version"] or 0)
            if row_version != expected_version:
                await _raise_version_conflict(conn)

            existing = load_blocks_from_row(row.get("content_payload"), row.get("extracted_text"))
            updated_blocks = mutate(existing)
            payload = serialize_content_payload(updated_blocks)
            stitched = blocks_to_markdown(updated_blocks)
            word_count, character_count = count_words_and_chars(stitched)
            mime_resolved = (row.get("mime_type") or "text/markdown").strip() or "text/markdown"
            filename = (row.get("original_filename") or "document.md").strip() or "document.md"
            file_data = stitched.encode("utf-8")
            file_hash = self._calculate_hash(file_data)
            new_size = len(file_data)

            status = await conn.execute(
                """
                UPDATE unified_content
                SET content_payload = $1::jsonb,
                    extracted_text = $2,
                    word_count = $3,
                    character_count = $4,
                    file_size = $5,
                    file_hash = $6,
                    updated_at = NOW(),
                    updated_by = $7,
                    processing_status = $8
                WHERE id = $9 AND version = $10
                """,
                json.dumps(payload),
                stitched,
                word_count,
                character_count,
                new_size,
                file_hash,
                user_id,
                ProcessingStatus.PENDING.value,
                content_id,
                expected_version,
            )
            if status != "UPDATE 1":
                await _raise_version_conflict(conn)

            await self._sync_text_bytes_in_transaction(
                conn,
                content_id=content_id,
                row=row,
                file_data=file_data,
                filename=filename,
                mime_resolved=mime_resolved,
                new_size=new_size,
                file_hash=file_hash,
                user_id=user_id,
            )

        await self.audit_logger.log(
            content_id=content_id,
            user_id=user_id,
            action=audit_action,
            details=audit_details,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        if self.search_service:
            try:
                await self.search_service.update_index(content_id)
            except Exception:
                logger.exception("Failed to re-index content %s after block mutation", content_id)

        return await self.get_content(content_id, user_id)

    async def _sync_text_bytes_in_transaction(
        self,
        conn: asyncpg.Connection,
        *,
        content_id: UUID,
        row: asyncpg.Record,
        file_data: bytes,
        filename: str,
        mime_resolved: str,
        new_size: int,
        file_hash: str,
        user_id: str,
    ) -> None:
        """Keep binary storage aligned with stitched block markdown inside an open transaction."""
        sb_raw = row.get("storage_backend")
        old_sb_name = storage_backend_name_for_factory(sb_raw if isinstance(sb_raw, StorageBackendType) else None)
        if not old_sb_name and sb_raw:
            old_sb_name = str(sb_raw).strip().lower() or "postgresql"
        backend = self.storage_factory.get_backend(new_size, ContentType.DOCUMENT.value)
        old_path = (row.get("file_path") or "").strip() or None
        if old_path and old_sb_name not in ("postgresql",):
            try:
                old_be = self.storage_factory.get_backend_by_name(old_sb_name)
                await old_be.delete(old_path, content_id)
            except Exception:
                logger.warning(
                    "block_sync: failed to delete previous object (continuing): content_id=%s",
                    content_id,
                    exc_info=True,
                )
        if backend.get_backend_name() == "postgresql":
            await backend.store(  # type: ignore[call-overload]
                content_id,
                file_data,
                filename,
                mime_resolved,
                conn=conn,  # type: ignore[arg-type]
            )
            return
        await conn.execute(
            "UPDATE unified_content SET file_data = NULL WHERE id = $1",
            content_id,
        )
        storage_path = await backend.store(  # type: ignore[call-overload]
            content_id,
            file_data,
            filename,
            mime_resolved,
            conn=conn,  # type: ignore[arg-type]
        )
        await conn.execute(
            """
            UPDATE unified_content
            SET file_path = $1,
                storage_backend = $2
            WHERE id = $3
            """,
            storage_path,
            backend.get_backend_name(),
            content_id,
        )

    async def _check_quota(self, user_id: str, additional_size: int) -> None:
        """
        Check if user has quota for additional content

        Args:
            user_id: User ID
            additional_size: Size of content to add (bytes)

        Raises:
            ValueError: If quota would be exceeded
        """
        async with self.db_pool.acquire() as conn:
            total_size = await conn.fetchval(
                """
                SELECT COALESCE(SUM(file_size), 0)
                FROM unified_content
                WHERE (user_id)::text = $1 AND deleted_at IS NULL
                """,
                user_id,
            )

            if total_size + additional_size > self.USER_QUOTA_BYTES:
                used_gb = total_size / (1024**3)
                quota_gb = self.USER_QUOTA_BYTES / (1024**3)
                msg = (
                    f"Quota exceeded: {used_gb:.2f}GB / {quota_gb:.0f}GB used. "
                    f"Cannot add {additional_size / (1024**2):.2f}MB"
                )
                raise ValueError(msg)

    async def _admin_quarantine_blob_missing(
        self,
        content_id: UUID,
        operator_user_id: str,
    ) -> str | None:
        """
        Soft-delete content row: blob missing in object storage (admin/maintenance).
        Returns owner user_id for cache invalidation, or None if row already gone.
        """
        meta_patch = json.dumps(
            {
                "storage_quarantine": {
                    "reason": "blob_missing",
                    "quarantined_at": datetime.now(UTC).isoformat(),
                    "operator_id": operator_user_id,
                }
            }
        )
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT user_id FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
            if not row:
                return None
            owner_id = str(row["user_id"])
            await conn.execute(
                """
                UPDATE unified_content SET
                    deleted_at = NOW(),
                    updated_at = NOW(),
                    updated_by = $2::uuid,
                    storage_integrity_status = 'blob_missing',
                    metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
                WHERE id = $1
                """,
                content_id,
                operator_user_id,
                meta_patch,
            )

        await self.audit_logger.log(
            content_id=content_id,
            user_id=operator_user_id,
            action=AuditAction.QUARANTINE_BLOB_MISSING,
            details={"owner_user_id": owner_id},
        )

        if self.search_service:
            try:
                await self.search_service.delete_from_index(content_id)
            except Exception:
                logger.exception("Failed to remove quarantined content %s from Elasticsearch", content_id)

        logger.warning(
            "Content quarantined (blob_missing): id=%s",
            content_id,
        )
        return owner_id

    async def admin_scan_missing_storage_blobs(
        self,
        operator_user_id: str,
        *,
        dry_run: bool,
        limit: int,
        only_content_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Scan SeaweedFS-backed rows: ``exists`` must succeed and, for backends that support it,
        a one-byte read must succeed (filer metadata can outlive missing volume chunks).
        Optionally quarantine orphans. Requires DB column storage_integrity_status
        (migration 20260325_unified_content_storage_integrity).
        """
        cap = max(1, min(limit, 10_000))
        async with self.db_pool.acquire() as conn:
            if only_content_id is not None:
                rows = await conn.fetch(
                    """
                    SELECT id, file_path, storage_backend::text AS sb
                    FROM unified_content
                    WHERE id = $1
                      AND deleted_at IS NULL
                      AND storage_backend::text IN ('seaweedfs', 'minio')
                      AND file_path IS NOT NULL
                      AND trim(file_path) <> ''
                    """,
                    only_content_id,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, file_path, storage_backend::text AS sb
                    FROM unified_content
                    WHERE deleted_at IS NULL
                      AND storage_backend::text IN ('seaweedfs', 'minio')
                      AND file_path IS NOT NULL
                      AND trim(file_path) <> ''
                      AND coalesce(storage_integrity_status, '') <> 'blob_missing'
                      AND coalesce(storage_integrity_status, '') <> 'broken_quarantined'
                    ORDER BY updated_at DESC
                    LIMIT $1
                    """,
                    cap,
                )

        scanned = 0
        missing_ids: list[str] = []
        quarantined_ids: list[str] = []
        errors: list[dict[str, str]] = []

        for row in rows:
            scanned += 1
            cid: UUID = row["id"]
            path: str = row["file_path"]
            sb: str = row["sb"]
            backend = self.storage_factory.get_backend_by_name(sb)
            try:
                ok_exists = await backend.exists(path, cid)
            except Exception as exc:
                errors.append({"id": str(cid), "error": str(exc)})
                ok_exists = False
            ok = ok_exists
            if ok_exists:
                verify = getattr(backend, "verify_object_readable", None)
                if verify is not None:
                    try:
                        ok = await verify(path, cid)
                    except Exception as exc:
                        errors.append({"id": str(cid), "error": f"verify_object_readable: {exc}"})
                        ok = False
            if not ok:
                missing_ids.append(str(cid))
                if not dry_run:
                    out = await self._admin_quarantine_blob_missing(cid, operator_user_id)
                    if out is not None:
                        quarantined_ids.append(str(cid))

        return {
            "dry_run": dry_run,
            "scanned": scanned,
            "missing_count": len(missing_ids),
            "missing_ids": missing_ids,
            "quarantined_ids": quarantined_ids,
            "stat_errors": errors,
        }


__all__ = [
    "ContentStorageService",
    "ContentVersionConflictError",
    "get_content_user_storage_quota_bytes",
    "resolve_dedup_folder_relocation",
    "resolve_upload_folder_item_id",
    "upload_requests_folder_placement",
]
