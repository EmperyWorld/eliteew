# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# detect_format heuristics for office uploads (octet-stream, application/zip).
# Invariants:
# - No live stack4 required.
# Related:
# - api/services/doc_converter_service.py
# ---

from __future__ import annotations

import pytest

from api.services.doc_converter_service import DocConverterService


@pytest.mark.asyncio
async def test_detect_format_docx_with_octet_stream_mime() -> None:
    service = DocConverterService.__new__(DocConverterService)
    info = await service.detect_format(
        b"PK\x03\x04fake-docx",
        filename="contract.docx",
        declared_mime_type="application/octet-stream",
    )
    assert info["is_supported"] is True
    assert info["extension"] == "docx"
    assert info["detection_method"] in {"filename_extension", "magic_zip_filename", "magic_bytes"}


@pytest.mark.asyncio
async def test_detect_format_docx_magic_zip() -> None:
    service = DocConverterService.__new__(DocConverterService)
    info = await service.detect_format(
        b"PK\x03\x04",
        filename="report.docx",
        declared_mime_type=None,
    )
    assert info["is_supported"] is True
    assert info["extension"] == "docx"


@pytest.mark.asyncio
async def test_detect_format_octet_stream_without_extension_unsupported() -> None:
    service = DocConverterService.__new__(DocConverterService)
    info = await service.detect_format(
        b"\x00\x01",
        filename="noext",
        declared_mime_type="application/octet-stream",
    )
    assert info["is_supported"] is False
