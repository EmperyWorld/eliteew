# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/competitors.py`: эндпоинты и контракт — в коде
#   и OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, Query, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field, field_validator  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_competitor,
)
from api.schemas.marketing_cabinet import (
    DeleteCompetitorResponse,
    MarketingCompetitorListResponse,
    MarketingCompetitorOut,
)

router = APIRouter(prefix="/competitors", tags=["Marketing Cabinet - Competitors"])
logger = logging.getLogger("api.routers.marketing_cabinet.competitors")

# Legacy Postgres schema: competitor_type / market_position were VARCHAR(50); pricing_strategy often VARCHAR(50) too.
# See migration `20260602_01_competitors_widen_text_columns.sql` (market_position 255, pricing_strategy TEXT).
COMPETITOR_TYPE_DB_VALUES = frozenset({"direct", "indirect", "adjacent", "replacement"})
COMPETITOR_TYPE_MAX_LEN = 50
COMPETITOR_MARKET_POSITION_MAX_LEN = 255
# Legacy VARCHAR(50) before migration `20260602_01_competitors_widen_text_columns.sql`; column is TEXT afterward.
COMPETITOR_PRICING_STRATEGY_MAX_LEN = 4000

_COMPETITOR_TYPE_SYNONYMS: dict[str, str] = {
    "primary": "direct",
    "main": "direct",
    "прямой": "direct",
    "прямые": "direct",
    "косвенный": "indirect",
    "косвенные": "indirect",
    "смежный": "adjacent",
    "смежные": "adjacent",
    "замена": "replacement",
    "заменитель": "replacement",
}


def truncate_competitor_db_varchar(value: str | None, *, max_len: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) <= max_len:
        return text
    logger.debug("competitor_varchar_truncated max_len=%s raw_len=%s", max_len, len(text))
    return text[:max_len]


def normalize_competitor_type_for_db(value: str | None) -> str:
    """Map LLM / free-text competitor_type to a short value that fits VARCHAR(50)."""
    if value is None or not str(value).strip():
        return "direct"
    raw = str(value).strip().lower()
    for token in ("replacement", "adjacent", "indirect", "direct"):
        if token in raw:
            return token
    if raw in _COMPETITOR_TYPE_SYNONYMS:
        return _COMPETITOR_TYPE_SYNONYMS[raw]
    if raw in COMPETITOR_TYPE_DB_VALUES:
        return raw
    first = re.split(r"[\s|,;/]+", raw, maxsplit=1)[0]
    if first in COMPETITOR_TYPE_DB_VALUES:
        return first
    if first in _COMPETITOR_TYPE_SYNONYMS:
        return _COMPETITOR_TYPE_SYNONYMS[first]
    logger.debug("competitor_type_unmapped value=%s", value)
    return "direct"


def normalize_competitor_market_position_for_db(value: str | None) -> str | None:
    return truncate_competitor_db_varchar(value, max_len=COMPETITOR_MARKET_POSITION_MAX_LEN)


def normalize_competitor_pricing_strategy_for_db(value: str | None) -> str | None:
    # Truncate for API contract; legacy VARCHAR(50) is widened by migration 20260602_01.
    return truncate_competitor_db_varchar(value, max_len=COMPETITOR_PRICING_STRATEGY_MAX_LEN)


def prepare_competitor_write_fields(
    *,
    competitor_type: str | None,
    market_position: str | None,
    pricing_strategy: str | None,
) -> tuple[str, str | None, str | None]:
    ctype = truncate_competitor_db_varchar(
        normalize_competitor_type_for_db(competitor_type),
        max_len=COMPETITOR_TYPE_MAX_LEN,
    )
    return (
        ctype or "direct",
        normalize_competitor_market_position_for_db(market_position),
        normalize_competitor_pricing_strategy_for_db(pricing_strategy),
    )


_COMP_UPDATE_SCALAR_FIELDS: frozenset[str] = frozenset(
    {
        "name",
        "website",
        "description",
        "competitor_type",
        "market_position",
        "pricing_strategy",
    },
)
_COMP_UPDATE_ARRAY_FIELDS: frozenset[str] = frozenset({"strengths", "weaknesses"})


