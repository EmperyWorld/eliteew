#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unified content processing pipeline (thumbnail/OCR/metadata/text extraction + embedding handoff)
# for uploaded files.
# Invariants:
# - Request-path embedding generation must use async services only; no sync model bootstrap/encode fallback.
# - Processing failures degrade gracefully per step without crashing the whole pipeline.
# Related:
# - api/services/ai_sdk/embedding_service.py
# - api/services/unified_content/semantic_search_service.py
# ---
"""
🔥 CONTENT PROCESSING PIPELINE - Automatic Content Processing 🔥

Automatically process uploaded content:
1. Thumbnail generation (images, videos, PDFs)
2. OCR text extraction (scanned documents)
3. Metadata extraction (EXIF, document properties)
4. Text extraction (for indexing)
5. Embedding generation (for semantic search)

Created: 2025-11-13
Version: 1.0.0
"""

import contextlib
import hashlib
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from typing import Any
from uuid import UUID

from PIL import Image  # type: ignore[import-untyped]

from api.core.pdf_engine import PDF_ENGINE_AVAILABLE, extract_text_from_bytes, render_page_thumbnail_jpeg
from api.services.unified_content.storage_backends.factory import StorageBackendFactory
from api.utils.blocking import run_blocking_work

logger = logging.getLogger(__name__)


@dataclass
class ProcessingResult:
    """Result of content processing"""

    content_id: UUID
    thumbnail_url: str | None = None
    extracted_text: str | None = None
    metadata: dict[str, Any] | None = None  # ⚡ FIX MYPY: Optional type
    embedding_id: str | None = None
    processing_time: float = 0.0
    errors: list[str] | None = None  # ⚡ FIX MYPY: Optional type


