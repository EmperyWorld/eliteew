"""Текст для индекса desktop_chat_rag: изображения без extracted_text."""

from __future__ import annotations

import uuid

from api.services.desktop_chat.rag_service import build_desktop_chat_rag_index_text
from api.services.marketing_project_rag_service import MIN_EXTRACTED_TEXT_CHARS


def test_build_prefers_extracted_text_when_long_enough() -> None:
    cid = uuid.uuid4()
    row = {
        "id": cid,
        "extracted_text": "x" * MIN_EXTRACTED_TEXT_CHARS,
        "mime_type": "image/png",
        "name": "ignored.png",
    }
    out = build_desktop_chat_rag_index_text(row)
    assert out == "x" * MIN_EXTRACTED_TEXT_CHARS


def test_build_synthetic_for_image_with_short_extracted() -> None:
    cid = uuid.uuid4()
    row = {
        "id": cid,
        "extracted_text": "",
        "mime_type": "image/png",
        "name": "z-image-turbo_00500_.png",
        "original_filename": None,
        "title": None,
        "description": None,
        "tags": [],
        "metadata": {},
    }
    out = build_desktop_chat_rag_index_text(row)
    assert len(out) >= MIN_EXTRACTED_TEXT_CHARS
    assert "Изображение во вложении чата" in out
    assert "z-image-turbo_00500_.png" in out
    assert str(cid) in out


def test_build_includes_metadata_prompt_for_images() -> None:
    cid = uuid.uuid4()
    row = {
        "id": cid,
        "extracted_text": "",
        "mime_type": "image/png",
        "name": "out.png",
        "original_filename": None,
        "title": None,
        "description": None,
        "tags": ["demo"],
        "metadata": {"prompt": "кот на крыше"},
    }
    out = build_desktop_chat_rag_index_text(row)
    assert "кот на крыше" in out
    assert "demo" in out


def test_build_non_image_short_extracted_unchanged() -> None:
    row = {
        "id": uuid.uuid4(),
        "extracted_text": "short",
        "mime_type": "application/pdf",
        "name": "doc.pdf",
    }
    out = build_desktop_chat_rag_index_text(row)
    assert out == "short"
