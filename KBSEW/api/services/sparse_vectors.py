# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sparse lexical term-weight builder + in-process scoring for KBSEW hybrid retrieval.
# Invariants:
# - Pure functions; no I/O; deterministic for the same text + max_terms.
# - Does not replace dense embeddings; used when KBSEW_SPARSE_VECTORS_ENABLED is on.
# Related:
# - api/services/qdrant_store.py
# - api/services/search_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import hashlib
import math
import re
from typing import Any

_TOKEN_RE = re.compile(r"[0-9A-Za-zÀ-ÖØ-öø-ÿ_]{2,}")
_DEFAULT_VOCAB_MOD = 2**31 - 1
SPARSE_SCHEME_HASHED_LOG_TF_V1 = "hashed_log_tf_v1"


def tokenize_sparse_text(text: str) -> list[str]:
    return [m.group(0).casefold() for m in _TOKEN_RE.finditer(text or "")]


def _term_index(term: str, *, vocab_mod: int = _DEFAULT_VOCAB_MOD) -> int:
    digest = hashlib.blake2b(term.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") % vocab_mod


def build_sparse_term_weights(
    text: str,
    *,
    max_terms: int = 128,
    vocab_mod: int = _DEFAULT_VOCAB_MOD,
) -> tuple[list[int], list[float]]:
    """
    Build hashed sparse term weights (log-TF) for a chunk.

    Returns parallel (indices, values) suitable for Qdrant SparseVector or
    payload storage. Empty text → empty lists.
    """

    tokens = tokenize_sparse_text(text)
    if not tokens:
        return [], []
    tf: dict[int, int] = {}
    for term in tokens:
        idx = _term_index(term, vocab_mod=vocab_mod)
        tf[idx] = tf.get(idx, 0) + 1
    ranked = sorted(
        ((idx, 1.0 + math.log(count)) for idx, count in tf.items()),
        key=lambda item: (-item[1], item[0]),
    )[: max(1, int(max_terms))]
    ranked.sort(key=lambda item: item[0])
    indices = [idx for idx, _ in ranked]
    values = [float(weight) for _, weight in ranked]
    return indices, values


def sparse_weights_payload(
    text: str,
    *,
    max_terms: int = 128,
) -> dict[str, Any] | None:
    indices, values = build_sparse_term_weights(text, max_terms=max_terms)
    if not indices:
        return None
    return {
        "sparse_indices": indices,
        "sparse_values": values,
        "sparse_scheme": SPARSE_SCHEME_HASHED_LOG_TF_V1,
    }


def sparse_dot_product(
    query_indices: list[int],
    query_values: list[float],
    doc_indices: list[int],
    doc_values: list[float],
) -> float:
    """Dot product over intersecting hashed term indices (log-TF weights)."""

    if not query_indices or not doc_indices:
        return 0.0
    if len(query_indices) != len(query_values) or len(doc_indices) != len(doc_values):
        return 0.0
    query_map = dict(zip(query_indices, query_values, strict=True))
    score = 0.0
    for idx, value in zip(doc_indices, doc_values, strict=True):
        query_value = query_map.get(int(idx))
        if query_value is not None:
            score += float(query_value) * float(value)
    return score


def rank_texts_by_sparse_payload(
    query: str,
    candidates: list[dict[str, Any]],
    *,
    max_terms: int = 128,
    top_k: int,
) -> list[str]:
    """
    Rank candidate payloads by sparse dot product against the query.

    Each candidate needs ``text``, ``sparse_indices``, ``sparse_values``.
    Zero-score / invalid payloads are dropped. Duplicate texts keep the
    highest score.
    """

    query_indices, query_values = build_sparse_term_weights(query, max_terms=max_terms)
    if not query_indices or top_k <= 0:
        return []

    best_score: dict[str, float] = {}
    for candidate in candidates:
        text = candidate.get("text")
        if not isinstance(text, str):
            continue
        normalized = text.strip()
        if not normalized:
            continue
        raw_indices = candidate.get("sparse_indices")
        raw_values = candidate.get("sparse_values")
        if not isinstance(raw_indices, list) or not isinstance(raw_values, list):
            continue
        if not raw_indices or len(raw_indices) != len(raw_values):
            continue
        try:
            doc_indices = [int(idx) for idx in raw_indices]
            doc_values = [float(value) for value in raw_values]
        except (TypeError, ValueError):
            continue
        score = sparse_dot_product(query_indices, query_values, doc_indices, doc_values)
        if score <= 0.0:
            continue
        previous = best_score.get(normalized)
        if previous is None or score > previous:
            best_score[normalized] = score

    ordered = sorted(best_score.keys(), key=lambda text: (-best_score[text], text))
    return ordered[:top_k]


def try_qdrant_sparse_vector(
    text: str,
    *,
    max_terms: int = 128,
) -> Any | None:
    """
    Build qdrant_client.models.SparseVector when the client exposes it.

    Used by native named-sparse upsert/query (KBSEW_SPARSE_NATIVE_QDRANT).
    Legacy hybrid path stores the same weights on point payload and scores
    in-process when native schema is not active.
    """

    indices, values = build_sparse_term_weights(text, max_terms=max_terms)
    if not indices:
        return None
    try:
        from qdrant_client.models import SparseVector
    except ImportError:  # pragma: no cover - client always present in runtime
        return None
    return SparseVector(indices=indices, values=values)
