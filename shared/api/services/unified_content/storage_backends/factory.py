#!/usr/bin/env python3
"""
Storage Backend Factory with caching
"""

import logging
from typing import Any

import asyncpg  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings

from .base import StorageBackend
from .minio_storage import (
    SeaweedFSStorage,  # Note: file still named minio_storage.py for backward compatibility
)
from .postgresql import PostgreSQLStorage

logger = logging.getLogger(__name__)

# Global cache for factory instances
_factory_cache = {}


class StorageBackendFactory:
    """
    Factory for selecting storage backend based on file size
    """

    # Non-audio: small files in PostgreSQL BYTEA
    SIZE_THRESHOLD = 1024 * 1024  # 1 MB in bytes
    # Audio: prefer PostgreSQL up to this size — SeaweedFS single-node S3 often breaks on long MP3 reads (IncompleteRead).
    AUDIO_POSTGRES_MAX_BYTES = 40 * 1024 * 1024  # 40 MB

    def __init__(
        self,
        db_pool: asyncpg.Pool,
        minio_endpoint: str | None = None,  # Backward compatibility: parameter name kept
        minio_access_key: str | None = None,
        minio_secret_key: str | None = None,
    ):
        """
        Initialize storage backends
        """
        logger.debug("Creating new StorageBackendFactory instance")

        self.postgresql_backend = PostgreSQLStorage(db_pool)

        endpoint = (
            minio_endpoint or unified_settings.minio_endpoint
        )  # Backward compatibility: still uses minio_* settings
        access_key = minio_access_key or unified_settings.minio_access_key
        secret_key = minio_secret_key or unified_settings.minio_secret_key

        masked_key = f"{access_key[:4]}***{access_key[-4:]}" if access_key and len(access_key) >= 8 else "***"
        logger.info(
            "Initializing SeaweedFS backend (endpoint=%s, secure=%s, access_key=%s)",
            endpoint,
            unified_settings.minio_secure,
            masked_key,
        )

        self.seaweedfs_backend = SeaweedFSStorage(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=unified_settings.minio_secure,
            enable_encryption=unified_settings.s3_use_bucket_default_sse,
            bucket_name=unified_settings.s3_bucket,
        )
        # Backward compatibility alias
        self.minio_backend = self.seaweedfs_backend

    def get_backend(self, file_size: int, content_type: str | None = None) -> StorageBackend:
        """Select storage backend based on file size and content type (audio → Postgres below AUDIO_POSTGRES_MAX_BYTES)."""
        if content_type == "audio" and file_size > 0 and file_size < self.AUDIO_POSTGRES_MAX_BYTES:
            return self.postgresql_backend
        if file_size < self.SIZE_THRESHOLD:
            return self.postgresql_backend
        return self.seaweedfs_backend

    def get_backend_by_name(self, backend_name: str) -> StorageBackend:
        """Get backend by explicit name"""
        if backend_name == "postgresql":
            return self.postgresql_backend
        if backend_name in {"minio", "seaweedfs"}:  # Support both for backward compatibility
            return self.seaweedfs_backend
        msg = f"Unknown storage backend: {backend_name}"
        raise ValueError(msg)


def get_storage_factory(db_pool: asyncpg.Pool | None = None) -> StorageBackendFactory:
    """
    Get cached StorageBackendFactory instance
    SYNC function for import-time usage
    """
    # If db_pool is not provided, raise error (for test scripts need to pass db_pool)
    if db_pool is None:
        msg = (
            "db_pool is required for get_storage_factory(). For scripts, create db_pool first and pass it as parameter."
        )
        raise ValueError(msg)

    cache_key = id(db_pool)

    if cache_key not in _factory_cache:
        _factory_cache[cache_key] = StorageBackendFactory(db_pool)
        logger.debug(
            "Created new StorageBackendFactory and cached it",
            extra={"cache_size": len(_factory_cache)},
        )
    else:
        logger.debug(
            "Reusing cached StorageBackendFactory instance",
            extra={"cache_size": len(_factory_cache)},
        )

    return _factory_cache[cache_key]


async def get_storage_factory_async(db_pool: asyncpg.Pool | None = None) -> StorageBackendFactory:
    """
    Async version: uses central pool from DatabaseManager when db_pool is not provided.
    """
    if db_pool is None:
        from api.core.database_manager import get_asyncpg_pool  # noqa: PLC0415

        db_pool = await get_asyncpg_pool()
    return get_storage_factory(db_pool)


async def create_temp_db_pool() -> Any:  # noqa: ANN401
    """
    Return central asyncpg pool from DatabaseManager.
    Kept for backward compatibility; callers should prefer get_asyncpg_pool().
    """
    from api.core.database_manager import get_asyncpg_pool  # noqa: PLC0415

    return await get_asyncpg_pool()
