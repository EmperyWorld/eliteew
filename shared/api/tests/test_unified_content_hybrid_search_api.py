# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for GET /content/search mode=keyword|hybrid routing.
# Invariants:
# - Hybrid path delegates to SemanticSearchService; keyword stays on ContentSearchService.
# Related:
# - api/routers/unified_content_search.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.routers import unified_content_search as search_mod
from api.services.unified_content.semantic_search_service import SearchResult


@pytest.mark.asyncio
async def test_search_content_keyword_uses_es_service(monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = str(uuid4())
    es_mock = AsyncMock(
        return_value={
            "total": 1,
            "took_ms": 5,
            "results": [
                {
                    "id": str(uuid4()),
                    "name": "Doc",
                    "description": None,
                    "content_type": "document",
                    "tags": [],
                    "created_at": "2025-01-01T00:00:00Z",
                    "score": 1.0,
                    "highlight": None,
                }
            ],
        }
    )
    search_service = SimpleNamespace(search=es_mock)
    hybrid_mock = AsyncMock()
    monkeypatch.setattr(search_mod, "get_semantic_search_service", hybrid_mock)

    response = await search_mod.search_content(
        q="report",
        content_type=None,
        tags=None,
        mode="keyword",
        limit=10,
        offset=0,
        user_id=user_id,
        search_service=search_service,  # type: ignore[arg-type]
    )

    assert response.search_mode == "keyword"
    assert response.total == 1
    es_mock.assert_awaited_once()
    hybrid_mock.assert_not_called()


@pytest.mark.asyncio
async def test_search_content_hybrid_uses_semantic_service(monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = str(uuid4())
    cid = uuid4()
    semantic = AsyncMock(
        return_value=[
            SearchResult(
                content_id=cid,
                title="Hybrid hit",
                description="desc",
                score=0.42,
                metadata={
                    "content_type": "document",
                    "tags": ["a"],
                    "created_at": datetime(2025, 6, 1, tzinfo=UTC),
                },
            )
        ]
    )
    svc = SimpleNamespace(search=semantic)
    monkeypatch.setattr(search_mod, "get_semantic_search_service", AsyncMock(return_value=svc))
    es_mock = AsyncMock()
    search_service = SimpleNamespace(search=es_mock)

    response = await search_mod.search_content(
        q="semantic query",
        content_type="document",
        tags="a,b",
        mode="hybrid",
        limit=10,
        offset=0,
        user_id=user_id,
        search_service=search_service,  # type: ignore[arg-type]
    )

    assert response.search_mode == "hybrid"
    assert response.total == 1
    assert response.results[0].name == "Hybrid hit"
    semantic.assert_awaited_once()
    es_mock.assert_not_called()


@pytest.mark.asyncio
async def test_search_content_hybrid_unavailable_returns_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(search_mod, "get_semantic_search_service", AsyncMock(return_value=None))

    with pytest.raises(HTTPException) as exc_info:
        await search_mod.search_content(
            q="x",
            content_type=None,
            tags=None,
            mode="hybrid",
            limit=5,
            offset=0,
            user_id=str(uuid4()),
            search_service=SimpleNamespace(search=AsyncMock()),  # type: ignore[arg-type]
        )

    assert exc_info.value.status_code == 503