class CompetitorCreateRequest(BaseModel):
    project_id: UUID
    name: str = Field(..., min_length=2, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    description: str | None = None
    competitor_type: str = Field(default="direct")
    market_position: str | None = Field(default=None, max_length=COMPETITOR_MARKET_POSITION_MAX_LEN)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    pricing_strategy: str | None = Field(default=None, max_length=COMPETITOR_PRICING_STRATEGY_MAX_LEN)

    @field_validator("competitor_type", mode="before")
    @classmethod
    def _coerce_competitor_type(cls, value: object) -> str:
        return normalize_competitor_type_for_db(str(value) if value is not None else None)

    @field_validator("market_position", mode="before")
    @classmethod
    def _coerce_market_position(cls, value: object) -> object:
        if value is None:
            return None
        return normalize_competitor_market_position_for_db(str(value))

    @field_validator("pricing_strategy", mode="before")
    @classmethod
    def _coerce_pricing_strategy(cls, value: object) -> object:
        if value is None:
            return None
        return normalize_competitor_pricing_strategy_for_db(str(value))


class CompetitorUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    description: str | None = None
    competitor_type: str | None = None
    market_position: str | None = Field(default=None, max_length=COMPETITOR_MARKET_POSITION_MAX_LEN)
    strengths: list[str] | None = None
    weaknesses: list[str] | None = None
    pricing_strategy: str | None = Field(default=None, max_length=COMPETITOR_PRICING_STRATEGY_MAX_LEN)

    @field_validator("competitor_type", mode="before")
    @classmethod
    def _coerce_competitor_type(cls, value: object) -> object:
        if value is None:
            return None
        return normalize_competitor_type_for_db(str(value))

    @field_validator("market_position", mode="before")
    @classmethod
    def _coerce_market_position(cls, value: object) -> object:
        if value is None:
            return None
        return normalize_competitor_market_position_for_db(str(value))

    @field_validator("pricing_strategy", mode="before")
    @classmethod
    def _coerce_pricing_strategy(cls, value: object) -> object:
        if value is None:
            return None
        return normalize_competitor_pricing_strategy_for_db(str(value))


async def _fetch_competitor(db_pool: asyncpg.Pool, competitor_id: UUID) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM competitors
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            competitor_id,
        )


@router.get("", response_model=MarketingCompetitorListResponse)
async def list_competitors(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingCompetitorListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    query = """
        SELECT *
        FROM competitors
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2 OFFSET $3
    """
    params: list[Any] = [project_id, effective_limit, effective_offset]

    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            """
            SELECT COUNT(*)::int AS count
            FROM competitors
            WHERE project_id = $1 AND deleted_at IS NULL
            """,
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(query, *params)

    items = [normalize_competitor(row) for row in rows]
    return MarketingCompetitorListResponse.model_validate({"items": items, "total": total})


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MarketingCompetitorOut)
async def create_competitor(
    payload: CompetitorCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingCompetitorOut:
    await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="competitors"
    )

    competitor_type, market_position, pricing_strategy = prepare_competitor_write_fields(
        competitor_type=payload.competitor_type,
        market_position=payload.market_position,
        pricing_strategy=payload.pricing_strategy,
    )

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO competitors (
                project_id,
                created_by,
                name,
                website,
                description,
                competitor_type,
                market_position,
                strengths,
                weaknesses,
                pricing_strategy,
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
                $8::text[],
                $9::text[],
                $10,
                $11::jsonb,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            payload.project_id,
            user_id,
            payload.name,
            payload.website,
            payload.description,
            competitor_type,
            market_position,
            payload.strengths,
            payload.weaknesses,
            pricing_strategy,
            json.dumps({}),
        )

    return MarketingCompetitorOut.model_validate(normalize_competitor(row))


@router.patch("/{competitor_id}", response_model=MarketingCompetitorOut)
async def update_competitor(
    competitor_id: UUID,
    payload: CompetitorUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingCompetitorOut:
    existing = await _fetch_competitor(db_pool, competitor_id)
    if existing is None:
        from fastapi import HTTPException  # noqa: PLC0415

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Конкурент не найден")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="competitors"
    )
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return MarketingCompetitorOut.model_validate(normalize_competitor(existing))

    if "competitor_type" in update_data or "market_position" in update_data or "pricing_strategy" in update_data:
        ctype, mpos, pstrat = prepare_competitor_write_fields(
            competitor_type=update_data.get("competitor_type", existing.get("competitor_type")),
            market_position=update_data.get("market_position", existing.get("market_position")),
            pricing_strategy=update_data.get("pricing_strategy", existing.get("pricing_strategy")),
        )
        if "competitor_type" in update_data:
            update_data["competitor_type"] = ctype
        if "market_position" in update_data:
            update_data["market_position"] = mpos
        if "pricing_strategy" in update_data:
            update_data["pricing_strategy"] = pstrat

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1
    for field in _COMP_UPDATE_SCALAR_FIELDS:
        if field in update_data:
            set_parts.append(f"{field} = ${index}")
            params.append(update_data[field])
            index += 1
    for field in _COMP_UPDATE_ARRAY_FIELDS:
        if field in update_data:
            set_parts.append(f"{field} = ${index}::text[]")
            params.append(update_data[field] or [])
            index += 1
    set_parts.append("updated_at = NOW()")
    params.append(competitor_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE competitors
            SET {", ".join(set_parts)}
            WHERE id = ${index}
              AND deleted_at IS NULL
            RETURNING *
            """,  # noqa: S608
            *params,
        )

    return MarketingCompetitorOut.model_validate(normalize_competitor(row))


@router.delete("/{competitor_id}", status_code=status.HTTP_200_OK, response_model=DeleteCompetitorResponse)
async def delete_competitor(
    competitor_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteCompetitorResponse:
    existing = await _fetch_competitor(db_pool, competitor_id)
    if existing is None:
        from fastapi import HTTPException  # noqa: PLC0415

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Конкурент не найден")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="competitors"
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE competitors
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            competitor_id,
        )

    return DeleteCompetitorResponse.model_validate(
        {"message": "Competitor deleted", "competitor_id": str(competitor_id)}
    )
