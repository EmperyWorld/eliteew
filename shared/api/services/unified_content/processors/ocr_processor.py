#!/usr/bin/env python3
"""
OCR Processor
Extracts text from scanned images using Tesseract OCR

Languages: Russian + English
Confidence scoring included
"""

import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.business_intelligence.tika_service import (
    TikaService,
)

from .base import ContentProcessor

logger = logging.getLogger(__name__)


class OCRProcessor(ContentProcessor):
    """OCR processor using Tesseract (via Tika with OCR support)"""

    def __init__(self, db_pool: asyncpg.Pool, tika_url: str = "http://stack4-tika:9998"):
        super().__init__(db_pool)
        # Tika has built-in OCR support via Tesseract

        self.tika_service = TikaService(tika_url)

    async def process(self, content_id: UUID, file_data: bytes, filename: str, mime_type: str) -> dict[str, Any]:
        """
        Extract text from scanned image using OCR

        Returns:
            {
                "extracted_text": str,
                "metadata": {
                    "ocr_confidence": float,
                    "language": str
                },
                "processing_status": "completed" | "failed"
            }
        """
        try:
            # Tika automatically uses Tesseract for images
            async with self.tika_service:
                result = await self.tika_service.extract_text_from_bytes(
                    file_data=file_data, filename=filename, extract_metadata=True
                )

            if not result.get("success"):
                error = result.get("error", "OCR extraction failed")
                logger.error("OCR failed for %s: %s", content_id, error)

                await self.update_content(content_id=content_id, processing_status="failed", processing_error=error)

                return {
                    "extracted_text": None,
                    "thumbnail_path": None,
                    "metadata": {},
                    "processing_status": "failed",
                    "processing_error": error,
                }

            extracted_text = result.get("text", "")
            language = result.get("language", "unknown")

            # Estimate OCR confidence based on text characteristics
            # (real confidence would require direct Tesseract API)
            confidence = self._estimate_confidence(extracted_text)

            metadata = {"ocr_language": language, "ocr_confidence": confidence, "ocr_enabled": True}

            # Update database
            await self.update_content(
                content_id=content_id,
                extracted_text=extracted_text,
                metadata=metadata,
                processing_status="completed",
            )

            logger.info(
                f"OCR processed: {content_id} | Text: {len(extracted_text)} chars | Confidence: {confidence:.2f}"
            )

            return {
                "extracted_text": extracted_text,
                "thumbnail_path": None,
                "metadata": metadata,
                "processing_status": "completed",
                "processing_error": None,
            }

        except Exception as e:
            logger.exception("OCR processing failed for %s", content_id)

            await self.update_content(content_id=content_id, processing_status="failed", processing_error=str(e))

            return {
                "extracted_text": None,
                "thumbnail_path": None,
                "metadata": {},
                "processing_status": "failed",
                "processing_error": str(e),
            }

    @staticmethod
    def _estimate_confidence(text: str) -> float:
        """
        Estimate OCR confidence based on text characteristics
        (Simple heuristic - real implementation would use Tesseract API)
        """
        if not text or len(text) < 10:
            return 0.3

        # Count alphanumeric vs total characters
        alphanumeric = sum(c.isalnum() for c in text)
        total = len(text)

        if total == 0:
            return 0.3

        ratio = alphanumeric / total

        # Higher ratio = higher confidence
        if ratio > 0.8:
            return 0.9
        if ratio > 0.6:
            return 0.7
        if ratio > 0.4:
            return 0.5
        return 0.3
