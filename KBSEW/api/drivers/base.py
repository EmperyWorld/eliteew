# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Abstract ingestion driver contract (URL) and optional bytes-upload Protocol.
# Invariants:
# - BaseIngestionDriver is URL-oriented; upload path uses BytesUploadDriver after runtime gate.
# Related:
# - api/services/ingestion_service.py (_require_bytes_upload_driver)
# ---

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar, Protocol

from api.models.chunk import Chunk


class BaseIngestionDriver(ABC):
    """Plugin interface for knowledge asset ingestion."""

    driver_type: ClassVar[str]

    @abstractmethod
    async def validate(self, source_url: str) -> bool:
        """Return True if this driver can handle the source."""

    @abstractmethod
    async def extract_metadata(self, source_url: str) -> dict:
        """Extract document-level metadata before chunking."""

    @abstractmethod
    async def process_and_chunk(self, source_url: str) -> list[Chunk]:
        """Download/parse source and produce text chunks."""

    @abstractmethod
    async def index_to_qdrant(self, chunks: list[Chunk], barrel_id: str) -> int:
        """Embed and upsert chunks into the barrel vector index; returns point count."""


class BytesUploadDriver(Protocol):
    """Drivers that can ingest from uploaded file bytes (pdf, markdown, code_*)."""

    async def validate_bytes(self, file_data: bytes, filename: str) -> bool:
        """Return True if this driver can handle the uploaded payload."""
        ...

    async def extract_metadata_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> dict[str, Any]:
        """Extract document-level metadata from bytes before chunking."""
        ...

    async def process_and_chunk_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> list[Chunk]:
        """Parse uploaded bytes and produce text chunks."""
        ...
