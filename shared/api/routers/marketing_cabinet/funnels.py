# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Marketing Cabinet funnel CRUD endpoints and OpenAPI contract.
# Funnel/stage writes trigger best-effort performance fact sync for the owning project.
# Invariants:
# - list_funnels keeps default limit 200 and fetches stages only for returned funnel ids.
# - Fact sync failures must not roll back the already accepted funnel mutation.
# - Stage ``conversion_rate`` is always derived server-side from visitors/conversions (client field ignored).
# Related:
# - api/services/marketing_cabinet/project_performance_sync.py
# - documentation/product/marketing/MARKETING-CABINET.md
# ---
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
    normalize_funnel,
    normalize_funnel_stage,
)
from api.schemas.marketing_cabinet import (
    DeleteMarketingFunnelResponse,
    MarketingFunnelListResponse,
    MarketingFunnelOut,
)
from api.services.marketing_cabinet.project_performance_sync import (
    sync_marketing_performance_facts_best_effort,
)

router = APIRouter(prefix="/funnels", tags=["Marketing Cabinet - Funnels"])


def compute_funnel_stage_conversion_rate(visitors: int, conversions: int) -> float:
    """Authoritative stage rate: conversions/visitors, else 0.0 (same scale as legacy FE)."""
    try:
        visitors_n = int(visitors)
        conversions_n = int(conversions)
    except TypeError, ValueError:
        return 0.0
    if visitors_n <= 0:
        return 0.0
    return float(conversions_n) / float(visitors_n)


class FunnelStageInput(BaseModel):
    stage_name: str = Field(..., min_length=2, max_length=255)
    stage_order: int = Field(default=0, ge=0)
    visitors: int = Field(default=0, ge=0)
    conversions: int = Field(default=0, ge=0)
    conversion_rate: float | None = Field(
        default=None,
        description="Deprecated on write: ignored; server stores conversions/visitors.",
    )


class FunnelCreateRequest(BaseModel):
    project_id: UUID
    name: str = Field(..., min_length=2, max_length=255)
    status: str = Field(default="draft")
    primary_goal: str | None = None
    stages: list[FunnelStageInput] = Field(default_factory=list)


class FunnelUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    status: str | None = None
    primary_goal: str | None = None
    stages: list[FunnelStageInput] | None = None


async def _fetch_funnel(db_pool: asyncpg.Pool, funnel_id: UUID) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM marketing_funnels
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            funnel_id,
        )


async def _fetch_funnel_stages(db_pool: asyncpg.Pool, funnel_id: UUID) -> list[dict[str, Any]]:
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_funnel_stages
            WHERE funnel_id = $1
              AND deleted_at IS NULL
            ORDER BY stage_order ASC, created_at ASC
            """,
            funnel_id,
        )
    return [normalize_funnel_stage(row) for row in rows]


async def _insert_funnel_stages(
    conn: asyncpg.Connection,
    *,
    funnel_id: UUID,
    stages: list[FunnelStageInput],
) -> None:
    for item in stages:
        rate = compute_funnel_stage_conversion_rate(item.visitors, item.conversions)
        await conn.execute(
            """
            INSERT INTO marketing_funnel_stages (
                funnel_id,
                stage_name,
                stage_order,
                visitors,
                conversions,
                conversion_rate,
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
                $7::jsonb,
                NOW(),
                NOW()
            )
            """,
            funnel_id,
            item.stage_name,
            item.stage_order,
            item.visitors,
            item.conversions,
            rate,
            json.dumps({}),
        )


@router.get("", response_model=MarketingFunnelListResponse)
async def list_funnels(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingFunnelListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            """
            SELECT COUNT(*)::int AS count
            FROM marketing_funnels
            WHERE project_id = $1
              AND deleted_at IS NULL
            """,
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0

        funnel_rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_funnels
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2 OFFSET $3
            """,
            project_id,
            effective_limit,
            effective_offset,
        )
        funnel_ids = [row["id"] for row in funnel_rows]
        stage_rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_funnel_stages
            WHERE funnel_id = ANY($1::uuid[])
              AND deleted_at IS NULL
            ORDER BY stage_order ASC, created_at ASC
            """,
            funnel_ids or [UUID(int=0)],
        )

    stages_by_funnel: dict[UUID, list[dict[str, Any]]] = {}
    for stage_row in stage_rows:
        stages_by_funnel.setdefault(stage_row["funnel_id"], []).append(normalize_funnel_stage(stage_row))
    items = [normalize_funnel(row, stages_by_funnel.get(row["id"], [])) for row in funnel_rows]
    return MarketingFunnelListResponse.model_validate({"items": items, "total": total})


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MarketingFunnelOut)
async def create_funnel(
    payload: FunnelCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingFunnelOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="funnel"
    )

    async with db_pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
                INSERT INTO marketing_funnels (
                    project_id,
                    company_id,
                    created_by,
                    name,
                    status,
                    primary_goal,
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
                    $7::jsonb,
                    NOW(),
                    NOW()
                )
                RETURNING *
                """,
            payload.project_id,
            project["company_id"],
            user_id,
            payload.name,
            payload.status,
            payload.primary_goal,
            json.dumps({}),
        )
        await _insert_funnel_stages(conn, funnel_id=row["id"], stages=payload.stages)

    await sync_marketing_performance_facts_best_effort(db_pool, project_id=payload.project_id)
    return MarketingFunnelOut.model_validate(normalize_funnel(row, await _fetch_funnel_stages(db_pool, row["id"])))


