# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Search service and Qdrant read-path contract tests.
# ---

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock

import api.services.qdrant_store as qdrant_store
import api.services.search_service as search_service
import pytest
from api.core.config import get_settings
from api.services.search_service import (
    BarrelDisabledError,
    BarrelNotFoundError,
    EmbeddingFailedError,
    IndexStaleError,
    rrf_merge,
)


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    qdrant_store.reset_qdrant_client_for_tests()
    yield
    get_settings.cache_clear()
    qdrant_store.reset_qdrant_client_for_tests()


@pytest.fixture(autouse=True)
def _pipeline_fresh_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        search_service.revision_service,
        "barrel_pipeline_freshness",
        AsyncMock(
            return_value={
                "pipeline_fresh": True,
                "stale_asset_count": 0,
                "required_pipeline_version": "kbsew-ingest-v2",
            }
        ),
    )


@pytest.mark.asyncio
async def test_search_collection_chunks_returns_text_payloads(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = True
    point = type("Point", (), {"payload": {"text": " chunk one "}})()
    mock_client.query_points.return_value = type("Result", (), {"points": [point]})()
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)

    chunks = await qdrant_store.search_collection_chunks(
        collection="kbsew_barrel_test",
        query_vector=[0.1, 0.2],
        limit=5,
    )
    assert chunks == ["chunk one"]
    mock_client.query_points.assert_awaited_once()


@pytest.mark.asyncio
async def test_search_barrel_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    barrel = {
        "id": "da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        "enabled": True,
        "qdrant_collection": "kbsew_barrel_da11ce9f1d46474781127210",
    }
    monkeypatch.setattr(search_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(search_service, "embed_texts", AsyncMock(return_value=[[0.1, 0.2, 0.3]]))
    monkeypatch.setattr(
        search_service,
        "search_collection_chunks",
        AsyncMock(
            return_value=[
                "Маркетинговый брендовый контекст с достаточным количеством слов для фильтра качества.",
                "Позиционирование продукта описано как связный фрагмент знания для поиска, "
                "который должен пройти фильтр качества извлеченного текста.",
            ]
        ),
    )

    chunks = await search_service.search_barrel(
        barrel_id=barrel["id"],
        query="маркетинг бренд",
    )
    assert chunks == [
        "Маркетинговый брендовый контекст с достаточным количеством слов для фильтра качества.",
        "Позиционирование продукта описано как связный фрагмент знания для поиска, "
        "который должен пройти фильтр качества извлеченного текста.",
    ]
    search_service.search_collection_chunks.assert_awaited_once()
    assert search_service.search_collection_chunks.await_args is not None
    call_kwargs = search_service.search_collection_chunks.await_args.kwargs
    assert call_kwargs["limit"] >= 5


@pytest.mark.asyncio
async def test_search_barrel_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(search_service.barrel_service, "get_barrel", AsyncMock(return_value=None))
    with pytest.raises(BarrelNotFoundError):
        await search_service.search_barrel(barrel_id="00000000-0000-4000-8000-000000000099", query="x")


@pytest.mark.asyncio
async def test_search_barrel_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        search_service.barrel_service,
        "get_barrel",
        AsyncMock(return_value={"enabled": False, "qdrant_collection": "c"}),
    )
    with pytest.raises(BarrelDisabledError):
        await search_service.search_barrel(barrel_id="00000000-0000-4000-8000-000000000099", query="x")


@pytest.mark.asyncio
async def test_search_barrel_index_stale(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        search_service.barrel_service,
        "get_barrel",
        AsyncMock(return_value={"enabled": True, "qdrant_collection": "c"}),
    )
    monkeypatch.setattr(
        search_service.revision_service,
        "barrel_pipeline_freshness",
        AsyncMock(
            return_value={
                "pipeline_fresh": False,
                "stale_asset_count": 4,
                "required_pipeline_version": "kbsew-ingest-v2",
            }
        ),
    )
    with pytest.raises(IndexStaleError) as exc_info:
        await search_service.search_barrel(
            barrel_id="00000000-0000-4000-8000-000000000099",
            query="маркетинг",
        )
    assert exc_info.value.stale_assets == 4
    assert exc_info.value.code == "index_stale"


