#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Extract audio metadata for Unified Content items using ffprobe.
# Invariants:
# - Blocking ffprobe subprocess calls run behind the shared blocking-work bulkhead.
# - Processor updates content status exactly once per process call.
# Related:
# - api/services/unified_content/processors/base.py
# ---
"""Audio Processor: extracts audio metadata."""

import json
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from uuid import UUID

from api.utils.blocking import run_blocking_work

from .base import ContentProcessor

logger = logging.getLogger(__name__)


class AudioProcessor(ContentProcessor):
    """Audio processor for metadata extraction"""

    async def process(self, content_id: UUID, file_data: bytes, filename: str, mime_type: str) -> dict[str, Any]:
        """
        Extract audio metadata

        Returns:
            {
                "metadata": {
                    "duration": float,
                    "bitrate": int,
                    "sample_rate": int,
                    "channels": int,
                    "format": str
                },
                "processing_status": "completed" | "failed"
            }
        """
        try:
            # Create temp file for audio
            with tempfile.NamedTemporaryFile(suffix=Path(filename).suffix, delete=False) as audio_file:
                audio_file.write(file_data)
                audio_path = audio_file.name

            # Extract metadata using ffprobe
            metadata = await self._extract_metadata(audio_path)

            # Clean up temp file
            Path(audio_path).unlink(missing_ok=True)

            # Update database
            await self.update_content(content_id=content_id, metadata=metadata, processing_status="completed")

            logger.info(
                f"Audio processed: {content_id} | "
                f"Duration: {metadata.get('duration', 0)}s | "
                f"Format: {metadata.get('format', 'unknown')}"
            )

            return {
                "extracted_text": None,
                "thumbnail_path": None,
                "metadata": metadata,
                "processing_status": "completed",
                "processing_error": None,
            }

        except Exception as e:
            logger.exception("Audio processing failed for %s", content_id)

            # Clean up
            if "audio_path" in locals():
                Path(audio_path).unlink(missing_ok=True)

            await self.update_content(content_id=content_id, processing_status="failed", processing_error=str(e))

            return {
                "extracted_text": None,
                "thumbnail_path": None,
                "metadata": {},
                "processing_status": "failed",
                "processing_error": str(e),
            }

    async def _extract_metadata(self, audio_path: str) -> dict[str, Any]:
        """Extract audio metadata using ffprobe"""
        try:
            cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration,bit_rate:stream=codec_name,sample_rate,channels",
                "-of",
                "json",
                audio_path,
            ]

            result = await run_blocking_work(
                subprocess.run,
                cmd,
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
                blocking_timeout=35.0,
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

                # Stream info (first audio stream)
                if data.get("streams"):
                    stream = data["streams"][0]
                    metadata["format"] = stream.get("codec_name", "unknown")
                    metadata["sample_rate"] = stream.get("sample_rate", 0)
                    metadata["channels"] = stream.get("channels", 0)

                return metadata

            return {}

        except Exception as e:
            logger.warning("Failed to extract audio metadata: %s", e)
            return {}
