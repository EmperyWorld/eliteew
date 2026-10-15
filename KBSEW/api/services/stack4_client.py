# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP client for stack4 Tika/OCRmyPDF used by PDF ingestion driver.
# ---

from __future__ import annotations

import json
import logging
import mimetypes
from pathlib import Path
from typing import Any

import httpx

from api.core.config import get_settings

logger = logging.getLogger(__name__)

_TIMEOUT = 120.0


def _guess_mime(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


class Stack4Client:
    async def extract_plain(
        self, file_data: bytes, filename: str, ocr_lang: str = "rus+eng"
    ) -> str:
        settings = get_settings()
        tika = settings.tika_url.rstrip("/")
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.put(
                f"{tika}/tika",
                content=file_data,
                headers={
                    "Accept": "text/plain",
                    "Content-Type": _guess_mime(filename),
                    "X-Tika-OCRLanguage": ocr_lang,
                    "X-Tika-PDFextractInlineImages": "false",
                },
            )
            response.raise_for_status()
            return response.text.strip()

    async def extract_metadata(self, file_data: bytes, filename: str) -> dict[str, Any]:
        settings = get_settings()
        tika = settings.tika_url.rstrip("/")
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            try:
                response = await client.put(
                    f"{tika}/meta",
                    content=file_data,
                    headers={"Content-Type": _guess_mime(filename)},
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code >= 500:
                    logger.warning(
                        "[STEP] kbsew_tika_meta_degrade filename=%s status=%s reason=%s",
                        filename,
                        exc.response.status_code,
                        exc,
                    )
                    return {"tika_meta_status": "degraded"}
                raise
            except httpx.HTTPError as exc:
                logger.warning(
                    "[STEP] kbsew_tika_meta_degrade filename=%s reason=%r",
                    filename,
                    exc,
                )
                return {"tika_meta_status": "degraded"}
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

    async def ocr_pdf_to_bytes(self, file_data: bytes, filename: str) -> bytes:
        settings = get_settings()
        ocr_url = settings.ocrmypdf_url.rstrip("/")
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{ocr_url}/ocr",
                files={
                    "file": (
                        Path(filename).name or "document.pdf",
                        file_data,
                        "application/pdf",
                    )
                },
            )
            response.raise_for_status()
            return response.content


_stack4: Stack4Client | None = None


def get_stack4_client() -> Stack4Client:
    global _stack4  # noqa: PLW0603
    if _stack4 is None:
        _stack4 = Stack4Client()
    return _stack4
