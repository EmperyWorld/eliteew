# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Doc editor OCR uses Stack4 Tesseract for images when Tika returns empty text.
# Invariants:
# - PNG/images prefer gateway.ocr_image_to_text before Tika.
# Related:
# - api/services/doc_editor_service.py, api/services/stack4/document_gateway.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.doc_editor_service import DocEditorService


@pytest.mark.asyncio
async def test_perform_ocr_image_uses_tesseract_when_tika_empty() -> None:
    service = DocEditorService(db_pool=MagicMock())
    gateway = MagicMock()
    gateway.ocr_image_to_text = AsyncMock(return_value="Распознанный текст")

    with patch(
        "api.services.doc_editor_service.get_stack4_document_gateway",
        return_value=gateway,
    ):
        result = await service.perform_ocr(
            b"\x89PNG fake",
            "rus+eng",
            "44.png",
            "image/png",
        )

    assert result["success"] is True
    assert result["text"] == "Распознанный текст"
    assert result["ocr_engine"] == "tesseract"
    gateway.ocr_image_to_text.assert_awaited_once()


@pytest.mark.asyncio
async def test_perform_ocr_image_falls_back_to_tika_when_tesseract_empty() -> None:
    service = DocEditorService(db_pool=MagicMock())
    gateway = MagicMock()
    gateway.ocr_image_to_text = AsyncMock(return_value="")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = "From Tika"
    mock_response.headers = {}
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.put = AsyncMock(return_value=mock_response)

    with (
        patch(
            "api.services.doc_editor_service.get_stack4_document_gateway",
            return_value=gateway,
        ),
        patch("api.services.doc_editor_service.get_httpx_client", return_value=mock_client),
        patch("api.services.doc_editor_service.TIKA_URL", "http://tika:9998"),
    ):
        result = await service.perform_ocr(
            b"\x89PNG fake",
            "rus+eng",
            "scan.png",
            "image/png",
        )

    assert result["success"] is True
    assert result["text"] == "From Tika"
    assert result["ocr_engine"] == "tika"
