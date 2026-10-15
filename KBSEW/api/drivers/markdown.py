# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Markdown knowledge asset ingestion driver (http(s)/.md → chunk → embed → Qdrant).
# Invariants:
# - No stack4/Tika; UTF-8 text decode; self-contained like PDF driver pattern.
# - Soft-hyphen normalize + shared sentence-aware chunking before embed.
# Related:
# - api/drivers/pdf.py
# - api/drivers/registry.py
# - api/services/chunking.py
# - api/services/text_quality.py
# ---

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from api.core.config import get_settings
from api.drivers.base import BaseIngestionDriver
from api.models.chunk import Chunk
from api.services.chunking import chunk_text as _chunk_text
from api.services.embedding_client import embed_texts
from api.services.qdrant_store import collection_name_for_barrel, upsert_chunks
from api.services.text_quality import is_readable_chunk, normalize_readable_text

logger = logging.getLogger(__name__)


def _looks_like_markdown_filename(filename: str) -> bool:
    lower = filename.lower().split("?", 1)[0]
    return lower.endswith(".md") or lower.endswith(".markdown")


def _decode_markdown_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


class MarkdownIngestionDriver(BaseIngestionDriver):
    driver_type = "markdown"

    def __init__(self) -> None:
        self._collection: str | None = None
        self._asset_id: str | None = None

    async def _download(self, source_url: str) -> tuple[bytes, str]:
        from api.services.safe_http import download_url_capped

        return await download_url_capped(source_url)

    async def _process_bytes_and_chunk(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> list[Chunk]:
        settings = get_settings()
        text = normalize_readable_text(_decode_markdown_bytes(file_data))
        if not text:
            logger.warning(
                "[STEP] kbsew_markdown_empty_body source=%s filename=%s",
                source_url,
                filename,
            )
            return []
        parts = _chunk_text(text, size=settings.chunk_size, overlap=settings.chunk_overlap)
        return [
            Chunk(
                text=part,
                chunk_index=idx,
                metadata={"source_url": source_url, "filename": filename},
            )
            for idx, part in enumerate(parts)
            if is_readable_chunk(part)
        ]

    async def validate_bytes(self, file_data: bytes, filename: str) -> bool:
        if not file_data:
            return False
        # Reject binary payloads even when the filename claims .md.
        if b"\x00" in file_data[:4096]:
            return False
        if _looks_like_markdown_filename(filename):
            return True
        try:
            file_data[:8192].decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False

    async def extract_metadata_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> dict[str, Any]:
        text = _decode_markdown_bytes(file_data)
        title = filename
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                title = stripped.lstrip("#").strip() or filename
                break
        return {
            "source_url": source_url,
            "filename": filename,
            "driver_type": self.driver_type,
            "title": title,
            "char_count": len(text),
        }

    async def process_and_chunk_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> list[Chunk]:
        return await self._process_bytes_and_chunk(file_data, filename, source_url=source_url)

    async def validate(self, source_url: str) -> bool:
        parsed = urlparse(source_url)
        if parsed.scheme not in ("http", "https"):
            return False
        if _looks_like_markdown_filename(parsed.path or source_url):
            return True
        try:
            from api.services.safe_http import head_url_safe

            response = await head_url_safe(source_url)
            ctype = (response.headers.get("content-type") or "").lower()
            return "text/markdown" in ctype or "text/x-markdown" in ctype or "text/plain" in ctype
        except Exception:  # noqa: BLE001 — validate is best-effort pre-check
            return False

    async def extract_metadata(self, source_url: str) -> dict[str, Any]:
        file_data, filename = await self._download(source_url)
        return await self.extract_metadata_bytes(file_data, filename, source_url=source_url)

    async def process_and_chunk(self, source_url: str) -> list[Chunk]:
        file_data, filename = await self._download(source_url)
        return await self._process_bytes_and_chunk(file_data, filename, source_url=source_url)

    async def index_to_qdrant(self, chunks: list[Chunk], barrel_id: str) -> int:
        if not chunks:
            return 0
        texts = [c.text for c in chunks]
        vectors = await embed_texts(texts)
        for chunk, vector in zip(chunks, vectors, strict=True):
            chunk.embedding = vector
        collection = self._collection or collection_name_for_barrel(barrel_id)
        asset_id = self._asset_id or barrel_id
        return await upsert_chunks(
            collection=collection,
            barrel_id=barrel_id,
            asset_id=asset_id,
            chunks=chunks,
        )

    def bind_index_context(self, *, collection: str, asset_id: str) -> None:
        self._collection = collection
        self._asset_id = asset_id
