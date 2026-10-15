# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batched Qdrant upsert contract tests.
# ---

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock

import api.services.qdrant_store as qdrant_store
import pytest
from api.core.config import get_settings
from api.models.chunk import Chunk


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    qdrant_store.reset_qdrant_client_for_tests()
    yield
    get_settings.cache_clear()
    qdrant_store.reset_qdrant_client_for_tests()


@pytest.mark.asyncio
async def test_upsert_chunks_batches_points(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KBSEW_QDRANT_UPSERT_BATCH_SIZE", "40")
    monkeypatch.setenv("AI_EMBEDDINGS_DIMENSION", "4")
    get_settings.cache_clear()

    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = True
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)

    chunks = [
        Chunk(
            text=f"t-{index}",
            chunk_index=index,
            metadata={},
            embedding=[0.1, 0.2, 0.3, 0.4],
        )
        for index in range(95)
    ]
    indexed = await qdrant_store.upsert_chunks(
        collection="kbsew_barrel_test",
        barrel_id="00000000-0000-4000-8000-000000000001",
        asset_id="00000000-0000-4000-8000-000000000002",
        chunks=chunks,
    )

    assert indexed == 95
    assert mock_client.upsert.await_count == 3
    batch_sizes = [len(call.kwargs["points"]) for call in mock_client.upsert.await_args_list]
    assert batch_sizes == [40, 40, 15]


def test_chunk_to_point_is_stable_for_asset_and_chunk() -> None:
    chunk = Chunk(text="same", chunk_index=3, metadata={}, embedding=[0.1, 0.2])
    first = qdrant_store.chunk_to_point(
        chunk=chunk,
        barrel_id="00000000-0000-4000-8000-000000000001",
        asset_id="00000000-0000-4000-8000-000000000002",
    )
    second = qdrant_store.chunk_to_point(
        chunk=chunk,
        barrel_id="00000000-0000-4000-8000-000000000001",
        asset_id="00000000-0000-4000-8000-000000000002",
    )

    assert first.id == second.id


def test_chunk_to_point_defaults_chunk_kind_text() -> None:
    chunk = Chunk(text="plain", chunk_index=1, metadata={}, embedding=[0.1, 0.2])
    point = qdrant_store.chunk_to_point(
        chunk=chunk,
        barrel_id="00000000-0000-4000-8000-000000000001",
        asset_id="00000000-0000-4000-8000-000000000002",
    )
    assert (point.payload or {}).get("chunk_kind") == "text"
    assert "page" not in (point.payload or {})
    assert "bbox" not in (point.payload or {})


def test_chunk_to_point_figure_includes_page_and_bbox() -> None:
    chunk = Chunk(
        text="figure caption",
        chunk_index=2,
        metadata={"filename": "doc.pdf"},
        embedding=[0.1, 0.2],
        chunk_kind="figure",
        page=3,
        bbox=(1.0, 2.0, 3.5, 4.5),
    )
    point = qdrant_store.chunk_to_point(
        chunk=chunk,
        barrel_id="00000000-0000-4000-8000-000000000001",
        asset_id="00000000-0000-4000-8000-000000000002",
    )
    payload = point.payload or {}
    assert payload["chunk_kind"] == "figure"
    assert payload["page"] == 3
    assert payload["bbox"] == [1.0, 2.0, 3.5, 4.5]
    assert payload["filename"] == "doc.pdf"


def test_chunk_to_point_dense_default_has_no_sparse_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("KBSEW_SPARSE_VECTORS_ENABLED", raising=False)
    get_settings.cache_clear()
    chunk = Chunk(
        text="marketing brand positioning",
        chunk_index=0,
        metadata={},
        embedding=[0.1, 0.2],
    )
    point = qdrant_store.chunk_to_point(
        chunk=chunk,
        barrel_id="00000000-0000-4000-8000-000000000001",
        asset_id="00000000-0000-4000-8000-000000000002",
    )
    assert point.vector == [0.1, 0.2]
    assert "sparse_indices" not in (point.payload or {})


def test_chunk_to_point_sparse_flag_adds_payload_weights(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    get_settings.cache_clear()
    chunk = Chunk(
        text="marketing brand positioning marketing",
        chunk_index=0,
        metadata={},
        embedding=[0.1, 0.2],
    )
    point = qdrant_store.chunk_to_point(
        chunk=chunk,
        barrel_id="00000000-0000-4000-8000-000000000001",
        asset_id="00000000-0000-4000-8000-000000000002",
    )
    payload = point.payload or {}
    assert point.vector == [0.1, 0.2]
    assert payload.get("sparse_scheme") == "hashed_log_tf_v1"
    assert payload.get("sparse_indices")
    assert payload.get("sparse_values")
    assert payload.get("sparse_vector_ready") is True
    assert "_sparse_vector_hook" not in payload


@pytest.mark.asyncio
async def test_search_collection_sparse_chunks_ranks_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    get_settings.cache_clear()

    strong_text = "quantum entanglement protocol details for operators with enough words"
    weak_text = "marketing brand positioning narrative described as a coherent knowledge fragment"
    from api.services.sparse_vectors import sparse_weights_payload

    strong = sparse_weights_payload(strong_text)
    weak = sparse_weights_payload(weak_text)
    assert strong is not None
    assert weak is not None

    record_strong = type(
        "Record",
        (),
        {
            "payload": {
                "text": strong_text,
                **strong,
            }
        },
    )()
    record_weak = type(
        "Record",
        (),
        {
            "payload": {
                "text": weak_text,
                **weak,
            }
        },
    )()

    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = True
    mock_client.scroll.return_value = ([record_weak, record_strong], None)
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)

    ranked = await qdrant_store.search_collection_sparse_chunks(
        collection="kbsew_barrel_test",
        query="quantum entanglement protocol",
        limit=2,
        candidate_limit=32,
    )
    assert ranked.texts[0] == strong_text
    assert ranked.truncated is False
    assert ranked.candidate_count == 2
    mock_client.scroll.assert_awaited()


