# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# stack4 Tika client degrade behavior when /meta is unavailable.
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from api.services.stack4_client import Stack4Client


@pytest.mark.asyncio
async def test_extract_metadata_degrades_on_tika_500() -> None:
    client = Stack4Client()
    mock_response = MagicMock()
    mock_response.status_code = 500
    request = httpx.Request("PUT", "http://stack4-tika:9998/meta")
    error = httpx.HTTPStatusError("Server error", request=request, response=mock_response)

    with patch("api.services.stack4_client.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.put.return_value = mock_response
        mock_response.raise_for_status.side_effect = error
        mock_client_cls.return_value.__aenter__.return_value = mock_http

        meta = await client.extract_metadata(b"%PDF-1.4", "doc.pdf")

    assert meta == {"tika_meta_status": "degraded"}


@pytest.mark.asyncio
async def test_extract_metadata_raises_on_client_error() -> None:
    client = Stack4Client()
    mock_response = MagicMock()
    mock_response.status_code = 400
    request = httpx.Request("PUT", "http://stack4-tika:9998/meta")
    error = httpx.HTTPStatusError("Bad request", request=request, response=mock_response)

    with patch("api.services.stack4_client.httpx.AsyncClient") as mock_client_cls:
        mock_http = AsyncMock()
        mock_http.put.return_value = mock_response
        mock_response.raise_for_status.side_effect = error
        mock_client_cls.return_value.__aenter__.return_value = mock_http

        with pytest.raises(httpx.HTTPStatusError):
            await client.extract_metadata(b"%PDF-1.4", "doc.pdf")
