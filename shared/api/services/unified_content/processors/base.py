#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Abstract Unified Content processor + shared DB update helpers.
# Invariants:
# - extracted_text is capped before UPDATE so expression GIN to_tsvector indexes stay under PG limits.
# - Processor updates content status exactly once per successful/failed process path in subclasses.
# Related:
# - api/migrations/applied/20260509_ewa_companion_unified_content_body_search.sql
# - api/workers/queue_handlers.py
# ---
"""Base Content Processor — Unified Content System."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

# Postgres to_tsvector / GIN expression index hard-fails above ~1 MiB of input.
# Cap well under that; keep enough for FTS without stuffing huge PDFs into PG.
MAX_EXTRACTED_TEXT_CHARS = 500_000
MAX_EXTRACTED_TEXT_BYTES = 900 * 1024


def clamp_extracted_text_for_fts(text: str) -> tuple[str, dict[str, Any]]:
    """Return (safe_text, truncation_meta). Meta empty when no clamp applied."""
    original_chars = len(text)
    original_bytes = len(text.encode("utf-8"))
    if original_chars <= MAX_EXTRACTED_TEXT_CHARS and original_bytes <= MAX_EXTRACTED_TEXT_BYTES:
        return text, {}

    clipped = text[:MAX_EXTRACTED_TEXT_CHARS]
    while len(clipped.encode("utf-8")) > MAX_EXTRACTED_TEXT_BYTES and clipped:
        clipped = clipped[: max(0, len(clipped) - 4096)]
    meta = {
        "extracted_text_truncated": True,
        "extracted_text_original_chars": original_chars,
        "extracted_text_original_bytes": original_bytes,
        "extracted_text_stored_chars": len(clipped),
    }
    logger.info(
        "[STEP] unified_content_extracted_text_clamped original_chars=%s stored_chars=%s",
        original_chars,
        len(clipped),
    )
    return clipped, meta


class ContentProcessor(ABC):
    """Abstract base class for content processors"""

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool

    @abstractmethod
    async def process(self, content_id: UUID, file_data: bytes, filename: str, mime_type: str) -> dict[str, Any]:
        """
        Process content and return extracted information

        Args:
            content_id: Content UUID
            file_data: Binary file data
            filename: Original filename
            mime_type: MIME type

        Returns:
            (dict[str, Any]) with extracted data:
            {
                "extracted_text": str | None,
                "thumbnail_path": str | None,
                "metadata": dict,
                "processing_status": "completed" | "failed",
                "processing_error": str | None
            }
        """

    async def update_content(
        self,
        content_id: UUID,
        extracted_text: str | None = None,
        thumbnail_path: str | None = None,
        metadata: dict[str, Any] | None = None,
        processing_status: str = "completed",
        processing_error: str | None = None,
    ) -> None:
        """
        Update content record with processed data

        Args:
            content_id: Content UUID
            extracted_text: Extracted text (for search)
            thumbnail_path: Path to thumbnail
            metadata: Additional metadata
            processing_status: Processing status
            processing_error: Error message if failed
        """
        meta_out: dict[str, Any] | None = dict(metadata) if isinstance(metadata, dict) else None
        text_out = extracted_text
        if text_out is not None:
            text_out, trunc_meta = clamp_extracted_text_for_fts(text_out)
            if trunc_meta:
                meta_out = {**(meta_out or {}), **trunc_meta}

        async with self.db_pool.acquire() as conn:
            # Build update query dynamically
            updates = []
            params = []
            param_count = 0

            if text_out is not None:
                param_count += 1
                updates.append(f"extracted_text = ${param_count}")
                params.append(text_out)

            if thumbnail_path is not None:
                param_count += 1
                updates.append(f"thumbnail_path = ${param_count}")
                params.append(thumbnail_path)

            if meta_out is not None:
                param_count += 1
                # Merge with existing metadata
                updates.append(f"metadata = COALESCE(metadata, '{{}}'::jsonb) || ${param_count}::jsonb")
                params.append(json.dumps(meta_out))

            param_count += 1
            updates.append(f"processing_status = ${param_count}")
            params.append(processing_status)

            if processing_error:
                param_count += 1
                updates.append(f"processing_error = ${param_count}")
                params.append(processing_error)

            updates.append("processed_at = NOW()")
            updates.append("updated_at = NOW()")

            # Add content_id for WHERE
            param_count += 1
            params.append(str(content_id))

            # Note: updates is built from hardcoded field names, params are passed separately
            query = f"""
                UPDATE unified_content
                SET {", ".join(updates)}
                WHERE id = ${param_count}
            """  # noqa: S608

            await conn.execute(query, *params)
            logger.info("Updated content %s with processed data", content_id)
