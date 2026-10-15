#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Extract video metadata and thumbnails for Unified Content items using ffprobe/ffmpeg.
# Invariants:
# - Blocking ffprobe/ffmpeg subprocess and thumbnail file reads run behind the shared blocking-work bulkhead.
# - Processor updates content status exactly once per process call.
# Related:
# - api/services/unified_content/processors/base.py
# ---
"""Video Processor: extracts metadata and first-frame thumbnails."""

import json
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.unified_content.storage_backends import MinIOStorage
from api.utils.blocking import run_blocking_work

from .base import ContentProcessor

logger = logging.getLogger(__name__)


class VideoProcessor(ContentProcessor):
    """Video processor using ffmpeg"""

    def __init__(self, db_pool: asyncpg.Pool):
        super().__init__(db_pool)
        self.minio_storage = MinIOStorage()

    async def process(self, content_id: UUID, file_data: bytes, filename: str, mime_type: str) -> dict[str, Any]:
        """
        Extract video metadata and first frame as thumbnail

        Returns:
            {
                "thumbnail_path": str,
                "metadata": {
                    "duration": float,
                    "width": int,
                    "height": int,
                    "codec": str,
                    "bitrate": int
                },
                "processing_status": "completed" | "failed"
            }
        """
        try:
            # Create temp file for video
            with tempfile.NamedTemporaryFile(suffix=Path(filename).suffix, delete=False) as video_file:
                video_file.write(file_data)
                video_path = video_file.name

            # Extract metadata using ffprobe
            metadata = await self._extract_metadata(video_path)

            # Extract first frame as thumbnail
            thumbnail_path = await self._extract_thumbnail(content_id, video_path)

            # Clean up temp file
            Path(video_path).unlink(missing_ok=True)

            # Update database
            await self.update_content(
                content_id=content_id,
                thumbnail_path=thumbnail_path,
                metadata=metadata,
                processing_status="completed",
            )

            logger.info(
                f"Video processed: {content_id} | "
                f"Duration: {metadata.get('duration', 0)}s | "
                f"Resolution: {metadata.get('width')}x{metadata.get('height')}"
            )

            return {
                "extracted_text": None,
                "thumbnail_path": thumbnail_path,
                "metadata": metadata,
                "processing_status": "completed",
                "processing_error": None,
            }

        except Exception as e:
            logger.exception("Video processing failed for %s", content_id)

            # Clean up
            if "video_path" in locals():
                Path(video_path).unlink(missing_ok=True)

            await self.update_content(content_id=content_id, processing_status="failed", processing_error=str(e))

            return {
                "extracted_text": None,
                "thumbnail_path": None,
                "metadata": {},
                "processing_status": "failed",
                "processing_error": str(e),
            }

    async def _extract_metadata(self, video_path: str) -> dict[str, Any]:
        """Extract video metadata using ffprobe"""
        try:
            cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration,bit_rate:stream=codec_name,width,height",
                "-of",
                "json",
                video_path,
            ]

            result = await run_blocking_work(
                subprocess.run,
                cmd,
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)

                metadata = {}

                # Format info
                if "format" in data:
                    if "duration" in data["format"]:
                        metadata["duration"] = float(data["format"]["duration"])
                    if "bit_rate" in data["format"]:
                        metadata["bitrate"] = int(data["format"]["bit_rate"])

                # Stream info (first video stream)
                if data.get("streams"):
                    stream = data["streams"][0]
                    metadata["codec"] = stream.get("codec_name", "unknown")
                    metadata["width"] = stream.get("width", 0)
                    metadata["height"] = stream.get("height", 0)

                return metadata

            return {}

        except Exception as e:
            logger.warning("Failed to extract video metadata: %s", e)
            return {}

    async def _extract_thumbnail(self, content_id: UUID, video_path: str) -> str | None:
        """Extract first frame as thumbnail"""
        try:
            # Create temp file for thumbnail
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as thumb_file:
                thumb_path = thumb_file.name

            # Extract frame at 1 second
            cmd = [
                "ffmpeg",
                "-i",
                video_path,
                "-ss",
                "00:00:01",
                "-vframes",
                "1",
                "-vf",
                "scale=256:256:force_original_aspect_ratio=decrease",
                "-y",
                thumb_path,
            ]

            result = await run_blocking_work(
                subprocess.run,
                cmd,
                check=False,
                capture_output=True,
                timeout=30,
            )

            if result.returncode == 0 and Path(thumb_path).exists():
                thumb_data = await run_blocking_work(Path(thumb_path).read_bytes, blocking_timeout=10.0)

                # Store in MinIO
                thumbnail_filename = f"video_thumb_{content_id}.jpg"
                storage_path = await self.minio_storage.store(
                    content_id=content_id,
                    file_data=thumb_data,
                    filename=thumbnail_filename,
                    mime_type="image/jpeg",
                )

                # Clean up temp thumbnail
                Path(thumb_path).unlink(missing_ok=True)

                return storage_path

            return None

        except Exception as e:
            logger.warning("Failed to extract video thumbnail: %s", e)
            return None
