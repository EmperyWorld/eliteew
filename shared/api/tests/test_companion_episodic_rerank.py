# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion episodic retrieval optional rerank path (``RAG_RERANK_BASE_URL``).
# Related:
# - api/ewa_platform/companion/memory/retrieval.py
# ---

from __future__ import annotations

import asyncio
import sys
import types

import pytest

sys.modules.setdefault("asyncpg", types.ModuleType("asyncpg"))
sys.modules.setdefault("aiohttp", types.ModuleType("aiohttp"))

from api.ewa_platform.companion.memory import retrieval as mem_retrieval
from api.ewa_platform.persistence_vector.companion_qdrant import CompanionEpisodicHit


def _hit(body: str, score: float = 0.5) -> CompanionEpisodicHit:
    return CompanionEpisodicHit(
        episode_id=f"ep-{body[:8]}",
        body=body,
        kind="turn_user",
        source="chat_turn",
        persona="parent",
        importance=0.5,
        valence=0.5,
        score=score,
        created_at_iso="",
        turn_id=None,
    )


@pytest.mark.unit
def test_rerank_reorders_hits_when_rerank_returns_indices(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_ENABLED", "1")
    hits = [_hit("alpha", 0.9), _hit("beta", 0.8), _hit("gamma", 0.7)]

    async def fake_rerank(query: str, documents: list[str], *, timeout: float):
        assert query == "find beta"
        assert documents == ["alpha", "beta", "gamma"]
        return [(1, 0.99), (2, 0.5), (0, 0.1)]

    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_MAX_DOCS", "12")
    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_MAX_CHARS_PER_DOC", "4000")

    from api.services import rerank_client

    monkeypatch.setattr(rerank_client, "rerank_by_index", fake_rerank)

    out = asyncio.run(mem_retrieval._rerank_episodic_hits("find beta", hits, top_k=2))
    assert [h.body for h in out] == ["beta", "gamma"]


@pytest.mark.unit
def test_rerank_truncates_long_episode_bodies(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_MAX_CHARS_PER_DOC", "128")
    long_body = "x" * 200
    hits = [_hit(long_body, 0.9), _hit("short", 0.8)]

    seen_docs: list[list[str]] = []

    async def fake_rerank(query: str, documents: list[str], *, timeout: float):
        seen_docs.append(documents)
        return [(0, 0.9), (1, 0.8)]

    from api.services import rerank_client

    monkeypatch.setattr(rerank_client, "rerank_by_index", fake_rerank)

    out = asyncio.run(mem_retrieval._rerank_episodic_hits("q", hits, top_k=2))
    assert len(seen_docs) == 1
    assert len(seen_docs[0][0]) <= 128
    assert seen_docs[0][0].endswith("…")
    assert [h.body for h in out] == [long_body, "short"]


@pytest.mark.unit
def test_rerank_timeout_cap_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_TIMEOUT_SEC", "12.5")
    assert mem_retrieval._companion_episodic_rerank_timeout_sec() == 12.5
    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_TIMEOUT_SEC", "999")
    assert mem_retrieval._companion_episodic_rerank_timeout_sec() == 60.0


@pytest.mark.unit
def test_rerank_skipped_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EPISODIC_RERANK_ENABLED", "0")
    hits = [_hit("a"), _hit("b")]
    out = asyncio.run(mem_retrieval._rerank_episodic_hits("q", hits, top_k=2))
    assert out is hits
