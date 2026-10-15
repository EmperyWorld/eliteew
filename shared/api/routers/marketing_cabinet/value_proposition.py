# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/value_proposition.py`: эндпоинты и контракт —
#   в коде и OpenAPI.
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
from pydantic import BaseModel, Field, field_validator  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_job_story,
    normalize_value_proposition,
)
from api.schemas.marketing_cabinet import (
    DeleteValuePropositionResponse,
    MarketingValuePropositionListResponse,
    MarketingValuePropositionOut,
)

router = APIRouter(prefix="/value-propositions", tags=["Marketing Cabinet - Value Proposition"])

_VP_UPDATE_SCALAR_FIELDS: frozenset[str] = frozenset(
    {"headline", "subheadline", "value_statement", "status"},
)

VALUE_PROP_STATUS_DB_VALUES = frozenset(
    {
        "draft",
        "testing",
        "active",
        "paused",
        "archived",
    }
)

VALUE_PROP_STATUS_ALIASES = {
    "approved": "active",
    "in_review": "testing",
    "live": "active",
    "published": "active",
    "review": "testing",
    "validated": "active",
}


def _coerce_value_prop_status_value(value: object) -> object:
    if value is None or not isinstance(value, str):
        return value
    raw_key = value.strip().lower().replace("-", "_")
    key = raw_key.replace(" ", "_")
    if ":" in raw_key:
        _prefix, suffix = raw_key.split(":", 1)
        if any(separator in suffix for separator in ("|", ",", "/")):
            key = suffix.replace(" ", "_")
    list_candidate = key.replace(",", "|").replace("/", "|")
    if "|" in list_candidate:
        normalized_tokens: list[str] = []
        for token in list_candidate.split("|"):
            token_key = token.strip().strip("_")
            if not token_key:
                continue
            normalized_tokens.append(VALUE_PROP_STATUS_ALIASES.get(token_key, token_key))
        if normalized_tokens and all(token in VALUE_PROP_STATUS_DB_VALUES for token in normalized_tokens):
            return normalized_tokens[0]
    return VALUE_PROP_STATUS_ALIASES.get(key, key)


def _validate_value_prop_status_enum(value: str) -> str:
    if value not in VALUE_PROP_STATUS_DB_VALUES:
        allowed = ", ".join(sorted(VALUE_PROP_STATUS_DB_VALUES))
        msg = f"Invalid value proposition status '{value}'. Allowed: {allowed}"
        raise ValueError(msg)
    return value


class ValuePropositionCreateRequest(BaseModel):
    project_id: UUID
    headline: str | None = Field(default=None, max_length=255)
    subheadline: str | None = Field(default=None, max_length=500)
    value_statement: str | None = None
    proof_points: list[str] = Field(default_factory=list)
    target_channels: list[str] = Field(default_factory=list)
    job_story_ids: list[UUID] = Field(default_factory=list)
    status: str = Field(default="draft")

    @field_validator("status", mode="before")
    @classmethod
    def vp_status_normalize_create(cls, value: object) -> object:
        return _coerce_value_prop_status_value(value)

    @field_validator("status")
    @classmethod
    def vp_status_validate_create(cls, value: str) -> str:
        return _validate_value_prop_status_enum(value)


class ValuePropositionUpdateRequest(BaseModel):
    headline: str | None = Field(default=None, max_length=255)
    subheadline: str | None = Field(default=None, max_length=500)
    value_statement: str | None = None
    proof_points: list[str] | None = None
    target_channels: list[str] | None = None
    job_story_ids: list[UUID] | None = None
    status: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def vp_status_normalize_update(cls, value: object) -> object:
        return _coerce_value_prop_status_value(value)

    @field_validator("status")
    @classmethod
    def vp_status_validate_update(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_value_prop_status_enum(value)


async def _fetch_value_proposition(
    db_pool: asyncpg.Pool,
    value_prop_id: UUID,
) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM value_propositions
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            value_prop_id,
        )


