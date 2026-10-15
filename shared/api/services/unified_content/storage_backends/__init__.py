#!/usr/bin/env python3
"""
Storage Backends Package
Unified Content System - Phase 1 Week 1
"""

from .base import StorageBackend
from .factory import StorageBackendFactory
from .minio_storage import SeaweedFSStorage
from .postgresql import PostgreSQLStorage

# Backward compatibility: MinIOStorage is now SeaweedFSStorage
MinIOStorage = SeaweedFSStorage

__all__ = [
    "MinIOStorage",  # Backward compatibility alias
    "PostgreSQLStorage",
    "SeaweedFSStorage",
    "StorageBackend",
    "StorageBackendFactory",
]
