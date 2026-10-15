# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for sparse term-weight builder and in-process hybrid scoring.
# ---

from __future__ import annotations

from api.services.sparse_vectors import (
    SPARSE_SCHEME_HASHED_LOG_TF_V1,
    build_sparse_term_weights,
    rank_texts_by_sparse_payload,
    sparse_dot_product,
    sparse_weights_payload,
    try_qdrant_sparse_vector,
)


def test_build_sparse_term_weights_deterministic_and_ranked() -> None:
    text = "Alpha beta alpha gamma beta beta"
    first = build_sparse_term_weights(text, max_terms=16)
    second = build_sparse_term_weights(text, max_terms=16)
    assert first == second
    indices, values = first
    assert indices
    assert len(indices) == len(values)
    assert indices == sorted(indices)
    assert all(v > 0 for v in values)


def test_build_sparse_term_weights_empty() -> None:
    assert build_sparse_term_weights("") == ([], [])
    assert build_sparse_term_weights("   ") == ([], [])


def test_sparse_weights_payload_and_qdrant_hook() -> None:
    payload = sparse_weights_payload("knowledge barrel search retrieval")
    assert payload is not None
    assert payload["sparse_scheme"] == SPARSE_SCHEME_HASHED_LOG_TF_V1
    sparse = try_qdrant_sparse_vector("knowledge barrel search retrieval")
    assert sparse is not None
    assert list(sparse.indices) == payload["sparse_indices"]
    assert list(sparse.values) == payload["sparse_values"]


def test_sparse_dot_product_and_rank_prefers_lexical_match() -> None:
    query = "quantum entanglement protocol"
    strong = sparse_weights_payload(
        "quantum entanglement protocol details for operators"
    )
    weak = sparse_weights_payload("marketing brand positioning narrative")
    assert strong is not None
    assert weak is not None
    q_idx, q_val = build_sparse_term_weights(query)
    strong_score = sparse_dot_product(
        q_idx,
        q_val,
        strong["sparse_indices"],
        strong["sparse_values"],
    )
    weak_score = sparse_dot_product(
        q_idx,
        q_val,
        weak["sparse_indices"],
        weak["sparse_values"],
    )
    assert strong_score > weak_score

    ranked = rank_texts_by_sparse_payload(
        query,
        [
            {
                "text": "marketing brand positioning narrative with enough words",
                **weak,
            },
            {
                "text": "quantum entanglement protocol details for operators here",
                **strong,
            },
        ],
        top_k=2,
    )
    assert ranked[0].startswith("quantum entanglement")
