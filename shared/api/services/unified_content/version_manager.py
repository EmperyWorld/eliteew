#!/usr/bin/env python3
"""
Version Manager Service for Unified Content System

Handles complete version control with full snapshots (not diffs).
Supports hybrid storage (PostgreSQL for <1MB, MinIO for ≥1MB).
Auto-incrementing version numbers per content item.

Week 5 - Phase 1 - Unified Content System
"""

import json
import logging
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]

from api.services.unified_content.storage_backends.factory import StorageBackendFactory

logger = logging.getLogger(__name__)


class VersionManager:
    """
    Complete version control system for unified content.

    Features:
    - Full snapshots (not diffs) for reliability and simplicity
    - Hybrid storage via StorageBackendFactory
    - Auto-incrementing version numbers per content
    - Permission-based access control
    - Revert capability with full history preservation
    - Version-specific downloads
    """

    def __init__(self, db_pool: asyncpg.Pool, storage_factory: StorageBackendFactory):
        """
        Initialize VersionManager.

        Args:
            db_pool: PostgreSQL connection pool
            storage_factory: Factory for choosing storage backend (PostgreSQL/MinIO)
        """
        self.db_pool = db_pool
        self.storage_factory = storage_factory
        logger.info("VersionManager initialized with hybrid storage support")

    @staticmethod
    def _parse_version_metadata(raw_metadata: Any) -> dict[str, Any]:
        if raw_metadata is None:
            return {}
        if isinstance(raw_metadata, dict):
            return dict(raw_metadata)
        if isinstance(raw_metadata, str):
            try:
                parsed = json.loads(raw_metadata)
            except json.JSONDecodeError:
                return {}
            return dict(parsed) if isinstance(parsed, dict) else {}
        return {}

    def _build_snapshot_metadata(self, record: asyncpg.Record) -> dict[str, Any]:
        record_data = dict(record)
        metadata = self._parse_version_metadata(record_data.get("metadata"))
        metadata.update(
            {
                "name": record_data.get("name"),
                "title": record_data.get("title") or record_data.get("name"),
                "description": record_data.get("description"),
                "tags": list(record_data.get("tags") or []),
                "mime_type": record_data.get("mime_type"),
                "content_type": record_data.get("content_type"),
                "sub_type": record_data.get("sub_type"),
                "visibility": record_data.get("visibility"),
                "original_filename": record_data.get("original_filename"),
            }
        )
        return metadata

    @staticmethod
    def _extract_content_metadata(snapshot_metadata: dict[str, Any]) -> dict[str, Any]:
        cleaned = dict(snapshot_metadata)
        for key in (
            "name",
            "title",
            "description",
            "tags",
            "mime_type",
            "content_type",
            "sub_type",
            "visibility",
            "original_filename",
        ):
            cleaned.pop(key, None)
        return cleaned

    @staticmethod
    def _version_name(snapshot_metadata: dict[str, Any], fallback: str | None) -> str:
        return str(snapshot_metadata.get("name") or snapshot_metadata.get("title") or fallback or "document")

    async def create_version(self, content_id: UUID, user_id: str, change_description: str | None = None) -> UUID:
        """
        Create a new version snapshot of content.

        Creates a full snapshot (not diff) of the current content state.
        Uses hybrid storage: PostgreSQL for <1MB, MinIO for ≥1MB.
        Version numbers auto-increment per content (1, 2, 3...).

        Args:
            content_id: UUID of content to version
            user_id: User creating the version
            change_description: Optional description of changes made

        Returns:
            UUID of created version

        Raises:
            ValueError: If content not found or deleted
            PermissionError: If user lacks access to content
            RuntimeError: If storage operation fails
        """
        async with self.db_pool.acquire() as conn:
            content = await conn.fetchrow(
                """
                SELECT
                    id,
                    name,
                    title,
                    description,
                    tags,
                    metadata,
                    file_size,
                    file_hash,
                    mime_type,
                    content_type,
                    sub_type,
                    file_data,
                    file_path,
                    storage_backend,
                    user_id,
                    visibility,
                    original_filename,
                    extracted_text,
                    word_count,
                    character_count
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
            if not content:
                msg = f"Content {content_id} not found or deleted"
                raise ValueError(msg)
            if not await self._has_access(conn, content_id, user_id):
                msg = f"User {user_id} lacks access to content {content_id}"
                raise PermissionError(msg)

            next_version = await conn.fetchval(
                """
                SELECT COALESCE(MAX(version), 0) + 1
                FROM content_versions
                WHERE content_id = $1
                """,
                content_id,
            )
            version_number = int(next_version or 1)

            try:
                file_data = await self._retrieve_file_data(content)
            except Exception as e:
                logger.exception("Failed to retrieve file data for versioning")
                msg = f"File retrieval failed: {e}"
                raise RuntimeError(msg) from e

            file_size = int(content["file_size"] or len(file_data))
            version_file_data: bytes | None = None
            version_file_path: str | None = None
            version_id = uuid4()
            snapshot_metadata = self._build_snapshot_metadata(content)

            try:
                ct = str(content["content_type"]) if content.get("content_type") else None
                backend = self.storage_factory.get_backend(file_size, ct)
                if backend.get_backend_name() == "postgresql":
                    version_file_data = file_data
                else:
                    filename = content["original_filename"] or content["name"] or f"version_{version_number}"
                    version_file_path = await backend.store(
                        content_id=version_id,
                        file_data=file_data,
                        filename=filename,
                        mime_type=content["mime_type"],
                    )
            except Exception as e:
                logger.exception("Failed to store version file")
                msg = f"Storage operation failed: {e}"
                raise RuntimeError(msg) from e

            stored_version_id = await conn.fetchval(
                """
                INSERT INTO content_versions (
                    id,
                    content_id,
                    version,
                    file_data,
                    file_path,
                    metadata,
                    file_size,
                    file_hash,
                    changed_by,
                    changes_description,
                    change_type,
                    title,
                    content,
                    word_count,
                    character_count
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15
                )
                RETURNING id
                """,
                version_id,
                content_id,
                version_number,
                version_file_data,
                version_file_path,
                json.dumps(snapshot_metadata),
                file_size,
                content["file_hash"],
                str(user_id),
                change_description,
                "update",
                content["title"] or content["name"],
                content["extracted_text"],
                content["word_count"],
                content["character_count"],
            )

            logger.info(
                "Created version %s for content %s (version_id=%s, user=%s, size=%s, change=%s)",
                version_number,
                content_id,
                stored_version_id,
                user_id,
                file_size,
                change_description,
            )
            return stored_version_id

    async def list_versions(
        self, content_id: UUID, user_id: str, limit: int = 50, offset: int = 0
    ) -> list[dict[str, Any]]:
        """
        List all versions for a content item.

        Returns versions ordered by version DESC (newest first).
        Does not include file_data (use download_version for that).

        Args:
            content_id: UUID of content
            user_id: User requesting versions
            limit: Maximum number of versions to return (default 50)
            offset: Number of versions to skip (for pagination)

        Returns:
            List of version dicts with metadata (newest first)

        Raises:
            ValueError: If content not found
            PermissionError: If user lacks access to content
        """
        async with self.db_pool.acquire() as conn:
            # Check content exists and is not deleted
            content_exists = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM unified_content
                    WHERE id = $1 AND deleted_at IS NULL
                )
            """,
                content_id,
            )

            if not content_exists:
                msg = f"Content {content_id} not found"
                raise ValueError(msg)

            # Check user has access
            if not await self._has_access(conn, content_id, user_id):
                msg = f"User {user_id} lacks access to content {content_id}"
                raise PermissionError(msg)

            # Fetch versions with metadata
            versions = await conn.fetch(
                """
                SELECT
                    id as version_id,
                    version as version_number,
                    created_at,
                    changed_by as created_by,
                    changes_description as change_description,
                    COALESCE(file_size, 0) as file_size
                FROM content_versions
                WHERE content_id = $1
                ORDER BY version DESC
                LIMIT $2 OFFSET $3
            """,
                content_id,
                limit,
                offset,
            )

            logger.info(
                f"Listed {len(versions)} versions for content {content_id} "
                f"(user={user_id}, limit={limit}, offset={offset})"
            )

            return [dict(v) for v in versions]

    async def get_version(self, version_id: UUID, user_id: str) -> dict[str, Any]:
        """
        Get detailed information about a specific version.

        Does NOT include file_data in response (use download_version for that).
        Includes all metadata fields for display.

        Args:
            version_id: UUID of version
            user_id: User requesting version info

        Returns:
            (dict[str, Any]) with full version details (no file_data)

        Raises:
            ValueError: If version not found
            PermissionError: If user lacks access to parent content
        """
        async with self.db_pool.acquire() as conn:
            version = await conn.fetchrow(
                """
                SELECT
                    id as version_id,
                    content_id,
                    version as version_number,
                    metadata,
                    file_size,
                    file_hash,
                    title,
                    changed_by as created_by,
                    created_at,
                    changes_description as change_description
                FROM content_versions
                WHERE id = $1
                """,
                version_id,
            )
            if not version:
                msg = f"Version {version_id} not found"
                raise ValueError(msg)
            if not await self._has_access(conn, version["content_id"], user_id):
                msg = f"User {user_id} lacks access to version {version_id}"
                raise PermissionError(msg)
            snapshot_metadata = self._parse_version_metadata(version["metadata"])
            name = self._version_name(snapshot_metadata, version["title"])
            tags = snapshot_metadata.get("tags")
            description = snapshot_metadata.get("description")
            logger.info(f"Retrieved version {version_id} (content={version['content_id']}, user={user_id})")
            return {
                "version_id": version["version_id"],
                "content_id": version["content_id"],
                "version_number": version["version_number"],
                "file_size": int(version["file_size"] or 0),
                "file_hash": str(version["file_hash"] or ""),
                "mime_type": str(snapshot_metadata.get("mime_type") or "application/octet-stream"),
                "name": name,
                "description": description if isinstance(description, str) else None,
                "tags": [str(tag) for tag in tags] if isinstance(tags, list) else [],
                "metadata": snapshot_metadata,
                "created_by": str(version["created_by"] or ""),
                "created_at": version["created_at"],
                "change_description": version["change_description"],
            }

    async def revert_to_version(
        self, content_id: UUID, version: int, user_id: str, change_description: str | None = None
    ) -> UUID:
        """
        Revert content to a previous version.

        Creates a NEW version from old version's data (doesn't modify old version).
        Updates unified_content with version's data.
        Increments revision_count via database trigger.
        Only content owner can revert.

        Args:
            content_id: UUID of content to revert
            version: Version number to revert to
            user_id: User performing revert (must be owner)
            change_description: Optional description (auto-generated if None)

        Returns:
            UUID of newly created version (after revert)

        Raises:
            ValueError: If content or version not found
            PermissionError: If user is not content owner
            RuntimeError: If storage operation fails
        """
        async with self.db_pool.acquire() as conn:
            content = await conn.fetchrow(
                """
                SELECT
                    id,
                    user_id,
                    name,
                    title,
                    description,
                    tags,
                    mime_type,
                    sub_type,
                    original_filename,
                    content_type
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
            if not content:
                msg = f"Content {content_id} not found"
                raise ValueError(msg)
            if str(content["user_id"]) != str(user_id):
                msg = f"User {user_id} is not owner of content {content_id}. Only owner can revert."
                raise PermissionError(msg)

            old_version = await conn.fetchrow(
                """
                SELECT
                    id,
                    content_id,
                    version,
                    file_data,
                    file_path,
                    title,
                    content,
                    word_count,
                    character_count,
                    file_size,
                    file_hash,
                    metadata
                FROM content_versions
                WHERE content_id = $1 AND version = $2
                """,
                content_id,
                version,
            )
            if not old_version:
                msg = f"Version {version} not found for content {content_id}"
                raise ValueError(msg)

            try:
                snapshot_bytes = await self._retrieve_file_data(old_version)
            except Exception as e:
                logger.exception("Failed to retrieve version data for revert")
                msg = f"Storage retrieval failed: {e}"
                raise RuntimeError(msg) from e

            snapshot_metadata = self._parse_version_metadata(old_version["metadata"])
            restored_name = self._version_name(snapshot_metadata, content["name"])
            restored_title = str(snapshot_metadata.get("title") or old_version["title"] or restored_name)
            restored_description = snapshot_metadata.get("description")
            restored_tags = snapshot_metadata.get("tags")
            restored_mime_type = str(
                snapshot_metadata.get("mime_type") or content["mime_type"] or "application/octet-stream"
            )
            restored_sub_type = snapshot_metadata.get("sub_type")
            restored_original_filename = str(
                snapshot_metadata.get("original_filename") or content["original_filename"] or restored_name
            )
            restored_metadata = self._extract_content_metadata(snapshot_metadata)
            restored_text = old_version["content"]
            file_size = int(old_version["file_size"] or len(snapshot_bytes))

            unified_content_file_data: bytes | None = None
            unified_content_file_path: str | None = None
            unified_content_storage_backend = "postgresql"
            version_file_data: bytes | None = None
            version_file_path: str | None = None
            revert_version_id = uuid4()

            try:
                ct = str(content["content_type"]) if content.get("content_type") else None
                backend = self.storage_factory.get_backend(file_size, ct)
                if backend.get_backend_name() == "postgresql":
                    unified_content_file_data = snapshot_bytes
                    version_file_data = snapshot_bytes
                else:
                    unified_content_file_path = await backend.store(
                        content_id=content_id,
                        file_data=snapshot_bytes,
                        filename=restored_original_filename,
                        mime_type=restored_mime_type,
                    )
                    version_file_path = await backend.store(
                        content_id=revert_version_id,
                        file_data=snapshot_bytes,
                        filename=restored_original_filename,
                        mime_type=restored_mime_type,
                    )
                    unified_content_storage_backend = backend.get_backend_name()
            except Exception as e:
                logger.exception("Failed to store reverted file data")
                msg = f"Storage operation failed: {e}"
                raise RuntimeError(msg) from e

            change_summary = change_description or f"Reverted to version {version}"
            snapshot_metadata_for_version = {
                **snapshot_metadata,
                "name": restored_name,
                "title": restored_title,
                "description": restored_description if isinstance(restored_description, str) else None,
                "tags": [str(tag) for tag in restored_tags]
                if isinstance(restored_tags, list)
                else list(content["tags"] or []),
                "mime_type": restored_mime_type,
                "sub_type": restored_sub_type if isinstance(restored_sub_type, str) else content["sub_type"],
                "original_filename": restored_original_filename,
            }

            async with conn.transaction():
                previous_max_version = int(
                    await conn.fetchval(
                        "SELECT COALESCE(MAX(version), 0) FROM content_versions WHERE content_id = $1",
                        content_id,
                    )
                    or 0
                )

                await conn.execute(
                    """
                    UPDATE unified_content
                    SET
                        file_data = $1,
                        file_path = $2,
                        storage_backend = $3,
                        extracted_text = $4,
                        title = $5,
                        name = $6,
                        description = $7,
                        tags = $8,
                        mime_type = $9,
                        sub_type = $10,
                        word_count = $11,
                        character_count = $12,
                        file_size = $13,
                        file_hash = $14,
                        metadata = $15::jsonb,
                        original_filename = $16,
                        updated_at = NOW(),
                        updated_by = $17
                    WHERE id = $18
                    """,
                    unified_content_file_data,
                    unified_content_file_path,
                    unified_content_storage_backend,
                    restored_text,
                    restored_title,
                    restored_name,
                    restored_description if isinstance(restored_description, str) else content["description"],
                    [str(tag) for tag in restored_tags]
                    if isinstance(restored_tags, list)
                    else list(content["tags"] or []),
                    restored_mime_type,
                    restored_sub_type if isinstance(restored_sub_type, str) else content["sub_type"],
                    old_version["word_count"],
                    old_version["character_count"],
                    file_size,
                    old_version["file_hash"],
                    json.dumps(restored_metadata),
                    restored_original_filename,
                    str(user_id),
                    content_id,
                )

                current_version_number = int(
                    await conn.fetchval("SELECT version FROM unified_content WHERE id = $1", content_id) or 0
                )
                if current_version_number <= previous_max_version:
                    current_version_number = previous_max_version + 1
                    await conn.execute(
                        "UPDATE unified_content SET version = $1 WHERE id = $2",
                        current_version_number,
                        content_id,
                    )

                await conn.execute(
                    """
                    INSERT INTO content_versions (
                        id,
                        content_id,
                        version,
                        file_data,
                        file_path,
                        metadata,
                        file_size,
                        file_hash,
                        changed_by,
                        changes_description,
                        change_type,
                        title,
                        content,
                        word_count,
                        character_count
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15
                    )
                    """,
                    revert_version_id,
                    content_id,
                    current_version_number,
                    version_file_data,
                    version_file_path,
                    json.dumps(snapshot_metadata_for_version),
                    file_size,
                    old_version["file_hash"],
                    str(user_id),
                    change_summary,
                    "revert",
                    restored_title,
                    restored_text,
                    old_version["word_count"],
                    old_version["character_count"],
                )

            logger.info("Reverted content %s to version %d (user=%s)", content_id, version, user_id)
            return revert_version_id

    async def download_version(self, version_id: UUID, user_id: str) -> tuple[bytes, dict[str, Any]]:
        """
        Download file data from a specific version.

        Retrieves file from storage (PostgreSQL or MinIO) and returns
        with filename and mime type for HTTP response.

        Args:
            version_id: UUID of version to download
            user_id: User requesting download

        Returns:
            Tuple of (file_data, version_info_dict)

        Raises:
            ValueError: If version not found
            PermissionError: If user lacks access to parent content
            RuntimeError: If storage retrieval fails
        """
        async with self.db_pool.acquire() as conn:
            # Fetch version with permission check
            version = await conn.fetchrow(
                """
                SELECT
                    v.id,
                    v.content_id,
                    v.file_data,
                    v.file_path,
                    v.title as title,
                    v.metadata,
                    v.version,
                    v.file_size
                FROM content_versions v
                WHERE v.id = $1
                """,
                version_id,
            )

            if not version:
                msg = f"Version {version_id} not found"
                raise ValueError(msg)

            # Check permission on parent content
            if not await self._has_access(conn, version["content_id"], user_id):
                msg = f"User {user_id} lacks access to version {version_id}"
                raise PermissionError(msg)

            # Retrieve file data from storage
            try:
                file_data = await self._retrieve_file_data(version)
            except Exception as e:
                logger.exception("Failed to retrieve version file")
                msg = f"Storage retrieval failed: {e}"
                raise RuntimeError(msg) from e

            snapshot_metadata = self._parse_version_metadata(version["metadata"])
            base_name = self._version_name(snapshot_metadata, version["title"])
            version_suffix = f"_v{version['version']}"
            filename = f"{base_name}{version_suffix}"

            logger.info(
                "Downloaded version %s (content=%s, user=%s, size=%d bytes)",
                version_id,
                version["content_id"],
                user_id,
                version["file_size"],
            )

            version_info = {
                "name": filename,
                "mime_type": str(snapshot_metadata.get("mime_type") or "application/octet-stream"),
            }

            return (file_data, version_info)

    async def should_create_version(self, content_id: UUID, new_file_hash: str) -> bool:
        """
        Check if content changed (hash differs) to decide if version needed.

        Used before updates to determine if file content actually changed.
        If hash is same, no need to create new version.

        Args:
            content_id: UUID of content
            new_file_hash: SHA256 hash of new/updated file

        Returns:
            True if version should be created (hash changed), False otherwise
        """
        async with self.db_pool.acquire() as conn:
            current_hash = await conn.fetchval(
                """
                SELECT file_hash
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
            """,
                content_id,
            )

            if current_hash is None:
                # Content not found or deleted
                return False

            hash_changed = current_hash != new_file_hash

            if hash_changed:
                logger.debug(
                    "Content %s hash changed (old=%s..., new=%s...)",
                    content_id,
                    current_hash[:16],
                    new_file_hash[:16],
                )
            else:
                logger.debug("Content %s hash unchanged, no version needed", content_id)

            return hash_changed

    # ============ Private Helper Methods ============

    async def _has_access(
        self, conn: asyncpg.Connection | asyncpg.pool.PoolConnectionProxy, content_id: UUID, user_id: str
    ) -> bool:
        """
        Check if user has access to content.

        Access granted if:
        - User is owner
        - Content is public (visibility='public')
        - Content is shared with user (via content_shares)

        Args:
            conn: Database connection (Connection or PoolConnectionProxy)
            content_id: UUID of content
            user_id: User to check access for

        Returns:
            True if user has access, False otherwise
        """
        result = await conn.fetchval(  # type: ignore[arg-type]
            """
            SELECT EXISTS(
                SELECT 1 FROM unified_content
                WHERE id = $1
                AND deleted_at IS NULL
                AND (
                    (user_id)::text = ($2)::text
                    OR visibility = 'public'
                    OR EXISTS(
                        SELECT 1 FROM content_shares
                        WHERE content_id = $1
                        AND (shared_with_user_id)::text = ($2)::text
                        AND (expires_at IS NULL OR expires_at > NOW())
                    )
                )
            )
        """,
            content_id,
            user_id,
        )
        # fetchval() returns bool | None for EXISTS queries, but EXISTS always returns bool
        return bool(result) if result is not None else False

    async def _retrieve_file_data(self, record: asyncpg.Record) -> bytes:
        """
        Retrieve file data from storage (PostgreSQL or MinIO).

        Checks file_data field first (PostgreSQL), then file_path (MinIO).

        Args:
            record: Database record with file_data and file_path fields

        Returns:
            File data as bytes

        Raises:
            RuntimeError: If no storage location found or retrieval fails
        """
        if record["file_data"]:
            # Data stored in PostgreSQL BYTEA
            return bytes(record["file_data"])
        if record["file_path"]:
            file_size = int(record["file_size"] or (1024 * 1024))
            needle_id = record["id"]
            sb = record.get("storage_backend")
            if sb:
                backend = self.storage_factory.get_backend_by_name(str(sb))
            else:
                ct = record.get("content_type")
                backend = self.storage_factory.get_backend(
                    file_size,
                    str(ct) if ct else None,
                )
            return await backend.retrieve(storage_path=record["file_path"], content_id=needle_id)
        msg = "No file data or path found in record. Content may be corrupted."
        raise RuntimeError(msg)
