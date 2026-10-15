# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/segments.py`: эндпоинты и контракт — в коде и
#   OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_segment,
)
from api.schemas.marketing_cabinet import (
    DeleteMarketingSegmentResponse,
    MarketingSegmentListResponse,
    MarketingSegmentOut,
)

router = APIRouter(prefix="/segments", tags=["Marketing Cabinet - Segments"])

_SEGMENT_SCALAR_FIELDS: frozenset[str] = frozenset(
    {"name", "description", "segment_type", "status", "priority", "estimated_reach", "fit_score"}
)


class SegmentCreateRequest(BaseModel):
    project_id: UUID
    name: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    segment_type: str = Field(default="icp")
    status: str = Field(default="draft")
    priority: str = Field(default="medium")
    estimated_reach: int = Field(default=0, ge=0)
    fit_score: float | None = Field(default=None, ge=0, le=100)
    linked_job_story_ids: list[UUID] = Field(default_factory=list)
    linked_content_ids: list[UUID] = Field(default_factory=list)
    linked_competitor_ids: list[UUID] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    gains: list[str] = Field(default_factory=list)


class SegmentUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    segment_type: str | None = None
    status: str | None = None
    priority: str | None = None
    estimated_reach: int | None = Field(default=None, ge=0)
    fit_score: float | None = Field(default=None, ge=0, le=100)
    linked_job_story_ids: list[UUID] | None = None
    linked_content_ids: list[UUID] | None = None
    linked_competitor_ids: list[UUID] | None = None
    pain_points: list[str] | None = None
    gains: list[str] | None = None


async def _fetch_segment(db_pool: asyncpg.Pool, segment_id: UUID) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM marketing_segments
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            segment_id,
        )


@router.get("", response_model=MarketingSegmentListResponse)
async def list_segments(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingSegmentListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    query = """
        SELECT *
        FROM marketing_segments
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2 OFFSET $3
    """
    params: list[Any] = [project_id, effective_limit, effective_offset]

    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            "SELECT COUNT(*) FROM marketing_segments WHERE project_id = $1 AND deleted_at IS NULL",
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(query, *params)

    items = [normalize_segment(row) for row in rows]
    return MarketingSegmentListResponse.model_validate({"items": items, "total": total})


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MarketingSegmentOut)
async def create_segment(
    payload: SegmentCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingSegmentOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="segments"
    )

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_segments (
                project_id,
                company_id,
                created_by,
                name,
                description,
                segment_type,
                status,
                priority,
                estimated_reach,
                fit_score,
                linked_job_story_ids,
                linked_content_ids,
                linked_competitor_ids,
                pain_points,
                gains,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11::uuid[],
                $12::uuid[],
                $13::uuid[],
                $14::text[],
                $15::text[],
                $16::jsonb,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            payload.project_id,
            project["company_id"],
            user_id,
            payload.name,
            payload.description,
            payload.segment_type,
            payload.status,
            payload.priority,
            payload.estimated_reach,
            payload.fit_score,
            payload.linked_job_story_ids,
            payload.linked_content_ids,
            payload.linked_competitor_ids,
            payload.pain_points,
            payload.gains,
            json.dumps({}),
        )

    return MarketingSegmentOut.model_validate(normalize_segment(row))


@router.patch("/{segment_id}", response_model=MarketingSegmentOut)
async def update_segment(
    segment_id: UUID,
    payload: SegmentUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingSegmentOut:
    existing = await _fetch_segment(db_pool, segment_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сегмент не найден")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="segments"
    )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return MarketingSegmentOut.model_validate(normalize_segment(existing))

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1

    for field in _SEGMENT_SCALAR_FIELDS:
        if field in update_data:
            set_parts.append(f"{field} = ${index}")
            params.append(update_data[field])
            index += 1

    for field in ("linked_job_story_ids", "linked_content_ids", "linked_competitor_ids"):
        if field in update_data:
            set_parts.append(f"{field} = ${index}::uuid[]")
            params.append(update_data[field] or [])
            index += 1

    for field in ("pain_points", "gains"):
        if field in update_data:
            set_parts.append(f"{field} = ${index}::text[]")
            params.append(update_data[field] or [])
            index += 1

    set_parts.append("updated_at = NOW()")
    params.append(segment_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE marketing_segments
            SET {", ".join(set_parts)}
            WHERE id = ${index}
              AND deleted_at IS NULL
            RETURNING *
            """,  # noqa: S608
            *params,
        )

    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить сегмент")
    return MarketingSegmentOut.model_validate(normalize_segment(row))


@router.delete("/{segment_id}", status_code=status.HTTP_200_OK, response_model=DeleteMarketingSegmentResponse)
async def delete_segment(
    segment_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteMarketingSegmentResponse:
    existing = await _fetch_segment(db_pool, segment_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сегмент не найден")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="segments"
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE marketing_segments
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            segment_id,
        )

    return DeleteMarketingSegmentResponse.model_validate({"message": "Segment deleted", "segment_id": str(segment_id)})
