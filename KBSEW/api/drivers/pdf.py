# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# PDF knowledge asset ingestion driver (stack4 Tika + OCRmyPDF).
# Invariants:
# - Text cleaned via text_quality; chunked via shared sentence-aware chunking.
# Related:
# - api/services/chunking.py
# - api/services/text_quality.py
# ---

from __future__ import annotations

import logging
from typing import Any

from api.core.config import get_settings
from api.drivers.base import BaseIngestionDriver
from api.models.chunk import Chunk
from api.services.chunking import chunk_text as _chunk_text
from api.services.embedding_client import embed_texts
from api.services.qdrant_store import collection_name_for_barrel, upsert_chunks
from api.services.stack4_client import get_stack4_client
from api.services.text_quality import clean_pdf_extracted_text, is_readable_chunk

logger = logging.getLogger(__name__)


class PDFIngestionDriver(BaseIngestionDriver):
    driver_type = "pdf"

    def __init__(self) -> None:
        self._stack4 = get_stack4_client()
        self._collection: str | None = None
        self._asset_id: str | None = None

    async def _download(self, source_url: str) -> tuple[bytes, str]:
        from api.services.safe_http import download_url_capped

        return await download_url_capped(source_url)

    @staticmethod
    def _is_pdf_bytes(data: bytes, filename: str) -> bool:
        if data.startswith(b"%PDF"):
            return True
        return filename.lower().split("?", 1)[0].endswith(".pdf")

    async def _extract_metadata_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> dict[str, Any]:
        meta = await self._stack4.extract_metadata(file_data, filename)
        meta["source_url"] = source_url
        meta["filename"] = filename
        meta["driver_type"] = self.driver_type
        return meta

    async def _process_bytes_and_chunk(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> list[Chunk]:
        settings = get_settings()
        text = await self._stack4.extract_plain(file_data, filename)
        if len(text.strip()) < 80:
            logger.info("[STEP] kbsew_pdf_low_text_try_ocr source=%s", source_url)
            searchable = await self._stack4.ocr_pdf_to_bytes(file_data, filename)
            text = await self._stack4.extract_plain(searchable, filename)
        text = clean_pdf_extracted_text(text)
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
        return self._is_pdf_bytes(file_data, filename)

    async def extract_metadata_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> dict[str, Any]:
        return await self._extract_metadata_bytes(file_data, filename, source_url=source_url)

    async def process_and_chunk_bytes(
        self,
        file_data: bytes,
        filename: str,
        *,
        source_url: str,
    ) -> list[Chunk]:
        return await self._process_bytes_and_chunk(file_data, filename, source_url=source_url)

    async def validate(self, source_url: str) -> bool:
        lower = source_url.lower().split("?", 1)[0]
        if lower.endswith(".pdf"):
            return True
        try:
            from api.services.safe_http import head_url_safe

            response = await head_url_safe(source_url)
            ctype = (response.headers.get("content-type") or "").lower()
            return "application/pdf" in ctype
        except Exception:  # noqa: BLE001 — validate is best-effort pre-check
            return False

    async def extract_metadata(self, source_url: str) -> dict[str, Any]:
        file_data, filename = await self._download(source_url)
        return await self._extract_metadata_bytes(file_data, filename, source_url=source_url)

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
