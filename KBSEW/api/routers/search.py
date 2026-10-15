# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FastAPI route for KBSEW barrel vector search (RAG retrieval).
# Invariants:
# - Read-only; does not invoke ingestion pipeline.
# Related:
# - api/services/search_service.py
# ---

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status

from api.core.auth import require_kbsew_api_access
from api.schemas.search import SearchRequest, SearchResponse
from api.services.search_service import (
    BarrelDisabledError,
    BarrelNotFoundError,
    EmbeddingFailedError,
    IndexStaleError,
    search_barrel,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kbsew", tags=["KBSEW"])


@router.post("/search", response_model=SearchResponse)
async def search_kbsew_barrel(
    body: SearchRequest,
    _auth=Depends(require_kbsew_api_access),
    trace_id: str | None = Header(default=None, alias="X-KBSEW-Trace-Id"),
) -> SearchResponse:
    logger.info(
        "[STEP] kbsew_search_request trace_id=%s barrel_id=%s query_len=%s",
        trace_id,
        body.barrel_id,
        len((body.query or "").strip()),
    )
    try:
        chunks = await search_barrel(
            barrel_id=str(body.barrel_id),
            query=body.query,
            limit=body.limit,
            retrieval_mode=body.retrieval_mode,
        )
    except BarrelNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BarrelDisabledError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except IndexStaleError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": exc.code,
                "message": str(exc),
                "stale_assets": exc.stale_assets,
                "required_pipeline": exc.required_pipeline,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except EmbeddingFailedError as exc:
        logger.warning(
            "[STEP] kbsew_search_embed_failed barrel_id=%s reason=%s",
            body.barrel_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding service unavailable",
        ) from exc
    except Exception as exc:
        logger.exception("[STEP] kbsew_search_failed barrel_id=%s", body.barrel_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Vector search failed",
        ) from exc

    return SearchResponse(barrel_id=body.barrel_id, chunks=chunks)
