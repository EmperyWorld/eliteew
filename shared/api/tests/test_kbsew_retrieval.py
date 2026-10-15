# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for KBSEW retrieval settings (chunks_per_barrel, rerank, retrieval_mode) and search pipeline.
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from api.services.desktop_chat.kbsew_search_settings import (
    KBSEW_CHUNKS_PER_BARREL_DEFAULT,
    KbsewSearchSettings,
    clamp_kbsew_chunks_per_barrel,
    kbsew_vector_fetch_limit,
    normalize_kbsew_search_settings,
    resolve_kbsew_search_settings,
)
from api.services.kbsew import kbsew_retrieval


def test_clamp_chunks_per_barrel() -> None:
    assert clamp_kbsew_chunks_per_barrel(0) == 1
    assert clamp_kbsew_chunks_per_barrel(99) == 20
    assert clamp_kbsew_chunks_per_barrel("7") == 7
    assert clamp_kbsew_chunks_per_barrel(None) == KBSEW_CHUNKS_PER_BARREL_DEFAULT


def test_kbsew_vector_fetch_limit_with_rerank() -> None:
    settings = normalize_kbsew_search_settings({"chunks_per_barrel": 5, "rerank_enabled": True, "allowed_barrels": []})
    assert kbsew_vector_fetch_limit(settings) == 20
    settings_small = normalize_kbsew_search_settings(
        {"chunks_per_barrel": 3, "rerank_enabled": True, "allowed_barrels": []}
    )
    assert kbsew_vector_fetch_limit(settings_small) == 12


def test_resolve_overlay_chunks_and_rerank() -> None:
    resolved = resolve_kbsew_search_settings(
        {"kbsew_search_settings": {"chunks_per_barrel": 8, "rerank_enabled": False}},
        {"kbsew_search_settings": {"rerank_enabled": True, "chunks_per_barrel": 4}},
    )
    assert resolved.chunks_per_barrel == 4
    assert resolved.rerank_enabled is True


@pytest.mark.asyncio
async def test_kbsew_search_with_settings_passes_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_search = AsyncMock(return_value=["a", "b", "c"])
    monkeypatch.setattr(kbsew_retrieval, "kbsew_search_barrel", mock_search)
    settings = KbsewSearchSettings(chunks_per_barrel=2, rerank_enabled=False, allowed_barrels=[])
    chunks = await kbsew_retrieval.kbsew_search_with_settings(
        query="test",
        barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        settings=settings,
    )
    assert chunks == ["a", "b"]
    search_call = mock_search.await_args
    assert search_call is not None
    assert search_call.kwargs["limit"] == 2


@pytest.mark.asyncio
async def test_kbsew_search_with_settings_rerank_reorders(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_search = AsyncMock(return_value=["first", "second", "third", "fourth"])
    mock_rerank = AsyncMock(return_value=[(2, 0.9), (0, 0.5), (1, 0.3), (3, 0.1)])
    monkeypatch.setattr(kbsew_retrieval, "kbsew_search_barrel", mock_search)
    monkeypatch.setattr(kbsew_retrieval, "rerank_by_index", mock_rerank)
    settings = KbsewSearchSettings(chunks_per_barrel=2, rerank_enabled=True, allowed_barrels=[])
    chunks = await kbsew_retrieval.kbsew_search_with_settings(
        query="test",
        barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        settings=settings,
    )
    assert chunks == ["third", "first"]
    search_call = mock_search.await_args
    assert search_call is not None
    assert search_call.kwargs["limit"] == 8


@pytest.mark.asyncio
async def test_kbsew_search_with_settings_passes_retrieval_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_search = AsyncMock(return_value=["a"])
    monkeypatch.setattr(kbsew_retrieval, "kbsew_search_barrel", mock_search)
    settings = KbsewSearchSettings(chunks_per_barrel=2, retrieval_mode="hybrid", allowed_barrels=[])
    chunks = await kbsew_retrieval.kbsew_search_with_settings(
        query="test",
        barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        settings=settings,
    )
    assert chunks == ["a"]
    search_call = mock_search.await_args
    assert search_call is not None
    assert search_call.kwargs["retrieval_mode"] == "hybrid"


@pytest.mark.asyncio
async def test_kbsew_search_with_settings_body_override_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_search = AsyncMock(return_value=["a"])
    monkeypatch.setattr(kbsew_retrieval, "kbsew_search_barrel", mock_search)
    settings = KbsewSearchSettings(chunks_per_barrel=2, retrieval_mode="dense", allowed_barrels=[])
    await kbsew_retrieval.kbsew_search_with_settings(
        query="test",
        barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        settings=settings,
        retrieval_mode="hybrid",
    )
    search_call = mock_search.await_args
    assert search_call is not None
    assert search_call.kwargs["retrieval_mode"] == "hybrid"


def test_normalize_retrieval_mode_and_resolve() -> None:
    from api.services.desktop_chat.kbsew_search_settings import normalize_kbsew_retrieval_mode

    assert normalize_kbsew_retrieval_mode("HYBRID") == "hybrid"
    assert normalize_kbsew_retrieval_mode("nope") == "dense"
    resolved = resolve_kbsew_search_settings(
        {"kbsew_search_settings": {"retrieval_mode": "hybrid"}},
    )
    assert resolved.retrieval_mode == "hybrid"
