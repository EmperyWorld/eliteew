# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/analysis.py`: эндпоинты и контракт — в коде и
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
from pydantic import BaseModel, Field, field_validator  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.ai_support import (
    build_marketing_queue_snapshot,
    ensure_marketing_idempotency,
    get_marketing_ai_service,
    record_marketing_ai_run,
)
from api.routers.marketing_cabinet.common import (
    build_project_context,
    extract_json_payload,
    format_project_context_for_prompt,
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_swot_analysis,
    normalize_swot_factor,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.schemas.marketing_cabinet import (
    DeleteSwotAnalysisResponse,
    MarketingAiAsyncStartResponse,
    MarketingSwotListResponse,
    MarketingSwotOut,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import merge_project_context_text_with_rag

_MARKETING_SWOT_GENERATION_TYPE_KEY = "marketing_swot_analysis"

router = APIRouter(prefix="/analysis", tags=["Marketing Cabinet - Analysis"])

IMPACT_LEVEL_DB_VALUES = frozenset({"low", "medium", "high", "critical"})
IMPACT_LEVEL_ALIASES = {
    "major": "high",
    "minor": "low",
    "moderate": "medium",
    "severe": "critical",
    "urgent": "critical",
}


def _coerce_impact_level_value(value: object) -> object:
    if value is None or not isinstance(value, str):
        return value
    key = value.strip().lower().replace("-", "_").replace(" ", "_")
    return IMPACT_LEVEL_ALIASES.get(key, key)


def _validate_impact_level_enum(value: str) -> str:
    if value not in IMPACT_LEVEL_DB_VALUES:
        allowed = ", ".join(sorted(IMPACT_LEVEL_DB_VALUES))
        msg = f"Invalid SWOT impact level '{value}'. Allowed: {allowed}"
        raise ValueError(msg)
    return value


def _normalize_impact_level_for_storage(value: object) -> str:
    candidate = _coerce_impact_level_value(value)
    if not isinstance(candidate, str):
        return "medium"
    try:
        return _validate_impact_level_enum(candidate)
    except ValueError:
        return "medium"


class SWOTFactorInput(BaseModel):
    factor_text: str = Field(..., min_length=2)
    description: str | None = None
    impact_level: str = Field(default="medium")
    priority_score: int = Field(default=0, ge=0, le=100)

    @field_validator("impact_level", mode="before")
    @classmethod
    def impact_level_normalize(cls, value: object) -> object:
        return _coerce_impact_level_value(value)

    @field_validator("impact_level")
    @classmethod
    def impact_level_validate(cls, value: str) -> str:
        return _validate_impact_level_enum(value)


class SWOTCreateRequest(BaseModel):
    project_id: UUID
    title: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    executive_summary: str | None = None
    company_name: str | None = None
    industry: str | None = None
    strengths: list[SWOTFactorInput] = Field(default_factory=list)
    weaknesses: list[SWOTFactorInput] = Field(default_factory=list)
    opportunities: list[SWOTFactorInput] = Field(default_factory=list)
    threats: list[SWOTFactorInput] = Field(default_factory=list)


class SWOTGenerateRequest(BaseModel):
    project_id: UUID
    context: str | None = None
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)


class SWOTUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = None
    executive_summary: str | None = None
    company_name: str | None = None
    industry: str | None = None
    strengths: list[SWOTFactorInput] | None = None
    weaknesses: list[SWOTFactorInput] | None = None
    opportunities: list[SWOTFactorInput] | None = None
    threats: list[SWOTFactorInput] | None = None


async def _fetch_swot(
    db_pool: asyncpg.Pool,
    analysis_id: UUID,
) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM swot_analyses
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            analysis_id,
        )


async def _fetch_swot_any(
    db_pool: asyncpg.Pool,
    analysis_id: UUID,
) -> asyncpg.Record | None:
    """Row by id including soft-deleted (for idempotent DELETE)."""
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM swot_analyses
            WHERE id = $1
            """,
            analysis_id,
        )


async def _fetch_swot_factors(
    db_pool: asyncpg.Pool,
    analysis_id: UUID,
) -> list[dict[str, Any]]:
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM swot_factors
            WHERE swot_analysis_id = $1
              AND deleted_at IS NULL
            ORDER BY priority_score DESC, created_at ASC
            """,
            analysis_id,
        )
    return [normalize_swot_factor(row) for row in rows]


