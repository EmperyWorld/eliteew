# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# API schemas for Marketing Cabinet project RAG source listing, inclusion toggles, and semantic search hits.
# Keeps response contracts small while exposing indexing queue state for operator feedback.
# Invariants:
# - Semantic hits must carry enough source metadata for citation.
# - Inclusion PATCH may queue embedding work asynchronously.
# Related:
# - api.routers.marketing_cabinet.project_rag_sources
# - api.services.marketing_project_rag_service
# ---
"""API schemas: marketing cabinet project RAG sources list and mutations."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MarketingRagSourceItem(BaseModel):
    content_id: str
    name: str | None = None
    content_type: str | None = None
    mime_type: str | None = None
    source_kind: str = Field(description="'file' | 'imc_research_run'")
    marketing_rag_included: bool
    imc_research_run_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class MarketingRagSourceListResponse(BaseModel):
    items: list[MarketingRagSourceItem]


class PatchMarketingRagSourceBody(BaseModel):
    marketing_rag_included: bool


class PatchMarketingRagSourceResponse(BaseModel):
    content_id: str
    marketing_rag_included: bool
    indexing_status: str | None = Field(default=None, description="'queued' | 'deleted' | null")


class PostImcRunToProjectRagResponse(BaseModel):
    content_id: str
    created: bool


class MarketingRagSemanticHit(BaseModel):
    """Один фрагмент из Qdrant (векторный поиск по проекту)."""

    ordinal: int
    text: str
    content_id: str | None = None
    chunk_index: int | None = None
    source_label: str | None = None
    score: float | None = None


class MarketingRagSemanticSearchResponse(BaseModel):
    hits: list[MarketingRagSemanticHit]
