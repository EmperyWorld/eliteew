# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3 contract locks: turn phase order, interactive/deep job class, Desktop RAG budget defaults.
# Invariants:
# - No HTTP/DB; env monkeypatch only for deep URL and budget helpers.
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md §6 / Phase 3
# ---
"""Tests: Phase 3 LLM runtime turn contract + job class + RAG budget defaults."""

from __future__ import annotations

import pytest

from api.services.desktop_chat.rag_limits import (
    DEFAULT_RAG_MAX_CHUNKS_CHARS,
    DEFAULT_RAG_TOP_K,
    desktop_rag_max_chunks_chars,
    desktop_rag_top_k,
)
from api.services.llm_runtime.job_class import (
    DeepLlmUnavailableError,
    normalize_llm_job_class,
    resolve_llm_base_url,
)
from api.services.llm_runtime.turn_contract import (
    TurnPhaseOrderError,
    TurnPhaseTracker,
    is_canonical_phase_sequence,
)


@pytest.mark.unit
def test_canonical_phase_sequence_ok() -> None:
    assert is_canonical_phase_sequence(["route", "retrieve", "answer", "persist"])
    assert is_canonical_phase_sequence(["route", "retrieve", "act", "answer"])


@pytest.mark.unit
def test_canonical_phase_sequence_rejects_backward() -> None:
    assert not is_canonical_phase_sequence(["retrieve", "route"])


@pytest.mark.unit
def test_turn_phase_tracker_requires_retrieve_before_answer() -> None:
    t = TurnPhaseTracker(surface="test")
    t.mark("route")
    with pytest.raises(TurnPhaseOrderError):
        t.assert_ready_for_answer()
    t.mark("retrieve")
    t.assert_ready_for_answer()


@pytest.mark.unit
def test_turn_phase_tracker_optional_retrieve_when_disabled() -> None:
    t = TurnPhaseTracker(surface="test", require_retrieve_before_answer=False)
    t.mark("route")
    t.assert_ready_for_answer()


@pytest.mark.unit
def test_normalize_llm_job_class() -> None:
    assert normalize_llm_job_class(None) == "interactive"
    assert normalize_llm_job_class("interactive") == "interactive"
    assert normalize_llm_job_class("deep") == "deep"
    assert normalize_llm_job_class("research") == "deep"


@pytest.mark.unit
def test_resolve_llm_deep_unavailable_without_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLAMA_DEEP_URL", raising=False)
    with pytest.raises(DeepLlmUnavailableError):
        resolve_llm_base_url(job_class="deep")


@pytest.mark.unit
def test_resolve_llm_deep_uses_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080/")
    assert resolve_llm_base_url(job_class="deep") == "http://192.168.1.136:8080"


@pytest.mark.unit
def test_desktop_rag_budget_defaults() -> None:
    assert DEFAULT_RAG_TOP_K == 8
    assert DEFAULT_RAG_MAX_CHUNKS_CHARS == 8_000
    assert desktop_rag_top_k({}) == 8
    assert desktop_rag_max_chunks_chars({}) == 8_000
    # Stored operator defaults win when set.
    assert desktop_rag_top_k({"rag_top_k": 12}) == 12
    assert desktop_rag_max_chunks_chars({"rag_max_chunks_chars": 24_000}) == 24_000
    # Hard clamp: never silent-raise above 48k.
    assert desktop_rag_max_chunks_chars({"rag_max_chunks_chars": 99_000}) == 48_000


@pytest.mark.unit
def test_compose_memory_window_episodic_top_k_defaults() -> None:
    import inspect

    from api.ewa_platform.companion.memory.memory_phase import compose_memory_for_chat_turn
    from api.ewa_platform.companion.memory.retrieval import compose_memory_window

    assert inspect.signature(compose_memory_window).parameters["episodic_top_k"].default == 8
    assert inspect.signature(compose_memory_for_chat_turn).parameters["episodic_top_k"].default == 8
