# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Marketing Cabinet campaign CRUD endpoints and OpenAPI contract.
# Campaign writes trigger best-effort performance fact sync for the owning project.
# Invariants:
# - Authorization is checked through Marketing Cabinet project visibility helpers.
# - Fact sync failures must not roll back the already accepted campaign mutation.
# Related:
# - api/services/marketing_cabinet/project_performance_sync.py
# - documentation/product/marketing/MARKETING-CABINET-PERFORMANCE.md
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
    normalize_campaign,
)
from api.schemas.marketing_cabinet import (
    DeleteMarketingCampaignResponse,
    MarketingCampaignListResponse,
    MarketingCampaignOut,
)
from api.services.marketing_cabinet.project_performance_sync import (
    sync_marketing_performance_facts_best_effort,
)

router = APIRouter(prefix="/campaigns", tags=["Marketing Cabinet - Campaigns"])

_CAMPAIGN_SCALAR_FIELDS: frozenset[str] = frozenset(
    {
        "name",
        "objective",
        "channel",
        "status",
        "priority",
        "owner_name",
        "hypothesis",
        "budget",
        "target_metric_name",
        "target_metric",
        "actual_metric",
        "start_date",
        "end_date",
    }
)


class CampaignCreateRequest(BaseModel):
    project_id: UUID
    name: str = Field(..., min_length=2, max_length=255)
    objective: str | None = None
    channel: str = Field(default="organic")
    status: str = Field(default="draft")
    priority: str = Field(default="medium")
    owner_name: str | None = Field(default=None, max_length=255)
    hypothesis: str | None = None
    budget: float | None = Field(default=None, ge=0)
    target_metric_name: str | None = Field(default=None, max_length=255)
    target_metric: float | None = None
    actual_metric: float | None = None
    linked_segment_ids: list[UUID] = Field(default_factory=list)
    linked_value_prop_ids: list[UUID] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str | None = None


class CampaignUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    objective: str | None = None
    channel: str | None = None
    status: str | None = None
    priority: str | None = None
    owner_name: str | None = Field(default=None, max_length=255)
    hypothesis: str | None = None
    budget: float | None = Field(default=None, ge=0)
    target_metric_name: str | None = Field(default=None, max_length=255)
    target_metric: float | None = None
    actual_metric: float | None = None
    linked_segment_ids: list[UUID] | None = None
    linked_value_prop_ids: list[UUID] | None = None
    start_date: str | None = None
    end_date: str | None = None


async def _fetch_campaign(db_pool: asyncpg.Pool, campaign_id: UUID) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM marketing_campaigns
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            campaign_id,
        )


@router.get("", response_model=MarketingCampaignListResponse)
async def list_campaigns(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingCampaignListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    query = """
        SELECT *
        FROM marketing_campaigns
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2 OFFSET $3
    """
    params: list[Any] = [project_id, effective_limit, effective_offset]

    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            "SELECT COUNT(*) FROM marketing_campaigns WHERE project_id = $1 AND deleted_at IS NULL",
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(query, *params)

    items = [normalize_campaign(row) for row in rows]
    return MarketingCampaignListResponse.model_validate({"items": items, "total": total})


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MarketingCampaignOut)
async def create_campaign(
    payload: CampaignCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingCampaignOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="campaigns"
    )

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_campaigns (
                project_id,
                company_id,
                created_by,
                name,
                objective,
                channel,
                status,
                priority,
                owner_name,
                hypothesis,
                budget,
                target_metric_name,
                target_metric,
                actual_metric,
                linked_segment_ids,
                linked_value_prop_ids,
                metadata,
                start_date,
                end_date,
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
                $11,
                $12,
                $13,
                $14,
                $15::uuid[],
                $16::uuid[],
                $17::jsonb,
                $18::timestamp,
                $19::timestamp,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            payload.project_id,
            project["company_id"],
            user_id,
            payload.name,
            payload.objective,
            payload.channel,
            payload.status,
            payload.priority,
            payload.owner_name,
            payload.hypothesis,
            payload.budget,
            payload.target_metric_name,
            payload.target_metric,
            payload.actual_metric,
            payload.linked_segment_ids,
            payload.linked_value_prop_ids,
            json.dumps({}),
            payload.start_date,
            payload.end_date,
        )

    await sync_marketing_performance_facts_best_effort(db_pool, project_id=payload.project_id)
    return MarketingCampaignOut.model_validate(normalize_campaign(row))


@router.patch("/{campaign_id}", response_model=MarketingCampaignOut)
async def update_campaign(
    campaign_id: UUID,
    payload: CampaignUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingCampaignOut:
    existing = await _fetch_campaign(db_pool, campaign_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Кампания не найдена")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="campaigns"
    )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return MarketingCampaignOut.model_validate(normalize_campaign(existing))

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1

    for field in _CAMPAIGN_SCALAR_FIELDS:
        if field in update_data:
            cast_suffix = "::timestamp" if field in {"start_date", "end_date"} else ""
            set_parts.append(f"{field} = ${index}{cast_suffix}")
            params.append(update_data[field])
            index += 1

    for field in ("linked_segment_ids", "linked_value_prop_ids"):
        if field in update_data:
            set_parts.append(f"{field} = ${index}::uuid[]")
            params.append(update_data[field] or [])
            index += 1

    set_parts.append("updated_at = NOW()")
    params.append(campaign_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE marketing_campaigns
            SET {", ".join(set_parts)}
            WHERE id = ${index}
              AND deleted_at IS NULL
            RETURNING *
            """,  # noqa: S608
            *params,
        )

    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить кампанию")
    await sync_marketing_performance_facts_best_effort(db_pool, project_id=existing["project_id"])
    return MarketingCampaignOut.model_validate(normalize_campaign(row))


@router.delete("/{campaign_id}", status_code=status.HTTP_200_OK, response_model=DeleteMarketingCampaignResponse)
async def delete_campaign(
    campaign_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteMarketingCampaignResponse:
    existing = await _fetch_campaign(db_pool, campaign_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Кампания не найдена")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="campaigns"
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE marketing_campaigns
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            campaign_id,
        )

    await sync_marketing_performance_facts_best_effort(db_pool, project_id=existing["project_id"])
    return DeleteMarketingCampaignResponse.model_validate(
        {"message": "Campaign deleted", "campaign_id": str(campaign_id)}
    )
