# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared sentence-aware text chunking for PDF/markdown ingestion drivers.
# Invariants:
# - Respects KBSEW_CHUNK_SIZE / KBSEW_CHUNK_OVERLAP budgets (caller-supplied).
# - Prefers `.!?` / word boundaries within the size window; no giant refactor.
# Related:
# - api/services/text_quality.py
# - api/drivers/pdf.py
# - api/drivers/markdown.py
# ---

from __future__ import annotations

import re

_SENTENCE_END = re.compile(r"[.!?](?:\s+|$)")
_WORD_CHARS = re.compile(r"[\w\u0400-\u04FF]", re.UNICODE)


def chunk_text(text: str, *, size: int, overlap: int) -> list[str]:
    """Split normalized prose into overlapping chunks with sentence-aware cuts.

    Callers should pass text already cleaned via ``text_quality`` (soft hyphens,
    PDF noise). Whitespace is collapsed here.
    """
    if size <= 0:
        return []
    normalized = " ".join(text.split()).strip()
    if not normalized:
        return []

    safe_overlap = max(0, min(overlap, size - 1)) if size > 1 else 0
    chunks: list[str] = []
    start = 0
    n = len(normalized)

    while start < n:
        hard_end = min(n, start + size)
        end = _prefer_boundary_end(normalized, start=start, hard_end=hard_end)
        piece = normalized[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        next_start = max(0, end - safe_overlap)
        next_start = _prefer_boundary_start(
            normalized, candidate=next_start, hard_end=end
        )
        if next_start <= start:
            next_start = end
        start = next_start

    return chunks


def _prefer_boundary_end(text: str, *, start: int, hard_end: int) -> int:
    """Prefer last sentence end (or word break) in the latter half of the window."""
    if hard_end >= len(text):
        return hard_end
    window = text[start:hard_end]
    if not window:
        return hard_end
    search_from = max(0, len(window) // 2)
    best_sentence = -1
    for match in _SENTENCE_END.finditer(window):
        if match.start() < search_from:
            continue
        # End after punctuation; keep trailing space out of the chunk when present.
        cut = match.start() + 1
        best_sentence = cut
    if best_sentence > 0:
        return start + best_sentence

    space = window.rfind(" ", search_from)
    if space > 0:
        return start + space
    return hard_end


def _prefer_boundary_start(text: str, *, candidate: int, hard_end: int) -> int:
    """Avoid mid-sentence / mid-word starts when a nearby boundary exists."""
    if candidate <= 0 or candidate >= hard_end:
        return candidate

    snap_zone = text[candidate:hard_end]
    sentence = _SENTENCE_END.search(snap_zone)
    if sentence is not None:
        # Start after `.!?` and following whitespace.
        after = candidate + sentence.end()
        if after < hard_end:
            return after

    if candidate > 0 and _WORD_CHARS.match(text[candidate - 1] or ""):
        space = text.find(" ", candidate, hard_end)
        if space != -1 and space + 1 < hard_end:
            return space + 1
    return candidate
