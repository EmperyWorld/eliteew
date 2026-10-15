#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unified Content document processor for text-like local parsing and Tika-backed binary document extraction.
# It stores stable normalized HTML/Markdown/plain metadata for DocEditor and EWA surfaces.
# Invariants:
# - Text-like suffixes are decoded locally to preserve Markdown and line breaks.
# - Binary Office/PDF parsing remains delegated to Tika.
# Related:
# - api/services/doc_editor_text_normalizer.py
# - api/services/doc_editor_service.py
# ---
"""
Document Processor
Uses Apache Tika for binary office/PDF; plain text and Markdown are decoded locally
(same policy as DocEditorService — Tika often flattens .md to a single line).
"""

import logging
from pathlib import Path
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.business_intelligence.tika_service import (
    TikaService,
)
from api.services.doc_editor_text_normalizer import (
    decode_text_document_bytes,
    default_rendered_html,
    normalize_text_document,
)
from api.services.unified_content.document_thumbnail import (
    generate_and_store_document_thumbnail,
    should_generate_document_thumbnail,
)

from .base import ContentProcessor

logger = logging.getLogger(__name__)

# Aligned with api.services.doc_editor_service (Tika hurts line breaks on these types).
_NATIVE_TEXT_SUFFIXES = frozenset(
    {
        ".txt",
        ".md",
        ".markdown",
        ".log",
        ".csv",
        ".json",
        ".xml",
        ".html",
        ".htm",
        ".css",
        ".js",
        ".ts",
        ".mjs",
        ".cjs",
        ".py",
        ".sh",
        ".yaml",
        ".yml",
        ".ini",
        ".conf",
        ".cfg",
        ".rst",
    }
)
_MARKDOWN_SUFFIXES = frozenset({".md", ".markdown"})


