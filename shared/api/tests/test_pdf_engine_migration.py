# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 2 Task 1.C regression: unified PyMuPDF pdf_engine (extract, merge, split, thumbnail, lock).
# Invariants:
# - api.lock contains PyMuPDF only among PDF libraries.
# Related:
# - api.core.pdf_engine; docker/builders/stack0-api/requirements/locks/api.lock
# ---
from __future__ import annotations

from pathlib import Path

import pytest

from api.core import pdf_engine

_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_LOCK = _REPO_ROOT / "docker/builders/stack0-api/requirements/locks/api.lock"

pytestmark = pytest.mark.skipif(not pdf_engine.PDF_ENGINE_AVAILABLE, reason="PyMuPDF not installed")


def _sample_two_page_pdf() -> bytes:
    import fitz  # type: ignore[import-not-found]

    doc = fitz.open()
    for label in ("Page one text", "Page two text"):
        page = doc.new_page()
        page.insert_text((72, 72), label)
    data = doc.tobytes()
    doc.close()
    return data


def test_api_lock_has_single_pdf_engine() -> None:
    if not _API_LOCK.is_file():
        pytest.skip(f"api.lock not mounted ({_API_LOCK})")
    lock_text = _API_LOCK.read_text(encoding="utf-8").lower()
    assert "pymupdf==" in lock_text
    for banned in ("pypdf2==", "pypdf==", "pdfplumber==", "pdfminer.six==", "pypdfium2==", "pdf2image=="):
        assert banned not in lock_text


def test_extract_text_from_standard_pdf() -> None:
    pdf_bytes = _sample_two_page_pdf()
    text = pdf_engine.extract_text_from_bytes(pdf_bytes)
    assert "Page one text" in text
    assert "Page two text" in text


def test_merge_two_pdf_buffers() -> None:
    left = _sample_two_page_pdf()
    import fitz  # type: ignore[import-not-found]

    right_doc = fitz.open()
    page = right_doc.new_page()
    page.insert_text((72, 72), "Merged appendix")
    right = right_doc.tobytes()
    right_doc.close()

    merged = pdf_engine.merge_pdf_bytes([left, right])
    merged_text = pdf_engine.extract_text_from_bytes(merged)
    assert "Page one text" in merged_text
    assert "Merged appendix" in merged_text
    assert pdf_engine.page_count_from_bytes(merged) == 3


def test_split_single_page() -> None:
    pdf_bytes = _sample_two_page_pdf()
    single = pdf_engine.split_page_to_bytes(pdf_bytes, page_index=1)
    text = pdf_engine.extract_text_from_bytes(single)
    assert "Page two text" in text
    assert "Page one text" not in text
    assert pdf_engine.page_count_from_bytes(single) == 1


def test_document_processor_pdf_paths_use_run_blocking_work() -> None:
    source = Path(__file__).resolve().parents[1].joinpath("services/document_processor.py").read_text(encoding="utf-8")
    assert "run_blocking_work" in source
    assert "PyPDF2" not in source
    assert "pdf2image" not in source


def test_doc_converter_pdf_uses_single_engine() -> None:
    source = (
        Path(__file__).resolve().parents[1].joinpath("services/doc_converter_service.py").read_text(encoding="utf-8")
    )
    assert "_convert_pdf_pymupdf" in source
    assert "pdfplumber" not in source
    assert "PyPDF2" not in source