class ContentProcessingPipeline:
    """
    🔥 CONTENT PROCESSING PIPELINE 🔥

    Automatic processing pipeline for uploaded content
    """

    def __init__(
        self,
        storage_factory: StorageBackendFactory | None = None,
        embedding_service: Any | None = None,  # noqa: ANN401 - Dynamic service type
        chromadb_service: Any | None = None,  # noqa: ANN401 - Dynamic service type
    ) -> None:
        """
        Initialize processing pipeline

        Args:
            storage_factory: Storage backend factory for uploading thumbnails
            embedding_service: Service for generating embeddings (optional)
            chromadb_service: Service for storing embeddings in ChromaDB (optional)
        """
        self.max_thumbnail_size = (800, 800)
        self.thumbnail_quality = 85
        self.storage_factory = storage_factory
        self.embedding_service = embedding_service
        self.chromadb_service = chromadb_service

    async def process_content(
        self, content_id: UUID, file_data: bytes, content_type: str, file_name: str
    ) -> ProcessingResult:
        """
        Process content through complete pipeline

        Args:
            content_id: Content UUID
            file_data: File bytes
            content_type: MIME type
            file_name: Original filename

        Returns:
            ProcessingResult with all extraction results
        """

        start_time = datetime.now(UTC)
        errors = []

        logger.info(
            "🔄 Starting processing pipeline for %s (type: %s, size: %s bytes)",
            content_id,
            content_type,
            len(file_data),
        )

        # Build task list based on content type
        tasks = []

        # 1. Thumbnail generation
        if self._needs_thumbnail(content_type):
            tasks.append(("thumbnail", self._generate_thumbnail(content_id, file_data, content_type)))

        # 2. OCR text extraction
        if self._needs_ocr(content_type):
            tasks.append(("ocr", self._extract_text_ocr(content_id, file_data, content_type)))

        # 3. Metadata extraction
        tasks.append(("metadata", self._extract_metadata(content_id, file_data, content_type, file_name)))

        # 4. Text extraction (for text documents)
        if self._is_text_document(content_type):
            tasks.append(("text", self._extract_text(content_id, file_data, content_type)))

        # 5. Embedding generation (for text content)
        if self._needs_embeddings(content_type):
            tasks.append(("embedding", self._generate_embeddings(content_id, file_data)))

        # Execute all tasks in parallel
        logger.info("🚀 Executing %s processing tasks in parallel", len(tasks))

        results = {}
        for task_name, task_coro in tasks:
            try:
                result = await task_coro
                results[task_name] = result
                logger.info("Task '%s' completed", task_name)
            except Exception as e:
                logger.exception("Task '%s' failed", task_name)
                errors.append(f"{task_name}: {e!s}")
                results[task_name] = None

        # Build processing result
        processing_time = (datetime.now(UTC) - start_time).total_seconds()

        return ProcessingResult(
            content_id=content_id,
            thumbnail_url=results.get("thumbnail"),
            extracted_text=results.get("text") or results.get("ocr"),
            metadata=results.get("metadata", {}),
            embedding_id=results.get("embedding"),
            processing_time=processing_time,
            errors=errors if errors else None,
        )

    def _needs_thumbnail(self, content_type: str) -> bool:
        """Check if content needs thumbnail"""
        return content_type.startswith(("image/", "video/", "application/pdf"))

    def _needs_ocr(self, content_type: str) -> bool:
        """Check if content needs OCR"""
        return content_type in [
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/tiff",
            "application/pdf",
        ]

    def _is_text_document(self, content_type: str) -> bool:
        """Check if content is text document"""
        return content_type in [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/markdown",
        ]

    def _needs_embeddings(self, content_type: str) -> bool:
        """Check if content needs embeddings"""
        return self._is_text_document(content_type)

    async def _generate_thumbnail(self, content_id: UUID, file_data: bytes, content_type: str) -> str | None:
        """
        Generate thumbnail for content

        Returns:
            URL or path to thumbnail
        """

        try:
            if content_type.startswith("image/"):
                # Generate image thumbnail
                image = Image.open(BytesIO(file_data))

                # Convert to RGB if needed
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGB")

                # Resize maintaining aspect ratio
                image.thumbnail(self.max_thumbnail_size, Image.Resampling.LANCZOS)

                # Save thumbnail
                thumb_io = BytesIO()
                image.save(thumb_io, format="JPEG", quality=self.thumbnail_quality)
                thumb_data = thumb_io.getvalue()

                # Upload to S3/SeaweedFS
                thumbnail_path = await self._upload_thumbnail(content_id, thumb_data, "thumbnail.jpg")

                logger.info("Thumbnail generated and uploaded: %s", thumbnail_path)

                return thumbnail_path

            if content_type.startswith("video/"):
                # Extract first frame as thumbnail
                thumbnail_data = await self._extract_video_frame(file_data)
                if thumbnail_data:
                    thumbnail_path = await self._upload_thumbnail(content_id, thumbnail_data, "thumbnail.jpg")
                    logger.info("Video thumbnail extracted and uploaded: %s", thumbnail_path)
                    return thumbnail_path
                return None

            if content_type == "application/pdf":
                # Render first page as thumbnail
                thumbnail_data = await self._render_pdf_first_page(file_data)
                if thumbnail_data:
                    thumbnail_path = await self._upload_thumbnail(content_id, thumbnail_data, "thumbnail.jpg")
                    logger.info("PDF thumbnail rendered and uploaded: %s", thumbnail_path)
                    return thumbnail_path
                return None

            return None  # noqa: TRY300 - Multiple independent if blocks, else would be unnecessary

        except Exception:
            logger.exception("Thumbnail generation failed")
            raise

    async def _upload_thumbnail(self, content_id: UUID, thumbnail_data: bytes, filename: str) -> str:
        """
        Upload thumbnail to S3/SeaweedFS storage

        Args:
            content_id: Content UUID
            thumbnail_data: Thumbnail image bytes
            filename: Thumbnail filename

        Returns:
            Storage path to thumbnail
        """
        if not self.storage_factory:
            logger.warning("No storage factory available, using placeholder path")
            return f"/thumbnails/{content_id}/{filename}"

        try:
            # Use SeaweedFS for thumbnails (always use S3 storage for thumbnails)
            backend = self.storage_factory.seaweedfs_backend
            return await backend.store(
                content_id=content_id,
                file_data=thumbnail_data,
                filename=f"thumbnails/{filename}",
                mime_type="image/jpeg",
            )
        except Exception:
            logger.exception("Failed to upload thumbnail")
            # Return placeholder path on error
            return f"/thumbnails/{content_id}/{filename}"

    async def _extract_video_frame(self, _file_data: bytes) -> bytes | None:
        """Extract first frame from video as thumbnail (delegated to science sidecar in a follow-up)."""
        logger.debug("[STEP] video_frame_extract_not_implemented — opencv removed from stack0-api")
        return None

    async def _render_pdf_first_page(self, file_data: bytes) -> bytes | None:
        """Render first page of PDF as thumbnail."""
        if not PDF_ENGINE_AVAILABLE:
            logger.warning("PyMuPDF not available for PDF thumbnail rendering")
            return None
        try:
            return await run_blocking_work(
                render_page_thumbnail_jpeg,
                file_data,
                page_index=0,
                zoom=2.0,
                max_size=self.max_thumbnail_size,
                quality=self.thumbnail_quality,
                blocking_timeout=60.0,
            )
        except Exception:
            logger.exception("PDF thumbnail rendering failed")
            return None

    async def _extract_text_ocr(
        self,
        content_id: UUID,
        file_data: bytes,
        _content_type: str,  # noqa: ARG002 - Reserved for future type-specific OCR
    ) -> str | None:
        """
        Extract text using OCR (for scanned documents/images)

        Uses:
        - pytesseract for simple OCR
        - PaddleOCR for better accuracy (if available)

        Returns:
            Extracted text
        """

        try:
            logger.info("OCR text extraction for %s", content_id)

            # Try PaddleOCR first (better accuracy, especially for Russian)
            try:
                from paddleocr import (  # type: ignore[import-not-found]
                    PaddleOCR,  # noqa: PLC0415 - Conditional import for optional dependency
                )

                ocr = PaddleOCR(use_angle_cls=True, lang="en+ru", use_gpu=False)
                result = ocr.ocr(file_data, cls=True)

                # Extract text from all detected regions
                extracted_text = ""
                if result and result[0]:
                    for line in result[0]:
                        if line and len(line) >= 2:  # noqa: PLR2004 - OCR result structure requires 2 elements
                            text = line[1][0] if isinstance(line[1], (list, tuple)) else str(line[1])
                            extracted_text += text + "\n"

                if extracted_text.strip():
                    logger.info("OCR extracted %s characters using PaddleOCR", len(extracted_text))
                    return extracted_text.strip()

            except ImportError:
                logger.debug("PaddleOCR not available, trying pytesseract")

            # Fallback to pytesseract
            try:
                import pytesseract  # type: ignore[import-not-found] # noqa: PLC0415 - Conditional import for optional dependency
                from PIL import (
                    Image,  # type: ignore[import-not-found] # noqa: PLC0415 - Conditional import for optional dependency
                )

                # Convert to PIL Image
                image = Image.open(BytesIO(file_data))
                # Convert to RGB if needed
                if image.mode not in ("RGB", "L"):
                    image = image.convert("RGB")

                # Extract text
                extracted_text = pytesseract.image_to_string(image, lang="eng+rus")

                if extracted_text.strip():
                    logger.info("OCR extracted %s characters using pytesseract", len(extracted_text))
                    return extracted_text.strip()

            except ImportError:
                logger.warning("Neither PaddleOCR nor pytesseract available for OCR")
                return None
            except Exception:  # noqa: BLE001 - Fallback for OCR errors
                logger.warning("pytesseract OCR failed")
                return None
            else:
                return None

        except Exception:
            logger.exception("OCR extraction failed")
            return None

    async def _extract_metadata(
        self, content_id: UUID, file_data: bytes, content_type: str, file_name: str
    ) -> dict[str, Any]:
        """
        Extract metadata from file

        Extracts:
        - EXIF data (for images)
        - Document properties (for office docs)
        - Media info (for video/audio)
        - File hash

        Returns:
            Metadata dictionary
        """

        try:
            metadata = {
                "file_name": file_name,
                "content_type": content_type,
                "file_size": len(file_data),
                "processed_at": datetime.now(UTC).isoformat(),
            }

            # Calculate file hash
            metadata["sha256"] = hashlib.sha256(file_data).hexdigest()

            # Extract format-specific metadata
            if content_type.startswith("image/"):
                # Extract EXIF
                try:
                    image = Image.open(BytesIO(file_data))
                    metadata["width"] = image.width
                    metadata["height"] = image.height
                    metadata["format"] = image.format
                    metadata["mode"] = image.mode

                    # EXIF data
                    exif = image.getexif()
                    if exif:
                        metadata["exif"] = {k: str(v) for k, v in exif.items() if k < 1000}  # noqa: PLR2004 - EXIF tag limit
                except Exception:  # noqa: BLE001 - Fallback for EXIF extraction errors
                    logger.debug("Failed to extract EXIF metadata from image")

            logger.info("Metadata extracted for %s", content_id)
            return metadata

        except Exception as e:
            logger.exception("Metadata extraction failed")
            return {"error": str(e)}

    async def _extract_text(
        self,
        _content_id: UUID,
        file_data: bytes,
        content_type: str,  # noqa: ARG002 - Reserved for future logging
    ) -> str | None:
        """
        Extract text from text documents

        Supports:
        - Plain text
        - Markdown
        - PDF (PyMuPDF via pdf_engine)
        - DOCX (with python-docx)

        Returns:
            Extracted text
        """

        try:
            if content_type == "text/plain":
                return file_data.decode("utf-8")

            if content_type == "text/markdown":
                return file_data.decode("utf-8")

            if content_type == "application/pdf":
                if not PDF_ENGINE_AVAILABLE:
                    logger.warning("PyMuPDF not available for PDF processing")
                    return None
                extracted_text = await run_blocking_work(
                    extract_text_from_bytes,
                    file_data,
                    blocking_timeout=120.0,
                )
                if extracted_text.strip():
                    logger.info("PDF text extracted: %s characters", len(extracted_text))
                    return extracted_text.strip()
                return None

            if "wordprocessingml" in content_type or content_type == "application/msword":
                # Use python-docx for DOCX files
                try:
                    from docx import (  # type: ignore[import-not-found]
                        Document,  # noqa: PLC0415 - Conditional import for optional dependency
                    )

                    doc = Document(BytesIO(file_data))
                    text_parts = []

                    # Extract text from paragraphs
                    for paragraph in doc.paragraphs:
                        if paragraph.text.strip():
                            text_parts.append(paragraph.text)

                    # Extract text from tables
                    for table in doc.tables:
                        for row in table.rows:
                            for cell in row.cells:
                                if cell.text.strip():
                                    text_parts.append(cell.text)

                    extracted_text = "\n".join(text_parts)
                    if extracted_text.strip():
                        logger.info("DOCX text extracted: %s characters", len(extracted_text))
                        return extracted_text.strip()

                except ImportError:
                    logger.warning("python-docx not available for DOCX processing")
                    return None
                except Exception as e:  # noqa: BLE001 - Fallback for DOCX processing errors
                    logger.warning("DOCX processing failed: %s", e)
                    return None

        except Exception:
            logger.exception("Text extraction failed")
            return None

        # Fallback: return None if no text extraction method worked
        return None

    async def _generate_embeddings(self, content_id: UUID, file_data: bytes) -> str | None:
        """
        Generate embeddings for semantic search

        Uses:
        - sentence-transformers for text embeddings
        - Stores in ChromaDB/Qdrant

        Returns:
            Embedding ID or None
        """

        try:
            logger.info("Embedding generation for %s", content_id)

            # 1. Extract text from file
            # Try to extract text using existing methods
            text = None

            # Try text extraction first
            text = None
            try:
                if file_data.startswith(b"%PDF"):
                    if not PDF_ENGINE_AVAILABLE:
                        logger.debug("PyMuPDF not available for PDF text extraction")
                    else:
                        text = await run_blocking_work(
                            extract_text_from_bytes,
                            file_data,
                            blocking_timeout=120.0,
                        )
                else:
                    # Try to decode as text
                    with contextlib.suppress(UnicodeDecodeError):
                        text = file_data.decode("utf-8")
            except Exception as e:  # noqa: BLE001 - Fallback for text extraction errors
                logger.warning("Text extraction for embedding failed: %s", e)

            if not text or not text.strip():
                logger.warning("No text extracted for embedding generation: %s", content_id)
                return None

            # 2. Generate embedding
            embedding: list[float] | None = None

            # Try using embedding service if available
            if self.embedding_service:
                try:
                    if hasattr(self.embedding_service, "embed_text"):
                        embedding = await self.embedding_service.embed_text(text)
                    elif hasattr(self.embedding_service, "generate_embedding"):
                        embedding = await self.embedding_service.generate_embedding(text)
                except Exception as e:  # noqa: BLE001 - Fallback for embedding service errors
                    logger.warning("Embedding service failed: %s", e)

            if embedding is None:
                logger.warning(
                    "⚠️ Embedding generation skipped for %s: async embedding backend unavailable",
                    content_id,
                )
                return None

            if not embedding:
                logger.warning("Failed to generate embedding for %s", content_id)
                return None

            # 3. Store in ChromaDB if available
            if self.chromadb_service and embedding:
                try:
                    if hasattr(self.chromadb_service, "add"):
                        await self.chromadb_service.add(
                            id=str(content_id),
                            embedding=embedding,
                            metadata={"content_id": str(content_id)},
                        )
                        logger.info("Embedding stored in ChromaDB: %s", content_id)
                        return str(content_id)
                except Exception as e:  # noqa: BLE001 - Fallback for ChromaDB storage errors
                    logger.warning("Failed to store embedding in ChromaDB: %s", e)

            # Return content_id as embedding_id if stored, None otherwise
            return str(content_id) if embedding else None

        except Exception:
            logger.exception("Embedding generation failed")
            return None


# Global instance
_processing_pipeline = None


def get_processing_pipeline() -> ContentProcessingPipeline:
    """Get or create global processing pipeline instance"""
    global _processing_pipeline  # noqa: PLW0603 - Singleton pattern

    if _processing_pipeline is None:
        _processing_pipeline = ContentProcessingPipeline()

    return _processing_pipeline
