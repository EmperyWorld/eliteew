# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Stack4DocumentGateway HTTP contracts and Gotenberg zip unwrap.
# Invariants:
# - Mock httpx only; no live stack4 containers required.
# Related:
# - api/services/stack4/document_gateway.py
# ---

from __future__ import annotations

import io
import zipfile
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from api.services.stack4.document_gateway import (
    Stack4DocumentGateway,
    Stack4Urls,
    clean_tika_html,
    unwrap_gotenberg_output,
)


def _zip_with(name: str, payload: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(name, payload)
    return buf.getvalue()


def test_unwrap_gotenberg_output_extracts_docx_from_zip() -> None:
    inner = b"docx-bytes"
    zipped = _zip_with("document.docx", inner)
    assert unwrap_gotenberg_output(zipped, "application/zip", ".docx") == inner


def test_unwrap_gotenberg_output_passthrough_raw_pdf() -> None:
    raw = b"%PDF-1.4"
    assert unwrap_gotenberg_output(raw, "application/pdf", ".pdf") == raw


def test_clean_tika_html_extracts_body_and_restores_escaped_br() -> None:
    raw = "<html><head><style>.c{}</style></head><body><p>sad &lt;br/&gt;a</p><p></p></body></html>"
    out = clean_tika_html(raw)
    assert "<html" not in out.lower()
    assert "sad <br />" in out
    assert "&lt;br" not in out


@pytest.mark.asyncio
async def test_extract_html_calls_tika_put() -> None:
    client = AsyncMock(spec=httpx.AsyncClient)
    response = MagicMock()
    response.text = "<html><body><p>hello</p></body></html>"
    response.raise_for_status = MagicMock()
    client.put = AsyncMock(return_value=response)

    gw = Stack4DocumentGateway(
        urls=Stack4Urls(
            tika="http://tika:9998",
            gotenberg="http://got:3000",
            ocrmypdf="http://ocr:5000",
            tesseract="http://tess:8884",
        ),
        client=client,
    )
    out = await gw.extract_html(b"data", "sample.docx")
    assert out == "<p>hello</p>"
    client.put.assert_awaited_once()
    call_args = client.put.await_args
    assert call_args.args[0] == "http://tika:9998/tika"
    assert call_args.kwargs["headers"]["Accept"] == "text/html"


@pytest.mark.asyncio
async def test_ocr_pdf_to_text_chain() -> None:
    client = AsyncMock(spec=httpx.AsyncClient)
    ocr_resp = MagicMock()
    ocr_resp.content = b"%PDF-searchable"
    ocr_resp.raise_for_status = MagicMock()
    tika_resp = MagicMock()
    tika_resp.text = "recognized text"
    tika_resp.raise_for_status = MagicMock()
    client.post = AsyncMock(return_value=ocr_resp)
    client.put = AsyncMock(return_value=tika_resp)

    gw = Stack4DocumentGateway(
        urls=Stack4Urls("http://tika:9998", "http://got:3000", "http://ocr:5000", "http://tess:8884"),
        client=client,
    )
    text = await gw.ocr_pdf_to_text(b"%PDF", "scan.pdf")
    assert text == "recognized text"
    client.post.assert_awaited_once()
    assert client.post.await_args.args[0] == "http://ocr:5000/ocr"
    client.put.assert_awaited_once()


@pytest.mark.asyncio
async def test_ocr_image_to_text_uses_recognize_endpoint() -> None:
    client = AsyncMock(spec=httpx.AsyncClient)
    response = MagicMock()
    response.json.return_value = {"text": "line"}
    response.raise_for_status = MagicMock()
    client.post = AsyncMock(return_value=response)

    gw = Stack4DocumentGateway(
        urls=Stack4Urls("http://tika:9998", "http://got:3000", "http://ocr:5000", "http://tess:8884"),
        client=client,
    )
    text = await gw.ocr_image_to_text(b"png", "x.png", lang="rus+eng")
    assert text == "line"
    assert client.post.await_args.args[0] == "http://tess:8884/recognize"


@pytest.mark.asyncio
async def test_html_to_docx_unwraps_zip() -> None:
    docx_bytes = b"PK-docx"
    zipped = _zip_with("out.docx", docx_bytes)
    client = AsyncMock(spec=httpx.AsyncClient)
    response = MagicMock()
    response.content = zipped
    response.headers = {"content-type": "application/zip"}
    response.raise_for_status = MagicMock()
    client.post = AsyncMock(return_value=response)

    gw = Stack4DocumentGateway(
        urls=Stack4Urls("http://tika:9998", "http://got:3000", "http://ocr:5000", "http://tess:8884"),
        client=client,
    )
    out = await gw.html_to_docx("<p>x</p>", title="T")
    assert out == docx_bytes
    assert "libreoffice/convert" in client.post.await_args.args[0]
