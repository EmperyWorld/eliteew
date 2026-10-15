#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression checks for RAG/LLM/vector resilience remediation.
# Invariants:
# - AI SDK embeddings use stable cache keys, provider-native batch calls and finite-vector validation.
# - Companion episodic rerank spends only remaining retrieval budget.
# - Qdrant collection dim mismatch never auto-deletes production collections.
# Related:
# - api/services/ai_sdk/embedding_service.py
# - api/services/rerank_client.py
# - api/core/qdrant_vector_collection.py
# ---
"""RAG resilience regression checks."""

from __future__ import annotations

from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]


def _read(rel_path: str) -> str:
    return (API_ROOT / rel_path).read_text(encoding="utf-8")


@pytest.mark.unit
def test_embedding_service_uses_stable_batch_vectors() -> None:
    source = _read("services/ai_sdk/embedding_service.py")
    assert "hashlib.sha256" in source
    assert "hash(input_text)" not in source
    assert "llama_service.embed_many" in source
    assert "math.isfinite" in source


@pytest.mark.unit
def test_companion_rerank_uses_remaining_budget_and_circuit_breaker_exists() -> None:
    retrieval = _read("ewa_platform/companion/memory/retrieval.py")
    rerank = _read("services/rerank_client.py")
    assert "remaining_sec = max(0.05, (budget_ms - vec_ms) / 1000.0)" in retrieval
    assert "_companion_episodic_rerank_timeout_sec()" in retrieval
    assert "timeout_sec=min(remaining_sec, _companion_episodic_rerank_timeout_sec())" in retrieval
    assert "_rerank_circuit_is_open" in rerank
    assert 'outcome="circuit_open"' in rerank


@pytest.mark.unit
def test_qdrant_dim_mismatch_requires_explicit_migration() -> None:
    source = _read("core/qdrant_vector_collection.py")
    assert "delete_collection" not in source
    assert "explicit migration required" in source
