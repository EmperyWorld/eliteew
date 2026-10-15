#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Generate stored preview derivatives for Unified Content documents (text card JPEG,
# PDF page JPEG) and share helpers for lazy heal on GET /thumbnail.
# Invariants:
# - Never invent thumbnails for video/audio/office without a real renderer.
# - Failures return None and log [STEP] document_thumbnail_skip (no fake path).
# - Storage uses Seaweed/MinIO thumbnail key under content id (same as ImageProcessor).
# Related:
# - api/services/unified_content/processors/document_processor.py
# - api/routers/unified_content_download.py
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# ---
"""Document / regenerable content thumbnail helpers."""

from __future__ import annotations

import logging
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID

from PIL import Image, ImageDraw, ImageFont

from api.core.pdf_engine import PDF_ENGINE_AVAILABLE, render_page_thumbnail_jpeg
from api.services.unified_content.storage_backends import MinIOStorage
from api.utils.blocking import run_blocking_work

logger = logging.getLogger(__name__)

_NATIVE_TEXT_SUFFIXES = frozenset(
    {
        ".txt",
        ".md",
        ".markdown",
        ".log",
        ".csv",
        ".json",
        ".xml",
        ".html",
        ".htm",
        ".css",
        ".js",
        ".ts",
        ".mjs",
        ".cjs",
        ".py",
        ".sh",
        ".yaml",
        ".yml",
        ".ini",
        ".conf",
        ".cfg",
        ".rst",
    }
)

THUMB_MAX_SIZE = (800, 800)
THUMB_JPEG_QUALITY = 85
_TEXT_CARD_SIZE = (640, 800)
_TEXT_MAX_LINES = 40
_TEXT_CHARS_PER_LINE = 52


def should_generate_document_thumbnail(mime: str | None, filename: str | None) -> bool:
    """True for text-like and PDF documents that can get a stored preview."""
    mime_l = (mime or "").strip().lower()
    suffix = Path(filename or "").suffix.lower()
    if mime_l == "application/pdf" or suffix == ".pdf":
        return True
    if mime_l.startswith("text/") or mime_l in {"text/markdown", "text/x-markdown", "application/json"}:
        return True
    return suffix in _NATIVE_TEXT_SUFFIXES


def should_lazy_heal_thumbnail(
    mime: str | None,
    filename: str | None,
    *,
    integrity_status: str | None = None,
) -> bool:
    """True when GET /thumbnail may generate+persist a missing derivative."""
    status = (integrity_status or "").strip().lower()
    if status == "broken_quarantined":
        return False
    mime_l = (mime or "").strip().lower()
    if mime_l.startswith("image/"):
        return True
    return should_generate_document_thumbnail(mime, filename)


def render_text_preview_jpeg(
    text: str,
    *,
    max_size: tuple[int, int] = THUMB_MAX_SIZE,
    quality: int = THUMB_JPEG_QUALITY,
) -> bytes:
    """Render first lines of plain text onto a neutral JPEG card."""
    cleaned = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not cleaned:
        cleaned = "—"
    lines: list[str] = []
    for raw in cleaned.split("\n"):
        chunk = raw if raw else " "
        while chunk:
            lines.append(chunk[:_TEXT_CHARS_PER_LINE])
            chunk = chunk[_TEXT_CHARS_PER_LINE:]
            if len(lines) >= _TEXT_MAX_LINES:
                break
        if len(lines) >= _TEXT_MAX_LINES:
            break
    if len(cleaned.split("\n")) > _TEXT_MAX_LINES or len(lines) >= _TEXT_MAX_LINES:
        lines = lines[: _TEXT_MAX_LINES - 1]
        lines.append("…")

    img = Image.new("RGB", _TEXT_CARD_SIZE, color=(28, 30, 34))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default()
    except Exception:  # noqa: BLE001 — pillow default always available; defensive
        font = None
    y = 24
    line_gap = 18
    fill = (220, 224, 230)
    for line in lines:
        draw.text((28, y), line, fill=fill, font=font)
        y += line_gap
        if y > _TEXT_CARD_SIZE[1] - 28:
            break
    img.thumbnail(max_size, Image.Resampling.LANCZOS)
    out = BytesIO()
    img.save(out, format="JPEG", quality=quality)
    return out.getvalue()


