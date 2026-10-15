#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Create/copy paths for Unified Content storage (dedup, quota gate, backend store).
# Invariants:
# - Quota enforcement delegates to ``ContentStorageService._check_quota`` on the core service.
# - Text/* creates sync ``extracted_text`` (same helper as ``replace_file_content``) so agentic
#   driver observe / FTS see body without waiting for async processors.
# Related:
# - api/services/unified_content/content_storage_service.py
# - api/services/unified_content/content_storage_shared.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# ---
"""Create and copy operations for Unified Content storage."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any
from uuid import UUID, uuid4

from api.schemas.unified_content import (
    AuditAction,
    Content,
    ContentCreate,
    ContentUpdate,
    ProcessingStatus,
    Visibility,
    build_content_create,
)
from api.services.unified_content.content_storage_mixin_host import ContentStorageMixinHost
from api.services.unified_content.content_storage_shared import (
    extracted_text_from_file_data,
    resolve_dedup_folder_relocation,
    resolve_upload_folder_item_id,
    upload_requests_folder_placement,
    verify_storage_object_after_write,
)
from api.services.unified_content.processors.base import clamp_extracted_text_for_fts

logger = logging.getLogger(__name__)


class ContentStorageCreateMixin(ContentStorageMixinHost):
    async def create_content(
        self,
        content_data: ContentCreate,
        file_data: bytes,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        *,
        skip_deduplication: bool = False,
    ) -> Content:
        """
        Create new content with deduplication and quota check

        Args:
            content_data: Content metadata
            file_data: Binary file data
            user_id: User ID (from auth)
            ip_address: Client IP for audit
            user_agent: Client user agent for audit
            skip_deduplication: When True, always insert a new row (content copy path)

        Returns:
            Created Content object

        Raises:
            ValueError: If quota exceeded
            RuntimeError: If storage fails
        """
        file_size = len(file_data)
        file_hash = self._calculate_hash(file_data)

        # Check quota
        await self._check_quota(user_id, file_size)

        # Check for duplicate
        if not skip_deduplication:
            existing = await self._find_by_hash(file_hash, user_id)
            if existing:
                existing_id = existing["id"]
                logger.info("Duplicate content found: %s | Hash: %s...", existing_id, file_hash[:16])
                content = await self._reuse_duplicate_with_upload_metadata(
                    existing_id=existing_id,
                    content_data=content_data,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                return content.model_copy(update={"deduplicated_reused": True})

        # Select storage backend (audio < ~40MB → PostgreSQL for reliable playback)
        backend = self.storage_factory.get_backend(file_size, content_data.content_type.value)
        content_id = uuid4()

        folder_item_id_val = resolve_upload_folder_item_id(content_data)

        async with self.db_pool.acquire() as conn, conn.transaction():
            # Create content record
            await conn.fetchrow(
                """
                    INSERT INTO unified_content (
                        id, user_id, name, description, tags, content_type,
                        mime_type, sub_type, original_filename, file_size, file_hash,
                        storage_backend, visibility, company_id, project_id, friend_visibility,
                        source_service, source_id, related_content, metadata, processing_status,
                        folder_item_id, created_at, updated_at, updated_by
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                        $14, $15, $16, $17, $18, $19, $20::jsonb, $21, $22, NOW(), NOW(), $23
                    )
                    RETURNING *
                    """,
                content_id,
                user_id,
                content_data.name,
                content_data.description,
                content_data.tags,
                content_data.content_type.value,
                content_data.mime_type,
                content_data.sub_type,
                content_data.original_filename,
                file_size,
                file_hash,
                backend.get_backend_name(),
                content_data.visibility.value,
                content_data.company_id,
                content_data.project_id,
                content_data.friend_visibility,
                content_data.source_service,
                content_data.source_id,
                content_data.related_content,
                json.dumps(content_data.metadata),
                ProcessingStatus.PENDING.value,
                folder_item_id_val,
                user_id,
            )

            # Store file (pass conn for PostgreSQL backend transaction support)
            # PostgreSQLStorage.store accepts conn parameter, but base class doesn't
            storage_path = await backend.store(  # type: ignore[call-overload]
                content_id,
                file_data,
                content_data.original_filename,
                content_data.mime_type,
                conn=conn,  # type: ignore[arg-type]
            )

            # Update file_path if SeaweedFS (or other S3 storage)
            if storage_path:
                await conn.execute(
                    "UPDATE unified_content SET file_path = $1 WHERE id = $2",
                    storage_path,
                    content_id,
                )

            # Sync text extract for searchable / agentic-driver observe (parity with replace_file_content).
            extracted_text = extracted_text_from_file_data(file_data, content_data.mime_type or "")
            if extracted_text is not None:
                text_out, trunc_meta = clamp_extracted_text_for_fts(extracted_text)
                word_count = len(text_out.split()) if text_out else 0
                character_count = len(text_out)
                await conn.execute(
                    """
                    UPDATE unified_content
                    SET extracted_text = $1,
                        word_count = $2,
                        character_count = $3
                    WHERE id = $4
                    """,
                    text_out,
                    word_count,
                    character_count,
                    content_id,
                )
                if trunc_meta:
                    logger.info(
                        "[STEP] create_content_extracted_text_set content_id=%s chars=%s truncated=%s",
                        content_id,
                        character_count,
                        True,
                    )
                else:
                    logger.info(
                        "[STEP] create_content_extracted_text_set content_id=%s chars=%s",
                        content_id,
                        character_count,
                    )

            # Update tags usage
            for tag in content_data.tags:
                await conn.execute("SELECT increment_tag_usage($1::uuid, $2)", user_id, tag)

            # SeaweedFS: read-probe after store (stat alone misses orphan filer metadata).
            # PostgreSQL BYTEA: verify runs in-process on same conn via backend.exists.
            if storage_path:
                try:
                    await verify_storage_object_after_write(backend, storage_path, content_id)
                except RuntimeError:
                    raise
                except Exception as exc:
                    msg = f"Post-upload storage verification failed: {exc!s}"
                    raise RuntimeError(msg) from exc

        # Audit log
        await self.audit_logger.log(
            content_id=content_id,
            user_id=user_id,
            action=AuditAction.CREATED,
            details={
                "file_size": file_size,
                "mime_type": content_data.mime_type,
                "storage_backend": backend.get_backend_name(),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(f"Content created: {content_id} | Size: {file_size} | Backend: {backend.get_backend_name()}")

        # Auto-index to Elasticsearch (async, non-blocking)
        if self.search_service:
            try:
                await self.search_service.index_content(content_id, user_id)
                logger.info("Content indexed to Elasticsearch: %s", content_id)
            except Exception:
                logger.exception("Failed to index content %s", content_id)
                # Don't fail creation if indexing fails

        return await self.get_content(content_id, user_id)

    async def copy_content(
        self,
        *,
        source_content_id: UUID,
        user_id: str,
        new_name: str,
        file_data: bytes,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        """
        Duplicate readable content into a new row owned by ``user_id``.

        Always creates a new storage object and row (hash dedup skipped).
        Shares/versions/comments are not copied. Visibility is always private.
        Folder/company/project are inherited only when the caller owns the source.
        """
        source = await self.get_content(source_content_id, user_id, check_permissions=True)
        name = new_name.strip()
        if not name:
            msg = "Copy name must not be empty"
            raise ValueError(msg)
        if not file_data:
            msg = "Source file data is empty"
            raise ValueError(msg)

        is_owner = str(source.user_id) == str(user_id)
        folder_item_id = source.folder_item_id if is_owner else None
        company_id = source.company_id if is_owner else None
        project_id = source.project_id if is_owner else None

        content_data = build_content_create(
            user_id=user_id,
            original_filename=source.original_filename or f"{name}.bin",
            name=name,
            content_type=source.content_type,
            description=source.description,
            tags=list(source.tags or []),
            mime_type=source.mime_type,
            sub_type=source.sub_type,
            visibility=Visibility.PRIVATE,
            metadata=dict(source.metadata or {}),
            company_id=company_id,
            project_id=project_id,
            friend_visibility=False,
            title=source.title,
            source_service="content_copy",
            source_id=str(source.id),
            related_content=[source.id],
            folder_item_id=folder_item_id,
            apply_project_desktop_folder=False,
        )
        return await self.create_content(
            content_data=content_data,
            file_data=file_data,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            skip_deduplication=True,
        )

    async def _reuse_duplicate_with_upload_metadata(
        self,
        existing_id: UUID,
        content_data: ContentCreate,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        """Return existing hash match but apply upload name/placement from Content Manager."""
        content_id = existing_id if isinstance(existing_id, UUID) else UUID(str(existing_id))
        current = await self.get_content(content_id, user_id)
        updates = ContentUpdate.model_validate({})
        patch_fields: set[str] = set()

        if content_data.name and content_data.name != current.name:
            updates.name = content_data.name
            patch_fields.add("name")

        if upload_requests_folder_placement(content_data):
            target_folder = resolve_upload_folder_item_id(content_data)
            if target_folder != current.folder_item_id:
                updates.folder_item_id = target_folder
                patch_fields.add("folder_item_id")

        if "folder_item_id" not in patch_fields:
            relocated = resolve_dedup_folder_relocation(content_data, current.folder_item_id)
            if relocated is not None and relocated != current.folder_item_id:
                updates.folder_item_id = relocated
                patch_fields.add("folder_item_id")

        if content_data.project_id is not None and content_data.project_id != current.project_id:
            updates.project_id = content_data.project_id
            patch_fields.add("project_id")
            if content_data.company_id is not None:
                updates.company_id = content_data.company_id
                patch_fields.add("company_id")
        elif content_data.company_id is not None and content_data.company_id != current.company_id:
            updates.company_id = content_data.company_id
            patch_fields.add("company_id")

        if patch_fields:
            current = await self.update_content(
                content_id,
                user_id,
                updates,
                ip_address=ip_address,
                user_agent=user_agent,
            )

        if content_data.original_filename and content_data.original_filename != current.original_filename:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE unified_content
                    SET original_filename = $1, updated_at = NOW(), updated_by = $2
                    WHERE id = $3
                    """,
                    content_data.original_filename,
                    user_id,
                    content_id,
                )
            current = await self.get_content(content_id, user_id)

        return current

    async def _find_by_hash(self, file_hash: str, user_id: str) -> dict[str, Any] | None:
        """
        Find existing content by hash (for deduplication)

        Args:
            file_hash: SHA256 hash
            user_id: User ID

        Returns:
            Content dict if found, None otherwise
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM unified_content
                WHERE file_hash = $1 AND (user_id)::text = $2 AND deleted_at IS NULL
                LIMIT 1
                """,
                file_hash,
                user_id,
            )
            return dict(row) if row else None

    @staticmethod
    def _calculate_hash(data: bytes) -> str:
        """Calculate SHA256 hash of data"""
        return hashlib.sha256(data).hexdigest()
