# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for plain-text HTML conversion (line breaks must stay real <br>).
# Invariants:
# - _escape_html runs on text lines only, never on markup tags.
# Related:
# - api/services/doc_converter_service.py
# ---

from __future__ import annotations

import pytest

from api.services.doc_converter_service import DocConverterService


@pytest.mark.asyncio
async def test_convert_text_html_uses_real_br_not_escaped() -> None:
    service = DocConverterService.__new__(DocConverterService)
    payload = b"sad\na\nsd\n\nnext block"
    html = await service._convert_text(payload, "html", {})
    assert "sad<br/>a<br/>sd" in html.replace(" ", "")
    assert "&lt;br" not in html
    assert "next block" in html
