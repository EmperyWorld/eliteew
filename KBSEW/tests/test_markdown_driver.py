# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for MarkdownIngestionDriver validation and chunking.
# Related:
# - api/drivers/markdown.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import httpx
import pytest
from api.drivers.markdown import MarkdownIngestionDriver, _chunk_text


def test_chunk_text_overlap() -> None:
    text = "word " * 200
    chunks = _chunk_text(text, size=100, overlap=20)
    assert len(chunks) >= 2
    assert all(len(c) <= 100 for c in chunks)


def test_markdown_validate_https_md_url(monkeypatch: pytest.MonkeyPatch) -> None:
    # Unit test: the non-Markdown URL is classified by the returned HEAD MIME,
    # not by connectivity to example.com. Transport behavior has separate tests.
    monkeypatch.setattr(
        "api.services.safe_http.head_url_safe",
        AsyncMock(
            return_value=httpx.Response(
                200, headers={"content-type": "application/pdf"}
            )
        ),
    )
    driver = MarkdownIngestionDriver()

    async def _run() -> None:
        assert await driver.validate("https://example.com/readme.md") is True
        assert await driver.validate("http://example.com/docs/guide.markdown") is True
        assert await driver.validate("ftp://example.com/readme.md") is False
        assert await driver.validate("https://example.com/manual.pdf") is False

    asyncio.run(_run())


def test_markdown_validate_bytes_utf8() -> None:
    driver = MarkdownIngestionDriver()

    async def _run() -> None:
        assert await driver.validate_bytes(b"# Hello\n\nWorld", "note.md") is True
        assert await driver.validate_bytes(b"\x00\x01\x02bin", "x.md") is False
        assert await driver.validate_bytes(b"", "empty.md") is False

    asyncio.run(_run())


@pytest.mark.asyncio
async def test_markdown_process_and_chunk_bytes() -> None:
    driver = MarkdownIngestionDriver()
    body = (
        "# Title\n\n"
        + ("This is a readable markdown paragraph with enough words. " * 20)
    ).encode("utf-8")
    chunks = await driver.process_and_chunk_bytes(
        body,
        "doc.md",
        source_url="https://example.com/doc.md",
    )
    assert len(chunks) >= 1
    assert chunks[0].metadata["filename"] == "doc.md"


@pytest.mark.asyncio
async def test_markdown_index_to_qdrant_uses_bind_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    driver = MarkdownIngestionDriver()
    driver.bind_index_context(collection="kbsew_barrel_test", asset_id="asset-1")
    embed = AsyncMock(return_value=[[0.1, 0.2]])
    upsert = AsyncMock(return_value=1)
    monkeypatch.setattr("api.drivers.markdown.embed_texts", embed)
    monkeypatch.setattr("api.drivers.markdown.upsert_chunks", upsert)

    from api.models.chunk import Chunk

    chunks = [
        Chunk(
            text="Readable markdown chunk with enough words for indexing quality gates.",
            chunk_index=0,
            metadata={},
        )
    ]
    indexed = await driver.index_to_qdrant(chunks, barrel_id="barrel-1")
    assert indexed == 1
    upsert.assert_awaited_once()
    assert upsert.await_args is not None
    upsert_call = upsert.await_args
    assert upsert_call.kwargs["collection"] == "kbsew_barrel_test"
    assert upsert_call.kwargs["asset_id"] == "asset-1"