@router.patch("/{funnel_id}", response_model=MarketingFunnelOut)
async def update_funnel(
    funnel_id: UUID,
    payload: FunnelUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingFunnelOut:
    existing = await _fetch_funnel(db_pool, funnel_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Воронка не найдена")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="funnel"
    )
    update_data = payload.model_dump(exclude_unset=True)

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1
    for field in ("name", "status", "primary_goal"):
        if field in update_data:
            set_parts.append(f"{field} = ${index}")
            params.append(update_data[field])
            index += 1

    async with db_pool.acquire() as conn, conn.transaction():
        if set_parts:
            set_parts.append("updated_at = NOW()")
            params.append(funnel_id)
            row = await conn.fetchrow(
                f"""
                    UPDATE marketing_funnels
                    SET {", ".join(set_parts)}
                    WHERE id = ${index}
                      AND deleted_at IS NULL
                    RETURNING *
                    """,  # noqa: S608
                *params,
            )
        else:
            row = existing

        if "stages" in update_data:
            await conn.execute(
                """
                    UPDATE marketing_funnel_stages
                    SET deleted_at = NOW(), updated_at = NOW()
                    WHERE funnel_id = $1
                      AND deleted_at IS NULL
                    """,
                funnel_id,
            )
            await _insert_funnel_stages(conn, funnel_id=funnel_id, stages=payload.stages or [])

    await sync_marketing_performance_facts_best_effort(db_pool, project_id=existing["project_id"])
    return MarketingFunnelOut.model_validate(normalize_funnel(row, await _fetch_funnel_stages(db_pool, funnel_id)))


@router.delete("/{funnel_id}", status_code=status.HTTP_200_OK, response_model=DeleteMarketingFunnelResponse)
async def delete_funnel(
    funnel_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteMarketingFunnelResponse:
    existing = await _fetch_funnel(db_pool, funnel_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Воронка не найдена")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="funnel"
    )
    async with db_pool.acquire() as conn, conn.transaction():
        await conn.execute(
            """
                UPDATE marketing_funnel_stages
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE funnel_id = $1
                  AND deleted_at IS NULL
                """,
            funnel_id,
        )
        await conn.execute(
            """
                UPDATE marketing_funnels
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE id = $1
                """,
            funnel_id,
        )

    await sync_marketing_performance_facts_best_effort(db_pool, project_id=existing["project_id"])
    return DeleteMarketingFunnelResponse.model_validate({"message": "Funnel deleted", "funnel_id": str(funnel_id)})
