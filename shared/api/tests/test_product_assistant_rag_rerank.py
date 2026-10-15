# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product assistant (Справочник) RAG: rerank path when RAG_RERANK_BASE_URL is set.
# Invariants:
# - Unit tests only; no live Qdrant/rerank HTTP.
# Related:
# - api/services/product_assistant_rag_service.py
# ---

"""Product assistant KB hybrid search: cross-encoder rerank integration."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from api.services.marketing_project_rag_service import MarketingRagChunk
from api.services.product_assistant_rag_service import search_product_assistant_kb_hybrid


def _chunk(text: str, *, doc_id: str = "d1", score: float = 0.9, label: str = "Doc") -> MarketingRagChunk:
    return MarketingRagChunk(
        text=text,
        ordinal=1,
        content_id=doc_id,
        chunk_index=0,
        source_label=label,
        score=score,
    )


@pytest.mark.unit
def test_hybrid_skips_rerank_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.product_assistant_rag_service._product_assistant_rag_rerank_enabled",
        lambda: False,
    )
    vector = [_chunk("vector hit")]
    keyword: list[MarketingRagChunk] = []

    async def fake_vector(**_kw: object) -> list[MarketingRagChunk]:
        return vector

    async def fake_keyword(_db: object, **_kw: object) -> list[MarketingRagChunk]:
        return keyword

    rerank_mock = AsyncMock()

    with (
        patch(
            "api.services.product_assistant_rag_service.search_product_assistant_kb_with_fallback",
            side_effect=fake_vector,
        ),
        patch(
            "api.services.product_assistant_rag_service.search_product_assistant_kb_keyword",
            side_effect=fake_keyword,
        ),
        patch(
            "api.services.product_assistant_rag_service.apply_rerank_to_chunks",
            rerank_mock,
        ),
    ):
        out = asyncio.run(search_product_assistant_kb_hybrid(None, query="как открыть плеер", limit=4))

    assert len(out) == 1
    assert out[0].text == "vector hit"
    rerank_mock.assert_not_called()


@pytest.mark.unit
def test_hybrid_invokes_rerank_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.product_assistant_rag_service._product_assistant_rag_rerank_enabled",
        lambda: True,
    )
    c1 = _chunk("first", doc_id="a", score=0.95)
    c2 = _chunk("second", doc_id="b", score=0.85)

    async def fake_vector(**_kw: object) -> list[MarketingRagChunk]:
        return [c1, c2]

    async def fake_keyword(_db: object, **_kw: object) -> list[MarketingRagChunk]:
        return []

    rerank_calls: list[tuple[str, int, int]] = []

    async def fake_rerank(q: str, chunks: list[MarketingRagChunk], **kw: object) -> list[MarketingRagChunk]:
        take = int(kw.get("take") or 0)
        rerank_calls.append((q, len(chunks), take))
        return list(reversed(chunks))[:take]

    with (
        patch(
            "api.services.product_assistant_rag_service.search_product_assistant_kb_with_fallback",
            side_effect=fake_vector,
        ),
        patch(
            "api.services.product_assistant_rag_service.search_product_assistant_kb_keyword",
            side_effect=fake_keyword,
        ),
        patch(
            "api.services.product_assistant_rag_service.apply_rerank_to_chunks",
            side_effect=fake_rerank,
        ),
    ):
        out = asyncio.run(search_product_assistant_kb_hybrid(None, query="музыкальный плеер", limit=2))

    assert rerank_calls == [("музыкальный плеер", 2, 2)]
    assert len(out) == 2
    assert out[0].text == "second"
    assert out[1].text == "first"
