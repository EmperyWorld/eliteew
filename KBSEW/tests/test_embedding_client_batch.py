# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batched embedding client contract tests (HTTP batching + dimension validation).
# ---

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest

from api.core.config import get_settings
from api.services import embedding_client


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _openai_payload(vectors: list[list[float]]) -> dict[str, Any]:
    return {
        "data": [{"embedding": vector, "index": index} for index, vector in enumerate(vectors)],
    }


@pytest.mark.asyncio
async def test_embed_texts_batches_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_EMBEDDINGS_BATCH_SIZE", "50")
    monkeypatch.setenv("AI_EMBEDDINGS_DIMENSION", "4")
    get_settings.cache_clear()

    call_sizes: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/api/embed"):
            return httpx.Response(404)
        body = json.loads(request.content.decode())
        texts = body["input"]
        call_sizes.append(len(texts))
        vectors = [[float(index), 0.0, 0.0, 1.0] for index in range(len(texts))]
        return httpx.Response(200, json=_openai_payload(vectors))

    transport = httpx.MockTransport(handler)
    original_client = httpx.AsyncClient

    def client_factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = transport
        return original_client(*args, **kwargs)

    monkeypatch.setattr(embedding_client.httpx, "AsyncClient", client_factory)

    texts = [f"chunk-{index}" for index in range(120)]
    vectors = await embedding_client.embed_texts(texts)

    assert len(vectors) == 120
    assert call_sizes == [50, 50, 20]


@pytest.mark.asyncio
async def test_embed_texts_rejects_dimension_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_EMBEDDINGS_DIMENSION", "4")
    get_settings.cache_clear()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/api/embed"):
            return httpx.Response(404)
        return httpx.Response(200, json=_openai_payload([[0.1, 0.2, 0.3]]))

    transport = httpx.MockTransport(handler)
    original_client = httpx.AsyncClient

    def client_factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = transport
        return original_client(*args, **kwargs)

    monkeypatch.setattr(embedding_client.httpx, "AsyncClient", client_factory)

    with pytest.raises(RuntimeError, match="dimension mismatch"):
        await embedding_client.embed_texts(["one"])
