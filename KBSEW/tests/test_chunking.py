# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for sentence-aware KBSEW text chunking.
# ---

from __future__ import annotations

from api.services.chunking import chunk_text


def test_chunk_text_respects_size_and_overlap() -> None:
    text = "word " * 200
    chunks = chunk_text(text, size=100, overlap=20)
    assert len(chunks) >= 2
    assert all(len(c) <= 100 for c in chunks)


def test_chunk_text_prefers_sentence_boundary() -> None:
    # Hard window would cut mid-second sentence; prefer end of first sentence.
    left = "Первое предложение про бренд и обещание качества для покупателя на рынке. "
    right = (
        "Второе предложение продолжает тему позиционирования продукта среди конкурентов "
        "и целевой аудитории бренда на длинном отрезке текста."
    )
    text = left + right
    size = len(left) + 40
    chunks = chunk_text(text, size=size, overlap=10)
    assert chunks
    assert chunks[0].endswith(".")
    assert not chunks[0].endswith("позиционирован")


def test_chunk_text_overlap_snaps_to_word_boundary() -> None:
    words = [f"token{i:02d}" for i in range(40)]
    text = " ".join(words)
    chunks = chunk_text(text, size=50, overlap=20)
    assert len(chunks) >= 2
    for piece in chunks:
        first = piece.split()[0]
        assert first.startswith("token"), piece
