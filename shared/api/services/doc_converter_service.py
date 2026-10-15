#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Конвертация документов между форматами с кешем Redis и аудитом; office/preview через Stack4 gateway.
# Invariants:
#   - Время операций конвертации — utc_now_naive() для профилирования; secrets не в коде.
# Related:
#   - api/services/stack4/document_gateway.py
#   - unified_content, asyncpg доступ к БД
# ------------------------------------------------------------------------------
"""
Ultimate Document Converter Service
Backend service for converting documents between multiple formats.

Supported Conversions:
- DOCX → HTML (for editing)
- PDF → HTML/Text (for editing/viewing)
- ODT → HTML
- RTF → HTML
- MD → HTML (with syntax highlighting)
- Excel/XLSX → JSON/CSV
- Images → Base64 (for embedding)
- HTML → PDF/DOCX (export)

Features:
- Format detection using magic bytes
- Redis caching with TTL
- Async processing for large files
- Integration with unified_content table
- Audit logging

Author: Python Pro Agent (Claude)
Date: 2025-10-24
"""

import asyncio
import base64
import hashlib
import io
import json
import logging
from pathlib import Path
from typing import Any
from uuid import UUID

from api.services.stack4 import Stack4ServiceUnavailable, get_stack4_document_gateway

# Document processing libraries
try:
    from docx import Document  # type: ignore[import-not-found]
except ImportError:
    Document = None

from api.core.pdf_engine import PDF_ENGINE_AVAILABLE, extract_text_from_bytes

try:
    import markdown  # type: ignore[reportMissingImports]
except ImportError:
    markdown = None  # type: ignore[assignment]

try:
    import openpyxl  # type: ignore[import-untyped]
except ImportError:
    openpyxl = None

try:
    from PIL import Image  # type: ignore[reportMissingImports]
except ImportError:
    Image = None  # type: ignore[assignment]

try:
    import magic  # type: ignore[reportMissingImports]
except ImportError:
    magic = None

# Async libraries
import asyncpg  # type: ignore[import-not-found]
from redis.asyncio import Redis  # type: ignore[reportMissingModuleSource]

from api.utils.blocking import run_blocking_work
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)  # type: ignore[import-not-found]


class ConversionError(Exception):
    """Custom exception for conversion failures"""


class UnsupportedFormatError(ConversionError):
    """Exception for unsupported file formats"""


