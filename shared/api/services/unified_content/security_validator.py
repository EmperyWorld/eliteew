#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/unified_content/security_validator.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Security Validator for Unified Content System
Implements file type validation, magic byte verification, and malware scanning
"""

import logging
from pathlib import Path
from typing import ClassVar

from api.services.unified_content.clamav_client import (
    ClamAvProtocolError,
    ClamAvUnixClient,
)
from api.utils.blocking import run_blocking_work

try:
    import magic  # type: ignore[import-untyped]

    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
    magic = None  # type: ignore[assignment, unused-ignore]

logger = logging.getLogger(__name__)
if not MAGIC_AVAILABLE:
    logger.warning("libmagic not available - file type detection will be limited")


class SecurityValidator:
    """
    Comprehensive security validation for file uploads

    Features:
    - Whitelist-based file type validation
    - Magic byte verification (not just extension)
    - Executable file blocking
    - MIME type validation
    - File size enforcement
    """

    # Maximum file size: 100MB
    MAX_FILE_SIZE: ClassVar[int] = 100 * 1024 * 1024  # 100MB in bytes

    # Minimum file size for magic byte validation
    MIN_FILE_SIZE_FOR_VALIDATION: ClassVar[int] = 8

    # MIME types allowed when payload is smaller than MIN_FILE_SIZE_FOR_VALIDATION
    SMALL_FILE_SAFE_EXACT_MIMES: ClassVar[frozenset[str]] = frozenset(
        {
            "application/json",
            "application/xml",
            "application/javascript",
            "application/typescript",
        }
    )

    # ALLOW ALL FILE TYPES by default (blacklist-only approach)
    # Only BLOCKED_EXTENSIONS are rejected - everything else is allowed
    # This enables storage of any file format
    ALLOW_ALL_EXTENSIONS: ClassVar[bool] = True

    # Blocked extensions (executables and scripts)
    BLOCKED_EXTENSIONS: ClassVar[set[str]] = {
        ".exe",
        ".dll",
        ".sys",
        ".com",
        ".bat",
        ".cmd",
        ".vbs",
        ".ps1",
        ".sh",
        ".bash",
        ".zsh",
        ".app",
        ".deb",
        ".rpm",
        ".msi",
        ".dmg",
        ".pkg",
        ".bin",
        ".run",
        ".jar",
        ".apk",
        ".scr",
        ".pif",
        ".cpl",
        ".msc",
        ".hta",
        ".vb",
        ".ws",
        ".wsf",
        ".reg",
        ".inf",
        ".ade",
        ".adp",
        ".bas",
        ".chm",
        ".crt",
        ".hlp",
        ".ins",
        ".isp",
        ".jse",
        ".lnk",
        ".mde",
        ".msp",
        ".mst",
        ".pcd",
        ".prf",
        ".scf",
        ".sct",
        ".shb",
        ".shs",
        ".url",
        ".wsc",
        ".gadget",
        ".application",
    }

    # Safe MIME types mapping
    SAFE_MIME_TYPES: ClassVar[dict[str, list[str]]] = {
        # Documents
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        "application/vnd.ms-powerpoint": [".ppt"],
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
        "text/plain": [".txt"],
        "text/csv": [".csv"],
        "text/rtf": [".rtf"],
        "application/rtf": [".rtf"],
        # Images
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/gif": [".gif"],
        "image/bmp": [".bmp"],
        "image/svg+xml": [".svg"],
        "image/webp": [".webp"],
        "image/tiff": [".tiff", ".tif"],
        "image/x-icon": [".ico"],
        # Audio
        "audio/mpeg": [".mp3"],
        "audio/wav": [".wav"],
        "audio/ogg": [".ogg"],
        "audio/flac": [".flac"],
        "audio/mp4": [".m4a"],
        "audio/aac": [".aac"],
        "audio/x-ms-wma": [".wma"],
        # Video
        "video/mp4": [".mp4", ".m4v"],
        "video/x-msvideo": [".avi"],
        "video/quicktime": [".mov"],
        "video/x-ms-wmv": [".wmv"],
        "video/x-flv": [".flv"],
        "video/webm": [".webm"],
        "video/x-matroska": [".mkv"],
        "video/mpeg": [".mpeg", ".mpg"],
        # Archives
        "application/zip": [".zip"],
        "application/x-rar-compressed": [".rar"],
        "application/x-7z-compressed": [".7z"],
        "application/x-tar": [".tar"],
        "application/gzip": [".gz"],
        "application/x-bzip2": [".bz2"],
        # Code/Text
        "application/json": [".json"],
        "application/xml": [".xml"],
        "text/xml": [".xml"],
        "text/yaml": [".yaml", ".yml"],
        "text/markdown": [".md"],
        "text/html": [".html"],
        "text/css": [".css"],
        "application/javascript": [".js"],
        "text/javascript": [".js"],
        "application/typescript": [".ts"],
        "text/x-python": [".py"],
        "text/x-java": [".java"],
        "text/x-c": [".c", ".h"],
        "text/x-c++": [".cpp"],
    }

    # Magic byte signatures for common file types
    MAGIC_SIGNATURES: ClassVar[dict[bytes, str]] = {
        # Documents
        b"%PDF": "application/pdf",
        b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1": "application/msword",  # DOC/XLS/PPT
        b"PK\x03\x04": "application/zip",  # ZIP/DOCX/XLSX/PPTX
        # Images
        b"\xff\xd8\xff": "image/jpeg",
        b"\x89PNG\r\n\x1a\n": "image/png",
        b"GIF87a": "image/gif",
        b"GIF89a": "image/gif",
        b"BM": "image/bmp",
        b"<svg": "image/svg+xml",
        b"RIFF": "image/webp",  # or audio/wav (needs further check)
        # Audio
        b"ID3": "audio/mpeg",  # MP3
        b"\xff\xfb": "audio/mpeg",  # MP3
        b"\xff\xf3": "audio/mpeg",  # MP3
        b"\xff\xf2": "audio/mpeg",  # MP3
        b"fLaC": "audio/flac",
        b"OggS": "audio/ogg",
        # Video
        b"\x00\x00\x00\x18ftypmp4": "video/mp4",
        b"\x00\x00\x00\x20ftypisom": "video/mp4",
        b"RIFF....AVI ": "video/x-msvideo",
        b"\x1a\x45\xdf\xa3": "video/x-matroska",  # MKV
        # Archives
        b"Rar!\x1a\x07": "application/x-rar-compressed",
        b"7z\xbc\xaf\x27\x1c": "application/x-7z-compressed",
    }

    def __init__(self) -> None:
        """Initialize security validator"""
        self.magic_detector = magic.Magic(mime=True) if MAGIC_AVAILABLE and magic is not None else None  # type: ignore[misc]

    def validate_file_size(self, file_size: int) -> tuple[bool, str | None]:
        """
        Validate file size before reading into memory

        Args:
            file_size: File size in bytes

        Returns:
            Tuple of (is_valid, error_message)
        """
        if file_size <= 0:
            return False, "File is empty"

        if file_size > self.MAX_FILE_SIZE:
            size_mb = file_size / (1024 * 1024)
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            return False, f"File too large: {size_mb:.2f}MB (max: {max_mb}MB)"

        return True, None

    def validate_file_extension(self, filename: str) -> tuple[bool, str | None]:
        """
        Validate file extension against whitelist and blacklist

        Args:
            filename: Original filename

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not filename:
            return False, "Filename is empty"

        ext = Path(filename).suffix.lower()

        # Allow files without extension - will be validated by magic bytes later
        # Common case: README, Makefile, Dockerfile, etc.
        if not ext:
            logger.info("File without extension accepted for magic byte validation: %s", filename)
            return True, None

        # Check blocked extensions (executables/scripts)
        if ext in self.BLOCKED_EXTENSIONS:
            return False, f"File type not allowed: {ext} (executable/script)"

        # Allow all other extensions (blacklist-only approach)
        return True, None

    def validate_magic_bytes(
        self, file_data: bytes, filename: str, declared_mime: str | None = None
    ) -> tuple[bool, str | None, str | None]:
        """
        Validate file using magic byte verification

        Args:
            file_data: Binary file data
            filename: Original filename
            declared_mime: MIME type declared by client

        Returns:
            Tuple of (is_valid, error_message, detected_mime_type)
        """
        if len(file_data) < self.MIN_FILE_SIZE_FOR_VALIDATION:
            return self._validate_small_file(file_data, filename, declared_mime)

        try:
            # Get file extension
            ext = Path(filename).suffix.lower()

            # Detect MIME type using python-magic (libmagic) if available
            detected_mime: str | None
            if self.magic_detector:
                detected_mime = self.magic_detector.from_buffer(file_data)
            else:
                # Fallback: try to detect from magic bytes
                detected_mime = self._detect_mime_from_bytes(file_data)
                if not detected_mime:
                    # Last resort: use extension-based detection
                    logger.warning("libmagic not available, using extension-based detection for %s", ext)
                    for mime, exts in self.SAFE_MIME_TYPES.items():
                        if ext in exts:
                            detected_mime = mime
                            break
                    else:
                        detected_mime = "application/octet-stream"

            # ALLOW ALL MIME TYPES (blacklist-only approach)
            # Only check for executable signatures, not MIME type whitelist
            logger.info(
                "MIME type detected: %s | File: %s | Extension: %s",
                detected_mime,
                filename,
                ext,
            )

            # Check for executable signatures in first 512 bytes
            header = file_data[:512]
            if self._contains_executable_signature(header):
                return False, "File contains executable signatures", None

            logger.info(
                "Magic byte validation passed | File: %s | Detected: %s | Declared: %s",
                filename,
                detected_mime,
                declared_mime,
            )

            return True, None, detected_mime

        except Exception as e:
            logger.exception("Magic byte validation error")
            return False, f"File validation failed: {e!s}", None

    async def validate_magic_bytes_async(
        self, file_data: bytes, filename: str, declared_mime: str | None = None
    ) -> tuple[bool, str | None, str | None]:
        """Validate magic bytes outside the request event loop."""
        return await run_blocking_work(
            self.validate_magic_bytes,
            file_data,
            filename,
            declared_mime,
            blocking_timeout=10.0,
        )

    def _detect_mime_from_bytes(self, data: bytes) -> str | None:
        """
        Detect MIME type from magic bytes signature

        Args:
            data: File data bytes

        Returns:
            Detected MIME type or None if not recognized
        """
        for signature, mime_type in self.MAGIC_SIGNATURES.items():
            if data.startswith(signature):
                return mime_type
        return None

    def _contains_executable_signature(self, data: bytes) -> bool:
        """
        Check if data contains executable file signatures

        Args:
            data: First bytes of file

        Returns:
            True if executable signatures detected
        """
        # Windows executable signatures
        if data.startswith(b"MZ"):  # DOS/Windows executable
            return True
        if data.startswith(b"\x7fELF"):  # Linux ELF binary
            return True
        if data.startswith(b"\xca\xfe\xba\xbe"):  # Mach-O binary (macOS)
            return True
        if data.startswith(b"\xfe\xed\xfa"):  # Mach-O binary (macOS, different arch)
            return True

        # Script headers
        if data.startswith((b"#!/bin/sh", b"#!/bin/bash")):
            return True
        if data.startswith(b"#!/usr/bin/env"):
            return True

        # Windows batch/script
        return b"@echo off" in data[:100].lower()

    def _mime_from_extension(self, ext: str) -> str | None:
        if not ext:
            return None
        for mime, exts in self.SAFE_MIME_TYPES.items():
            if ext in exts:
                return mime
        return None

    def _is_small_file_text_safe_mime(self, mime: str) -> bool:
        normalized = mime.split(";", 1)[0].strip().lower()
        if normalized.startswith("text/"):
            return True
        return normalized in self.SMALL_FILE_SAFE_EXACT_MIMES

    def _validate_small_file(
        self, file_data: bytes, filename: str, declared_mime: str | None
    ) -> tuple[bool, str | None, str | None]:
        """Allow tiny text/code payloads (e.g. empty desktop .md) without libmagic."""
        header = file_data[:512]
        if self._contains_executable_signature(header):
            return False, "File contains executable signatures", None

        ext = Path(filename).suffix.lower()
        detected_mime = self._mime_from_extension(ext)
        if detected_mime is None and declared_mime:
            declared = declared_mime.split(";", 1)[0].strip().lower()
            if self._is_small_file_text_safe_mime(declared):
                detected_mime = declared

        if detected_mime is None or not self._is_small_file_text_safe_mime(detected_mime):
            return False, "File too small for validation", None

        logger.info(
            "Small text file validation passed | File: %s | Detected: %s | Size: %s",
            filename,
            detected_mime,
            len(file_data),
        )
        return True, None, detected_mime

    def validate_upload(
        self,
        filename: str,
        file_data: bytes,
        declared_mime: str | None = None,
        *,
        skip_size_check: bool = False,
    ) -> tuple[bool, str | None, str | None]:
        """
        Comprehensive upload validation

        Args:
            filename: Original filename
            file_data: Binary file data
            declared_mime: MIME type declared by client
            skip_size_check: Skip size validation (for already-checked files)

        Returns:
            Tuple of (is_valid, error_message, detected_mime_type)
        """
        # 1. Validate file size
        if not skip_size_check:
            size_valid, size_error = self.validate_file_size(len(file_data))
            if not size_valid:
                return False, size_error, None

        # 2. Validate file extension
        ext_valid, ext_error = self.validate_file_extension(filename)
        if not ext_valid:
            return False, ext_error, None

        # 3. Validate magic bytes
        magic_valid, magic_error, detected_mime = self.validate_magic_bytes(file_data, filename, declared_mime)
        if not magic_valid:
            return False, magic_error, None

        logger.info("File validation passed: %s | MIME: %s", filename, detected_mime)
        return True, None, detected_mime


