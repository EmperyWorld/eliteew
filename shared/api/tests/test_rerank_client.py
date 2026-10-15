"""Unit tests for llama-server /v1/rerank client (desktop RAG)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.marketing_project_rag_service import MarketingRagChunk
from api.services.rerank_client import apply_rerank_to_chunks, rerank_by_index


@pytest.mark.unit
def test_rerank_by_index_returns_none_when_base_url_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.rerank_client.unified_settings.rag_rerank_base_url",
        "",
        raising=False,
    )

    async def _run() -> None:
        out = await rerank_by_index("q", ["a", "b"], timeout=5.0)
        assert out is None

    asyncio.run(_run())


@pytest.mark.unit
def test_rerank_by_index_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.rerank_client.unified_settings.rag_rerank_base_url",
        "http://stack2-llama-rerank:8080",
        raising=False,
    )
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json = MagicMock(
        return_value={
            "results": [
                {"index": 1, "relevance_score": -1.0},
                {"index": 0, "relevance_score": -5.0},
            ]
        }
    )
    inner = MagicMock()
    inner.post = AsyncMock(return_value=mock_response)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=inner)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    async def _run() -> None:
        with patch("api.services.rerank_client.httpx.AsyncClient", return_value=mock_cm):
            out = await rerank_by_index("query", ["doc0", "doc1"], timeout=5.0)
        assert out == [(1, -1.0), (0, -5.0)]

    asyncio.run(_run())


@pytest.mark.unit
def test_rerank_by_index_http_error_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.rerank_client.unified_settings.rag_rerank_base_url",
        "http://stack2-llama-rerank:8080",
        raising=False,
    )
    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.text = "unavailable"
    inner = MagicMock()
    inner.post = AsyncMock(return_value=mock_response)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=inner)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    async def _run() -> None:
        with patch("api.services.rerank_client.httpx.AsyncClient", return_value=mock_cm):
            out = await rerank_by_index("q", ["a"], timeout=5.0)
        assert out is None

    asyncio.run(_run())


@pytest.mark.unit
def test_apply_rerank_reorders_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.rerank_client.unified_settings.rag_rerank_base_url",
        "http://stack2-llama-rerank:8080",
        raising=False,
    )
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json = MagicMock(
        return_value={
            "results": [
                {"index": 1, "relevance_score": -1.0},
                {"index": 0, "relevance_score": -3.0},
            ]
        }
    )
    inner = MagicMock()
    inner.post = AsyncMock(return_value=mock_response)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=inner)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    async def _run() -> None:
        with patch("api.services.rerank_client.httpx.AsyncClient", return_value=mock_cm):
            chunks = [
                MarketingRagChunk(text="first", ordinal=1, score=0.9),
                MarketingRagChunk(text="second", ordinal=2, score=0.8),
            ]
            out = await apply_rerank_to_chunks("q", chunks, take=2, timeout_sec=5.0)
        assert len(out) == 2
        assert out[0].text == "second"
        assert out[0].ordinal == 1
        assert out[0].score == -1.0
        assert out[1].text == "first"
        assert out[1].ordinal == 2

    asyncio.run(_run())


@pytest.mark.unit
def test_apply_rerank_fallback_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.rerank_client.unified_settings.rag_rerank_base_url",
        "http://stack2-llama-rerank:8080",
        raising=False,
    )
    mock_response = MagicMock()
    mock_response.status_code = 500
    inner = MagicMock()
    inner.post = AsyncMock(return_value=mock_response)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=inner)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    async def _run() -> None:
        with patch("api.services.rerank_client.httpx.AsyncClient", return_value=mock_cm):
            chunks = [
                MarketingRagChunk(text="a", ordinal=1),
                MarketingRagChunk(text="b", ordinal=2),
            ]
            out = await apply_rerank_to_chunks("q", chunks, take=1, timeout_sec=5.0)
        assert len(out) == 1
        assert out[0].text == "a"
        assert out[0].ordinal == 1

    asyncio.run(_run())
