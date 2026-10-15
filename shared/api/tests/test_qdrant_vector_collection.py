# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for Qdrant collection vector size introspection used before ensure/create.
# Invariants:
# - Tests avoid live Qdrant; only pure helpers and simple namespace mocks.
# Related:
# - api.core.qdrant_vector_collection
# ---
from __future__ import annotations

from api.core.qdrant_vector_collection import _single_vector_size_from_collection_info


def test_single_vector_size_from_unnamed_config() -> None:
    class V:
        size = 4096

    class P:
        vectors = V()

    class C:
        params = P()

    class MockInfo:
        config = C()

    assert _single_vector_size_from_collection_info(MockInfo()) == 4096


def test_single_vector_size_from_named_dict() -> None:
    class V:
        size = 2560

    class P:
        vectors = {"default": V()}

    class C:
        params = P()

    class MockInfo:
        config = C()

    assert _single_vector_size_from_collection_info(MockInfo()) == 2560


def test_single_vector_size_missing_returns_none() -> None:
    class MockInfo:
        config = None

    assert _single_vector_size_from_collection_info(MockInfo()) is None
