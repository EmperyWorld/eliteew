# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for unified_content process ack-on-fail, extracted_text FTS clamp, HEIC honest fail.
# Invariants:
# - Processor failed status must not raise from queue handler (no DLQ poison).
# - Huge extracted_text is clamped under PG to_tsvector limits.
# Related:
# - api/workers/queue_handlers.py
# - api/services/unified_content/processors/base.py
# - api/services/unified_content/processors/image_processor.py
# ---
"""Unit locks for documents.processing DLQ cause fixes."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.unified_content.processors.base import (
    MAX_EXTRACTED_TEXT_CHARS,
    clamp_extracted_text_for_fts,
)
from api.services.unified_content.processors.image_processor import (
    ImageProcessor,
    _unsupported_image_error,
)


def test_clamp_extracted_text_for_fts_noop_small() -> None:
    text, meta = clamp_extracted_text_for_fts("hello")
    assert text == "hello"
    assert meta == {}


def test_clamp_extracted_text_for_fts_caps_huge() -> None:
    huge = "я" * (MAX_EXTRACTED_TEXT_CHARS + 50_000)
    text, meta = clamp_extracted_text_for_fts(huge)
    assert meta.get("extracted_text_truncated") is True
    assert meta["extracted_text_original_chars"] == len(huge)
    assert len(text) <= MAX_EXTRACTED_TEXT_CHARS
    assert len(text.encode("utf-8")) <= 900 * 1024


def test_unsupported_image_error_heic() -> None:
    err = _unsupported_image_error("image/heic", "x.heic", RuntimeError("cannot identify"))
    assert err.startswith("unsupported_image_format:")


@pytest.mark.asyncio
async def test_image_processor_heic_fails_honest(monkeypatch: pytest.MonkeyPatch) -> None:
    pool = MagicMock()
    proc = ImageProcessor(pool)
    proc.update_content = AsyncMock()  # type: ignore[method-assign]
    proc.minio_storage = MagicMock()

    def boom(*_a: object, **_k: object) -> tuple[dict[str, Any], bytes]:
        raise OSError("cannot identify image file")

    monkeypatch.setattr(proc, "_extract_metadata_and_thumbnail", boom)

    out = await proc.process(uuid4(), b"not-an-image", "photo.heic", "image/heic")
    assert out["processing_status"] == "failed"
    assert str(out["processing_error"]).startswith("unsupported_image_format:")
    proc.update_content.assert_awaited()


@pytest.mark.asyncio
async def test_handle_unified_content_failed_acks_without_raise(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.workers.queue_handlers as handlers

    content_id = uuid4()
    payload: dict[str, Any] = {
        "content_id": str(content_id),
        "correlation_id": str(content_id),
        "use_ocr": False,
    }

    async def fake_load_blob(_content_id: object) -> tuple[str, bytes, str, str]:
        return ("document", b"hello", "doc.txt", "text/plain")

    async def fake_get_pool() -> object:
        return object()

    class FakeProcessorFactory:
        def __init__(self, _pool: object) -> None:
            pass

        async def process_content(self, **_kwargs: object) -> dict[str, str]:
            return {
                "processing_status": "failed",
                "processing_error": "unsupported_image_format: image/heic",
            }

    index_calls: list[str] = []

    async def mark_es(*_a: object, **_k: object) -> None:
        index_calls.append("es")

    async def mark_rag(*_a: object, **_k: object) -> None:
        index_calls.append("rag")

    async def mark_qdrant(*_a: object, **_k: object) -> None:
        index_calls.append("qdrant")

    monkeypatch.setattr(handlers, "_load_unified_content_blob", fake_load_blob)
    monkeypatch.setattr(handlers, "get_asyncpg_pool", fake_get_pool)
    monkeypatch.setattr(
        "api.services.unified_content.processors.factory.ProcessorFactory",
        FakeProcessorFactory,
    )
    monkeypatch.setattr(handlers, "_index_unified_content_elasticsearch", mark_es)
    monkeypatch.setattr(handlers, "_index_unified_content_marketing_rag", mark_rag)
    monkeypatch.setattr(handlers, "_index_unified_content_qdrant", mark_qdrant)

    # Must not raise — permanent fail is ack-path.
    await handlers.handle_unified_content_processing(payload)
    assert index_calls == []
