# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Project RAG sources: list unified_content rows eligible for marketing_project_rag,
# toggle inclusion, promote IMC runs, and inspect semantic search hits.
# Invariants:
# - Enabling a source returns quickly; embedding indexing runs as a background task.
# - Semantic search is read-only and scoped by project access.
# Related:
# - api.services.marketing_project_rag_sources_service
# - api.services.marketing_project_rag_service
# ---
"""Project RAG sources: list unified_content rows eligible for marketing_project_rag, toggle inclusion, promote IMC runs."""

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.common import get_marketing_db_pool, get_marketing_user_id
from api.schemas.marketing_project_rag_sources import (
    MarketingRagSemanticHit,
    MarketingRagSemanticSearchResponse,
    MarketingRagSourceListResponse,
    PatchMarketingRagSourceBody,
    PatchMarketingRagSourceResponse,
    PostImcRunToProjectRagResponse,
)
from api.services.marketing_project_rag_service import search_marketing_project_rag_chunks
from api.services.marketing_project_rag_sources_service import (
    list_project_rag_sources,
    patch_marketing_rag_source_inclusion,
    reindex_marketing_rag_source_if_included,
    upsert_imc_run_as_project_rag_content,
)

router = APIRouter(prefix="/projects", tags=["Marketing Cabinet - Project RAG Sources"])


@router.get("/{project_id}/rag-sources", response_model=MarketingRagSourceListResponse)
async def get_project_rag_sources(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingRagSourceListResponse:
    items = await list_project_rag_sources(db_pool, project_id=project_id, user_id=user_id)
    return MarketingRagSourceListResponse(items=items)


@router.get(
    "/{project_id}/rag-sources/semantic-search",
    response_model=MarketingRagSemanticSearchResponse,
)
async def semantic_search_project_rag(
    project_id: UUID,
    q: str = Query(..., min_length=2, max_length=2000, description="Текст запроса для эмбеддинга"),
    limit: int = Query(16, ge=1, le=32),
    min_score: float | None = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Мин. cosine similarity (если задан — отсекаются слабые совпадения)",
    ),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingRagSemanticSearchResponse:
    """Семантический поиск по чанкам коллекции marketing_project_rag (только чтение, доступ к проекту)."""
    chunks = await search_marketing_project_rag_chunks(
        db_pool,
        query=q.strip(),
        project_id=project_id,
        user_id=user_id,
        limit=limit,
        min_score=min_score,
    )
    hits = [
        MarketingRagSemanticHit(
            ordinal=c.ordinal,
            text=c.text,
            content_id=c.content_id,
            chunk_index=c.chunk_index,
            source_label=c.source_label,
            score=c.score,
        )
        for c in chunks
    ]
    return MarketingRagSemanticSearchResponse(hits=hits)


@router.patch(
    "/{project_id}/rag-sources/content/{content_id}",
    response_model=PatchMarketingRagSourceResponse,
)
async def patch_project_rag_source(
    project_id: UUID,
    content_id: UUID,
    body: PatchMarketingRagSourceBody,
    background_tasks: BackgroundTasks,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> PatchMarketingRagSourceResponse:
    ok = await patch_marketing_rag_source_inclusion(
        db_pool,
        project_id=project_id,
        content_id=content_id,
        user_id=user_id,
        marketing_rag_included=body.marketing_rag_included,
        index_on_enable=False,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контент не найден в проекте",
        )
    indexing_status = "deleted"
    if body.marketing_rag_included:
        background_tasks.add_task(
            reindex_marketing_rag_source_if_included,
            db_pool,
            content_id=content_id,
        )
        indexing_status = "queued"
    return PatchMarketingRagSourceResponse(
        content_id=str(content_id),
        marketing_rag_included=body.marketing_rag_included,
        indexing_status=indexing_status,
    )


@router.post(
    "/{project_id}/rag-sources/from-imc-run/{imc_research_run_id}",
    response_model=PostImcRunToProjectRagResponse,
)
async def post_imc_run_to_project_rag(
    project_id: UUID,
    imc_research_run_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> PostImcRunToProjectRagResponse:
    out = await upsert_imc_run_as_project_rag_content(
        db_pool,
        project_id=project_id,
        imc_research_run_id=imc_research_run_id,
        user_id=user_id,
    )
    if out is None:
        run_row = None
        async with db_pool.acquire() as conn:
            run_row = await conn.fetchrow(
                "SELECT id FROM imc_research_runs WHERE id = $1 AND project_id = $2",
                imc_research_run_id,
                project_id,
            )
        if run_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Запуск ИМК не найден в этом проекте",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недостаточно текста результата для индексации в RAG",
        )
    return out