async def _create_swot_analysis(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    title: str,
    description: str | None,
    executive_summary: str | None,
    company_name: str | None,
    industry: str | None,
    factors_by_type: dict[str, list[SWOTFactorInput | dict[str, Any]]],
    ai_generated: bool = False,
    ai_insights_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    strengths = list(factors_by_type.get("strength", []))
    weaknesses = list(factors_by_type.get("weakness", []))
    opportunities = list(factors_by_type.get("opportunity", []))
    threats = list(factors_by_type.get("threat", []))

    async with db_pool.acquire() as conn, conn.transaction():
        analysis = await conn.fetchrow(
            """
            INSERT INTO swot_analyses (
                project_id,
                company_id,
                created_by,
                title,
                description,
                company_name,
                industry,
                status,
                strengths_count,
                weaknesses_count,
                opportunities_count,
                threats_count,
                executive_summary,
                ai_insights,
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
                'completed'::analysis_status,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13::jsonb,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            project_id,
            company_id,
            user_id,
            title,
            description,
            company_name,
            industry,
            len(strengths),
            len(weaknesses),
            len(opportunities),
            len(threats),
            executive_summary,
            json.dumps({"ai_generated": ai_generated, **(ai_insights_extra or {})}),
        )

        if analysis is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось создать SWOT-анализ"
            )

        for factor_type, items in (
            ("strength", strengths),
            ("weakness", weaknesses),
            ("opportunity", opportunities),
            ("threat", threats),
        ):
            for raw_item in items:
                item = raw_item if isinstance(raw_item, dict) else raw_item.model_dump()
                factor_text = str(item.get("factor_text") or "").strip()
                if not factor_text:
                    continue
                await conn.execute(
                    """
                    INSERT INTO swot_factors (
                        swot_analysis_id,
                        created_by,
                        factor_type,
                        factor_text,
                        description,
                        impact_level,
                        priority_score,
                        ai_generated,
                        confidence_score,
                        ai_reasoning,
                        created_at,
                        updated_at
                    ) VALUES (
                        $1,
                        $2,
                        $3::swot_factor_type,
                        $4,
                        $5,
                        $6::impact_level,
                        $7,
                        $8,
                        $9,
                        $10,
                        NOW(),
                        NOW()
                    )
                    """,
                    analysis["id"],
                    user_id,
                    factor_type,
                    factor_text,
                    item.get("description"),
                    _normalize_impact_level_for_storage(item.get("impact_level")),
                    item.get("priority_score") or 0,
                    ai_generated,
                    item.get("confidence_score"),
                    item.get("ai_reasoning"),
                )

    factors = await _fetch_swot_factors(db_pool, analysis["id"])
    return normalize_swot_analysis(analysis, factors)


@router.get("/swot", response_model=MarketingSwotListResponse)
async def list_swot_analyses(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingSwotListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            """
            SELECT COUNT(*)::int AS count
            FROM swot_analyses
            WHERE project_id = $1 AND deleted_at IS NULL
            """,
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(
            """
            SELECT *
            FROM swot_analyses
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2 OFFSET $3
            """,
            project_id,
            effective_limit,
            effective_offset,
        )

    items = [normalize_swot_analysis(row) for row in rows]
    return MarketingSwotListResponse.model_validate({"items": items, "total": total})


@router.delete("/swot/{analysis_id}", status_code=status.HTTP_200_OK, response_model=DeleteSwotAnalysisResponse)
async def delete_swot_analysis(
    analysis_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteSwotAnalysisResponse:
    row = await _fetch_swot_any(db_pool, analysis_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SWOT-анализ не найден")
    await get_accessible_project(db_pool, row["project_id"], user_id, for_mutation=True, required_mc_module="swot")

    if row["deleted_at"] is not None:
        return DeleteSwotAnalysisResponse.model_validate(
            {"message": "SWOT analysis already deleted", "analysis_id": str(analysis_id)}
        )

    async with db_pool.acquire() as conn, conn.transaction():
        await conn.execute(
            """
                UPDATE swot_factors
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE swot_analysis_id = $1
                  AND deleted_at IS NULL
                """,
            analysis_id,
        )
        await conn.execute(
            """
                UPDATE swot_analyses
                SET deleted_at = NOW(), updated_at = NOW()
                WHERE id = $1
                  AND deleted_at IS NULL
                """,
            analysis_id,
        )

    return DeleteSwotAnalysisResponse.model_validate(
        {"message": "SWOT analysis deleted", "analysis_id": str(analysis_id)}
    )


@router.get("/swot/{analysis_id}", response_model=MarketingSwotOut)
async def get_swot_analysis(
    analysis_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingSwotOut:
    row = await _fetch_swot(db_pool, analysis_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SWOT-анализ не найден")
    await get_accessible_project(db_pool, row["project_id"], user_id)
    factors = await _fetch_swot_factors(db_pool, analysis_id)
    return MarketingSwotOut.model_validate(normalize_swot_analysis(row, factors))


_FACTOR_KEY_TO_DB: dict[str, str] = {
    "strengths": "strength",
    "weaknesses": "weakness",
    "opportunities": "opportunity",
    "threats": "threat",
}


@router.patch("/swot/{analysis_id}", response_model=MarketingSwotOut)
async def update_swot_analysis(
    analysis_id: UUID,
    payload: SWOTUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingSwotOut:
    row = await _fetch_swot(db_pool, analysis_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SWOT-анализ не найден")
    await get_accessible_project(db_pool, row["project_id"], user_id, for_mutation=True, required_mc_module="swot")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        factors = await _fetch_swot_factors(db_pool, analysis_id)
        return MarketingSwotOut.model_validate(normalize_swot_analysis(row, factors))

    factor_updates = {k: data.pop(k) for k in list(data.keys()) if k in _FACTOR_KEY_TO_DB}

    async with db_pool.acquire() as conn, conn.transaction():
        for _list_key, items in factor_updates.items():
            db_type = _FACTOR_KEY_TO_DB[_list_key]
            await conn.execute(
                """
                    UPDATE swot_factors
                    SET deleted_at = NOW(), updated_at = NOW()
                    WHERE swot_analysis_id = $1
                      AND factor_type = $2::swot_factor_type
                      AND deleted_at IS NULL
                    """,
                analysis_id,
                db_type,
            )
            for raw in items or []:
                item = raw if isinstance(raw, dict) else raw.model_dump()
                await conn.execute(
                    """
                        INSERT INTO swot_factors (
                            swot_analysis_id, created_by, factor_type, factor_text,
                            description, impact_level, priority_score, ai_generated,
                            confidence_score, ai_reasoning, created_at, updated_at
                        ) VALUES (
                            $1, $2, $3::swot_factor_type, $4, $5, $6::impact_level,
                            $7, $8, $9, $10, NOW(), NOW()
                        )
                        """,
                    analysis_id,
                    user_id,
                    db_type,
                    item["factor_text"],
                    item.get("description"),
                    _normalize_impact_level_for_storage(item.get("impact_level")),
                    item.get("priority_score") or 0,
                    False,
                    item.get("confidence_score"),
                    item.get("ai_reasoning"),
                )

        set_parts: list[str] = []
        params: list[Any] = []

        def add_param(val: Any) -> int:
            params.append(val)
            return len(params)

        for col in ("title", "description", "executive_summary", "company_name", "industry"):
            if col in data:
                i = add_param(data[col])
                set_parts.append(f"{col} = ${i}")

        if factor_updates:
            counts = await conn.fetchrow(
                """
                    SELECT
                        COUNT(*) FILTER (WHERE factor_type = 'strength' AND deleted_at IS NULL) AS sc,
                        COUNT(*) FILTER (WHERE factor_type = 'weakness' AND deleted_at IS NULL) AS wc,
                        COUNT(*) FILTER (WHERE factor_type = 'opportunity' AND deleted_at IS NULL) AS oc,
                        COUNT(*) FILTER (WHERE factor_type = 'threat' AND deleted_at IS NULL) AS tc
                    FROM swot_factors
                    WHERE swot_analysis_id = $1
                    """,
                analysis_id,
            )
            if counts:
                for col_name, key in (
                    ("strengths_count", "sc"),
                    ("weaknesses_count", "wc"),
                    ("opportunities_count", "oc"),
                    ("threats_count", "tc"),
                ):
                    i = add_param(int(counts[key] or 0))
                    set_parts.append(f"{col_name} = ${i}")

        if set_parts or factor_updates:
            set_parts.append("updated_at = NOW()")
            wid = add_param(analysis_id)
            await conn.execute(
                f"""
                    UPDATE swot_analyses
                    SET {", ".join(set_parts)}
                    WHERE id = ${wid} AND deleted_at IS NULL
                    """,  # noqa: S608
                *params,
            )

        updated = await conn.fetchrow(
            """
                SELECT * FROM swot_analyses WHERE id = $1 AND deleted_at IS NULL
                """,
            analysis_id,
        )

    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SWOT-анализ не найден")
    factors = await _fetch_swot_factors(db_pool, analysis_id)
    return MarketingSwotOut.model_validate(normalize_swot_analysis(updated, factors))


def _extract_generation_text(payload: dict[str, Any]) -> str:
    return MarketingCabinetAIService._extract_text(payload)


def _build_swot_generate_prompt(
    context: dict[str, Any],
    payload: SWOTGenerateRequest,
    *,
    prompt_context_override: str | None = None,
) -> tuple[str, str]:
    prompt_context = (
        prompt_context_override if prompt_context_override is not None else format_project_context_for_prompt(context)
    )
    prompt = (
        "Ты senior strategic analyst для маркетингового кабинета EliteEW.\n"
        "Собери SWOT-анализ только на основе переданного контекста проекта.\n"
        "Ответ — JSON-объект с ключами: title, executive_summary, strengths, weaknesses, opportunities, threats.\n"
        "Во всех текстовых полях пиши по-русски.\n"
        "Каждый элемент в массивах факторов должен содержать factor_text, description, impact_level (low|medium|high|critical), priority_score.\n\n"
        f"Контекст проекта:\n{prompt_context}\n\n"
        f"Дополнительный контекст аналитика:\n{payload.context or 'Дополнительный контекст не указан.'}\n"
    )
    return prompt, prompt_context


def _parse_swot_generation_payload(raw_output: str) -> dict[str, Any]:
    parsed = extract_json_payload(raw_output)
    if not isinstance(parsed, dict):
        raise ValueError("Expected JSON object")
    return parsed


async def _create_swot_from_parsed_payload(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    project_context: dict[str, Any],
    user_id: UUID,
    payload_context: str | None,
    parsed: dict[str, Any],
    ai_insights_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    project = project_context["project"]
    return await _create_swot_analysis(
        db_pool,
        project_id=project_id,
        company_id=UUID(project["company_id"]),
        user_id=user_id,
        title=str(parsed.get("title") or f"SWOT for {project['name']}")[:255],
        description=payload_context,
        executive_summary=str(parsed.get("executive_summary") or "").strip() or None,
        company_name=project.get("company_name"),
        industry=project.get("company_industry"),
        factors_by_type={
            "strength": list(parsed.get("strengths") or []),
            "weakness": list(parsed.get("weaknesses") or []),
            "opportunity": list(parsed.get("opportunities") or []),
            "threat": list(parsed.get("threats") or []),
        },
        ai_generated=True,
        ai_insights_extra=ai_insights_extra,
    )


@router.post("/swot", status_code=status.HTTP_201_CREATED, response_model=MarketingSwotOut)
async def create_swot_analysis(
    payload: SWOTCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingSwotOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="swot"
    )
    return MarketingSwotOut.model_validate(
        await _create_swot_analysis(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            executive_summary=payload.executive_summary,
            company_name=payload.company_name or project.get("company_name"),
            industry=payload.industry or project.get("company_industry"),
            factors_by_type={
                "strength": payload.strengths,
                "weakness": payload.weaknesses,
                "opportunity": payload.opportunities,
                "threat": payload.threats,
            },
            ai_generated=False,
        )
    )


@router.post("/swot/generate/async", status_code=status.HTTP_202_ACCEPTED, response_model=MarketingAiAsyncStartResponse)
async def start_generate_swot_analysis_async(
    payload: SWOTGenerateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingAiAsyncStartResponse:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )

    await get_accessible_project(db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="swot")
    context = await build_project_context(db_pool, payload.project_id, user_id)
    await ensure_marketing_idempotency("swot_generate_async", payload.idempotency_key, user_id=user_id)
    base_ctx = format_project_context_for_prompt(context)
    proj = context.get("project") or {}
    rag_q = f"{payload.context or ''} {proj.get('name') or ''}".strip()
    enriched_ctx = await merge_project_context_text_with_rag(
        db_pool,
        project_id=payload.project_id,
        user_id=user_id,
        query=rag_q or str(proj.get("name") or ""),
        context_text=base_ctx,
    )
    prompt, prompt_context = _build_swot_generate_prompt(context, payload, prompt_context_override=enriched_ctx)
    swot_input_data: dict[str, Any] = {
        "prompt": prompt,
        "options": {"temperature": 0.25, "num_predict": 3200},
        "json_format": True,
    }
    try:
        start_payload = await ai_service.ugs_service.start_generation_for_stream(
            user_id=str(user_id),
            type_key=_MARKETING_SWOT_GENERATION_TYPE_KEY,
            input_data=swot_input_data,
            project_id=str(payload.project_id),
            company_id=str(context["project"]["company_id"]),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to start SWOT generation with UGS: {exc}",
        ) from exc

    initial_status = str(start_payload.get("status") or "processing")
    request_id = start_payload.get("request_id")
    prompt_excerpt = payload.context or prompt_context[:800]

    if start_payload.get("cached") and initial_status == "completed":
        raw_output = _extract_generation_text(start_payload)
        parsed = _parse_swot_generation_payload(raw_output)
        created = await _create_swot_from_parsed_payload(
            db_pool,
            project_id=payload.project_id,
            project_context=context,
            user_id=user_id,
            payload_context=payload.context,
            parsed=parsed,
        )
        run = await record_marketing_ai_run(
            db_pool,
            project_id=payload.project_id,
            company_id=context["project"]["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key="swot_generate",
            status_value="completed",
            prompt_excerpt=prompt_excerpt,
            result_excerpt=raw_output or json.dumps(parsed)[:2000],
            metadata={
                "result_type": "swot_generate",
                "result_payload": created,
                "analysis_id": created["id"],
            },
        )
        return MarketingAiAsyncStartResponse.model_validate({"run": run, "poll_after_ms": 0, "queue": None})

    if not request_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UGS не вернул request_id для SWOT generation",
        )

    run = await record_marketing_ai_run(
        db_pool,
        project_id=payload.project_id,
        company_id=context["project"]["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key="swot_generate",
        status_value=initial_status if initial_status in {"queued", "processing"} else "processing",
        prompt_excerpt=prompt_excerpt,
        result_excerpt="",
        metadata={
            "result_type": "swot_generate",
            "async_job": {
                "kind": "swot_generate",
                "payload_context": payload.context,
            },
        },
        finish_run=False,
    )
    return MarketingAiAsyncStartResponse.model_validate(
        {
            "run": run,
            "poll_after_ms": 2000,
            "queue": await build_marketing_queue_snapshot(ai_service, status_value=initial_status),
        }
    )


@router.post("/swot/generate", status_code=status.HTTP_201_CREATED, response_model=MarketingSwotOut)
async def generate_swot_analysis(
    payload: SWOTGenerateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingSwotOut:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )

    await get_accessible_project(db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="swot")
    context = await build_project_context(db_pool, payload.project_id, user_id)
    await ensure_marketing_idempotency(
        "swot_generate",
        payload.idempotency_key,
        user_id=user_id,
    )
    base_ctx = format_project_context_for_prompt(context)
    proj = context.get("project") or {}
    rag_q = f"{payload.context or ''} {proj.get('name') or ''}".strip()
    enriched_ctx = await merge_project_context_text_with_rag(
        db_pool,
        project_id=payload.project_id,
        user_id=user_id,
        query=rag_q or str(proj.get("name") or ""),
        context_text=base_ctx,
    )
    prompt, prompt_context = _build_swot_generate_prompt(context, payload, prompt_context_override=enriched_ctx)
    raw_output = ""
    request_id: str | None = None

    try:
        result = await ai_service.generate_text(
            user_id=str(user_id),
            prompt=prompt,
            project_id=str(payload.project_id),
            company_id=str(context["project"]["company_id"]),
            temperature=0.25,
            max_tokens=3200,
            type_key=_MARKETING_SWOT_GENERATION_TYPE_KEY,
            json_format=True,
        )
        raw_output = result.get("text") or ""
        request_id = result.get("request_id")
        parsed = _parse_swot_generation_payload(raw_output)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate SWOT with UGS: {exc}",
        ) from exc

    created = await _create_swot_from_parsed_payload(
        db_pool,
        project_id=payload.project_id,
        project_context=context,
        user_id=user_id,
        payload_context=payload.context,
        parsed=parsed,
    )
    await record_marketing_ai_run(
        db_pool,
        project_id=payload.project_id,
        company_id=context["project"]["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key="swot_generate",
        status_value="completed",
        prompt_excerpt=payload.context or prompt_context[:800],
        result_excerpt=raw_output or json.dumps(parsed)[:2000],
        metadata={"analysis_id": created["id"]},
    )
    return MarketingSwotOut.model_validate(created)
