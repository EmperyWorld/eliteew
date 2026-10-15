# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unified async HTTP client for Stack4 document services (Tika, Gotenberg, OCRmyPDF, Tesseract).
# Invariants:
# - URLs from unified_settings / env only; no hardcoded stack hostnames in call sites.
# - OCRmyPDF returns searchable PDF bytes; text extraction follows via Tika when needed.
# - Tika HTML is cleaned to a body fragment (clean_tika_html) before editors consume it.
# Related:
# - docker/stack/stack4.yml
# - api/services/doc_editor_service.py, doc_converter_service.py
# ---

"""Stack4 document processing gateway (Tika, Gotenberg, OCRmyPDF, Tesseract)."""

from __future__ import annotations

import io
import json
import logging
import mimetypes
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from api.core.http_clients import get_httpx_client
from api.core.unified_config import get_unified_settings

logger = logging.getLogger(__name__)

_TIMEOUT_TIKA = 120.0
_TIMEOUT_GOTENBERG = 120.0
_TIMEOUT_OCR = 120.0

_OFFICE_MIME: dict[str, str] = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".rtf": "application/rtf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
}


class Stack4GatewayError(Exception):
    """Base error for Stack4 gateway operations."""


class Stack4ServiceUnavailable(Stack4GatewayError):
    """Stack4 service URL missing or HTTP failure."""


@dataclass(frozen=True)
class Stack4Urls:
    tika: str
    gotenberg: str
    ocrmypdf: str
    tesseract: str


def _resolve_urls() -> Stack4Urls:
    settings = get_unified_settings()
    tika = (settings.tika_url or "").strip().rstrip("/")
    gotenberg_cfg = getattr(settings, "gotenberg", None)
    ocr_cfg = getattr(settings, "ocrmypdf", None)
    tess_cfg = getattr(settings, "tesseract", None)
    gotenberg = (
        gotenberg_cfg.internal_url.rstrip("/")
        if gotenberg_cfg
        else (getattr(settings, "gotenberg_url", None) or "").strip().rstrip("/")
    )
    ocrmypdf = ocr_cfg.internal_url.rstrip("/") if ocr_cfg else ""
    tesseract = tess_cfg.internal_url.rstrip("/") if tess_cfg else (settings.tesseract_url or "").strip().rstrip("/")
    if not gotenberg:
        import os

        gotenberg = (os.environ.get("GOTENBERG_URL") or "").strip().rstrip("/")
    if not ocrmypdf:
        import os

        ocrmypdf = (os.environ.get("OCRMYPDF_URL") or "").strip().rstrip("/")
    return Stack4Urls(tika=tika, gotenberg=gotenberg, ocrmypdf=ocrmypdf, tesseract=tesseract)


def _guess_mime(filename: str, fallback: str = "application/octet-stream") -> str:
    ext = Path(filename).suffix.lower()
    if ext in _OFFICE_MIME:
        return _OFFICE_MIME[ext]
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def unwrap_gotenberg_output(content: bytes, content_type: str | None, expected_ext: str) -> bytes:
    """Extract first matching file from Gotenberg zip archive, or return raw bytes."""
    ct = (content_type or "").lower()
    ext = expected_ext if expected_ext.startswith(".") else f".{expected_ext}"
    if "zip" not in ct and content[:2] != b"PK":
        return content
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            for name in zf.namelist():
                if name.lower().endswith(ext):
                    return zf.read(name)
            if zf.namelist():
                return zf.read(zf.namelist()[0])
    except zipfile.BadZipFile:
        return content
    return content


def clean_tika_html(tika_html: str) -> str:
    """Extract TipTap-friendly body fragment from Tika XHTML wrapper."""
    raw = (tika_html or "").strip()
    if not raw:
        return ""
    body_match = re.search(r"<body[^>]*>(.*?)</body>", raw, re.DOTALL | re.IGNORECASE)
    body_content = body_match.group(1) if body_match else raw
    body_content = re.sub(r"<style[\s\S]*?</style>", "", body_content, flags=re.IGNORECASE)
    body_content = re.sub(r"<script[\s\S]*?</script>", "", body_content, flags=re.IGNORECASE)
    body_content = re.sub(r"<meta[^>]*>", "", body_content, flags=re.IGNORECASE)
    body_content = re.sub(r"<p>\s*</p>", "", body_content, flags=re.IGNORECASE)
    body_content = re.sub(r"<p/>", "", body_content, flags=re.IGNORECASE)
    # Legacy text converter escaped <br> — restore real line breaks for editors
    body_content = re.sub(r"&lt;br\s*/?&gt;", "<br />", body_content, flags=re.IGNORECASE)
    return body_content.strip()


