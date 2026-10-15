#!/usr/bin/env python3
"""
Processor Factory
Routes content to appropriate processor based on type

Strategy:
- document → DocumentProcessor (Tika)
- image → ImageProcessor (PIL thumbnail) or OCRProcessor (if scanned)
- video → VideoProcessor (ffmpeg)
- audio → AudioProcessor (ffmpeg)
- other → No processing (metadata only)
"""

import logging
from typing import Any

import asyncpg  # type: ignore[import-not-found]

from .audio_processor import AudioProcessor
from .base import ContentProcessor
from .document_processor import DocumentProcessor
from .image_processor import ImageProcessor
from .ocr_processor import OCRProcessor
from .video_processor import VideoProcessor

logger = logging.getLogger(__name__)


class ProcessorFactory:
    """Factory for selecting appropriate content processor"""

    # MIME types that should use OCR instead of standard image processing
    OCR_MIME_TYPES = {
        "application/pdf",  # Scanned PDFs
        "image/tiff",  # TIFF often contains scanned documents
        "image/bmp",  # BMP scans
    }

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool

    def get_processor(
        self, content_type: str, mime_type: str | None = None, use_ocr: bool = False
    ) -> ContentProcessor | None:
        """
        Get appropriate processor for content type

        Args:
            content_type: Content type (document, image, video, audio, etc.)
            mime_type: MIME type for fine-grained routing
            use_ocr: Force OCR processing for images

        Returns:
            ContentProcessor instance or None
        """
        # Document processing
        if content_type == "document":
            return DocumentProcessor(self.db_pool)

        # Image processing
        if content_type == "image":
            # Use OCR for scanned documents
            if use_ocr or (mime_type and mime_type in self.OCR_MIME_TYPES):
                return OCRProcessor(self.db_pool)
            # Standard image processing with thumbnail
            return ImageProcessor(self.db_pool)

        # Video processing
        if content_type == "video":
            return VideoProcessor(self.db_pool)

        # Audio processing
        if content_type == "audio":
            return AudioProcessor(self.db_pool)

        # Presentation (treat as document)
        if content_type in {"presentation", "spreadsheet"}:
            return DocumentProcessor(self.db_pool)

        # AI results (no processing needed)
        if content_type == "ai_result":
            return None  # Already processed

        # Other/unknown
        logger.warning("No processor available for content type: %s", content_type)
        return None

    async def process_content(
        self,
        content_id,
        content_type: str,
        file_data: bytes,
        filename: str,
        mime_type: str,
        use_ocr: bool = False,
    ) -> dict[str, Any] | None:
        """
        Process content using appropriate processor

        Args:
            content_id: Content UUID
            content_type: Content type
            file_data: Binary file data
            filename: Original filename
            mime_type: MIME type
            use_ocr: Force OCR processing

        Returns:
            Processing result dict
        """
        processor = self.get_processor(content_type, mime_type, use_ocr)

        if processor is None:
            logger.info("No processing needed for %s: %s", content_type, content_id)
            # Update status to completed without processing
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE unified_content
                    SET processing_status = 'completed', processed_at = NOW()
                    WHERE id = $1
                    """,
                    content_id,
                )
            return {"processing_status": "completed", "message": "No processing required"}

        # Process content
        return await processor.process(
            content_id=content_id, file_data=file_data, filename=filename, mime_type=mime_type
        )