class DocConverterService:
    """
    Document conversion service with caching and format detection.

    Features:
    - Multi-format conversion (DOCX, PDF, ODT, RTF, MD, XLSX, images)
    - Redis caching with 1-hour TTL
    - Magic byte format detection
    - Integration with unified_content table
    - Async processing support
    """

    SUPPORTED_INPUT_FORMATS = {
        "docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        "doc": ["application/msword"],
        "pdf": ["application/pdf"],
        "odt": ["application/vnd.oasis.opendocument.text"],
        "rtf": ["application/rtf", "text/rtf"],
        "md": ["text/markdown", "text/x-markdown"],
        "txt": ["text/plain"],
        "xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        "xls": ["application/vnd.ms-excel"],
        "pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
        "ppt": ["application/vnd.ms-powerpoint"],
        "csv": ["text/csv"],
        "jpg": ["image/jpeg"],
        "jpeg": ["image/jpeg"],
        "png": ["image/png"],
        "gif": ["image/gif"],
        "bmp": ["image/bmp"],
        "webp": ["image/webp"],
    }

    SUPPORTED_OUTPUT_FORMATS = ["html", "text", "json", "csv", "markdown", "pdf"]

    CACHE_TTL = 3600  # 1 hour in seconds

    _GENERIC_DECLARED_MIMES = frozenset(
        {
            "application/octet-stream",
            "binary/octet-stream",
        }
    )
    _ZIP_CONTAINER_MIMES = frozenset(
        {
            "application/zip",
            "application/x-zip-compressed",
        }
    )

    @staticmethod
    def _extension_from_filename(filename: str | None) -> str | None:
        if not filename:
            return None
        ext = Path(filename).suffix.lower().lstrip(".")
        if ext in DocConverterService.SUPPORTED_INPUT_FORMATS:
            return ext
        return None

    @classmethod
    def _is_generic_mime(cls, mime: str | None) -> bool:
        if not mime:
            return True
        return mime.lower().strip() in cls._GENERIC_DECLARED_MIMES

    def __init__(self, db_pool: asyncpg.Pool, redis_client: Redis | None = None):
        """
        Initialize converter service.

        Args:
            db_pool: PostgreSQL connection pool
            redis_client: Redis client for caching (optional)
        """
        self.db_pool = db_pool
        self.redis_client = redis_client

        # Check for required libraries
        self._check_dependencies()

    def _check_dependencies(self) -> None:
        """Check if required libraries are installed"""
        missing = []

        if Document is None:
            missing.append("python-docx")
        if not PDF_ENGINE_AVAILABLE:
            missing.append("PyMuPDF")
        if markdown is None:
            missing.append("markdown")
        if openpyxl is None:
            missing.append("openpyxl")
        if Image is None:
            missing.append("Pillow")
        if magic is None:
            logger.warning("python-magic not installed. Format detection will use file extensions only.")

        if missing:
            logger.warning(f"Missing optional dependencies: {', '.join(missing)}")

    async def detect_format(
        self, file_data: bytes, filename: str | None = None, declared_mime_type: str | None = None
    ) -> dict[str, Any]:
        """
        Detect file format using magic bytes.

        Args:
            file_data: Binary file content
            filename: Original filename (optional, for fallback)
            declared_mime_type: MIME type from upload (optional)

        Returns:
            (dict[str, Any]) with format info:
            {
                'mime_type': str,
                'extension': str,
                'is_supported': bool,
                'detection_method': str
            }
        """
        detected_mime = None
        detection_method = "unknown"
        file_ext = self._extension_from_filename(filename)

        # Try magic bytes detection first
        if magic:
            try:
                detected_mime = magic.from_buffer(file_data, mime=True)
                detection_method = "magic_bytes"
                logger.debug(f"Magic bytes detection: {detected_mime}")
            except Exception as e:
                logger.warning(f"Magic bytes detection failed: {e}")

        # Declared MIME — ignore generic octet-stream so filename/ZIP heuristics can run
        declared = (declared_mime_type or "").strip()
        if not detected_mime and declared and not self._is_generic_mime(declared):
            detected_mime = declared
            detection_method = "declared"

        # Filename extension when magic/declared did not yield a supported type
        if file_ext and (not detected_mime or self._is_generic_mime(detected_mime)):
            detected_mime = self.SUPPORTED_INPUT_FORMATS[file_ext][0]
            detection_method = "filename_extension"

        # Determine extension from MIME type
        extension = None
        if detected_mime:
            for ext, mime_types in self.SUPPORTED_INPUT_FORMATS.items():
                if detected_mime in mime_types:
                    extension = ext
                    break

        # DOCX/XLSX/PPTX/ODT are ZIP containers — magic often returns application/zip
        if file_ext and (
            extension is None or detected_mime in self._ZIP_CONTAINER_MIMES or self._is_generic_mime(detected_mime)
        ):
            if detected_mime in self._ZIP_CONTAINER_MIMES:
                detection_method = "magic_zip_filename"
            elif detection_method in {"unknown", "declared", "magic_bytes"}:
                detection_method = "filename_extension"
            extension = file_ext
            detected_mime = self.SUPPORTED_INPUT_FORMATS[file_ext][0]

        is_supported = extension is not None

        return {
            "mime_type": detected_mime or "application/octet-stream",
            "extension": extension,
            "is_supported": is_supported,
            "detection_method": detection_method,
            "file_size": len(file_data),
            "filename": filename,
        }

    def _generate_cache_key(self, content_hash: str, target_format: str, options: dict[str, Any] | None = None) -> str:
        """
        Generate Redis cache key.

        Format: doc_convert:{hash}:{format}:{options_hash}
        """
        options_str = json.dumps(options or {}, sort_keys=True)
        options_hash = hashlib.md5(options_str.encode()).hexdigest()[:8]
        return f"doc_convert:{content_hash}:{target_format}:{options_hash}"

    async def _get_from_cache(self, cache_key: str) -> str | None:
        """Get converted document from Redis cache"""
        if not self.redis_client:
            return None

        try:
            cached = await self.redis_client.get(cache_key)
            if cached:
                logger.info(f"Cache HIT: {cache_key}")
                return cached.decode("utf-8") if isinstance(cached, bytes) else cached
        except Exception as e:
            logger.exception(f"Redis cache read error: {e}")

        return None

    async def _save_to_cache(self, cache_key: str, content: str) -> None:
        """Save converted document to Redis cache with TTL"""
        if not self.redis_client:
            return

        try:
            await self.redis_client.setex(
                cache_key, self.CACHE_TTL, content.encode("utf-8") if isinstance(content, str) else content
            )
            logger.info(f"Cache SAVED: {cache_key} (TTL: {self.CACHE_TTL}s)")
        except Exception as e:
            logger.exception(f"Redis cache write error: {e}")

    async def convert(
        self,
        file_data: bytes,
        source_format: str,
        target_format: str,
        filename: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Convert document from source format to target format.

        Args:
            file_data: Binary file content
            source_format: Source format extension (docx, pdf, md, etc.)
            target_format: Target format (html, text, json, csv, markdown)
            filename: Original filename (optional)
            options: Conversion options (optional)

        Returns:
            (dict[str, Any]) with conversion result:
            {
                'content': str,
                'metadata': dict,
                'cached': bool,
                'conversion_time': float
            }

        Raises:
            UnsupportedFormatError: If format not supported
            ConversionError: If conversion fails
        """
        start_time = utc_now_naive()

        # Validate formats
        if source_format not in self.SUPPORTED_INPUT_FORMATS:
            msg = (
                f"Unsupported source format: {source_format}. "
                f"Supported: {', '.join(self.SUPPORTED_INPUT_FORMATS.keys())}"
            )
            raise UnsupportedFormatError(msg)

        if target_format not in self.SUPPORTED_OUTPUT_FORMATS:
            msg = f"Unsupported target format: {target_format}. Supported: {', '.join(self.SUPPORTED_OUTPUT_FORMATS)}"
            raise UnsupportedFormatError(msg)

        # Generate content hash for caching
        content_hash = hashlib.sha256(file_data).hexdigest()[:16]
        cache_key = self._generate_cache_key(content_hash, target_format, options)

        # Check cache
        cached_content = await self._get_from_cache(cache_key)
        if cached_content:
            return {
                "content": cached_content,
                "metadata": {
                    "source_format": source_format,
                    "target_format": target_format,
                    "filename": filename,
                    "file_size": len(file_data),
                    "content_hash": content_hash,
                },
                "cached": True,
                "conversion_time": 0.0,
            }

        # Perform conversion
        conv_options = dict(options or {})
        if filename:
            conv_options.setdefault("filename", filename)
        try:
            converted_content = await run_blocking_work(
                lambda: asyncio.run(self._convert_internal(file_data, source_format, target_format, conv_options)),
                blocking_timeout=float(conv_options.get("timeout_seconds") or 60.0),
            )
        except Exception as e:
            logger.exception(f"Conversion failed ({source_format} → {target_format}): {e}")
            msg = f"Conversion failed: {e!s}"
            raise ConversionError(msg) from e

        # Save to cache
        await self._save_to_cache(cache_key, converted_content)

        # Calculate conversion time
        conversion_time = (utc_now_naive() - start_time).total_seconds()

        parsed_via = conv_options.get("_parsed_via", "internal")
        media_type = conv_options.get("_media_type")
        metadata: dict[str, Any] = {
            "source_format": source_format,
            "target_format": target_format,
            "filename": filename,
            "file_size": len(file_data),
            "content_hash": content_hash,
            "converted_size": len(converted_content),
            "parsed_via": parsed_via,
        }
        if media_type:
            metadata["media_type"] = media_type

        return {
            "content": converted_content,
            "metadata": metadata,
            "cached": False,
            "conversion_time": conversion_time,
        }

    async def _convert_internal(
        self, file_data: bytes, source_format: str, target_format: str, options: dict[str, Any]
    ) -> str:
        """
        Internal conversion logic router.

        Routes to appropriate converter based on source format.
        """
        if target_format == "pdf" and source_format in {"odt", "rtf", "pptx", "ppt", "xlsx", "xls", "docx", "doc"}:
            options["_parsed_via"] = "gotenberg"
            options["_media_type"] = "application/pdf"
            return await self._convert_office_to_pdf(file_data, options.get("filename") or f"document.{source_format}")

        # Document formats
        if source_format == "docx":
            return await self._convert_docx(file_data, target_format, options)
        if source_format == "doc":
            return await self._convert_legacy_doc(file_data, target_format, options)
        if source_format == "pdf":
            return await self._convert_pdf(file_data, target_format, options)
        if source_format == "odt":
            return await self._convert_odt(file_data, target_format, options)
        if source_format == "rtf":
            return await self._convert_rtf(file_data, target_format, options)
        if source_format in {"pptx", "ppt"}:
            return await self._convert_pptx(file_data, target_format, options)
        if source_format == "md":
            return await self._convert_markdown(file_data, target_format, options)
        if source_format == "txt":
            return await self._convert_text(file_data, target_format, options)

        # Spreadsheet formats
        if source_format in ["xlsx", "xls", "csv"]:
            return await self._convert_spreadsheet(file_data, source_format, target_format, options)

        # Image formats
        if source_format in ["jpg", "jpeg", "png", "gif", "bmp", "webp"]:
            return await self._convert_image(file_data, source_format, target_format, options)

        msg = f"No converter for format: {source_format}"
        raise UnsupportedFormatError(msg)

    async def _convert_office_to_pdf(self, file_data: bytes, filename: str) -> str:
        gateway = get_stack4_document_gateway()
        try:
            pdf_bytes = await gateway.office_to_pdf(file_data, filename)
        except Stack4ServiceUnavailable as exc:
            msg = str(exc)
            raise ConversionError(msg) from exc
        except Exception as exc:
            msg = f"Office to PDF conversion failed: {exc}"
            raise ConversionError(msg) from exc
        return base64.b64encode(pdf_bytes).decode("ascii")

    async def _convert_legacy_doc(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        filename = str(options.get("filename") or "document.doc")
        options["_parsed_via"] = "tika"
        gateway = get_stack4_document_gateway()
        try:
            if target_format == "html":
                return await gateway.extract_html(file_data, filename)
            if target_format in {"text", "markdown"}:
                return await gateway.extract_plain(file_data, filename)
        except Stack4ServiceUnavailable as exc:
            msg = str(exc)
            raise ConversionError(msg) from exc
        msg = f"DOC to {target_format} not supported"
        raise UnsupportedFormatError(msg)

    async def _convert_pptx(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        filename = str(options.get("filename") or "document.pptx")
        options["_parsed_via"] = "tika"
        gateway = get_stack4_document_gateway()
        try:
            if target_format == "html":
                return await gateway.extract_html(file_data, filename)
            if target_format in {"text", "markdown"}:
                return await gateway.extract_plain(file_data, filename)
        except Stack4ServiceUnavailable as exc:
            msg = str(exc)
            raise ConversionError(msg) from exc
        msg = f"PPTX to {target_format} not supported"
        raise UnsupportedFormatError(msg)

    async def _convert_docx(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        """Convert DOCX to target format (Tika first, python-docx fallback)."""
        filename = str(options.get("filename") or "document.docx")
        if target_format in {"html", "text", "markdown"}:
            gateway = get_stack4_document_gateway()
            try:
                if target_format == "html":
                    options["_parsed_via"] = "tika"
                    return await gateway.extract_html(file_data, filename)
                options["_parsed_via"] = "tika"
                return await gateway.extract_plain(file_data, filename)
            except (Stack4ServiceUnavailable, Exception) as exc:
                logger.warning("DOCX Tika conversion failed, fallback to python-docx: %s", exc)

        if Document is None:
            msg = "python-docx not installed"
            raise ConversionError(msg)

        try:
            doc = Document(io.BytesIO(file_data))
            options["_parsed_via"] = "python-docx"

            if target_format == "html":
                return self._docx_to_html(doc, options)
            if target_format == "text":
                return self._docx_to_text(doc)
            if target_format == "markdown":
                return self._docx_to_markdown(doc)
            msg = f"DOCX to {target_format} not supported"
            raise UnsupportedFormatError(msg)

        except UnsupportedFormatError:
            raise
        except Exception as e:
            msg = f"DOCX conversion failed: {e}"
            raise ConversionError(msg) from e

    def _docx_to_html(self, doc: Any, options: dict[str, Any]) -> str:
        """Convert DOCX document to HTML"""
        html_parts = ['<div class="document">']

        for paragraph in doc.paragraphs:
            if not paragraph.text.strip():
                continue

            # Detect heading level
            if paragraph.style.name.startswith("Heading"):
                try:
                    level = int(paragraph.style.name.split()[-1])
                    html_parts.append(f"<h{level}>{self._escape_html(paragraph.text)}</h{level}>")
                except (ValueError, IndexError):  # fmt: skip
                    html_parts.append(f"<p><strong>{self._escape_html(paragraph.text)}</strong></p>")
            else:
                # Regular paragraph with inline formatting
                para_html = "<p>"
                for run in paragraph.runs:
                    text = self._escape_html(run.text)

                    # Apply formatting
                    if run.bold:
                        text = f"<strong>{text}</strong>"
                    if run.italic:
                        text = f"<em>{text}</em>"
                    if run.underline:
                        text = f"<u>{text}</u>"

                    para_html += text

                para_html += "</p>"
                html_parts.append(para_html)

        # Handle tables
        for table in doc.tables:
            html_parts.append('<table border="1" style="border-collapse: collapse; width: 100%;">')
            for row in table.rows:
                html_parts.append("<tr>")
                for cell in row.cells:
                    html_parts.append(f"<td>{self._escape_html(cell.text)}</td>")
                html_parts.append("</tr>")
            html_parts.append("</table>")

        html_parts.append("</div>")
        return "\n".join(html_parts)

    def _docx_to_text(self, doc: Any) -> str:
        """Convert DOCX document to plain text"""
        text_parts = []

        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)

        return "\n\n".join(text_parts)

    def _docx_to_markdown(self, doc: Any) -> str:
        """Convert DOCX document to Markdown"""
        md_parts = []

        for paragraph in doc.paragraphs:
            if not paragraph.text.strip():
                continue

            # Detect heading level
            if paragraph.style.name.startswith("Heading"):
                try:
                    level = int(paragraph.style.name.split()[-1])
                    md_parts.append(f"{'#' * level} {paragraph.text}")
                except (ValueError, IndexError):  # fmt: skip
                    md_parts.append(f"**{paragraph.text}**")
            else:
                # Apply inline formatting
                text = paragraph.text

                # Check for bold/italic runs
                formatted_text = ""
                for run in paragraph.runs:
                    run_text = run.text
                    if run.bold and run.italic:
                        run_text = f"***{run_text}***"
                    elif run.bold:
                        run_text = f"**{run_text}**"
                    elif run.italic:
                        run_text = f"*{run_text}*"
                    formatted_text += run_text

                md_parts.append(formatted_text or text)

        return "\n\n".join(md_parts)

    async def _convert_pdf(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        """Convert PDF to target format via unified PyMuPDF engine."""
        if not PDF_ENGINE_AVAILABLE:
            msg = "No PDF library available (install PyMuPDF)"
            raise ConversionError(msg)
        return await self._convert_pdf_pymupdf(file_data, target_format, options)

    async def _convert_pdf_pymupdf(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        """Convert PDF using PyMuPDF text extraction with Stack4 OCR fallback."""
        try:
            full_text = await run_blocking_work(
                extract_text_from_bytes,
                file_data,
                blocking_timeout=120.0,
            )

            if not full_text.strip():
                gateway = get_stack4_document_gateway()
                try:
                    full_text = await gateway.ocr_pdf_to_text(file_data, str(options.get("filename") or "document.pdf"))
                    options["_parsed_via"] = "ocrmypdf+tika"
                except Exception as exc:
                    logger.warning("PDF OCR fallback failed: %s", exc)

            if target_format == "text":
                return full_text
            if target_format == "html":
                paragraphs = full_text.split("\n\n")
                html_parts = ['<div class="pdf-document">']
                for para in paragraphs:
                    if para.strip():
                        html_parts.append(f"<p>{self._escape_html(para)}</p>")
                html_parts.append("</div>")
                return "\n".join(html_parts)
            if target_format == "markdown":
                return full_text
            msg = f"PDF to {target_format} not supported"
            raise UnsupportedFormatError(msg)

        except UnsupportedFormatError, ConversionError:
            raise
        except Exception as e:
            msg = f"PDF conversion failed: {e}"
            raise ConversionError(msg) from e

    async def _convert_odt(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        filename = str(options.get("filename") or "document.odt")
        options["_parsed_via"] = "tika"
        gateway = get_stack4_document_gateway()
        try:
            if target_format == "html":
                return await gateway.extract_html(file_data, filename)
            if target_format in {"text", "markdown"}:
                return await gateway.extract_plain(file_data, filename)
        except Stack4ServiceUnavailable as exc:
            msg = str(exc)
            raise ConversionError(msg) from exc
        msg = f"ODT to {target_format} not supported"
        raise UnsupportedFormatError(msg)

    async def _convert_rtf(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        filename = str(options.get("filename") or "document.rtf")
        options["_parsed_via"] = "tika"
        gateway = get_stack4_document_gateway()
        try:
            if target_format == "html":
                return await gateway.extract_html(file_data, filename)
            if target_format in {"text", "markdown"}:
                return await gateway.extract_plain(file_data, filename)
        except Stack4ServiceUnavailable as exc:
            msg = str(exc)
            raise ConversionError(msg) from exc
        msg = f"RTF to {target_format} not supported"
        raise UnsupportedFormatError(msg)

    async def _convert_markdown(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        """Convert Markdown to target format"""
        if markdown is None:
            msg = "markdown library not installed"
            raise ConversionError(msg)

        try:
            md_text = file_data.decode("utf-8")

            if target_format == "html":
                # Convert with extensions
                html = markdown.markdown(
                    md_text, extensions=["fenced_code", "codehilite", "tables", "nl2br", "sane_lists"]
                )
                return f'<div class="markdown-document">{html}</div>'

            if target_format == "text":
                # Strip markdown syntax (basic)
                import re

                text = md_text
                text = re.sub(r"#+\s", "", text)  # Remove headers
                text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)  # Remove bold
                text = re.sub(r"\*(.+?)\*", r"\1", text)  # Remove italic
                return re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)  # Remove links

            msg = f"Markdown to {target_format} not supported"
            raise UnsupportedFormatError(msg)

        except Exception as e:
            msg = f"Markdown conversion failed: {e}"
            raise ConversionError(msg) from e

    async def _convert_text(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        """Convert plain text to target format"""
        try:
            text = file_data.decode("utf-8", errors="ignore")

            if target_format == "html":
                # Convert to HTML with paragraphs
                paragraphs = text.split("\n\n")
                html_parts = ['<div class="text-document">']
                for para in paragraphs:
                    if para.strip():
                        lines = [self._escape_html(line) for line in para.split("\n")]
                        para_inner = "<br/>".join(lines)
                        html_parts.append(f"<p>{para_inner}</p>")
                html_parts.append("</div>")
                return "\n".join(html_parts)

            if target_format == "text":
                return text

            if target_format == "markdown":
                # Preserve as-is for markdown
                return text

            msg = f"Text to {target_format} not supported"
            raise UnsupportedFormatError(msg)

        except Exception as e:
            msg = f"Text conversion failed: {e}"
            raise ConversionError(msg) from e

    async def _convert_spreadsheet(
        self, file_data: bytes, source_format: str, target_format: str, options: dict[str, Any]
    ) -> str:
        """Convert Excel/CSV to target format"""
        if openpyxl is None and source_format in ["xlsx", "xls"]:
            msg = "openpyxl library not installed"
            raise ConversionError(msg)

        try:
            if source_format == "csv":
                return await self._convert_csv(file_data, target_format, options)
            return await self._convert_excel(file_data, target_format, options)

        except Exception as e:
            msg = f"Spreadsheet conversion failed: {e}"
            raise ConversionError(msg) from e

    async def _convert_excel(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        """Convert Excel to JSON/CSV/HTML"""
        if openpyxl is None:
            msg = "openpyxl is not available"
            raise ConversionError(msg)
        workbook = openpyxl.load_workbook(io.BytesIO(file_data))
        sheet = workbook.active
        if sheet is None:
            msg = "No active sheet in workbook"
            raise ConversionError(msg)

        # Extract data
        data = []
        for row in sheet.iter_rows(values_only=True):
            data.append(list(row))

        if target_format == "json":
            # First row as headers
            if data:
                headers = data[0]
                rows = []
                for row in data[1:]:
                    rows.append(dict(zip(headers, row, strict=False)))
                return json.dumps(rows, ensure_ascii=False, indent=2)
            return "[]"

        if target_format == "csv":
            import csv

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerows(data)
            return output.getvalue()

        if target_format == "html":
            html_parts = ['<table border="1" style="border-collapse: collapse;">']
            for i, row in enumerate(data):
                tag = "th" if i == 0 else "td"
                html_parts.append("<tr>")
                for cell in row:
                    html_parts.append(f"<{tag}>{self._escape_html(str(cell or ''))}</{tag}>")
                html_parts.append("</tr>")
            html_parts.append("</table>")
            return "\n".join(html_parts)

        msg = f"Excel to {target_format} not supported"
        raise UnsupportedFormatError(msg)

    async def _convert_csv(self, file_data: bytes, target_format: str, options: dict[str, Any]) -> str:
        """Convert CSV to JSON/HTML"""
        import csv

        text = file_data.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        data = list(reader)

        if target_format == "json":
            if data:
                headers = data[0]
                rows = []
                for row in data[1:]:
                    rows.append(dict(zip(headers, row, strict=False)))
                return json.dumps(rows, ensure_ascii=False, indent=2)
            return "[]"

        if target_format == "html":
            html_parts = ['<table border="1" style="border-collapse: collapse;">']
            for i, row in enumerate(data):
                tag = "th" if i == 0 else "td"
                html_parts.append("<tr>")
                for cell in row:
                    html_parts.append(f"<{tag}>{self._escape_html(cell)}</{tag}>")
                html_parts.append("</tr>")
            html_parts.append("</table>")
            return "\n".join(html_parts)

        if target_format == "csv":
            return text

        msg = f"CSV to {target_format} not supported"
        raise UnsupportedFormatError(msg)

    async def _convert_image(
        self, file_data: bytes, source_format: str, target_format: str, options: dict[str, Any]
    ) -> str:
        """Convert image to base64 for HTML embedding"""
        if Image is None:
            msg = "Pillow library not installed"
            raise ConversionError(msg)

        try:
            if target_format == "html":
                # Encode as base64
                b64_data = base64.b64encode(file_data).decode("utf-8")
                mime_type = self.SUPPORTED_INPUT_FORMATS[source_format][0]

                # Get image dimensions
                img = Image.open(io.BytesIO(file_data))
                width, height = img.size

                # Create HTML img tag with base64 data
                html = '<div class="image-container">'
                html += f'<img src="data:{mime_type};base64,{b64_data}" '
                html += f'alt="Embedded image" width="{width}" height="{height}" '
                html += 'style="max-width: 100%; height: auto;" />'
                html += "</div>"
                return html

            if target_format == "json":
                # Return image metadata + base64
                img = Image.open(io.BytesIO(file_data))
                width, height = img.size
                b64_data = base64.b64encode(file_data).decode("utf-8")

                return json.dumps(
                    {
                        "format": source_format.upper(),
                        "mode": img.mode,
                        "width": width,
                        "height": height,
                        "size_bytes": len(file_data),
                        "data": b64_data,
                    },
                    indent=2,
                )

            msg = f"Image to {target_format} not supported"
            raise UnsupportedFormatError(msg)

        except Exception as e:
            msg = f"Image conversion failed: {e}"
            raise ConversionError(msg) from e

    @staticmethod
    def _escape_html(text: str) -> str:
        """Escape HTML special characters"""
        import html

        return html.escape(text)

    async def invalidate_cache(self, content_id: UUID | None = None, pattern: str | None = None) -> None:
        """
        Invalidate cached conversions.

        Args:
            content_id: Specific content ID to invalidate
            pattern: Redis key pattern to delete (e.g., "doc_convert:abc123:*")
        """
        if not self.redis_client:
            return

        try:
            if content_id:
                # Get content hash from database
                async with self.db_pool.acquire() as conn:
                    file_hash = await conn.fetchval("SELECT file_hash FROM unified_content WHERE id = $1", content_id)
                    if file_hash:
                        pattern = f"doc_convert:{file_hash[:16]}:*"

            if pattern:
                # Delete matching keys
                cursor = 0
                deleted_count = 0

                while True:
                    cursor, keys = await self.redis_client.scan(cursor, match=pattern, count=100)

                    if keys:
                        await self.redis_client.delete(*keys)
                        deleted_count += len(keys)

                    if cursor == 0:
                        break

                logger.info(f"Cache invalidated: {deleted_count} keys deleted (pattern: {pattern})")

        except Exception as e:
            logger.exception(f"Cache invalidation failed: {e}")

    def get_supported_formats(self) -> dict[str, Any]:
        """
        Get list of supported input and output formats.

        Returns:
            (dict[str, Any]) with format lists and conversion matrix
        """
        conversion_matrix = {
            "docx": ["html", "text", "markdown", "pdf"],
            "doc": ["html", "text", "pdf"],
            "pdf": ["html", "text", "markdown"],
            "odt": ["html", "text", "pdf"],
            "rtf": ["html", "text", "pdf"],
            "pptx": ["html", "text", "pdf"],
            "ppt": ["html", "text", "pdf"],
            "md": ["html", "text"],
            "txt": ["html", "markdown"],
            "xlsx": ["json", "csv", "html", "pdf"],
            "xls": ["json", "csv", "html", "pdf"],
            "csv": ["json", "html"],
            "images": ["html", "json"],
        }

        return {
            "input_formats": list(self.SUPPORTED_INPUT_FORMATS.keys()),
            "output_formats": self.SUPPORTED_OUTPUT_FORMATS,
            "conversion_matrix": conversion_matrix,
            "cache_ttl": self.CACHE_TTL,
        }
