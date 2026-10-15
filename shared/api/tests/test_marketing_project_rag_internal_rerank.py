"""Marketing project RAG: internal cross-encoder rerank when RAG_RERANK_BASE_URL is enabled."""

from __future__ import annotations

import asyncio
import sys
import types
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


def _stub_qdrant_client_models() -> None:
    """Локальный pytest без qdrant_client: заглушка для import внутри search."""
    if "qdrant_client.models" in sys.modules and hasattr(sys.modules["qdrant_client.models"], "__file__"):
        return
    m = types.ModuleType("qdrant_client.models")

    def _dummy(*_a: object, **_kw: object) -> object:
        return object()

    setattr(m, "FieldCondition", _dummy)
    setattr(m, "Filter", _dummy)
    setattr(m, "MatchValue", _dummy)
    sys.modules["qdrant_client.models"] = m


import pytest

from api.services.marketing_project_rag_service import (
    MarketingRagChunk,
    search_marketing_project_rag_chunks,
)


def _fake_point(score: float, text: str, name: str = "doc") -> SimpleNamespace:
    return SimpleNamespace(
        score=score,
        payload={
            "text": text,
            "content_id": "c1",
            "chunk_index": 0,
            "name": name,
        },
    )


@pytest.mark.unit
def test_search_invokes_rerank_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.marketing_project_rag_service._marketing_rag_rerank_enabled",
        lambda: True,
    )
    rerank_calls: list[tuple[int, int]] = []

    async def fake_rerank(q: str, chunks: list[MarketingRagChunk], **kw: object) -> list[MarketingRagChunk]:
        take = int(kw.get("take") or 0)
        rerank_calls.append((len(chunks), take))
        rev = list(reversed(chunks))[:take]
        out: list[MarketingRagChunk] = []
        for i, c in enumerate(rev):
            out.append(
                MarketingRagChunk(
                    text=c.text,
                    ordinal=i + 1,
                    content_id=c.content_id,
                    chunk_index=c.chunk_index,
                    source_label=c.source_label,
                    score=c.score,
                )
            )
        return out

    mock_client = MagicMock()
    mock_client.query_points = AsyncMock(
        return_value=SimpleNamespace(
            points=[
                _fake_point(0.9, "aaa first by vector"),
                _fake_point(0.85, "bbb second"),
                _fake_point(0.8, "ccc third"),
            ]
        )
    )

    async def fake_get_embedding(_text: str) -> list[float]:
        return [0.1] * 2560

    async def _run() -> None:
        _stub_qdrant_client_models()
        with (
            patch(
                "api.routers.marketing_cabinet.common.get_accessible_project",
                new_callable=AsyncMock,
            ),
            patch(
                "api.services.marketing_project_rag_service._get_embedding",
                side_effect=fake_get_embedding,
            ),
            patch(
                "api.services.marketing_project_rag_service._get_qdrant_client",
                new_callable=AsyncMock,
                return_value=mock_client,
            ),
            patch(
                "api.services.marketing_project_rag_service._ensure_marketing_rag_collection",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "api.services.rerank_client.apply_rerank_to_chunks",
                side_effect=fake_rerank,
            ),
        ):
            pid = uuid4()
            uid = uuid4()
            pool = AsyncMock()
            out = await search_marketing_project_rag_chunks(
                pool,
                query="q",
                project_id=pid,
                user_id=uid,
                limit=2,
                min_score=None,
            )

        assert len(out) == 2
        assert rerank_calls == [(3, 2)]
        assert "ccc third" in out[0].text

    asyncio.run(_run())


@pytest.mark.unit
def test_search_skips_rerank_when_skip_internal(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.marketing_project_rag_service._marketing_rag_rerank_enabled",
        lambda: True,
    )

    mock_client = MagicMock()
    mock_client.query_points = AsyncMock(
        return_value=SimpleNamespace(
            points=[
                _fake_point(0.9, "first"),
                _fake_point(0.85, "second"),
            ]
        )
    )

    async def fake_get_embedding(_text: str) -> list[float]:
        return [0.1] * 2560

    async def _run() -> None:
        _stub_qdrant_client_models()
        with (
            patch(
                "api.routers.marketing_cabinet.common.get_accessible_project",
                new_callable=AsyncMock,
            ),
            patch(
                "api.services.marketing_project_rag_service._get_embedding",
                side_effect=fake_get_embedding,
            ),
            patch(
                "api.services.marketing_project_rag_service._get_qdrant_client",
                new_callable=AsyncMock,
                return_value=mock_client,
            ),
            patch(
                "api.services.marketing_project_rag_service._ensure_marketing_rag_collection",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "api.services.rerank_client.apply_rerank_to_chunks",
                new_callable=AsyncMock,
            ) as mock_rerank,
        ):
            pid = uuid4()
            uid = uuid4()
            pool = AsyncMock()
            out = await search_marketing_project_rag_chunks(
                pool,
                query="q",
                project_id=pid,
                user_id=uid,
                limit=2,
                min_score=None,
                skip_internal_rerank=True,
            )

        mock_rerank.assert_not_called()
        assert len(out) == 2
        assert out[0].text == "first"

    asyncio.run(_run())
