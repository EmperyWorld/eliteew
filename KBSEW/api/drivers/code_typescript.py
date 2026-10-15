# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# TypeScript/TSX source ingestion driver for EliteEW frontend barrels.
# Invariants:
# - UTF-8 text only; path/symbol metadata on chunks; shared code_chunking.
# Related:
# - api/drivers/code_chunking.py
# - api/drivers/registry.py
# ---

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from api.core.config import get_settings
from api.drivers.base import BaseIngestionDriver
from api.drivers.code_chunking import chunk_source_lines, decode_source_bytes
from api.models.chunk import Chunk
from api.services.embedding_client import embed_texts
from api.services.qdrant_store import collection_name_for_barrel, upsert_chunks

logger = logging.getLogger(__name__)


def _looks_like_ts(filename: str) -> bool:
    lower = filename.lower().split("?", 1)[0]
    return lower.endswith((".ts", ".tsx", ".mts", ".cts"))


class CodeTypescriptIngestionDriver(BaseIngestionDriver):
    driver_type = "code_typescript"

    def __init__(self) -> None:
        self._collection: str | None = None
        self._asset_id: str | None = None

    async def _download(self, source_url: str) -> tuple[bytes, str]:
        from api.services.safe_http import download_url_capped

        return await download_url_capped(source_url)

    async def validate_bytes(self, file_data: bytes, filename: str) -> bool:
        if not file_data or b"\x00" in file_data[:4096]:
            return False
        if _looks_like_ts(filename):
            return True
        try:
            file_data[:8192].decode("utf-8")
            return _looks_like_ts(filename)
        except UnicodeDecodeError:
            return False

    async def extract_metadata_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> dict[str, Any]:
        text = decode_source_bytes(file_data)
        return {
            "source_url": source_url,
            "filename": filename,
            "driver_type": self.driver_type,
            "lang": "typescript",
            "path": filename,
            "char_count": len(text),
            "line_count": text.count("\n") + (1 if text else 0),
        }

    async def process_and_chunk_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> list[Chunk]:
        settings = get_settings()
        max_lines = max(20, min(120, settings.chunk_size // 40 or 80))
        overlap = max(2, min(20, settings.chunk_overlap // 20 or 8))
        text = decode_source_bytes(file_data)
        parts = chunk_source_lines(
            text,
            path=filename,
            lang="typescript",
            max_lines=max_lines,
            overlap_lines=overlap,
        )
        if not parts:
            logger.warning("[STEP] kbsew_code_typescript_empty filename=%s", filename)
            return []
        return [
            Chunk(
                text=part.text,
                chunk_index=idx,
                metadata={
                    "source_url": source_url,
                    "filename": filename,
                    "path": filename,
                    "lang": "typescript",
                    "symbol": part.symbol,
                    "start_line": part.start_line,
                    "end_line": part.end_line,
                },
            )
            for idx, part in enumerate(parts)
        ]

    async def validate(self, source_url: str) -> bool:
        parsed = urlparse(source_url)
        if parsed.scheme not in ("http", "https"):
            return False
        return _looks_like_ts(parsed.path or source_url)

    async def extract_metadata(self, source_url: str) -> dict[str, Any]:
        file_data, filename = await self._download(source_url)
        return await self.extract_metadata_bytes(file_data, filename, source_url=source_url)

    async def process_and_chunk(self, source_url: str) -> list[Chunk]:
        file_data, filename = await self._download(source_url)
        return await self.process_and_chunk_bytes(file_data, filename, source_url=source_url)

    async def index_to_qdrant(self, chunks: list[Chunk], barrel_id: str) -> int:
        if not chunks:
            return 0
        vectors = await embed_texts([c.text for c in chunks])
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