def render_image_preview_jpeg(
    file_data: bytes,
    *,
    max_size: tuple[int, int] = THUMB_MAX_SIZE,
    quality: int = THUMB_JPEG_QUALITY,
) -> bytes:
    """Resize an image original to a JPEG preview (lazy heal for stuck pending rows)."""
    image = Image.open(BytesIO(file_data))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    elif image.mode == "RGBA":
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])
        image = background
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    out = BytesIO()
    image.save(out, format="JPEG", quality=quality)
    return out.getvalue()


async def build_document_thumbnail_bytes(
    *,
    mime: str | None,
    filename: str | None,
    file_data: bytes | None,
    extracted_text: str | None,
) -> bytes | None:
    """Produce JPEG bytes for document/image heal/upload; None when not regenerable."""
    mime_l = (mime or "").strip().lower()
    suffix = Path(filename or "").suffix.lower()
    try:
        if mime_l.startswith("image/") and file_data:
            return await run_blocking_work(
                render_image_preview_jpeg,
                file_data,
                blocking_timeout=30.0,
            )
        if mime_l == "application/pdf" or suffix == ".pdf":
            if not file_data or not PDF_ENGINE_AVAILABLE:
                return None
            return await run_blocking_work(
                render_page_thumbnail_jpeg,
                file_data,
                page_index=0,
                zoom=2.0,
                max_size=THUMB_MAX_SIZE,
                quality=THUMB_JPEG_QUALITY,
                blocking_timeout=60.0,
            )
        if should_generate_document_thumbnail(mime, filename):
            text = (extracted_text or "").strip()
            if not text and file_data:
                from api.services.doc_editor_text_normalizer import (  # noqa: PLC0415
                    decode_text_document_bytes,
                )

                text = decode_text_document_bytes(file_data)
            if not text.strip():
                return None
            return await run_blocking_work(
                render_text_preview_jpeg,
                text,
                blocking_timeout=15.0,
            )
    except Exception:
        logger.exception(
            "[STEP] document_thumbnail_skip mime=%s filename=%s",
            mime_l or "-",
            (filename or "-")[:80],
        )
        return None
    return None


async def store_content_thumbnail_jpeg(content_id: UUID, jpeg_bytes: bytes) -> str:
    """Persist JPEG preview under the content object key space; return storage path."""
    storage = MinIOStorage()
    return await storage.store(
        content_id=content_id,
        file_data=jpeg_bytes,
        filename=f"thumbnail_{content_id}.jpg",
        mime_type="image/jpeg",
    )


async def generate_and_store_document_thumbnail(
    content_id: UUID,
    *,
    mime: str | None,
    filename: str | None,
    file_data: bytes | None = None,
    extracted_text: str | None = None,
) -> str | None:
    """Best-effort generate+store; returns path or None. Shares heal lock with GET lazy heal."""
    lock = get_thumbnail_heal_lock(content_id)
    async with lock:
        cached = _heal_results.get(thumbnail_heal_lock_key(content_id))
        if cached is not None:
            return cached[0]
        data = await build_document_thumbnail_bytes(
            mime=mime,
            filename=filename,
            file_data=file_data,
            extracted_text=extracted_text,
        )
        if not data:
            logger.debug(
                "[STEP] document_thumbnail_skip content_id=%s reason=no_bytes",
                content_id,
            )
            _heal_results[thumbnail_heal_lock_key(content_id)] = (None, None)
            return None
        try:
            path = await store_content_thumbnail_jpeg(content_id, data)
            logger.info("[STEP] document_thumbnail_stored content_id=%s path=%s", content_id, path)
            _heal_results[thumbnail_heal_lock_key(content_id)] = (path, data)
            return path
        except Exception:
            logger.exception("[STEP] document_thumbnail_skip content_id=%s reason=store_failed", content_id)
            return None


