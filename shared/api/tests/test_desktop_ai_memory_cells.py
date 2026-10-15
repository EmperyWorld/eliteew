# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Memory Cells settings clamps and text materialization.
# Invariants:
# - Soft quota 1..5; feature flag honest parse.
# Related:
# - api.services.desktop_chat.memory_cells_settings
# - api.services.desktop_chat.memory_cells_rag
# ---

from __future__ import annotations

from api.services.desktop_chat.memory_cells_rag import materialize_text_chunks
from api.services.desktop_chat.memory_cells_settings import (
    memory_cells_feature_enabled,
    memory_cells_max_per_user,
    memory_cells_retrieval_top_k,
    normalize_memory_cells_admin_defaults,
)


def test_memory_cells_quota_clamp() -> None:
    assert memory_cells_max_per_user({}) == 3
    assert memory_cells_max_per_user({"memory_cells_max_per_user": 99}) == 5
    assert memory_cells_max_per_user({"memory_cells_max_per_user": 0}) == 1


def test_memory_cells_feature_flag() -> None:
    assert memory_cells_feature_enabled({}) is True
    assert memory_cells_feature_enabled({"memory_cells_enabled": False}) is False
    assert memory_cells_feature_enabled({"memory_cells_enabled": "off"}) is False
    assert memory_cells_feature_enabled({"memory_cells_enabled": "1"}) is True


def test_normalize_admin_defaults_subset() -> None:
    out = normalize_memory_cells_admin_defaults(
        {"memory_cells_max_per_user": 2, "memory_cells_retrieval_top_k": 40, "unrelated": 1}
    )
    assert out == {"memory_cells_max_per_user": 2, "memory_cells_retrieval_top_k": 32}
    assert "unrelated" not in out
    assert memory_cells_retrieval_top_k(out) == 32


def test_materialize_text_chunks_respects_cap() -> None:
    docs = [("user", "hello world. " * 200), ("assistant", "reply " * 200)]
    chunks = materialize_text_chunks(docs, max_chunks=3)
    assert len(chunks) == 3
    assert all(label and text for label, text in chunks)
