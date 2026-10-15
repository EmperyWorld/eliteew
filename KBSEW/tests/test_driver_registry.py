# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for KBSEW driver registry and PDF chunk helper.
# ---

from __future__ import annotations

import asyncio

import pytest
from api.drivers.markdown import MarkdownIngestionDriver
from api.drivers.pdf import PDFIngestionDriver, _chunk_text
from api.drivers.registry import get_driver, list_driver_types


def test_list_driver_types_includes_pdf() -> None:
    types = list_driver_types()
    assert "pdf" in types
    assert "markdown" in types


def test_get_driver_pdf_instance() -> None:
    driver = get_driver("pdf")
    assert isinstance(driver, PDFIngestionDriver)


def test_get_driver_markdown_instance() -> None:
    driver = get_driver("markdown")
    assert isinstance(driver, MarkdownIngestionDriver)


def test_get_driver_unknown_raises() -> None:
    with pytest.raises(KeyError):
        get_driver("unknown-driver")


def test_chunk_text_overlap() -> None:
    text = "word " * 200
    chunks = _chunk_text(text, size=100, overlap=20)
    assert len(chunks) >= 2
    assert all(len(c) <= 100 for c in chunks)


def test_pdf_validate_by_extension() -> None:
    driver = PDFIngestionDriver()

    async def _run() -> None:
        assert await driver.validate("https://example.com/manual.pdf") is True
        assert await driver.validate("https://example.com/page.html") is False

    asyncio.run(_run())