@pytest.mark.asyncio
async def test_search_barrel_embed_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        search_service.barrel_service,
        "get_barrel",
        AsyncMock(return_value={"enabled": True, "qdrant_collection": "c"}),
    )
    monkeypatch.setattr(search_service, "embed_texts", AsyncMock(return_value=[]))
    with pytest.raises(EmbeddingFailedError):
        await search_service.search_barrel(barrel_id="00000000-0000-4000-8000-000000000099", query="x")


def test_rrf_merge_without_sparse_equals_dense() -> None:
    dense = ["a", "b", "c"]
    assert rrf_merge(dense, None, top_k=2) == ["a", "b"]
    assert rrf_merge(dense, [], top_k=3) == ["a", "b", "c"]


def test_rrf_merge_with_sparse_blends_ranks() -> None:
    dense = ["a", "b", "c"]
    sparse = ["c", "a", "d"]
    merged = rrf_merge(dense, sparse, top_k=3)
    assert merged[0] == "a"
    assert "c" in merged
    assert len(merged) == 3


@pytest.mark.asyncio
async def test_search_barrel_default_mode_is_dense(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {
        "id": "da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        "enabled": True,
        "qdrant_collection": "kbsew_barrel_test",
    }
    monkeypatch.setattr(search_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(search_service, "embed_texts", AsyncMock(return_value=[[0.1, 0.2, 0.3]]))
    readable = "Маркетинговый брендовый контекст с достаточным количеством слов для фильтра качества."
    monkeypatch.setattr(
        search_service,
        "search_collection_chunks",
        AsyncMock(return_value=[readable]),
    )
    sparse = AsyncMock(return_value=["should-not-be-called"])
    monkeypatch.setattr(search_service, "_sparse_retrieve", sparse)

    chunks = await search_service.search_barrel(
        barrel_id=barrel["id"],
        query="маркетинг",
    )
    assert chunks == [readable]
    sparse.assert_not_awaited()


@pytest.mark.asyncio
async def test_search_barrel_hybrid_falls_back_to_dense_when_sparse_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    barrel = {
        "id": "da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        "enabled": True,
        "qdrant_collection": "kbsew_barrel_test",
    }
    monkeypatch.setattr(search_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(search_service, "embed_texts", AsyncMock(return_value=[[0.1, 0.2, 0.3]]))
    readable = (
        "Позиционирование продукта описано как связный фрагмент знания для поиска, "
        "который должен пройти фильтр качества извлеченного текста."
    )
    monkeypatch.setattr(
        search_service,
        "search_collection_chunks",
        AsyncMock(return_value=[readable]),
    )
    sparse = AsyncMock(return_value=None)
    monkeypatch.setattr(search_service, "_sparse_retrieve", sparse)

    chunks = await search_service.search_barrel(
        barrel_id=barrel["id"],
        query="продукт",
        retrieval_mode="hybrid",
    )
    assert chunks == [readable]
    sparse.assert_awaited_once()


@pytest.mark.asyncio
async def test_search_barrel_hybrid_rrf_order_differs_from_dense(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When sparse ranks differently, hybrid RRF order is not dense-only."""

    barrel = {
        "id": "da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        "enabled": True,
        "qdrant_collection": "kbsew_barrel_test",
    }
    chunk_a = "Маркетинговый брендовый контекст с достаточным количеством слов для фильтра качества."
    chunk_b = (
        "Позиционирование продукта описано как связный фрагмент знания для поиска, "
        "который должен пройти фильтр качества извлеченного текста."
    )
    chunk_c = (
        "Квантовый протокол entanglement описан как отдельный технический фрагмент знания "
        "с достаточным числом слов для прохождения фильтра читаемости."
    )
    monkeypatch.setattr(search_service.barrel_service, "get_barrel", AsyncMock(return_value=barrel))
    monkeypatch.setattr(search_service, "embed_texts", AsyncMock(return_value=[[0.1, 0.2, 0.3]]))
    monkeypatch.setattr(
        search_service,
        "search_collection_chunks",
        AsyncMock(return_value=[chunk_a, chunk_b, chunk_c]),
    )
    monkeypatch.setattr(
        search_service,
        "_sparse_retrieve",
        AsyncMock(return_value=[chunk_c, chunk_a]),
    )

    dense_only = await search_service.search_barrel(
        barrel_id=barrel["id"],
        query="маркетинг",
        retrieval_mode="dense",
        limit=3,
    )
    hybrid = await search_service.search_barrel(
        barrel_id=barrel["id"],
        query="маркетинг",
        retrieval_mode="hybrid",
        limit=3,
    )
    assert dense_only == [chunk_a, chunk_b, chunk_c]
    assert hybrid != dense_only
    assert hybrid[0] == chunk_a
    assert hybrid.index(chunk_c) < hybrid.index(chunk_b)


@pytest.mark.asyncio
async def test_sparse_retrieve_skips_when_flag_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("KBSEW_SPARSE_VECTORS_ENABLED", raising=False)
    get_settings.cache_clear()
    ranked = await search_service._sparse_retrieve(
        collection="kbsew_barrel_test",
        query="quantum",
        limit=5,
    )
    assert ranked is None


@pytest.mark.asyncio
async def test_sparse_retrieve_returns_ranked_when_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    monkeypatch.delenv("KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE", raising=False)
    get_settings.cache_clear()
    from api.services.qdrant_store import SparseRankResult

    sparse_search = AsyncMock(
        return_value=SparseRankResult(
            texts=["chunk-sparse-1"],
            truncated=False,
            candidate_count=1,
            candidate_limit=256,
        )
    )
    monkeypatch.setattr(search_service, "search_collection_sparse_chunks", sparse_search)
    ranked = await search_service._sparse_retrieve(
        collection="kbsew_barrel_test",
        query="quantum",
        limit=5,
    )
    assert ranked == ["chunk-sparse-1"]
    sparse_search.assert_awaited_once()


@pytest.mark.asyncio
async def test_sparse_retrieve_skips_when_scroll_truncated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Default: truncated sparse universe → dense degrade (honest hybrid)."""

    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    monkeypatch.delenv("KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE", raising=False)
    get_settings.cache_clear()
    from api.services.qdrant_store import SparseRankResult

    sparse_search = AsyncMock(
        return_value=SparseRankResult(
            texts=["partial-a", "partial-b"],
            truncated=True,
            candidate_count=256,
            candidate_limit=256,
        )
    )
    monkeypatch.setattr(search_service, "search_collection_sparse_chunks", sparse_search)
    ranked = await search_service._sparse_retrieve(
        collection="kbsew_barrel_test",
        query="quantum",
        limit=5,
    )
    assert ranked is None


@pytest.mark.asyncio
async def test_sparse_retrieve_allows_truncated_when_opt_in(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    monkeypatch.setenv("KBSEW_HYBRID_ALLOW_TRUNCATED_SPARSE", "true")
    get_settings.cache_clear()
    from api.services.qdrant_store import SparseRankResult

    sparse_search = AsyncMock(
        return_value=SparseRankResult(
            texts=["partial-a"],
            truncated=True,
            candidate_count=256,
            candidate_limit=256,
        )
    )
    monkeypatch.setattr(search_service, "search_collection_sparse_chunks", sparse_search)
    ranked = await search_service._sparse_retrieve(
        collection="kbsew_barrel_test",
        query="quantum",
        limit=5,
    )
    assert ranked == ["partial-a"]
