# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock chat-memory embed input budget under LLAMA_EMBED_CTX and non-retry of
# exceed_context_size HTTP 400 (prod: 4383 tokens vs n_ctx 4096).
# Related:
# - api/services/chat_memory_service.py
# - documentation/platform/STACK2-LLM-CONTRACT.md
# ---

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest


@pytest.mark.unit
def test_clip_text_for_embedding_respects_llama_embed_ctx(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.services.chat_memory_service as cms

    monkeypatch.setenv("LLAMA_EMBED_CTX", "4096")
    limit = cms._embed_max_input_chars()
    assert 2500 <= limit <= 3800
    long = "я" * (limit + 500)
    clipped = cms._clip_text_for_embedding(long)
    assert len(clipped) <= limit
    assert clipped.endswith("…")


@pytest.mark.unit
def test_prepare_memory_turn_fits_embed_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.services.chat_memory_service as cms

    monkeypatch.setenv("LLAMA_EMBED_CTX", "4096")
    budget = cms._embed_max_input_chars()
    prepared = cms.prepare_memory_record(
        user_text="u" * 5000,
        assistant_text="a" * 8000,
        chat_profile="bezrazdelny_agent",
    )
    assert prepared is not None
    stored, extras = prepared
    assert extras.get("memory_kind") == cms.MEMORY_KIND_TURN
    assert len(stored) <= budget


@pytest.mark.unit
def test_exceed_context_embed_error_is_non_retryable() -> None:
    import api.services.chat_memory_service as cms

    err = RuntimeError(
        'OpenAI embeddings HTTP 400: {"error":{"code":400,"message":'
        '"request (4383 tokens) exceeds the available context size (4096 tokens), '
        'try increasing it","type":"exceed_context_size_error"}}'
    )
    assert cms._is_non_retryable_embed_error(err) is True
    assert cms._is_non_retryable_embed_error(ConnectionError("temporary")) is False


@pytest.mark.unit
def test_get_embedding_does_not_retry_exceed_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.services.chat_memory_service as cms

    dim = 32
    monkeypatch.setenv("EWA_COMPANION_EMBED_HTTP_RETRIES", "3")
    monkeypatch.setattr(cms, "_embedding_dim", lambda: dim)
    monkeypatch.setattr(cms, "_embedding_model", lambda: "test-embed")
    monkeypatch.setattr(
        cms,
        "unified_settings",
        SimpleNamespace(
            llama_embeddings_service_base="http://embed.test",
            llama_embedding_url="http://embed.test",
        ),
    )
    attempts = {"count": 0}

    class _FakeClientTimeout:
        def __init__(self, total: float):
            self.total = total

    class _FakeClientSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

    async def _fake_embeddings_dict(*args, **kwargs):  # type: ignore[no-untyped-def]
        del args, kwargs
        attempts["count"] += 1
        raise RuntimeError(
            "OpenAI embeddings HTTP 400: exceed_context_size_error "
            "request (4383 tokens) exceeds the available context size (4096 tokens)"
        )

    async def _no_sleep(_delay: float) -> None:
        return None

    monkeypatch.setattr(
        cms,
        "aiohttp",
        SimpleNamespace(ClientTimeout=_FakeClientTimeout, ClientSession=lambda: _FakeClientSession()),
    )
    monkeypatch.setattr(cms, "aiohttp_compat_embeddings_dict", _fake_embeddings_dict)
    monkeypatch.setattr(cms.asyncio, "sleep", _no_sleep)
    monkeypatch.setattr(cms, "observe_embedding_request", lambda **kwargs: None)
    monkeypatch.setattr(cms, "observe_embedding_retry", lambda **kwargs: None)
    monkeypatch.setattr(cms, "llama_keep_alive_from_settings", lambda: None)

    result = asyncio.run(cms._get_embedding("probe text for memory"))
    assert result is None
    assert attempts["count"] == 1