class DocumentProcessor(ContentProcessor):
    """Document processor: native UTF-8 for text-like files, else Apache Tika."""

    def __init__(self, db_pool: asyncpg.Pool, tika_url: str = "http://stack4-tika:9998"):
        super().__init__(db_pool)
        self.tika_service = TikaService(tika_url)

    @staticmethod
    def _should_use_native_plain_text(filename: str, mime_type: str) -> bool:
        suffix = Path(filename).suffix.lower()
        mime = (mime_type or "").strip().lower()
        return suffix in _NATIVE_TEXT_SUFFIXES or mime in ("text/markdown", "text/x-markdown")

    async def _process_plain_native(
        self,
        content_id: UUID,
        file_data: bytes,
        filename: str,
        mime_type: str,
    ) -> dict[str, Any]:
        text = decode_text_document_bytes(file_data)
        suffix = Path(filename).suffix.lower()
        mime_l = (mime_type or "").strip().lower()
        is_md = suffix in _MARKDOWN_SUFFIXES or mime_l in ("text/markdown", "text/x-markdown")
        parsed_via = "native_utf8"
        normalized = normalize_text_document(
            text,
            filename=filename,
            mime_type=mime_type,
            preferred_format="markdown" if is_md else ("html" if suffix in (".html", ".htm") else "text"),
        )

        if is_md and normalized.source_format == "html":
            parsed_via = "native_utf8_html_in_md_suffix"
        elif is_md and "markdown_glue_normalized" in normalized.warnings:
            logger.info("Markdown glue normalization: content_id=%s", content_id)
        extracted_text = normalized.plain_text
        html_content = normalized.rendered_html

        metadata: dict[str, Any] = {
            "language": "unknown",
            "content_type": mime_type or "text/plain",
            "parsed_via": parsed_via,
            "rendered_html": html_content,
            "content_markdown": normalized.markdown,
            "plain_text": normalized.plain_text,
            "source_format": normalized.source_format,
            "parse_warnings": list(normalized.warnings),
            "source_extension": Path(filename).suffix.lower() or None,
        }
        if extracted_text:
            metadata["word_count"] = len(extracted_text.split())
        thumb_path: str | None = None
        if should_generate_document_thumbnail(mime_type, filename):
            thumb_path = await generate_and_store_document_thumbnail(
                content_id,
                mime=mime_type,
                filename=filename,
                file_data=file_data,
                extracted_text=extracted_text,
            )
        await self.update_content(
            content_id=content_id,
            extracted_text=extracted_text,
            metadata=metadata,
            thumbnail_path=thumb_path,
            processing_status="completed",
        )
        logger.info(
            "Document processed (native, no Tika): %s | %s chars",
            content_id,
            len(extracted_text),
        )
        return {
            "extracted_text": extracted_text,
            "rendered_html": html_content,
            "thumbnail_path": thumb_path,
            "metadata": metadata,
            "processing_status": "completed",
            "processing_error": None,
        }

    async def process(self, content_id: UUID, file_data: bytes, filename: str, mime_type: str) -> dict[str, Any]:
        """
        Extract text and metadata (native UTF-8 for text-like files, else Tika).

        Returns:
            {
                "extracted_text": str,
                "metadata": {
                    "page_count": int,
                    "author": str,
                    "language": str,
                    "word_count": int,
                    ...
                },
                "processing_status": "completed" | "failed",
                "processing_error": str | None
            }
        """
        try:
            if self._should_use_native_plain_text(filename, mime_type):
                return await self._process_plain_native(content_id, file_data, filename, mime_type)

            # Extract text and HTML using Tika (all within same session context)
            async with self.tika_service:
                result = await self.tika_service.extract_text_from_bytes(
                    file_data=file_data, filename=filename, extract_metadata=True
                )

                # Extract HTML while session is still open
                html_content: str | None = await self.tika_service.extract_html_from_bytes(
                    file_data=file_data, filename=filename
                )

            if not result.get("success"):
                error = result.get("error", "Unknown Tika error")
                logger.error("Tika extraction failed for %s: %s", content_id, error)
                return {
                    "extracted_text": None,
                    "thumbnail_path": None,
                    "metadata": {},
                    "processing_status": "failed",
                    "processing_error": error,
                }

            # Extract relevant metadata
            tika_metadata = result.get("metadata", {})
            extracted_text_raw = result.get("text", "") or ""
            language = result.get("language", "unknown")

            # Normalize extracted text to UTF-8 (FastAPI/Pydantic expects str)
            if isinstance(extracted_text_raw, bytes):
                extracted_text = extracted_text_raw.decode("utf-8", errors="ignore")
            else:
                extracted_text = str(extracted_text_raw)

            extracted_text = extracted_text.strip()

            html_content = html_content.strip() if html_content else default_rendered_html(extracted_text)

            # Build metadata dict
            metadata = {
                "language": language,
                "content_type": result.get("content_type", mime_type),
                "tika_metadata": tika_metadata,
                "rendered_html": html_content,
                "content_markdown": "",
                "plain_text": extracted_text,
                "source_format": "html",
                "parse_warnings": [],
            }

            # Extract specific fields if available
            if "page_count" in tika_metadata:
                metadata["page_count"] = tika_metadata["page_count"]
            if "author" in tika_metadata:
                metadata["author"] = tika_metadata["author"]
            if "title" in tika_metadata:
                metadata["title"] = tika_metadata["title"]
            if "creation_date" in tika_metadata:
                metadata["creation_date"] = tika_metadata["creation_date"]

            # Calculate word count
            if extracted_text:
                word_count = len(extracted_text.split())
                metadata["word_count"] = word_count

            thumb_path: str | None = None
            if should_generate_document_thumbnail(mime_type, filename):
                thumb_path = await generate_and_store_document_thumbnail(
                    content_id,
                    mime=mime_type,
                    filename=filename,
                    file_data=file_data,
                    extracted_text=extracted_text,
                )

            # Update database
            await self.update_content(
                content_id=content_id,
                extracted_text=extracted_text,
                metadata=metadata,
                thumbnail_path=thumb_path,
                processing_status="completed",
            )

            logger.info(f"Document processed: {content_id} | Text: {len(extracted_text)} chars | Language: {language}")

            return {
                "extracted_text": extracted_text,
                "rendered_html": html_content,
                "thumbnail_path": thumb_path,
                "metadata": metadata,
                "processing_status": "completed",
                "processing_error": None,
            }

        except Exception as e:
            logger.exception("Document processing failed for %s", content_id)

            # Update with error status
            await self.update_content(content_id=content_id, processing_status="failed", processing_error=str(e))

            return {
                "extracted_text": None,
                "thumbnail_path": None,
                "metadata": {},
                "processing_status": "failed",
                "processing_error": str(e),
            }

    @staticmethod
    def _escape_html(value: str) -> str:
        return (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#39;")
        )

    def _convert_plain_text_to_html(self, plain_text: str) -> str:
        if not plain_text:
            return "<p></p>"

        paragraphs = plain_text.split("\n\n")
        html_parts = []
        for paragraph in paragraphs:
            lines = paragraph.split("\n")
            escaped_lines = [self._escape_html(line) for line in lines]
            html_parts.append(f"<p>{'<br />'.join(escaped_lines)}</p>")

        return "".join(html_parts)
