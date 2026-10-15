# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Domain models for ingestion pipeline (Chunk) and driver contracts.
# Invariants:
# - chunk_kind defaults to "text"; optional figure chunks may carry bbox/page.
# - Existing PDF text ingest remains chunk_kind="text" with page/bbox unset.
# Related:
# - api/services/qdrant_store.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ChunkKind = Literal["text", "figure"]


@dataclass(slots=True)
class Chunk:
    text: str
    chunk_index: int
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] | None = None
    chunk_kind: ChunkKind = "text"
    page: int | None = None
    bbox: tuple[float, float, float, float] | None = None

    def multimodal_payload_fields(self) -> dict[str, Any]:
        """Optional Qdrant payload fields for multimodal retrieval (no vision pipeline)."""

        payload: dict[str, Any] = {"chunk_kind": self.chunk_kind or "text"}
        if self.page is not None:
            payload["page"] = int(self.page)
        if self.bbox is not None:
            x0, y0, x1, y1 = self.bbox
            payload["bbox"] = [float(x0), float(y0), float(x1), float(y1)]
        return payload
