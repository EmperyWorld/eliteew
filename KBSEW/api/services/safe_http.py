# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSRF-aware, size-capped HTTP(S) fetch for KBSEW URL ingest drivers.
# Invariants:
# - Only http/https; each hop re-validated (manual redirects, max 5).
# - DNS answers are checked before each hop (private/metadata deny).
# - Loopback / link-local / metadata always blocked; RFC1918 blocked unless
#   KBSEW_URL_ALLOW_PRIVATE=true.
# - Response body hard-capped at KBSEW_INGEST_MAX_BYTES.
# Related:
# - api/core/config.py
# - api/core/ingest_errors.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from urllib.parse import urlparse

import httpx

from api.core.config import get_settings
from api.core.ingest_errors import IngestPayloadTooLargeError, UnsafeIngestUrlError
from api.services.safe_url_transport import (
    PayloadTooLargeError,
    UnsafeUrlError,
    fetch_url,
    resolve_destination,
)

logger = logging.getLogger(__name__)

_MAX_REDIRECTS = 5


async def assert_url_safe_for_ingest(url: str) -> str:
    """Preflight only; download/head independently resolve and pin the actual connection."""
    try:
        async with asyncio.timeout(30.0):
            logical, _ip = await resolve_destination(
                url, allow_private=bool(get_settings().url_allow_private)
            )
        return str(logical)
    except UnsafeUrlError as exc:
        raise UnsafeIngestUrlError(str(exc)) from exc


async def download_url_capped(url: str) -> tuple[bytes, str]:
    settings = get_settings()
    try:
        result = await fetch_url(
            url,
            max_bytes=settings.ingest_max_bytes_clamped,
            timeout_sec=120.0,
            max_redirects=_MAX_REDIRECTS,
            allow_private=bool(settings.url_allow_private),
        )
        return result.body, Path(urlparse(result.url).path).name or "document.bin"
    except UnsafeUrlError as exc:
        raise UnsafeIngestUrlError(str(exc)) from exc
    except PayloadTooLargeError as exc:
        raise IngestPayloadTooLargeError(size=exc.size, limit=exc.limit) from exc


async def head_url_safe(url: str) -> httpx.Response:
    try:
        result = await fetch_url(
            url,
            max_bytes=1,
            timeout_sec=30.0,
            method="HEAD",
            allow_private=bool(get_settings().url_allow_private),
            max_redirects=_MAX_REDIRECTS,
        )
        return httpx.Response(
            result.status_code,
            headers=result.headers,
            request=httpx.Request("HEAD", result.url),
        )
    except UnsafeUrlError as exc:
        raise UnsafeIngestUrlError(str(exc)) from exc


def ensure_payload_within_limit(data: bytes, *, limit: int | None = None) -> None:
    settings = get_settings()
    max_bytes = limit if limit is not None else settings.ingest_max_bytes_clamped
    size = len(data)
    if size > max_bytes:
        raise IngestPayloadTooLargeError(size=size, limit=max_bytes)
