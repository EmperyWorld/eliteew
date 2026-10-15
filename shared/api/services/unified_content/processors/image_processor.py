#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Generate WebP display thumbnails and extract image metadata for Unified Content items.
# Invariants:
# - Pillow decoding/resizing/encoding runs behind the shared blocking-work bulkhead.
# - Processor updates content status exactly once per process call.
# - HEIC/HEIF: best-effort pillow_heif opener if installed; else unsupported_image_format (no invent).
# - Thumbnail derivative is WebP; original bytes stay on the content object for download.
# Related:
# - api/services/unified_content/processors/base.py
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# ---
"""Image Processor: generates WebP thumbnails and extracts image metadata."""

import logging
from io import BytesIO
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from PIL import (  # type: ignore[import-untyped]
    Image,
    UnidentifiedImageError,
)

from api.services.unified_content.storage_backends import MinIOStorage
from api.utils.blocking import run_blocking_work

from .base import ContentProcessor

logger = logging.getLogger(__name__)

_HEIF_OPENER_TRIED = False
_HEIF_OPENER_OK = False


def _ensure_heif_opener() -> bool:
    """Register pillow_heif opener once when the optional package is present."""
    global _HEIF_OPENER_TRIED, _HEIF_OPENER_OK
    if _HEIF_OPENER_TRIED:
        return _HEIF_OPENER_OK
    _HEIF_OPENER_TRIED = True
    try:
        from pillow_heif import register_heif_opener  # type: ignore[import-not-found]

        register_heif_opener()
        _HEIF_OPENER_OK = True
        logger.info("[STEP] unified_content_heif_opener_registered")
        return True
    except Exception:
        _HEIF_OPENER_OK = False
        logger.debug("[STEP] unified_content_heif_opener_unavailable", exc_info=True)
        return False


def _unsupported_image_error(mime_type: str, filename: str, exc: BaseException) -> str:
    mime = (mime_type or "").strip().casefold() or "application/octet-stream"
    name = (filename or "").casefold()
    if mime in {"image/heic", "image/heif"} or name.endswith((".heic", ".heif")):
        return f"unsupported_image_format: {mime}"
    if isinstance(exc, UnidentifiedImageError):
        return f"unsupported_image_format: {mime}"
    return str(exc)


def sniff_image_media_type(data: bytes, storage_path: str | None = None) -> str:
    """Detect thumbnail media type from bytes or path (WebP preferred, legacy JPEG)."""
    path = (storage_path or "").casefold()
    if path.endswith(".webp"):
        return "image/webp"
    if path.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    return "image/jpeg"


class ImageProcessor(ContentProcessor):
    """Image processor with WebP thumbnail generation"""

    THUMBNAIL_SIZE: tuple[int, int] = (512, 512)
    THUMBNAIL_QUALITY: int = 82

    def __init__(self, db_pool: asyncpg.Pool):
        super().__init__(db_pool)
        # MinIO for thumbnail storage
        self.minio_storage = MinIOStorage()

    async def process(self, content_id: UUID, file_data: bytes, filename: str, mime_type: str) -> dict[str, Any]:
        """
        Generate thumbnail and extract image metadata

        Returns:
            {
                "thumbnail_path": str,
                "metadata": {
                    "width": int,
                    "height": int,
                    "format": str,
                    "mode": str,
                    ...
                },
                "processing_status": "completed" | "failed"
            }
        """
        try:
            metadata, thumbnail_data = await run_blocking_work(
                self._extract_metadata_and_thumbnail,
                file_data,
                mime_type,
                filename,
                blocking_timeout=30.0,
            )

            # Store WebP display derivative in object storage
            thumbnail_filename = f"thumbnail_{content_id}.webp"
            thumbnail_path = await self.minio_storage.store(
                content_id=content_id,
                file_data=thumbnail_data,
                filename=thumbnail_filename,
                mime_type="image/webp",
            )
            metadata = {
                **metadata,
                "display_derivative": "webp",
            }

            # Update database
            await self.update_content(
                content_id=content_id,
                thumbnail_path=thumbnail_path,
                metadata=metadata,
                processing_status="completed",
            )

            logger.info(
                f"Image processed: {content_id} | "
                f"Size: {metadata['width']}x{metadata['height']} | "
                f"Thumbnail: {thumbnail_path}"
            )

            return {
                "extracted_text": None,
                "thumbnail_path": thumbnail_path,
                "metadata": metadata,
                "processing_status": "completed",
                "processing_error": None,
            }

        except Exception as e:
            err = _unsupported_image_error(mime_type, filename, e)
            logger.exception("Image processing failed for %s err=%s", content_id, err[:200])

            # Update with error status
            await self.update_content(content_id=content_id, processing_status="failed", processing_error=err)

            return {
                "extracted_text": None,
                "thumbnail_path": None,
                "metadata": {},
                "processing_status": "failed",
                "processing_error": err,
            }

    def _extract_metadata_and_thumbnail(
        self,
        file_data: bytes,
        mime_type: str = "",
        filename: str = "",
    ) -> tuple[dict[str, Any], bytes]:
        """Run Pillow decode/resize/encode synchronously inside a worker thread."""
        mime = (mime_type or "").strip().casefold()
        name = (filename or "").casefold()
        if mime in {"image/heic", "image/heif"} or name.endswith((".heic", ".heif")):
            _ensure_heif_opener()

        try:
            image = Image.open(BytesIO(file_data))
        except UnidentifiedImageError as exc:
            raise UnidentifiedImageError(_unsupported_image_error(mime_type, filename, exc)) from exc

        metadata = {
            "width": image.width,
            "height": image.height,
            "format": image.format,
            "mode": image.mode,
        }

        getexif = getattr(image, "_getexif", None)
        if callable(getexif):
            exif_data = getexif()
            if isinstance(exif_data, dict) and exif_data:
                metadata["exif"] = {k: str(v) for k, v in exif_data.items() if k and v}

        thumbnail = image.copy()
        thumbnail.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

        if thumbnail.mode in ("P", "LA"):
            thumbnail = thumbnail.convert("RGBA")
        elif thumbnail.mode not in ("RGB", "RGBA"):
            thumbnail = thumbnail.convert("RGB")

        thumbnail_buffer = BytesIO()
        thumbnail.save(
            thumbnail_buffer,
            format="WEBP",
            quality=self.THUMBNAIL_QUALITY,
            method=4,
        )
        return metadata, thumbnail_buffer.getvalue()