class MalwareScanner:
    """
    Malware scanning integration for uploaded files
    Supports ClamAV and placeholder for other scanners
    """

    def __init__(self, *, enabled: bool = True, scanner_type: str = "clamav"):
        """
        Initialize malware scanner

        Args:
            enabled: Whether scanning is enabled
            scanner_type: Type of scanner ('clamav', 'virustotal', 'none')
        """
        self.enabled = enabled
        self.scanner_type = scanner_type

        if self.enabled and self.scanner_type == "clamav":
            try:
                self.clamd_client = ClamAvUnixClient()
                self.clamd_client.ping()
                logger.info("ClamAV scanner initialized successfully")
            except (OSError, ClamAvProtocolError) as exc:
                logger.warning("ClamAV not available: %s. Malware scanning disabled.", exc)
                self.enabled = False

    async def scan_file(self, file_data: bytes, filename: str) -> tuple[bool, str | None]:
        """
        Scan file for malware

        Args:
            file_data: Binary file data
            filename: Original filename

        Returns:
            Tuple of (is_safe, threat_name)
        """
        if not self.enabled:
            logger.debug("Malware scanning disabled, skipping")
            return True, None

        try:
            if self.scanner_type == "clamav":
                return await self._scan_with_clamav(file_data, filename)
            logger.warning("Unknown scanner type: %s", self.scanner_type)
            return True, None

        except Exception:
            logger.exception("Malware scan error")
            # Fail-open: allow file if scanner fails (configurable)
            return True, None

    async def _scan_with_clamav(self, file_data: bytes, filename: str) -> tuple[bool, str | None]:
        """
        Scan file using ClamAV

        Args:
            file_data: Binary file data
            filename: Original filename

        Returns:
            Tuple of (is_safe, threat_name)
        """
        try:
            result = await run_blocking_work(self.clamd_client.instream, file_data, blocking_timeout=20.0)

            # Result format: {'stream': ('OK', None)} or {'stream': ('FOUND', 'threat_name')}
            if not isinstance(result, dict):
                return True, None
            status, threat = result.get("stream", ("OK", None))

            if status == "FOUND":
                logger.warning("Malware detected in %s: %s", filename, threat)
                return False, threat
            logger.info("ClamAV scan passed: %s", filename)
            return True, None

        except (OSError, ClamAvProtocolError):  # fmt: skip
            logger.exception("ClamAV scan error")
            # Fail-open: allow file if scan fails
            return True, None
