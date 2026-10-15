# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Chunk multimodal schema defaults and payload helpers.
# ---

from __future__ import annotations

from api.models.chunk import Chunk


def test_chunk_defaults_to_text_kind() -> None:
    chunk = Chunk(text="hello", chunk_index=0)
    assert chunk.chunk_kind == "text"
    assert chunk.page is None
    assert chunk.bbox is None
    assert chunk.multimodal_payload_fields() == {"chunk_kind": "text"}


def test_chunk_figure_payload() -> None:
    chunk = Chunk(
        text="caption",
        chunk_index=4,
        chunk_kind="figure",
        page=12,
        bbox=(0.0, 0.0, 100.0, 50.0),
    )
    assert chunk.multimodal_payload_fields() == {
        "chunk_kind": "figure",
        "page": 12,
        "bbox": [0.0, 0.0, 100.0, 50.0],
    }
