# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Workflow DAG document resolution and text extraction (PDF, DOCX, TXT) via Stack4 Tika.
# Invariants:
# - Bytes are resolved from unified_content_id, paperless_id, or explicit file_base64 only.
# - Extraction failures return structured errors; callers map to ToolResult.
# Related:
# - api/services/stack4/document_gateway.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from __future__ import annotations

import base64
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext

logger = logging.getLogger(__name__)

_PDF_SUFFIXES = frozenset({".pdf"})
_EXTRACTOR_SUFFIXES = frozenset({".txt", ".docx", ".doc", ".md", ".rtf"})


@dataclass(frozen=True, slots=True)
class WorkflowDocumentBytes:
    filename: str
    data: bytes
    mime_type: str


@dataclass(frozen=True, slots=True)
class WorkflowDocumentExtractResult:
    ok: bool
    text: str
    filename: str
    mime_type: str
    char_count: int
    page_count: int | None = None
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "text": self.text,
            "extracted_text": self.text,
            "filename": self.filename,
            "mime_type": self.mime_type,
            "char_count": self.char_count,
        }
        if self.page_count is not None:
            payload["page_count"] = self.page_count
        if self.error:
            payload["error"] = self.error
        return payload


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _filename_suffix(filename: str) -> str:
    return Path(str(filename or "document.bin")).suffix.lower()


def _decode_plain_text_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1251", "latin-1"):
        try:
            return data.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace").strip()


async def _load_unified_content_blob(content_id: UUID) -> WorkflowDocumentBytes:
    from sqlalchemy import text

    from api.core.database_manager import get_database_manager
    from api.services.unified_content.storage_backends.minio_storage import SeaweedFSStorage

    manager = await get_database_manager()
    async with manager.get_postgres_session() as db:
        row = (
            (
                await db.execute(
                    text(
                        """
                    SELECT mime_type, name, file_path, storage_backend, file_data
                    FROM unified_content
                    WHERE id = :content_id AND deleted_at IS NULL
                    """
                    ),
                    {"content_id": str(content_id)},
                )
            )
            .mappings()
            .first()
        )
        if not row:
            msg = f"content {content_id} not found"
            raise ValueError(msg)

        storage_backend = str(row["storage_backend"] or "postgresql").lower()
        file_data = row["file_data"]
        if storage_backend in {"minio", "seaweedfs"}:
            storage = SeaweedFSStorage()
            file_data = await storage.retrieve(row["file_path"] or "", content_id)
        if not file_data:
            msg = f"content {content_id} has no stored file data"
            raise ValueError(msg)
        return WorkflowDocumentBytes(
            filename=str(row["name"] or content_id),
            data=bytes(file_data),
            mime_type=str(row["mime_type"] or "application/octet-stream"),
        )


async def resolve_workflow_document_bytes(
    ctx: ToolContext,
    args: Mapping[str, Any],
) -> WorkflowDocumentBytes:
    """Resolve document bytes from workflow args (catalog id, Paperless, or base64)."""

    _ = ctx
    filename = _first_text(args.get("filename"))
    file_base64 = _first_text(args.get("file_base64"))
    if file_base64:
        try:
            data = base64.b64decode(file_base64, validate=True)
        except (ValueError, TypeError) as exc:
            msg = f"invalid file_base64: {exc}"
            raise ValueError(msg) from exc
        if not filename:
            filename = "document.bin"
        mime_type = _first_text(args.get("mime_type")) or "application/octet-stream"
        return WorkflowDocumentBytes(filename=filename, data=data, mime_type=mime_type)

    unified_content_id = _first_text(args.get("unified_content_id"), args.get("document_id"))
    if unified_content_id:
        try:
            content_uuid = UUID(unified_content_id)
        except ValueError as exc:
            msg = f"invalid unified_content_id: {unified_content_id!r}"
            raise ValueError(msg) from exc
        return await _load_unified_content_blob(content_uuid)

    raw_paperless_id = args.get("paperless_id")
    try:
        paperless_id = int(raw_paperless_id) if raw_paperless_id is not None else 0
    except TypeError, ValueError:
        paperless_id = 0
    if paperless_id >= 1:
        from api.services.stack4.paperless_gateway import PaperlessGatewayError, get_paperless_gateway

        gateway = get_paperless_gateway()
        try:
            file_bytes, meta = await gateway.download_document_bytes(paperless_id)
        except PaperlessGatewayError as exc:
            msg = f"paperless download failed: {exc}"
            raise ValueError(msg) from exc
        resolved_name = meta.original_file_name or meta.title or f"paperless-{paperless_id}.pdf"
        return WorkflowDocumentBytes(
            filename=resolved_name,
            data=file_bytes,
            mime_type="application/pdf",
        )

    msg = "document source required: unified_content_id, paperless_id, or file_base64"
    raise ValueError(msg)


