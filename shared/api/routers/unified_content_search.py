#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Unified Content System - Search API Router
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Unified Content System - Search API Router
Week 4: Search & Indexing

Endpoints:
- GET /api/content/search - Basic search
- POST /api/content/search/advanced - Advanced search with filters
- GET /api/content/tags/suggest - Tag autocomplete

Created: 2025-10-05
"""

import logging
import time
from datetime import datetime
from typing import Any, NoReturn
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator  # type: ignore[import-untyped]

from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.schemas.unified_content import ContentType, Visibility
from api.services.unified_content.content_search_service import (
    ContentSearchService,
)
from api.services.unified_content.semantic_search_service import SemanticSearchService

# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class SearchResultItem(BaseModel):
    """Single search result item"""

    id: UUID
    name: str
    description: str | None = None
    content_type: str
    tags: list[str] = []
    created_at: datetime
    score: float = Field(..., description="Elasticsearch relevance score")
    highlight: dict | None = Field(None, description="Highlighted text snippets")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Project Proposal.docx",
                "description": "Q4 2025 Marketing Strategy",
                "content_type": "document",
                "tags": ["marketing", "strategy", "q4"],
                "created_at": "2025-10-05T10:30:00Z",
                "score": 12.45,
                "highlight": {
                    "name": ["Project <em>Proposal</em>.docx"],
                    "description": ["Q4 2025 <em>Marketing</em> Strategy"],
                },
            }
        }
    )


class SearchResponse(BaseModel):
    """Search results response"""

    total: int = Field(..., description="Total number of matching documents")
    results: list[SearchResultItem]
    took_ms: int = Field(..., description="Query execution time in milliseconds")
    search_mode: str = Field("keyword", description="keyword (ES) or hybrid (ES + Qdrant RRF)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total": 42,
                "results": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "Project Proposal.docx",
                        "description": "Q4 2025 Marketing Strategy",
                        "content_type": "document",
                        "tags": ["marketing", "strategy"],
                        "created_at": "2025-10-05T10:30:00Z",
                        "score": 12.45,
                        "highlight": None,
                    }
                ],
                "took_ms": 45,
            }
        }
    )


class AdvancedSearchRequest(BaseModel):
    """Advanced search request with filters"""

    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    content_types: list[str] | None = Field(
        None,
        description="Filter by content types (document, image, video, audio, ai_result, presentation, spreadsheet, other)",
    )
    tags: list[str] | None = Field(None, description="Filter by tags (AND logic)")
    date_from: datetime | None = Field(None, description="Filter by creation date from")
    date_to: datetime | None = Field(None, description="Filter by creation date to")
    file_size_min: int | None = Field(None, ge=0, description="Minimum file size in bytes")
    file_size_max: int | None = Field(None, ge=0, description="Maximum file size in bytes")
    visibility: str | None = Field(
        None, description="Filter by visibility (private, public, shared, friends, from_friends)"
    )
    limit: int = Field(20, ge=1, le=100, description="Max results to return")
    offset: int = Field(0, ge=0, description="Offset for pagination")

    @field_validator("content_types")
    @classmethod
    def validate_content_types(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            valid_types = {item.value for item in ContentType}
            invalid = set(v) - valid_types
            if invalid:
                msg = f"Invalid content types: {invalid}. Valid: {valid_types}"
                raise ValueError(msg)
        return v

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str | None) -> str | None:
        valid_visibilities = {
            Visibility.PRIVATE.value,
            Visibility.PUBLIC.value,
            Visibility.SHARED.value,
            Visibility.FRIENDS.value,
            Visibility.FROM_FRIENDS.value,
        }
        if v is not None and v not in valid_visibilities:
            msg = "Visibility must be one of: private, public, shared, friends, from_friends"
            raise ValueError(msg)
        return v

    @field_validator("file_size_max")
    @classmethod
    def validate_file_size_range(cls, v: int | None, info: ValidationInfo) -> int | None:
        if v is not None:
            file_size_min = info.data.get("file_size_min")
            if file_size_min is not None and v < file_size_min:
                msg = "file_size_max must be >= file_size_min"
                raise ValueError(msg)
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "query": "marketing strategy",
                "content_types": ["document", "image"],
                "tags": ["marketing", "q4"],
                "date_from": "2025-01-01T00:00:00Z",
                "date_to": "2025-12-31T23:59:59Z",
                "file_size_min": 1024,
                "file_size_max": 10485760,
                "visibility": "private",
                "limit": 20,
                "offset": 0,
            }
        }
    )


class TagSuggestResponse(BaseModel):
    """Tag autocomplete suggestions"""

    tags: list[str] = Field(..., description="Suggested tags sorted by usage count")

    model_config = ConfigDict(
        json_schema_extra={"example": {"tags": ["marketing", "marketing-strategy", "market-research"]}}
    )


# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================


async def get_search_service() -> ContentSearchService:
    """
    Dependency injection for ContentSearchService.
    Gets ES client and DB pool from unified_content router.
    """
    from api.routers.unified_content import get_db_pool, get_es_client

    db_pool = await get_db_pool()
    es_client = get_es_client()

    return ContentSearchService(es_client, db_pool)


async def get_semantic_search_service() -> SemanticSearchService | None:
    """Build hybrid search service from runtime database manager."""
    from api.core.database_manager import get_database_manager
    from api.services.ai_sdk.embedding_service import embedding_service

    manager = await get_database_manager()
    es_client = getattr(manager, "elasticsearch_client", None)
    qdrant_client = getattr(manager, "qdrant_client", None)
    db_pool = getattr(manager, "asyncpg_pool", None)
    if db_pool is None:
        try:
            db_pool = await manager.get_asyncpg_pool()
        except Exception:
            db_pool = None
    if es_client is None and qdrant_client is None:
        return None
    return SemanticSearchService(
        elasticsearch_service=es_client,
        qdrant_client=qdrant_client,
        embedding_service=embedding_service,
        db_pool=db_pool,
    )


def _coerce_created_at(value: Any) -> datetime:  # noqa: ANN401
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.fromtimestamp(0)


# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/content", tags=["Unified Content - Search"])
logger = logging.getLogger(__name__)


def _raise_internal_search_error(operation: str, error: Exception) -> NoReturn:
    error_id = uuid4().hex[:12]
    logger.exception("unified_content_search: %s failed (error_id=%s)", operation, error_id)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"{operation} failed. Reference: {error_id}",
        headers={"X-Error-ID": error_id},
    ) from None


@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Basic Content Search",
    description="""
    Search for content using Elasticsearch full-text search.

    **Features:**
    - Full-text search across name, description, and extracted text
    - Russian and English text analysis
    - Optional filters: content_type, tags
    - Pagination support
    - Relevance scoring

    **Permissions:**
    - Returns only content user has access to (owned + public + shared)

    **Example:**
    ```
    GET /api/content/search?q=marketing&content_type=document&tags=q4,strategy&limit=10
    ```
    """,
    responses={
        200: {
            "description": "Search results",
            "content": {
                "application/json": {
                    "example": {
                        "total": 15,
                        "results": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "Marketing Strategy Q4.docx",
                                "description": "Quarterly marketing plan",
                                "content_type": "document",
                                "tags": ["marketing", "q4", "strategy"],
                                "created_at": "2025-10-05T10:30:00Z",
                                "score": 15.23,
                                "highlight": {"name": ["<em>Marketing</em> Strategy Q4.docx"]},
                            }
                        ],
                        "took_ms": 32,
                    }
                }
            },
        },
        400: {"description": "Invalid query parameters"},
        401: {"description": "Authentication required"},
        500: {"description": "Elasticsearch error"},
    },
)
async def search_content(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    content_type: str | None = Query(None, description="Filter by content type"),
    tags: str | None = Query(None, description="Comma-separated tags (AND logic)"),
    mode: str = Query("keyword", pattern="^(keyword|hybrid)$", description="keyword or hybrid (ES+Qdrant)"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user_id: str = Depends(get_content_user_id),
    search_service: ContentSearchService = Depends(get_search_service),
) -> SearchResponse:
    """
    Basic search endpoint with simple filters.
    """
    try:
        # Parse filters
        filters: dict[str, Any] = {}

        if content_type:
            filters["content_type"] = content_type

        if tags:
            # Convert comma-separated string to list
            filters["tags"] = [t.strip() for t in tags.split(",") if t.strip()]

        if mode == "hybrid":
            semantic_svc = await get_semantic_search_service()
            if semantic_svc is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Hybrid search unavailable (vector backend not configured)",
                )
            t0 = time.perf_counter()
            hybrid_results = await semantic_svc.search(
                query=q,
                filters=filters or None,
                limit=limit + offset,
                user_id=UUID(user_id),
            )
            took_ms = int((time.perf_counter() - t0) * 1000)
            page = hybrid_results[offset : offset + limit]
            return SearchResponse(
                total=len(hybrid_results),
                search_mode="hybrid",
                results=[
                    SearchResultItem(
                        id=r.content_id,
                        name=r.title,
                        description=r.description,
                        content_type=str(r.metadata.get("content_type") or "other"),
                        tags=list(r.metadata.get("tags") or []),
                        created_at=_coerce_created_at(r.metadata.get("created_at")),
                        score=float(r.score),
                        highlight=None,
                    )
                    for r in page
                ],
                took_ms=took_ms,
            )

        # Execute keyword search
        search_result = await search_service.search(
            query=q, user_id=user_id, filters=filters, limit=limit, offset=offset
        )

        # Convert dict to SearchResponse
        return SearchResponse(
            total=search_result["total"],
            search_mode="keyword",
            results=[
                SearchResultItem(
                    id=UUID(r["id"]),
                    name=r["name"],
                    description=r.get("description"),
                    content_type=r["content_type"],
                    tags=r.get("tags", []),
                    created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
                    score=r.get("score", 0.0),
                    highlight=r.get("highlight"),
                )
                for r in search_result["results"]
            ],
            took_ms=search_result["took_ms"],
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        _raise_internal_search_error("Search", e)


@router.post(
    "/search/advanced",
    response_model=SearchResponse,
    summary="Advanced Content Search",
    description="""
    Advanced search with comprehensive filters.

    **Filters:**
    - Content types (document, image, video, audio, ai_result, presentation, spreadsheet, other)
    - Tags (AND logic - all tags must match)
    - Date range (created_at)
    - File size range
    - Visibility (private, public, shared, friends, from_friends)

    **Features:**
    - Full-text search with highlighting
    - Multi-field analysis (Russian + English)
    - Faceted search support
    - Relevance ranking

    **Permissions:**
    - Returns only content user has access to
    - Visibility filter applies ON TOP of user permissions

    **Example:**
    ```json
    {
      "query": "quarterly report",
      "content_types": ["document"],
      "tags": ["finance", "q3"],
      "date_from": "2025-07-01T00:00:00Z",
      "date_to": "2025-09-30T23:59:59Z",
      "file_size_max": 10485760,
      "visibility": "private",
      "limit": 20,
      "offset": 0
    }
    ```
    """,
    responses={
        200: {"description": "Search results with applied filters"},
        400: {"description": "Invalid request body or filters"},
        401: {"description": "Authentication required"},
        500: {"description": "Elasticsearch error"},
    },
)
async def advanced_search(
    request: AdvancedSearchRequest,
    user_id: str = Depends(get_content_user_id),
    search_service: ContentSearchService = Depends(get_search_service),
) -> SearchResponse:
    """
    Advanced search with all available filters.
    """
    try:
        # Build search_params dict
        search_params: dict[str, Any] = {
            "query": request.query,
            "limit": request.limit,
            "offset": request.offset,
        }

        if request.content_types:
            search_params["content_types"] = request.content_types
        if request.tags:
            search_params["must_have_tags"] = request.tags
        if request.date_from or request.date_to:
            search_params["date_range"] = {
                "from": request.date_from.isoformat() if request.date_from else None,
                "to": request.date_to.isoformat() if request.date_to else None,
            }
        if request.file_size_min is not None or request.file_size_max is not None:
            search_params["file_size_range"] = {
                "min": request.file_size_min,
                "max": request.file_size_max,
            }
        if request.visibility:
            search_params["visibility"] = request.visibility

        # Execute advanced search
        search_result = await search_service.advanced_search(
            search_params=search_params,
            user_id=user_id,
        )

        # Convert dict to SearchResponse
        return SearchResponse(
            total=search_result["total"],
            search_mode="keyword",
            results=[
                SearchResultItem(
                    id=UUID(r["id"]),
                    name=r["name"],
                    description=r.get("description"),
                    content_type=r["content_type"],
                    tags=r.get("tags", []),
                    created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
                    score=r.get("score", 0.0),
                    highlight=r.get("highlight"),
                )
                for r in search_result["results"]
            ],
            took_ms=search_result["took_ms"],
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        _raise_internal_search_error("Advanced search", e)


@router.get(
    "/tags/suggest",
    response_model=TagSuggestResponse,
    summary="Tag Autocomplete",
    description="""
    Get tag suggestions for autocomplete.

    **Features:**
    - Prefix-based matching
    - Sorted by usage count (descending)
    - Case-insensitive search
    - Fast response (<10ms)

    **Use Cases:**
    - Tag input autocomplete
    - Tag cloud generation
    - Popular tags discovery

    **Example:**
    ```
    GET /api/content/tags/suggest?prefix=mark&limit=10

    Response:
    {
      "tags": ["marketing", "marketing-strategy", "market-research", "marketplace"]
    }
    ```
    """,
    responses={
        200: {
            "description": "Tag suggestions sorted by popularity",
            "content": {
                "application/json": {"example": {"tags": ["marketing", "marketing-strategy", "market-analysis"]}}
            },
        },
        400: {"description": "Invalid prefix (too short or empty)"},
        401: {"description": "Authentication required"},
        500: {"description": "Database error"},
    },
)
async def suggest_tags(
    prefix: str = Query(..., min_length=1, max_length=500, description="Tag prefix to search"),
    limit: int = Query(10, ge=1, le=50, description="Max suggestions to return"),
    user_id: str = Depends(get_content_user_id),
    search_service: ContentSearchService = Depends(get_search_service),
) -> TagSuggestResponse:
    """
    Autocomplete endpoint for tags.
    """
    try:
        # Tags are capped at 50 chars in CM; long search strings (e.g. filenames) must not 422.
        tag_prefix = prefix[:50]
        tags = await search_service.suggest_tags(prefix=tag_prefix, user_id=user_id, limit=limit)

        return TagSuggestResponse(tags=tags)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        _raise_internal_search_error("Tag suggestion", e)
