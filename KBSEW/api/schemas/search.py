# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Request/response schemas for barrel vector search (RAG retrieval).
# Invariants:
# - retrieval_mode defaults to dense so existing clients stay unchanged.
# Related:
# - api/services/search_service.py
# ---

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

RetrievalMode = Literal["dense", "hybrid"]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    barrel_id: UUID
    limit: int | None = Field(default=None, ge=1, le=20)
    retrieval_mode: RetrievalMode | None = Field(
        default=None,
        description="dense (default) or hybrid (dense + sparse/RRF prep; sparse stub falls back to dense).",
    )


class SearchResponse(BaseModel):
    barrel_id: UUID
    chunks: list[str] = Field(default_factory=list)
