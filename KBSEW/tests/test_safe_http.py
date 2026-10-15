# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSRF deny-list and ingest size-cap contract tests for safe_http.
# ---

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest
from api.core.config import get_settings
from api.core.ingest_errors import IngestPayloadTooLargeError, UnsafeIngestUrlError
from api.services import safe_http


@pytest.fixture(autouse=True)
def _clear_settings() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_assert_url_rejects_loopback_literal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("KBSEW_URL_ALLOW_PRIVATE", raising=False)
    get_settings.cache_clear()
    with pytest.raises(UnsafeIngestUrlError):
        await safe_http.assert_url_safe_for_ingest("http://127.0.0.1/secret.pdf")


@pytest.mark.asyncio
async def test_assert_url_rejects_metadata_ip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_URL_ALLOW_PRIVATE", "true")
    get_settings.cache_clear()
    with pytest.raises(UnsafeIngestUrlError):
        await safe_http.assert_url_safe_for_ingest("http://169.254.169.254/latest/")


@pytest.mark.asyncio
async def test_assert_url_rejects_private_when_not_allowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("KBSEW_URL_ALLOW_PRIVATE", raising=False)
    get_settings.cache_clear()
    with pytest.raises(UnsafeIngestUrlError):
        await safe_http.assert_url_safe_for_ingest("http://10.0.0.5/doc.pdf")


@pytest.mark.asyncio
async def test_assert_url_rejects_ipv4_mapped_loopback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """IPv4-mapped IPv6 (::ffff:127.0.0.1) must hit the same deny path as IPv4 loopback."""
    monkeypatch.delenv("KBSEW_URL_ALLOW_PRIVATE", raising=False)
    get_settings.cache_clear()
    with pytest.raises(UnsafeIngestUrlError):
        await safe_http.assert_url_safe_for_ingest(
            "http://[::ffff:127.0.0.1]/secret.pdf"
        )


@pytest.mark.asyncio
async def test_assert_url_allows_public_literal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("KBSEW_URL_ALLOW_PRIVATE", raising=False)
    get_settings.cache_clear()
    url = await safe_http.assert_url_safe_for_ingest("https://93.184.216.34/doc.pdf")
    assert url.startswith("https://")


@pytest.mark.asyncio
async def test_download_url_capped_rejects_oversize_stream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_INGEST_MAX_BYTES", "1048576")
    monkeypatch.delenv("KBSEW_URL_ALLOW_PRIVATE", raising=False)
    get_settings.cache_clear()

    from unittest.mock import AsyncMock

    from api.services.safe_url_transport import PayloadTooLargeError

    with (
        patch(
            "api.services.safe_http.fetch_url",
            AsyncMock(side_effect=PayloadTooLargeError(1200000, 1048576)),
        ),
        pytest.raises(IngestPayloadTooLargeError),
    ):
        await safe_http.download_url_capped("https://example.test/doc.pdf")


def test_ensure_payload_within_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KBSEW_INGEST_MAX_BYTES", "1048576")
    get_settings.cache_clear()
    safe_http.ensure_payload_within_limit(b"ok")
    with pytest.raises(IngestPayloadTooLargeError):
        safe_http.ensure_payload_within_limit(b"x" * 2_000_000)
