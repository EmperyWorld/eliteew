#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Apache Tika client for Business Intelligence document text/metadata extraction.
# Invariants:
# - HTTP extraction is guarded by a process-local semaphore and per-call timeout.
# - Extracted text is capped before returning to BI analyzers to avoid unbounded prompt/input growth.
# Related:
# - api/routers/business_intelligence.py
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---
"""Tika text extraction service for Business Intelligence."""

import asyncio
import io
import logging
from pathlib import Path
from typing import Any

import aiohttp  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)
_TIKA_EXTRACT_SEMAPHORE = asyncio.Semaphore(4)
_TIKA_TIMEOUT = aiohttp.ClientTimeout(total=45)
_TIKA_MAX_EXTRACTED_CHARS = 500_000

# Try to import tika-python for local fallback
try:
    from tika import parser as tika_parser  # type: ignore[import-not-found]

    TIKA_PYTHON_AVAILABLE = True
except ImportError:
    TIKA_PYTHON_AVAILABLE = False
    tika_parser = None  # type: ignore[assignment]


class TikaService:
    """Production-ready Apache Tika service for text extraction"""

    def __init__(self, tika_url: str = "http://stack4-tika:9998"):
        """
        Initialize Tika service

        Args:
            tika_url: Tika server URL
        """
        self.tika_url = tika_url
        self.session: aiohttp.ClientSession | None = None

        # Supported file extensions
        self.SUPPORTED_EXTENSIONS = {
            # Documents
            ".pdf",
            ".doc",
            ".docx",
            ".txt",
            ".rtf",
            ".odt",
            # Spreadsheets
            ".xlsx",
            ".xls",
            ".csv",
            ".ods",
            # Presentations
            ".pptx",
            ".ppt",
            ".odp",
            # Web
            ".html",
            ".htm",
            ".xml",
            ".json",
            # Images (with OCR)
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".bmp",
            ".tiff",
            # Archives
            ".zip",
            ".rar",
            ".7z",
            ".tar",
            ".gz",
        }

    async def __aenter__(self):
        """Async context manager entry"""
        await self.ensure_session()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        """Async context manager exit"""
        await self.close()

    async def ensure_session(self) -> None:
        """Ensure HTTP session is active (uses central client)."""
        if not self.session:
            from api.core.http_clients import get_aiohttp_session

            self.session = get_aiohttp_session()

    async def close(self) -> None:
        """Central session is closed at app shutdown; just clear ref."""
        self.session = None

    async def health_check(self) -> bool:
        """
        Check if Tika server is available.

        Note: This method creates a temporary session if called without context manager.
        For better resource management, use 'async with TikaService() as tika: tika.health_check()'
        """
        try:
            # Use temporary session to avoid leaving unclosed sessions
            timeout = aiohttp.ClientTimeout(total=5)
            async with (
                aiohttp.ClientSession(timeout=timeout) as temp_session,
                temp_session.get(f"{self.tika_url}/tika") as response,
            ):
                if response.status == 200:
                    logger.info("Tika server is healthy: %s", self.tika_url)
                    return True
                logger.warning("Tika server returned %s", response.status)
                return False
        except Exception:
            logger.exception("Tika health check failed")
            return False

    def is_supported(self, filename: str) -> bool:
        """
        Check if file type is supported

        Args:
            filename: File name with extension

        Returns:
            True if supported
        """
        ext = Path(filename).suffix.lower()
        return ext in self.SUPPORTED_EXTENSIONS

    async def extract_text_from_file(self, file_path: str, **kwargs) -> dict[str, Any]:
        """
        Extract text from file path

        Args:
            file_path: Path to file
            **kwargs: Additional extraction options

        Returns:
            (dict[str, Any]) with extracted data:
            {
                "text": str,
                "metadata": dict,
                "language": str,
                "content_type": str,
                "success": bool,
                "error": str | None
            }
        """
        try:
            await self.ensure_session()

            # Read file
            with open(file_path, "rb") as f:
                file_data = f.read()

            return await self.extract_text_from_bytes(file_data, filename=Path(file_path).name, **kwargs)

        except FileNotFoundError:
            logger.exception("File not found: %s", file_path)
            return self._error_response(f"File not found: {file_path}")
        except Exception as e:
            logger.exception("Failed to extract from file %s", file_path)
            return self._error_response(str(e))

    async def extract_text_from_bytes(
        self, file_data: bytes, filename: str = "document", extract_metadata: bool = True, **kwargs
    ) -> dict[str, Any]:
        """
        Extract text from bytes

        Args:
            file_data: File content as bytes
            filename: Original filename (for type detection)
            extract_metadata: Extract metadata along with text
            **kwargs: Additional extraction options

        Returns:
            (dict[str, Any]) with extracted data
        """
        # For plain text files, use UTF-8 decode directly without Tika
        # This avoids unnecessary connection attempts when Tika is unavailable
        text_extensions = {
            ".txt",
            ".md",
            ".log",
            ".csv",
            ".json",
            ".xml",
            ".html",
            ".htm",
            ".css",
            ".js",
            ".ts",
            ".py",
            ".sh",
            ".yaml",
            ".yml",
            ".ini",
            ".conf",
            ".cfg",
        }
        file_ext = Path(filename).suffix.lower()
        if file_ext in text_extensions:
            logger.debug("📄 Plain text file detected (%s), using UTF-8 decode directly", filename)
            return await self._fallback_utf8_decode(file_data, filename)

        try:
            await self.ensure_session()
            if self.session is None:
                msg = "Failed to establish Tika session"
                raise RuntimeError(msg)

            # Determine endpoint
            endpoint = f"{self.tika_url}/rmeta/text" if extract_metadata else f"{self.tika_url}/tika"

            # Headers
            headers = {
                "Accept": "application/json" if extract_metadata else "text/plain",
                "Content-Type": "application/octet-stream",
            }

            async with (
                _TIKA_EXTRACT_SEMAPHORE,
                self.session.put(endpoint, data=file_data, headers=headers, timeout=_TIKA_TIMEOUT) as response,
            ):
                if response.status == 200:
                    if extract_metadata:
                        # Parse JSON response with metadata
                        result = await response.json()

                        # Tika returns list, take first element
                        metadata_raw = result[0] if isinstance(result, list) and len(result) > 0 else result

                        # Ensure metadata is a dict
                        if not isinstance(metadata_raw, dict):
                            metadata: dict[str, Any] = {}
                        else:
                            metadata = metadata_raw

                        text = str(metadata.get("X-TIKA:content", ""))[:_TIKA_MAX_EXTRACTED_CHARS]
                        content_type = metadata.get("Content-Type", "unknown")
                        language = metadata.get("language", "unknown")

                        # Clean metadata (remove binary/large fields)
                        clean_metadata = {
                            k: v
                            for k, v in metadata.items()
                            if k not in ["X-TIKA:content"] and isinstance(v, (str, int, float, list))
                        }

                        return {
                            "text": text.strip(),
                            "metadata": clean_metadata,
                            "language": language,
                            "content_type": content_type,
                            "filename": filename,
                            "size": len(file_data),
                            "char_count": len(text.strip()),
                            "success": True,
                            "error": None,
                        }
                    # Plain text response
                    text = (await response.text())[:_TIKA_MAX_EXTRACTED_CHARS]
                    return {
                        "text": text.strip(),
                        "metadata": {},
                        "language": "unknown",
                        "content_type": "unknown",
                        "filename": filename,
                        "size": len(file_data),
                        "char_count": len(text.strip()),
                        "success": True,
                        "error": None,
                    }
                error_text = await response.text()
                logger.error("Tika returned %s: %s", response.status, error_text)
                return self._error_response(f"Tika error {response.status}: {error_text}")

        except (TimeoutError, aiohttp.ClientConnectorError, aiohttp.ClientConnectorDNSError) as e:
            # HTTP Tika server unavailable - try local tika-python fallback
            logger.warning(
                "⚠️ Tika HTTP server unavailable (%s), trying local tika-python fallback for %s",
                type(e).__name__,
                filename,
            )
            return await self._extract_with_local_tika(file_data, filename, extract_metadata)
        except Exception as e:
            logger.exception("Tika extraction failed for %s", filename)
            return self._error_response(str(e))

    async def extract_html_from_bytes(self, file_data: bytes, filename: str = "document") -> str | None:
        """Extract rich HTML representation preserving document structure."""
        try:
            await self.ensure_session()
            if self.session is None:
                msg = "Failed to establish Tika session"
                raise RuntimeError(msg)

            headers = {"Accept": "text/html", "Content-Type": "application/octet-stream"}

            async with (
                _TIKA_EXTRACT_SEMAPHORE,
                self.session.put(
                    f"{self.tika_url}/tika", data=file_data, headers=headers, timeout=_TIKA_TIMEOUT
                ) as response,
            ):
                if response.status == 200:
                    return await response.text()

                logger.warning("Tika HTML extraction returned %s for %s", response.status, filename)
                return None
        except Exception:
            logger.exception("Failed to extract HTML from bytes: %s", filename)
            return None

    async def extract_text_from_url(self, url: str, **kwargs) -> dict[str, Any]:
        """
        Extract text from URL

        Args:
            url: URL to document
            **kwargs: Additional extraction options

        Returns:
            (dict[str, Any]) with extracted data
        """
        try:
            from urllib.parse import urlparse

            from api.services.safe_url_transport import fetch_url

            result = await fetch_url(url, max_bytes=20 * 1024 * 1024, timeout_sec=45.0)
            filename = Path(urlparse(result.url).path).name or "document"
            return await self.extract_text_from_bytes(result.body, filename=filename, **kwargs)

        except Exception as e:
            logger.exception("Failed to extract from URL %s", url)
            return self._error_response(str(e))

    async def detect_language(self, text: str) -> str:
        """
        Detect text language using Tika

        Args:
            text: Text to analyze

        Returns:
            Language code (e.g., 'en', 'ru', 'unknown')
        """
        try:
            await self.ensure_session()
            if self.session is None:
                msg = "Failed to establish Tika session"
                raise RuntimeError(msg)

            endpoint = f"{self.tika_url}/language/stream"
            headers = {"Content-Type": "text/plain"}

            async with self.session.put(endpoint, data=text.encode("utf-8"), headers=headers) as response:
                if response.status == 200:
                    language = await response.text()
                    return language.strip()
                return "unknown"

        except Exception:
            logger.exception("Language detection failed")
            return "unknown"

    async def extract_metadata_only(self, file_data: bytes, filename: str = "document") -> dict[str, Any]:
        """
        Extract only metadata without text

        Args:
            file_data: File content
            filename: Original filename

        Returns:
            (dict[str, Any]) with metadata
        """
        try:
            await self.ensure_session()
            if self.session is None:
                msg = "Failed to establish Tika session"
                raise RuntimeError(msg)

            endpoint = f"{self.tika_url}/meta"
            headers = {"Content-Type": "application/octet-stream"}

            async with self.session.put(endpoint, data=file_data, headers=headers) as response:
                if response.status == 200:
                    metadata = await response.json()
                    return {
                        "metadata": metadata,
                        "filename": filename,
                        "success": True,
                        "error": None,
                    }
                error_text = await response.text()
                return self._error_response(f"Metadata extraction failed: {error_text}")

        except Exception as e:
            logger.exception("Metadata extraction failed")
            return self._error_response(str(e))

    async def _extract_with_local_tika(self, file_data: bytes, filename: str, extract_metadata: bool) -> dict[str, Any]:
        """
        Extract text using local tika-python library as fallback

        Args:
            file_data: File content as bytes
            filename: Original filename
            extract_metadata: Extract metadata along with text

        Returns:
            (dict[str, Any]) with extracted data
        """
        if not TIKA_PYTHON_AVAILABLE or tika_parser is None:
            logger.warning("tika-python not available, falling back to UTF-8 decode")
            return await self._fallback_utf8_decode(file_data, filename)

        try:
            # Run tika-python in thread pool (it's synchronous)
            def _extract_sync() -> dict[str, Any]:
                """Synchronous extraction using tika-python"""
                assert tika_parser is not None, "tika_parser should be available here"
                file_obj = io.BytesIO(file_data)
                parsed = tika_parser.from_buffer(file_obj)

                if parsed is None:
                    return {"text": "", "metadata": {}, "success": False}

                text = parsed.get("content", "").strip() if parsed.get("content") else ""
                metadata = parsed.get("metadata", {}) if parsed.get("metadata") else {}

                # Extract common metadata fields
                content_type = metadata.get("Content-Type", "unknown")
                language = metadata.get("language", "unknown")

                # Clean metadata (remove binary/large fields)
                clean_metadata = {k: v for k, v in metadata.items() if isinstance(v, (str, int, float, list))}

                return {
                    "text": text,
                    "metadata": clean_metadata,
                    "language": language,
                    "content_type": content_type,
                    "filename": filename,
                    "size": len(file_data),
                    "char_count": len(text),
                    "success": True,
                    "error": None,
                }

            # Run in thread pool to avoid blocking
            result = await asyncio.to_thread(_extract_sync)

            if result.get("success"):
                logger.info(
                    "✅ Extracted %s characters from %s using local tika-python",
                    result.get("char_count", 0),
                    filename,
                )
            else:
                logger.warning("Local tika-python extraction failed, trying UTF-8 decode")
                return await self._fallback_utf8_decode(file_data, filename)

            return result

        except Exception as e:
            logger.warning("Local tika-python extraction error: %s, trying UTF-8 decode", str(e))
            return await self._fallback_utf8_decode(file_data, filename)

    async def _fallback_utf8_decode(self, file_data: bytes, filename: str) -> dict[str, Any]:
        """
        Final fallback: try to decode as UTF-8 text

        Args:
            file_data: File content as bytes
            filename: Original filename

        Returns:
            (dict[str, Any]) with extracted data
        """
        try:
            text = file_data.decode("utf-8", errors="ignore").strip()
            logger.info(
                "✅ Decoded %s characters from %s using UTF-8 fallback",
                len(text),
                filename,
            )
            return {
                "text": text,
                "metadata": {},
                "language": "unknown",
                "content_type": "text/plain",
                "filename": filename,
                "size": len(file_data),
                "char_count": len(text),
                "success": True,
                "error": None,
            }
        except Exception as e:
            logger.error("UTF-8 decode fallback failed for %s: %s", filename, str(e))
            return self._error_response(f"All extraction methods failed: {str(e)}")

    def _error_response(self, error: str) -> dict[str, Any]:
        """Generate standardized error response"""
        return {
            "text": "",
            "metadata": {},
            "language": "unknown",
            "content_type": "unknown",
            "filename": "",
            "size": 0,
            "char_count": 0,
            "success": False,
            "error": error,
        }

    # ========================================
    # BATCH OPERATIONS
    # ========================================

    async def extract_from_multiple_files(
        self,
        files: list[tuple[bytes, str]],  # List of (file_data, filename)
        **kwargs,
    ) -> list[dict[str, Any]]:
        """
        Extract text from multiple files in parallel

        Args:
            files: List of tuples (file_data, filename)
            **kwargs: Extraction options

        Returns:
            List of extraction results
        """
        tasks = [self.extract_text_from_bytes(file_data, filename, **kwargs) for file_data, filename in files]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions in results
        processed_results: list[dict[str, Any]] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error("Batch extraction failed for file %s: %s", i, result)
                processed_results.append(self._error_response(str(result)))
            else:
                # result is guaranteed to be dict[str, Any] after Exception check
                assert isinstance(result, dict), f"Expected dict, got {type(result)}"
                processed_results.append(result)

        return processed_results

    # ========================================
    # UTILITY METHODS
    # ========================================

    def estimate_extraction_time(self, file_size: int) -> float:
        """
        Estimate extraction time in seconds based on file size

        Args:
            file_size: File size in bytes

        Returns:
            Estimated time in seconds
        """
        # Rough estimates based on empirical testing
        # ~1MB per second for PDFs, ~5MB per second for text
        # Add base overhead of 1 second

        base_overhead = 1.0
        mb_size = file_size / (1024 * 1024)

        # Conservative estimate
        return base_overhead + (mb_size * 2.0)

    def get_supported_formats(self) -> list[str]:
        """Get list of supported file formats"""
        return sorted(self.SUPPORTED_EXTENSIONS)

    async def get_server_info(self) -> dict[str, Any]:
        """
        Get Tika server information.

        Note: This method should be called within context manager for proper session management.
        If called without context manager, uses temporary session.
        """
        try:
            # Check if we're in a context manager (session exists and is not closed)
            if self.session and not self.session.closed:
                # Use existing session
                async with self.session.get(f"{self.tika_url}/version") as response:
                    if response.status == 200:
                        version = await response.text()
                        return {
                            "version": version.strip(),
                            "url": self.tika_url,
                            "healthy": True,
                            "supported_formats": len(self.SUPPORTED_EXTENSIONS),
                        }
                    return {
                        "version": "unknown",
                        "url": self.tika_url,
                        "healthy": False,
                        "supported_formats": 0,
                    }
            else:
                # Use temporary session to avoid leaving unclosed sessions
                timeout = aiohttp.ClientTimeout(total=5)
                async with (
                    aiohttp.ClientSession(timeout=timeout) as temp_session,
                    temp_session.get(f"{self.tika_url}/version") as response,
                ):
                    if response.status == 200:
                        version = await response.text()
                        return {
                            "version": version.strip(),
                            "url": self.tika_url,
                            "healthy": True,
                            "supported_formats": len(self.SUPPORTED_EXTENSIONS),
                        }
                    return {
                        "version": "unknown",
                        "url": self.tika_url,
                        "healthy": False,
                        "supported_formats": 0,
                    }
        except Exception as e:
            logger.exception("Failed to get Tika server info")
            return {
                "version": "unknown",
                "url": self.tika_url,
                "healthy": False,
                "error": str(e),
                "supported_formats": 0,
            }