async def _extract_with_tika(document: WorkflowDocumentBytes) -> str:
    from api.services.stack4.document_gateway import Stack4DocumentGateway, Stack4ServiceUnavailable

    gateway = Stack4DocumentGateway()
    try:
        text = await gateway.extract_plain(document.data, document.filename)
    except Stack4ServiceUnavailable as exc:
        msg = f"Tika unavailable: {exc}"
        raise ValueError(msg) from exc
    return text.strip()


async def run_pdf_text_extraction(document: WorkflowDocumentBytes) -> WorkflowDocumentExtractResult:
    suffix = _filename_suffix(document.filename)
    if suffix and suffix not in _PDF_SUFFIXES:
        return WorkflowDocumentExtractResult(
            ok=False,
            text="",
            filename=document.filename,
            mime_type=document.mime_type,
            char_count=0,
            error=f"pdf_parser expects .pdf file, got {suffix or 'unknown'}",
        )

    try:
        text = await _extract_with_tika(document)
    except ValueError as exc:
        logger.debug("[STEP] workflow_pdf_extract_failed filename=%s err=%s", document.filename, exc)
        return WorkflowDocumentExtractResult(
            ok=False,
            text="",
            filename=document.filename,
            mime_type=document.mime_type,
            char_count=0,
            error=str(exc),
        )

    if not text:
        from api.services.stack4.document_gateway import Stack4DocumentGateway, Stack4ServiceUnavailable

        gateway = Stack4DocumentGateway()
        try:
            text = await gateway.ocr_pdf_to_text(document.data, document.filename)
        except Stack4ServiceUnavailable:
            text = ""

    text = text.strip()
    return WorkflowDocumentExtractResult(
        ok=bool(text),
        text=text,
        filename=document.filename,
        mime_type=document.mime_type,
        char_count=len(text),
        error=None if text else "empty_pdf_text",
    )


async def run_document_text_extraction(document: WorkflowDocumentBytes) -> WorkflowDocumentExtractResult:
    suffix = _filename_suffix(document.filename)
    if suffix == ".txt" or document.mime_type.startswith("text/"):
        text = _decode_plain_text_bytes(document.data)
        return WorkflowDocumentExtractResult(
            ok=bool(text),
            text=text,
            filename=document.filename,
            mime_type=document.mime_type,
            char_count=len(text),
            error=None if text else "empty_text_file",
        )

    if suffix and suffix not in _EXTRACTOR_SUFFIXES:
        return WorkflowDocumentExtractResult(
            ok=False,
            text="",
            filename=document.filename,
            mime_type=document.mime_type,
            char_count=0,
            error=f"document_extractor expects docx/txt, got {suffix or 'unknown'}",
        )

    try:
        text = await _extract_with_tika(document)
    except ValueError as exc:
        return WorkflowDocumentExtractResult(
            ok=False,
            text="",
            filename=document.filename,
            mime_type=document.mime_type,
            char_count=0,
            error=str(exc),
        )

    text = text.strip()
    return WorkflowDocumentExtractResult(
        ok=bool(text),
        text=text,
        filename=document.filename,
        mime_type=document.mime_type,
        char_count=len(text),
        error=None if text else "empty_document_text",
    )


__all__ = (
    "WorkflowDocumentBytes",
    "WorkflowDocumentExtractResult",
    "resolve_workflow_document_bytes",
    "run_document_text_extraction",
    "run_pdf_text_extraction",
)