def thumbnail_heal_lock_key(content_id: UUID) -> str:
    return str(content_id)


# Module-level single-flight locks for lazy heal (one generate per content_id).
_heal_locks: dict[str, Any] = {}
# Completed heal outcomes so waiters do not regenerate after the lock is released.
_heal_results: dict[str, tuple[str | None, bytes | None]] = {}


def get_thumbnail_heal_lock(content_id: UUID) -> Any:
    """Return an asyncio.Lock for this content_id (lazy-created; event-loop safe)."""
    import asyncio  # noqa: PLC0415

    key = thumbnail_heal_lock_key(content_id)
    lock = _heal_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _heal_locks[key] = lock
    return lock


async def persist_thumbnail_path(db_pool: Any, content_id: UUID, thumbnail_path: str) -> None:
    """Write healed/generated thumbnail_path onto the content row."""
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE unified_content
            SET thumbnail_path = $2, updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            """,
            content_id,
            thumbnail_path,
        )


async def _fetch_integrity_status(db_pool: Any, content_id: UUID) -> str | None:
    try:
        async with db_pool.acquire() as conn:
            return await conn.fetchval(
                """
                SELECT storage_integrity_status
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
    except Exception:
        logger.debug(
            "[STEP] document_thumbnail_skip content_id=%s reason=integrity_lookup_fail",
            content_id,
            exc_info=True,
        )
        return None


async def try_lazy_heal_thumbnail(
    *,
    db_pool: Any,
    content_id: UUID,
    mime: str | None,
    filename: str | None,
    file_data: bytes | None,
    extracted_text: str | None,
    integrity_status: str | None = None,
) -> tuple[str | None, bytes | None]:
    """
    Single-flight generate+store when GET /thumbnail has no usable derivative.

    Returns ``(path, jpeg_bytes)`` on success, ``(None, None)`` when not regenerable
    or generation failed. Caller should also gate broken blobs before original I/O.
    """
    status = integrity_status
    if status is None:
        status = await _fetch_integrity_status(db_pool, content_id)
    if not should_lazy_heal_thumbnail(
        mime,
        filename,
        integrity_status=status,
    ):
        return None, None

    key = thumbnail_heal_lock_key(content_id)
    lock = get_thumbnail_heal_lock(content_id)
    async with lock:
        cached = _heal_results.get(key)
        if cached is not None:
            return cached

        # Another request may have persisted while we waited.
        try:
            async with db_pool.acquire() as conn:
                existing = await conn.fetchval(
                    """
                    SELECT thumbnail_path
                    FROM unified_content
                    WHERE id = $1 AND deleted_at IS NULL
                    """,
                    content_id,
                )
        except Exception:
            existing = None
            logger.debug(
                "[STEP] document_thumbnail_skip content_id=%s reason=path_recheck_fail",
                content_id,
                exc_info=True,
            )
        if existing:
            # Path exists but we lack bytes in this request — return path only;
            # router will re-retrieve on next GET. Avoid double store.
            _heal_results[key] = (str(existing), None)
            return str(existing), None

        jpeg = await build_document_thumbnail_bytes(
            mime=mime,
            filename=filename,
            file_data=file_data,
            extracted_text=extracted_text,
        )
        if not jpeg:
            logger.debug(
                "[STEP] document_thumbnail_skip content_id=%s reason=lazy_heal_no_bytes",
                content_id,
            )
            _heal_results[key] = (None, None)
            return None, None
        try:
            path = await store_content_thumbnail_jpeg(content_id, jpeg)
        except Exception:
            logger.exception(
                "[STEP] document_thumbnail_skip content_id=%s reason=lazy_heal_store_failed",
                content_id,
            )
            return None, None
        await persist_thumbnail_path(db_pool, content_id, path)
        logger.info("[STEP] document_thumbnail_lazy_heal content_id=%s path=%s", content_id, path)
        _heal_results[key] = (path, jpeg)
        return path, jpeg
