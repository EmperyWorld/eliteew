# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# DocConverterService office routes delegate to Stack4 gateway (Tika / Gotenberg).
# Invariants:
# - No live stack4; gateway methods mocked.
# Related:
# - api/services/doc_converter_service.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from api.services.doc_converter_service import DocConverterService


@pytest.mark.asyncio
async def test_convert_odt_to_html_via_tika(monkeypatch: pytest.MonkeyPatch) -> None:
    gateway = MagicMock()
    gateway.extract_html = AsyncMock(return_value="<div>odt</div>")
    monkeypatch.setattr(
        "api.services.doc_converter_service.get_stack4_document_gateway",
        lambda: gateway,
    )

    service = DocConverterService.__new__(DocConverterService)
    out = await service._convert_odt(b"odt-bytes", "html", {})
    assert out == "<div>odt</div>"
    gateway.extract_html.assert_awaited_once()


@pytest.mark.asyncio
async def test_convert_pptx_to_html_via_tika(monkeypatch: pytest.MonkeyPatch) -> None:
    gateway = MagicMock()
    gateway.extract_html = AsyncMock(return_value="<div>slides</div>")
    monkeypatch.setattr(
        "api.services.doc_converter_service.get_stack4_document_gateway",
        lambda: gateway,
    )

    service = DocConverterService.__new__(DocConverterService)
    out = await service._convert_pptx(b"pptx", "html", {"filename": "deck.pptx"})
    assert out == "<div>slides</div>"


@pytest.mark.asyncio
async def test_convert_doc_to_text_via_tika(monkeypatch: pytest.MonkeyPatch) -> None:
    gateway = MagicMock()
    gateway.extract_plain = AsyncMock(return_value="legacy doc text")
    monkeypatch.setattr(
        "api.services.doc_converter_service.get_stack4_document_gateway",
        lambda: gateway,
    )

    service = DocConverterService.__new__(DocConverterService)
    out = await service._convert_legacy_doc(b"doc", "text", {"filename": "old.doc"})
    assert out == "legacy doc text"


@pytest.mark.asyncio
async def test_convert_xlsx_to_pdf_base64(monkeypatch: pytest.MonkeyPatch) -> None:
    import base64

    gateway = MagicMock()
    gateway.office_to_pdf = AsyncMock(return_value=b"%PDF-xlsx")
    monkeypatch.setattr(
        "api.services.doc_converter_service.get_stack4_document_gateway",
        lambda: gateway,
    )

    service = DocConverterService.__new__(DocConverterService)
    out = await service._convert_office_to_pdf(b"xlsx", "sheet.xlsx")
    assert base64.b64decode(out) == b"%PDF-xlsx"
