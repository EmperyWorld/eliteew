#!/usr/bin/env python3
"""
Elite Editor Unified Content Adapter

Adapter layer that wraps unified_content services to maintain compatibility
with existing Elite Editor router while using the new unified content system.

This allows Elite Editor to seamlessly transition to unified_content
without changing the router API.
"""

import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.schemas.unified_content import (
    ContentCreate,
    ContentType,
    ContentUpdate,
    Visibility,
)
from api.services.unified_content.content_storage_service import (
    ContentStorageService,
)
from api.services.unified_content.version_manager import VersionManager

logger = logging.getLogger(__name__)


class EliteEditorUnifiedAdapter:
    """
    Adapter that provides Elite Editor-style interface using unified_content backend
    """

    def __init__(
        self,
        content_service: ContentStorageService,
        version_manager: VersionManager,
        db_pool: asyncpg.Pool,
    ):
        self.content_service = content_service
        self.version_manager = version_manager
        self.db_pool = db_pool

    async def _get_file_data(self, content_id: UUID) -> bytes:
        """
        Retrieve file data for content from appropriate storage backend

        Args:
            content_id: Content UUID

        Returns:
            File data as bytes
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT file_data, file_path, file_size, storage_backend::text AS storage_backend, content_type
                FROM unified_content
                WHERE id = $1
            """,
                content_id,
            )

            if not row:
                msg = f"Content {content_id} not found"
                raise ValueError(msg)

            # Try PostgreSQL storage first (for small files)
            if row["file_data"]:
                return row["file_data"]

            # Fallback to MinIO for large files
            if row["file_path"]:
                sb = row.get("storage_backend")
                if sb:
                    backend = self.content_service.storage_factory.get_backend_by_name(str(sb))
                else:
                    backend = self.content_service.storage_factory.get_backend(
                        int(row["file_size"] or 0),
                        str(row["content_type"]) if row.get("content_type") else None,
                    )
                return await backend.retrieve(storage_path=row["file_path"], content_id=content_id)

            msg = f"No file data available for content {content_id}"
            raise ValueError(msg)

    async def create_document(
        self,
        title: str,
        content: str,
        document_type: str,
        user_id: str,
        metadata: dict[str, Any] | None,
        tags: list[str],
    ) -> dict[str, Any]:
        """
        Create new document using unified_content

        Args:
            title: Document title
            content: Document content (text/HTML)
            document_type: Document type (text, markdown, html)
            user_id: User ID
            metadata: Optional metadata dict
            tags: List of tags

        Returns:
            Document dict (Elite Editor format)
        """
        try:
            # Determine MIME type
            if document_type == "html" or content.strip().startswith("<"):
                mime_type = "text/html"
                sub_type = "text/html"
            elif document_type == "markdown":
                mime_type = "text/markdown"
                sub_type = "text/markdown"
            else:
                mime_type = "text/plain"
                sub_type = "text/plain"

            # Prepare metadata
            full_metadata = metadata or {}
            full_metadata["source"] = "elite_editor"
            full_metadata["document_type"] = document_type

            # Create content request
            content_create = ContentCreate(
                user_id=user_id,
                name=title,
                description="",
                content_type=ContentType.DOCUMENT,
                mime_type=mime_type,
                sub_type=sub_type,
                original_filename=f"{title}.{document_type}",
                tags=tags,
                metadata=full_metadata,
                visibility=Visibility.PRIVATE,
                source_service="elite_editor",
                company_id=None,
                project_id=None,
                title=None,
                word_count=None,
                character_count=None,
                access_level=None,
                is_public=None,
                source_id=None,
                folder_item_id=None,
                apply_project_desktop_folder=True,
            )

            # Create in unified_content
            content_bytes = content.encode("utf-8")
            unified_content = await self.content_service.create_content(
                content_data=content_create, file_data=content_bytes, user_id=user_id
            )

            # Convert to Elite Editor format
            return self._to_elite_editor_format(unified_content, content)

        except Exception:
            logger.exception("Document creation error")
            raise

    async def get_document(self, document_id: str, user_id: str) -> dict[str, Any] | None:
        """
        Get document by ID

        Args:
            document_id: Document UUID
            user_id: User ID

        Returns:
            Document dict (Elite Editor format) or None
        """
        try:
            # Get from unified_content
            content = await self.content_service.get_content(content_id=UUID(document_id), user_id=user_id)

            # Retrieve file data using helper method
            file_data = await self._get_file_data(UUID(document_id))
            decoded_content = file_data.decode("utf-8")

            return self._to_elite_editor_format(content, decoded_content)

        except PermissionError:
            logger.warning("Permission denied for document %s by user %s", document_id, user_id)
            return None
        except ValueError:
            logger.warning("Document %s not found", document_id)
            return None
        except Exception:
            logger.exception("Document retrieval error")
            return None

    async def list_documents(
        self,
        user_id: str,
        offset: int,
        limit: int,
        document_type: str | None,
        tags: list[str] | None,
        include_deleted: bool = False,
    ) -> list[dict[str, Any]]:
        """
        List user documents

        Args:
            user_id: User ID
            offset: Pagination offset
            limit: Results limit
            document_type: Optional filter by document type
            tags: Optional filter by tags
            include_deleted: If False (default), exclude soft-deleted documents

        Returns:
            List of document dicts (Elite Editor format)
        """
        try:
            # List from unified_content
            contents, _total = await self.content_service.list_content(
                user_id=user_id,
                content_type=ContentType.DOCUMENT,
                tags=tags,
                offset=offset,
                limit=limit,
            )

            # Convert to Elite Editor format
            documents = []
            for content in contents:
                try:
                    # Retrieve file data for each document
                    file_data = await self._get_file_data(content.id)
                    decoded_content = file_data.decode("utf-8")
                except Exception as e:
                    logger.warning("Failed to get file data for %s: %s", content.id, e)
                    # For list view, we can show documents even without content
                    decoded_content = ""

                doc = self._to_elite_editor_format(content, decoded_content)

                # Filter by document_type if specified
                if document_type and doc.get("metadata", {}).get("document_type") != document_type:
                    continue

                documents.append(doc)

            return documents

        except Exception:
            logger.exception("Document listing error")
            return []

    async def update_document(self, document_id: str, user_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        """
        Update document

        Args:
            document_id: Document UUID
            user_id: User ID
            updates: dict[str, Any] with fields to update (title, content, metadata, tags)

        Returns:
            Updated document dict (Elite Editor format) or None
        """
        try:
            # Prepare updates for unified_content
            content_updates = {}

            if "title" in updates:
                content_updates["name"] = updates["title"]

            if "metadata" in updates:
                content_updates["metadata"] = updates["metadata"]

            if "tags" in updates:
                content_updates["tags"] = updates["tags"]

            # Update content if changed
            if "content" in updates:
                # Update file data in database
                content_bytes = updates["content"].encode("utf-8")

                # Update directly in database (unified_content.file_data)
                async with self.db_pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE unified_content
                        SET file_data = $1,
                            file_size = $2,
                            updated_at = NOW(),
                            updated_by = $3
                        WHERE id = $4
                    """,
                        content_bytes,
                        len(content_bytes),
                        user_id,
                        UUID(document_id),
                    )

                # Create new version (version_manager will read updated content from DB)
                await self.version_manager.create_version(
                    content_id=UUID(document_id),
                    user_id=user_id,
                    change_description="Content updated via Elite Editor",
                )

            # Update metadata
            if content_updates:
                update_obj = ContentUpdate(**content_updates)
                await self.content_service.update_content(
                    content_id=UUID(document_id), user_id=user_id, updates=update_obj
                )

            # Return updated document
            return await self.get_document(document_id, user_id)

        except PermissionError:
            logger.warning(f"Permission denied for updating document {document_id} by user {user_id}")
            return None
        except ValueError:
            logger.warning(f"Document {document_id} not found for update")
            return None
        except Exception:
            logger.exception("Document update error")
            raise

    async def delete_document(self, document_id: str, user_id: str) -> bool:
        """
        Delete document (soft delete)

        Args:
            document_id: Document UUID
            user_id: User ID

        Returns:
            True if deleted, False otherwise
        """
        try:
            await self.content_service.delete_content(content_id=UUID(document_id), user_id=user_id)
            return True

        except PermissionError:
            logger.warning(f"Permission denied for deleting document {document_id} by user {user_id}")
            return False
        except ValueError:
            logger.warning(f"Document {document_id} not found for deletion")
            return False
        except Exception:
            logger.exception("Document deletion error")
            return False

    async def get_revisions(self, document_id: str, user_id: str, limit: int) -> list[dict[str, Any]]:
        """
        Get revision history for document

        Args:
            document_id: Document UUID
            user_id: User ID
            limit: Max revisions to return

        Returns:
            List of revision dicts (Elite Editor format)
        """
        try:
            versions = await self.version_manager.list_versions(
                content_id=UUID(document_id), user_id=user_id, limit=limit
            )

            revisions = []
            for version in versions:
                # Get content preview
                content_preview = ""
                file_data = version.get("file_data")
                if file_data:
                    if isinstance(file_data, bytes):
                        full_content = file_data.decode("utf-8")
                        content_preview = full_content[:200]  # First 200 chars
                    else:
                        content_preview = str(file_data)[:200]

                revisions.append(
                    {
                        "id": str(version.get("id", "")),
                        "revision_number": version.get("version", 0),
                        "content_preview": content_preview,
                        "content_size": version.get("file_size", 0),
                        "metadata": version.get("metadata") or {},
                        "change_summary": version.get("changes_description"),
                        "created_by": version.get("changed_by"),
                        "created_at": version.get("created_at", "").isoformat()
                        if hasattr(version.get("created_at", ""), "isoformat")
                        else str(version.get("created_at", "")),
                    }
                )

            return revisions

        except Exception:
            logger.exception("Revision retrieval error")
            return []

    async def restore_revision(self, document_id: str, user_id: str, revision_number: int) -> dict[str, Any] | None:
        """
        Restore document to specific revision

        Args:
            document_id: Document UUID
            user_id: User ID
            revision_number: Revision number to restore

        Returns:
            Restored document dict (Elite Editor format) or None
        """
        try:
            await self.version_manager.revert_to_version(
                content_id=UUID(document_id), version=revision_number, user_id=user_id
            )

            return await self.get_document(document_id, user_id)

        except PermissionError:
            logger.warning(f"Permission denied for restoring document {document_id} by user {user_id}")
            return None
        except ValueError as e:
            logger.warning(f"Revision restore failed: {e}")
            return None
        except Exception:
            logger.exception("Revision restore error")
            raise

    def _to_elite_editor_format(self, content: Any, decoded_content: str) -> dict[str, Any]:
        """
        Convert unified_content to Elite Editor format

        Args:
            content: Content object from unified_content
            decoded_content: Decoded file content (text)

        Returns:
            (dict[str, Any]) in Elite Editor format
        """
        metadata = content.metadata or {}

        return {
            "id": str(content.id),
            "user_id": content.user_id,
            "title": content.name,
            "content": decoded_content,
            "edited_content": metadata.get("edited_content", ""),
            "is_edited": metadata.get("is_edited", False),
            "document_type": metadata.get("document_type", "text"),
            "metadata": metadata,
            "tags": content.tags or [],
            "word_count": len(decoded_content.split()) if decoded_content else 0,
            "character_count": len(decoded_content) if decoded_content else 0,
            "created_at": content.created_at.isoformat(),
            "updated_at": content.updated_at.isoformat(),
            "last_edit_at": metadata.get("last_edit_at"),
            "edit_count": metadata.get("edit_count", 0),
            "revision_count": metadata.get("revision_count", 0),
            "updated_by": content.updated_by,
        }