@pytest.mark.asyncio
async def test_fetch_sparse_payload_candidates_marks_truncated_when_cap_hit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scroll that fills candidate_limit with remaining page/offset → truncated."""

    from api.services.sparse_vectors import sparse_weights_payload

    texts = [f"sparse candidate document number {i} with enough words for hashing" for i in range(3)]
    records = []
    for text in texts:
        weights = sparse_weights_payload(text)
        assert weights is not None
        records.append(type("Record", (), {"payload": {"text": text, **weights}})())

    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = True
    # One page of 3 valid candidates; limit=2 → stop mid-page → truncated.
    mock_client.scroll.return_value = (records, None)
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)

    batch = await qdrant_store.fetch_sparse_payload_candidates(
        collection="kbsew_barrel_test",
        limit=2,
    )
    assert len(batch.candidates) == 2
    assert batch.truncated is True
    assert batch.limit == 2


@pytest.mark.asyncio
async def test_delete_points_for_asset_uses_payload_filter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = True
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)

    await qdrant_store.delete_points_for_asset(
        collection="kbsew_barrel_test",
        asset_id="00000000-0000-4000-8000-000000000002",
    )

    mock_client.delete.assert_awaited_once()
    assert mock_client.delete.await_args is not None
    selector = mock_client.delete.await_args.kwargs["points_selector"]
    assert selector.filter.must[0].key == "asset_id"
    assert selector.filter.must[0].match.value == "00000000-0000-4000-8000-000000000002"


@pytest.mark.asyncio
async def test_delete_stale_points_after_upsert_filters_chunk_index(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = True
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)

    await qdrant_store.delete_stale_points_after_upsert(
        collection="kbsew_barrel_test",
        asset_id="00000000-0000-4000-8000-000000000002",
        keep_chunk_count=3,
    )

    mock_client.delete.assert_awaited_once()
    assert mock_client.delete.await_args is not None
    selector = mock_client.delete.await_args.kwargs["points_selector"]
    must = selector.filter.must
    assert must[0].key == "asset_id"
    assert must[1].key == "chunk_index"
    assert must[1].range.gte == 3


@pytest.mark.asyncio
async def test_delete_stale_points_rejects_zero_keep(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValueError, match="keep_chunk_count"):
        await qdrant_store.delete_stale_points_after_upsert(
            collection="kbsew_barrel_test",
            asset_id="asset-a",
            keep_chunk_count=0,
        )


@pytest.mark.asyncio
async def test_chunk_to_point_native_named_vectors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    monkeypatch.setenv("KBSEW_SPARSE_NATIVE_QDRANT", "true")
    get_settings.cache_clear()

    chunk = Chunk(
        chunk_index=0,
        text="marketing brand positioning knowledge",
        embedding=[0.1, 0.2, 0.3, 0.4],
        metadata={},
    )
    point = qdrant_store.chunk_to_point(
        chunk=chunk,
        barrel_id="barrel-a",
        asset_id="00000000-0000-4000-8000-000000000099",
    )
    assert isinstance(point.vector, dict)
    assert qdrant_store.DENSE_VECTOR_NAME in point.vector
    assert qdrant_store.SPARSE_VECTOR_NAME in point.vector
    assert point.payload is not None
    assert point.payload.get("sparse_vector_ready") is True


@pytest.mark.asyncio
async def test_ensure_collection_creates_named_native_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    monkeypatch.setenv("KBSEW_SPARSE_NATIVE_QDRANT", "true")
    get_settings.cache_clear()

    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = False
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)

    await qdrant_store.ensure_collection("kbsew_barrel_native", vector_size=4)

    mock_client.create_collection.assert_awaited_once()
    kwargs = mock_client.create_collection.await_args.kwargs
    assert qdrant_store.DENSE_VECTOR_NAME in kwargs["vectors_config"]
    assert qdrant_store.SPARSE_VECTOR_NAME in kwargs["sparse_vectors_config"]


@pytest.mark.asyncio
async def test_search_sparse_uses_native_query_when_schema_matches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_SPARSE_VECTORS_ENABLED", "true")
    monkeypatch.setenv("KBSEW_SPARSE_NATIVE_QDRANT", "true")
    get_settings.cache_clear()

    mock_client = AsyncMock()
    mock_client.collection_exists.return_value = True
    mock_point = type(
        "P",
        (),
        {"payload": {"text": "quantum entanglement protocol notes"}},
    )()
    mock_client.query_points.return_value = type("R", (), {"points": [mock_point]})()
    monkeypatch.setattr(qdrant_store, "get_qdrant_client", lambda: mock_client)
    monkeypatch.setattr(
        qdrant_store,
        "detect_collection_schema",
        AsyncMock(return_value="named_native"),
    )

    ranked = await qdrant_store.search_collection_sparse_chunks(
        collection="kbsew_barrel_native",
        query="quantum entanglement",
        limit=3,
    )
    assert ranked.backend == "native_qdrant"
    assert ranked.truncated is False
    assert ranked.texts == ["quantum entanglement protocol notes"]
    mock_client.query_points.assert_awaited_once()
    assert mock_client.query_points.await_args.kwargs["using"] == qdrant_store.SPARSE_VECTOR_NAME
    mock_client.scroll.assert_not_called()
