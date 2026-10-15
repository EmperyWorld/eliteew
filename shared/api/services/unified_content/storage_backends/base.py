#!/usr/bin/env python3
"""
Storage Backend Base Class
Unified Content System - Phase 1 Week 1
"""

from abc import ABC, abstractmethod
from uuid import UUID


class StorageBackend(ABC):
    """Abstract base class for content storage backends"""

    @abstractmethod
    async def store(self, content_id: UUID, file_data: bytes, filename: str, mime_type: str | None = None) -> str:
        """
        Store file data and return storage path

        Args:
            content_id: Unique content identifier
            file_data: Binary file data
            filename: Original filename
            mime_type: MIME type of the file

        Returns:
            Storage path (e.g., "bucket/path" for MinIO, "" for PostgreSQL)
        """

    @abstractmethod
    async def retrieve(
        self,
        storage_path: str,
        content_id: UUID,
        *,
        fail_fast: bool = False,
    ) -> bytes:
        """
        Retrieve file data from storage

        Args:
            storage_path: Path to retrieve from
            content_id: Content identifier
            fail_fast: Skip retries / heavy recovery for best-effort bulk operations

        Returns:
            Binary file data
        """

    @abstractmethod
    async def delete(self, storage_path: str, content_id: UUID) -> bool:
        """
        Delete file from storage

        Args:
            storage_path: Path to delete
            content_id: Content identifier

        Returns:
            True if deleted successfully
        """

    @abstractmethod
    async def exists(self, storage_path: str, content_id: UUID) -> bool:
        """
        Check if file exists in storage

        Args:
            storage_path: Path to check
            content_id: Content identifier

        Returns:
            True if exists
        """

    @abstractmethod
    def get_backend_name(self) -> str:
        """
        Get backend identifier

        Returns:
            Backend name: 'postgresql', 'minio', 'local'
        """