async def _fetch_job_rows(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    job_story_ids: list[UUID],
) -> list[asyncpg.Record]:
    if not job_story_ids:
        return []

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                id,
                project_id,
                company_id,
                situation,
                motivation,
                outcome,
                full_story,
                category::text AS category,
                priority::text AS priority,
                tags,
                source::text AS source,
                importance_score,
                quality_score,
                sentiment_score,
                is_validated,
                metadata,
                processing_data,
                created_at,
                updated_at,
                COALESCE((processing_data->>'satisfaction_score')::numeric, NULL) AS satisfaction_score,
                COALESCE(metadata->>'title', situation) AS title
            FROM job_stories
            WHERE project_id = $1
              AND id = ANY($2::uuid[])
              AND deleted_at IS NULL
            ORDER BY created_at ASC
            """,
            project_id,
            job_story_ids,
        )
    return list(rows)


def _draft_vp_from_jobs(job_rows: list[asyncpg.Record]) -> dict[str, Any]:
    if not job_rows:
        return {
            "headline": "Draft value proposition",
            "subheadline": "Fill in the customer promise and proof points",
            "value_statement": "Describe the customer outcome, differentiator and proof.",
            "proof_points": [],
        }

    jobs = [normalize_job_story(row) for row in job_rows]
    primary = jobs[0]
    unique_outcomes = [job["outcome"] for job in jobs if job.get("outcome")]
    unique_motivations = [job["motivation"] for job in jobs if job.get("motivation")]
    proof_points = list(dict.fromkeys(unique_outcomes[:3] + unique_motivations[:2]))

    return {
        "headline": f"Help customers {primary['motivation']}",
        "subheadline": f"Designed for teams that need to {primary['outcome']}",
        "value_statement": (
            "We turn the key jobs from customer interviews into a concrete workflow: "
            f"{'; '.join(job['title'] for job in jobs[:3])}."
        ),
        "proof_points": proof_points[:5],
    }


@router.get("", response_model=MarketingValuePropositionListResponse)
async def list_value_propositions(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingValuePropositionListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            """
            SELECT COUNT(*)::int AS count
            FROM value_propositions
            WHERE project_id = $1 AND deleted_at IS NULL
            """,
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(
            """
            SELECT *
            FROM value_propositions
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2 OFFSET $3
            """,
            project_id,
            effective_limit,
            effective_offset,
        )

    items = [normalize_value_proposition(row) for row in rows]
    return MarketingValuePropositionListResponse.model_validate({"items": items, "total": total})


@router.get("/{value_prop_id}", response_model=MarketingValuePropositionOut)
async def get_value_proposition(
    value_prop_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingValuePropositionOut:
    row = await _fetch_value_proposition(db_pool, value_prop_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ценностное предложение не найдено")

    await get_accessible_project(db_pool, row["project_id"], user_id)
    addressed_job_ids = list(row.get("addressed_job_ids") or [])
    addressed_job_rows = await _fetch_job_rows(db_pool, row["project_id"], addressed_job_ids)
    addressed_jobs = [normalize_job_story(job_row) for job_row in addressed_job_rows]
    return MarketingValuePropositionOut.model_validate(normalize_value_proposition(row, addressed_jobs=addressed_jobs))


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MarketingValuePropositionOut)
async def create_value_proposition(
    payload: ValuePropositionCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingValuePropositionOut:
    await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="value_proposition"
    )
    job_rows = await _fetch_job_rows(db_pool, payload.project_id, payload.job_story_ids)
    if payload.job_story_ids and len(job_rows) != len(payload.job_story_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Одна или несколько выбранных JTBD-историй не относятся к текущему проекту",
        )

    draft = _draft_vp_from_jobs(job_rows)
    headline = (payload.headline or draft["headline"]).strip()
    subheadline = (payload.subheadline or draft["subheadline"]).strip()
    value_statement = (payload.value_statement or draft["value_statement"]).strip()
    proof_points = payload.proof_points or draft["proof_points"]

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO value_propositions (
                project_id,
                created_by,
                headline,
                subheadline,
                value_statement,
                proof_points,
                addressed_job_ids,
                target_channels,
                status,
                metadata,
                is_ai_generated,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6::jsonb,
                $7::uuid[],
                $8::text[],
                $9::value_prop_status,
                $10::jsonb,
                $11,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            payload.project_id,
            user_id,
            headline,
            subheadline or None,
            value_statement,
            json.dumps(proof_points),
            payload.job_story_ids,
            payload.target_channels,
            payload.status,
            json.dumps(
                {
                    "generated_from_jtbd": bool(payload.job_story_ids),
                    "source_jobs_count": len(payload.job_story_ids),
                }
            ),
            bool(payload.job_story_ids),
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось создать ценностное предложение"
        )

    addressed_jobs = [normalize_job_story(job_row) for job_row in job_rows]
    return MarketingValuePropositionOut.model_validate(normalize_value_proposition(row, addressed_jobs=addressed_jobs))


@router.patch("/{value_prop_id}", response_model=MarketingValuePropositionOut)
async def update_value_proposition(
    value_prop_id: UUID,
    payload: ValuePropositionUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingValuePropositionOut:
    existing = await _fetch_value_proposition(db_pool, value_prop_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ценностное предложение не найдено")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="value_proposition"
    )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return MarketingValuePropositionOut.model_validate(normalize_value_proposition(existing))

    if "job_story_ids" in update_data:
        job_ids = list(update_data.pop("job_story_ids") or [])
        job_rows = await _fetch_job_rows(db_pool, existing["project_id"], job_ids)
        if job_ids and len(job_rows) != len(job_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Одна или несколько выбранных JTBD-историй не относятся к текущему проекту",
            )
        update_data["addressed_job_ids"] = job_ids

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1

    for field in _VP_UPDATE_SCALAR_FIELDS:
        if field in update_data:
            if field == "status":
                set_parts.append(f"{field} = ${index}::value_prop_status")
            else:
                set_parts.append(f"{field} = ${index}")
            params.append(update_data[field])
            index += 1

    if "proof_points" in update_data:
        set_parts.append(f"proof_points = ${index}::jsonb")
        params.append(json.dumps(update_data["proof_points"] or []))
        index += 1

    if "target_channels" in update_data:
        set_parts.append(f"target_channels = ${index}::text[]")
        params.append(update_data["target_channels"] or [])
        index += 1

    if "addressed_job_ids" in update_data:
        set_parts.append(f"addressed_job_ids = ${index}::uuid[]")
        params.append(update_data["addressed_job_ids"] or [])
        index += 1

    set_parts.append("updated_at = NOW()")
    params.append(value_prop_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE value_propositions
            SET {", ".join(set_parts)}
            WHERE id = ${index}
              AND deleted_at IS NULL
            RETURNING *
            """,  # noqa: S608
            *params,
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить ценностное предложение"
        )
    addressed_job_ids = list(row.get("addressed_job_ids") or [])
    addressed_job_rows = await _fetch_job_rows(db_pool, row["project_id"], addressed_job_ids)
    addressed_jobs = [normalize_job_story(job_row) for job_row in addressed_job_rows]
    return MarketingValuePropositionOut.model_validate(normalize_value_proposition(row, addressed_jobs=addressed_jobs))


@router.delete("/{value_prop_id}", status_code=status.HTTP_200_OK, response_model=DeleteValuePropositionResponse)
async def delete_value_proposition(
    value_prop_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteValuePropositionResponse:
    existing = await _fetch_value_proposition(db_pool, value_prop_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ценностное предложение не найдено")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="value_proposition"
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE value_propositions
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            value_prop_id,
        )

    return DeleteValuePropositionResponse.model_validate(
        {"message": "Value proposition deleted", "value_proposition_id": str(value_prop_id)}
    )