class Stack4DocumentGateway:
    """Async facade over Stack4 HTTP document services."""

    def __init__(self, urls: Stack4Urls | None = None, client: httpx.AsyncClient | None = None) -> None:
        self._urls = urls or _resolve_urls()
        self._client = client

    def _http(self) -> httpx.AsyncClient:
        return self._client if self._client is not None else get_httpx_client()

    async def extract_html(self, file_data: bytes, filename: str, ocr_lang: str = "rus+eng") -> str:
        if not self._urls.tika:
            raise Stack4ServiceUnavailable("TIKA_URL not configured")
        response = await self._http().put(
            f"{self._urls.tika}/tika",
            content=file_data,
            headers={
                "Accept": "text/html",
                "Content-Type": _guess_mime(filename),
                "X-Tika-OCRLanguage": ocr_lang,
                "X-Tika-PDFextractInlineImages": "true",
            },
            timeout=_TIMEOUT_TIKA,
        )
        response.raise_for_status()
        return clean_tika_html(response.text)

    async def extract_plain(self, file_data: bytes, filename: str, ocr_lang: str = "rus+eng") -> str:
        if not self._urls.tika:
            raise Stack4ServiceUnavailable("TIKA_URL not configured")
        response = await self._http().put(
            f"{self._urls.tika}/tika",
            content=file_data,
            headers={
                "Accept": "text/plain",
                "Content-Type": _guess_mime(filename),
                "X-Tika-OCRLanguage": ocr_lang,
                "X-Tika-PDFextractInlineImages": "true",
            },
            timeout=_TIMEOUT_TIKA,
        )
        response.raise_for_status()
        return response.text.strip()

    async def extract_metadata(self, file_data: bytes, filename: str) -> dict[str, Any]:
        if not self._urls.tika:
            raise Stack4ServiceUnavailable("TIKA_URL not configured")
        response = await self._http().put(
            f"{self._urls.tika}/meta",
            content=file_data,
            headers={"Content-Type": _guess_mime(filename)},
            timeout=_TIMEOUT_TIKA,
        )
        response.raise_for_status()
        if not response.content:
            return {}
        try:
            data = response.json()
        except json.JSONDecodeError:
            return {}
        if isinstance(data, dict):
            return data
        if isinstance(data, list) and data and isinstance(data[0], dict):
            return data[0]
        return {}

    async def html_to_pdf(self, html: str | bytes, title: str = "Document") -> bytes:
        if not self._urls.gotenberg:
            raise Stack4ServiceUnavailable("GOTENBERG_URL not configured")
        html_bytes = html.encode("utf-8") if isinstance(html, str) else html
        wrapped = html_bytes
        if isinstance(html, str) and "<html" not in html.lower():
            wrapped = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>{title}</title></head>
<body>{html}</body></html>""".encode()
        response = await self._http().post(
            f"{self._urls.gotenberg}/forms/chromium/convert/html",
            files={"files": ("index.html", wrapped, "text/html")},
            timeout=_TIMEOUT_GOTENBERG,
        )
        response.raise_for_status()
        return response.content

    async def html_to_docx(self, html: str | bytes, title: str = "Document") -> bytes:
        if not self._urls.gotenberg:
            raise Stack4ServiceUnavailable("GOTENBERG_URL not configured")
        html_bytes = html.encode("utf-8") if isinstance(html, str) else html
        if isinstance(html, str) and "<html" not in html.lower():
            html_bytes = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>{title}</title></head>
<body>{html}</body></html>""".encode()
        response = await self._http().post(
            f"{self._urls.gotenberg}/forms/libreoffice/convert",
            files={"files": ("document.html", html_bytes, "text/html")},
            timeout=_TIMEOUT_GOTENBERG,
        )
        response.raise_for_status()
        return unwrap_gotenberg_output(
            response.content,
            response.headers.get("content-type"),
            ".docx",
        )

    async def office_to_pdf(self, file_data: bytes, filename: str) -> bytes:
        if not self._urls.gotenberg:
            raise Stack4ServiceUnavailable("GOTENBERG_URL not configured")
        mime = _guess_mime(filename)
        response = await self._http().post(
            f"{self._urls.gotenberg}/forms/libreoffice/convert",
            files={"files": (Path(filename).name, file_data, mime)},
            timeout=_TIMEOUT_GOTENBERG,
        )
        response.raise_for_status()
        return unwrap_gotenberg_output(
            response.content,
            response.headers.get("content-type"),
            ".pdf",
        )

    async def ocr_pdf_to_bytes(self, file_data: bytes, filename: str) -> bytes:
        if not self._urls.ocrmypdf:
            raise Stack4ServiceUnavailable("OCRMYPDF_URL not configured")
        response = await self._http().post(
            f"{self._urls.ocrmypdf}/ocr",
            files={"file": (Path(filename).name or "document.pdf", file_data, "application/pdf")},
            timeout=_TIMEOUT_OCR,
        )
        response.raise_for_status()
        return response.content

    async def ocr_pdf_to_text(self, file_data: bytes, filename: str, ocr_lang: str = "rus+eng") -> str:
        searchable = await self.ocr_pdf_to_bytes(file_data, filename)
        return await self.extract_plain(searchable, filename, ocr_lang=ocr_lang)

    async def ocr_image_to_text(self, file_data: bytes, filename: str, lang: str = "rus+eng") -> str:
        if not self._urls.tesseract:
            raise Stack4ServiceUnavailable("TESSERACT_URL not configured")
        mime = _guess_mime(filename, "image/png")
        response = await self._http().post(
            f"{self._urls.tesseract}/recognize",
            files={"file": (Path(filename).name or "image.png", file_data, mime)},
            data={"lang": lang},
            timeout=_TIMEOUT_OCR,
        )
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict):
            return str(payload.get("text") or "").strip()
        return ""


_gateway_singleton: Stack4DocumentGateway | None = None


def get_stack4_document_gateway() -> Stack4DocumentGateway:
    global _gateway_singleton  # noqa: PLW0603
    if _gateway_singleton is None:
        _gateway_singleton = Stack4DocumentGateway()
    return _gateway_singleton
