# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/researches.py`: эндпоинты и контракт — в коде
#   и OpenAPI.
# Invariants:
#   - Async research run sets processing only after marketing_ai_runs is registered.
#   - list_researches reconciles stale processing rows via research_run_reconciliation.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

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
    assert_project_marketing_lead,
    build_project_context,
    format_project_context_for_prompt,
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_research,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.routers.marketing_cabinet.research_run_reconciliation import (
    enrich_research_items_with_active_ai_run,
    reconcile_research_projects_for_project,
)
from api.schemas.marketing_cabinet import (
    DeleteResearchResponse,
    MarketingAiAsyncStartResponse,
    MarketingResearchListResponse,
    MarketingResearchOut,
    ResearchTypesResponse,
)
from api.schemas.marketing_web_search import WebSearchQuality
from api.services.marketing_cabinet.research_type_catalog import (
    build_evidence_research_run_prompt,
    coerce_research_type_value,
    list_research_types_for_cabinet,
    validate_research_type_enum,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import merge_project_context_text_with_rag
from api.services.marketing_web_search_context import (
    resolve_marketing_kbsew_context,
    resolve_marketing_web_search_context,
)

router = APIRouter(prefix="/researches", tags=["Marketing Cabinet - Researches"])

# Must match PostgreSQL enum research_status (see marketing cabinet schema / SQLAlchemy ResearchStatus).
RESEARCH_STATUS_DB_VALUES = frozenset(
    {
        "draft",
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled",
    }
)
# UI / legacy synonyms → DB enum
RESEARCH_STATUS_ALIASES = {
    "active": "processing",
    "archived": "cancelled",
    "in_progress": "processing",
    "running": "processing",
}

_coerce_research_type_value = coerce_research_type_value
_validate_research_type_enum = validate_research_type_enum

RESEARCH_PRIORITY_DB_VALUES = frozenset({"low", "normal", "high", "urgent"})
RESEARCH_PRIORITY_ALIASES = {
    "critical": "urgent",
    "medium": "normal",
}


def _coerce_research_priority_value(value: object) -> object:
    if value is None or not isinstance(value, str):
        return value
    key = value.strip().lower().replace("-", "_").replace(" ", "_")
    return RESEARCH_PRIORITY_ALIASES.get(key, key)


def _validate_research_priority_enum(value: str) -> str:
    if value not in RESEARCH_PRIORITY_DB_VALUES:
        allowed = ", ".join(sorted(RESEARCH_PRIORITY_DB_VALUES))
        msg = f"Invalid research priority '{value}'. Allowed: {allowed}"
        raise ValueError(msg)
    return value


def _coerce_research_status_value(value: object) -> object:
    if value is None or not isinstance(value, str):
        return value
    key = value.strip().lower().replace("-", "_").replace(" ", "_")
    return RESEARCH_STATUS_ALIASES.get(key, key)


def _validate_research_status_enum(value: str) -> str:
    if value not in RESEARCH_STATUS_DB_VALUES:
        allowed = ", ".join(sorted(RESEARCH_STATUS_DB_VALUES))
        msg = f"Invalid research status '{value}'. Allowed: {allowed}"
        raise ValueError(msg)
    return value


def normalize_research_status_for_db(value: object) -> str:
    normalized = _coerce_research_status_value(value)
    if not isinstance(normalized, str):
        msg = f"Invalid research status '{value}'. Expected string-compatible value."
        raise ValueError(msg)
    return _validate_research_status_enum(normalized)


class ResearchCreateRequest(BaseModel):
    project_id: UUID
    title: str = Field(..., min_length=3, max_length=500)
    research_type: str = Field(default="market")
    research_query: str = Field(..., min_length=3)
    description: str | None = None
    goals: list[str] = Field(default_factory=list)
    priority: str = Field(default="normal")
    status: str = Field(default="draft")
    result_summary: str | None = None
    result_content_id: UUID | None = None

    @field_validator("research_type", mode="before")
    @classmethod
    def research_type_normalize_create(cls, v: object) -> object:
        return _coerce_research_type_value(v)

    @field_validator("research_type")
    @classmethod
    def research_type_validate_create(cls, v: str) -> str:
        return _validate_research_type_enum(v)

    @field_validator("priority", mode="before")
    @classmethod
    def research_priority_normalize_create(cls, v: object) -> object:
        return _coerce_research_priority_value(v)

    @field_validator("priority")
    @classmethod
    def research_priority_validate_create(cls, v: str) -> str:
        return _validate_research_priority_enum(v)

    @field_validator("status", mode="before")
    @classmethod
    def research_status_normalize_create(cls, v: object) -> object:
        return _coerce_research_status_value(v)

    @field_validator("status")
    @classmethod
    def research_status_validate_create(cls, v: str) -> str:
        return _validate_research_status_enum(v)


class ResearchUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=500)
    research_type: str | None = None
    research_query: str | None = None
    description: str | None = None
    goals: list[str] | None = None
    priority: str | None = None
    status: str | None = None
    result_summary: str | None = None
    result_content_id: UUID | None = None

    @field_validator("research_type", mode="before")
    @classmethod
    def research_type_normalize_update(cls, v: object) -> object:
        return _coerce_research_type_value(v)

    @field_validator("research_type")
    @classmethod
    def research_type_validate_update(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _validate_research_type_enum(v)

    @field_validator("priority", mode="before")
    @classmethod
    def research_priority_normalize_update(cls, v: object) -> object:
        return _coerce_research_priority_value(v)

    @field_validator("priority")
    @classmethod
    def research_priority_validate_update(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _validate_research_priority_enum(v)

    @field_validator("status", mode="before")
    @classmethod
    def research_status_normalize_update(cls, v: object) -> object:
        return _coerce_research_status_value(v)

    @field_validator("status")
    @classmethod
    def research_status_validate_update(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _validate_research_status_enum(v)

    @field_validator("research_query", mode="before")
    @classmethod
    def research_query_empty_to_none(cls, v: object) -> object:
        """Пустая строка → не обновляем поле (None); иначе min_length ниже."""
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return v.strip() if isinstance(v, str) else v

    @field_validator("research_query")
    @classmethod
    def research_query_min_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 3:
            msg = "research_query must be at least 3 characters when set"
            raise ValueError(msg)
        return v


class ResearchRunRequest(BaseModel):
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)
    model: str | None = None
    max_tokens: int = Field(default=2500, ge=128, le=12000)
    use_web_search: bool = False
    web_search_quality: WebSearchQuality = "off"


def _build_research_run_prompt(existing: dict[str, Any], context_text: str) -> str:
    return build_evidence_research_run_prompt(existing, context_text)


async def _research_prompt_with_optional_web_search(
    *,
    prompt: str,
    research_query: str,
    use_web_search: bool,
    web_search_quality: str | None,
    user_id: UUID,
    ai_service: MarketingCabinetAIService,
) -> str:
    web_block = await resolve_marketing_web_search_context(
        query=research_query,
        use_web_search=use_web_search,
        web_search_quality=web_search_quality,
        user_id=str(user_id),
        db=ai_service.ugs_service.db,
        log_prefix="marketing.research_run.web_search",
    )
    kbsew_block = await resolve_marketing_kbsew_context(
        query=research_query,
        db=ai_service.ugs_service.db,
    )
    out = prompt
    if web_block:
        out = f"{out}\n\n## Срез из веб-поиска (live search для этого запуска)\n{web_block}"
    if kbsew_block:
        out = f"{out}\n\n## KBSEW knowledge base\n{kbsew_block}"
    return out


def _extract_research_generation_text(payload: dict[str, Any]) -> str:
    return MarketingCabinetAIService._extract_text(payload)


async def _fetch_research(db_pool: asyncpg.Pool, research_id: UUID) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM research_projects
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            research_id,
        )


@router.get("/types", response_model=ResearchTypesResponse)
async def list_research_types(
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008, ARG001
) -> ResearchTypesResponse:
    return ResearchTypesResponse.model_validate({"items": list_research_types_for_cabinet()})


@router.get("", response_model=MarketingResearchListResponse)
async def list_researches(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingResearchListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    await reconcile_research_projects_for_project(
        db_pool,
        project_id=project_id,
        ai_service=ai_service,
    )

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    query = """
        SELECT *
        FROM research_projects
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
            FROM research_projects
            WHERE project_id = $1 AND deleted_at IS NULL
            """,
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(query, *params)

    items = [normalize_research(row) for row in rows]
    items = await enrich_research_items_with_active_ai_run(db_pool, items)
    return MarketingResearchListResponse.model_validate({"items": items, "total": total})


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MarketingResearchOut)
async def create_research(
    payload: ResearchCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingResearchOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="researches"
    )
    if payload.result_content_id is not None:
        await assert_project_marketing_lead(db_pool, payload.project_id, user_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO research_projects (
                project_id,
                company_id,
                created_by,
                research_type,
                title,
                description,
                research_query,
                goals,
                priority,
                status,
                result_content_id,
                result_summary,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4::research_type,
                $5,
                $6,
                $7,
                $8::text[],
                $9::research_priority,
                $10::research_status,
                $11,
                $12,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            payload.project_id,
            project["company_id"],
            user_id,
            payload.research_type,
            payload.title,
            payload.description,
            payload.research_query,
            payload.goals,
            payload.priority,
            payload.status,
            payload.result_content_id,
            payload.result_summary,
        )

    return MarketingResearchOut.model_validate(normalize_research(row))


@router.patch("/{research_id}", response_model=MarketingResearchOut)
async def update_research(
    research_id: UUID,
    payload: ResearchUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingResearchOut:
    existing = await _fetch_research(db_pool, research_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Исследование не найдено")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="researches"
    )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return MarketingResearchOut.model_validate(normalize_research(existing))

    if "result_content_id" in update_data:
        await assert_project_marketing_lead(db_pool, existing["project_id"], user_id)

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1

    field_types = {
        "research_type": "research_type",
        "priority": "research_priority",
        "status": "research_status",
    }

    for field in ("title", "description", "research_query", "result_content_id", "result_summary"):
        if field in update_data:
            set_parts.append(f"{field} = ${index}")
            params.append(update_data[field])
            index += 1

    for field, enum_type in field_types.items():
        if field in update_data:
            set_parts.append(f"{field} = ${index}::{enum_type}")
            params.append(update_data[field])
            index += 1

    if "goals" in update_data:
        set_parts.append(f"goals = ${index}::text[]")
        params.append(update_data["goals"] or [])
        index += 1

    set_parts.append("updated_at = NOW()")
    params.append(research_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE research_projects
            SET {", ".join(set_parts)}
            WHERE id = ${index}
              AND deleted_at IS NULL
            RETURNING *
            """,  # noqa: S608
            *params,
        )

    return MarketingResearchOut.model_validate(normalize_research(row))


@router.post(
    "/{research_id}/run/async",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=MarketingAiAsyncStartResponse,
)
async def run_research_async(
    research_id: UUID,
    payload: ResearchRunRequest,
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

    existing = await _fetch_research(db_pool, research_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Исследование не найдено")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="researches"
    )
    await ensure_marketing_idempotency(
        "research_run_async",
        payload.idempotency_key,
        user_id=user_id,
    )

    context = await build_project_context(db_pool, existing["project_id"], user_id)
    context_text = format_project_context_for_prompt(context)
    rq = str(existing.get("research_query") or existing.get("title") or "")
    context_text = await merge_project_context_text_with_rag(
        db_pool,
        project_id=existing["project_id"],
        user_id=user_id,
        query=rq,
        context_text=context_text,
    )
    prompt = _build_research_run_prompt(dict(existing), context_text)
    prompt = await _research_prompt_with_optional_web_search(
        prompt=prompt,
        research_query=rq,
        use_web_search=payload.use_web_search,
        web_search_quality=payload.web_search_quality,
        user_id=user_id,
        ai_service=ai_service,
    )

    input_data: dict[str, Any] = {
        "prompt": prompt,
        "options": {
            "temperature": 0.25,
            "num_predict": max(256, int(payload.max_tokens)),
        },
    }
    if payload.model:
        input_data["model"] = payload.model

    try:
        start_payload = await ai_service.ugs_service.start_generation_for_stream(
            user_id=str(user_id),
            type_key="text_chat",
            input_data=input_data,
            project_id=str(existing["project_id"]),
            company_id=str(existing["company_id"]),
        )
    except Exception as exc:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE research_projects
                SET status = 'failed'::research_status,
                    updated_at = NOW()
                WHERE id = $1
                  AND deleted_at IS NULL
                """,
                research_id,
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось поставить исследование в очередь UGS: {exc}",
        ) from exc

    initial_status = str(start_payload.get("status") or "processing")
    request_id = start_payload.get("request_id")
    prompt_excerpt = str(existing.get("research_query") or "")[:800]

    if start_payload.get("cached") and initial_status == "completed":
        result_summary = _extract_research_generation_text(start_payload).strip()
        if not result_summary:
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE research_projects
                    SET status = 'failed'::research_status,
                        updated_at = NOW()
                    WHERE id = $1
                      AND deleted_at IS NULL
                    """,
                    research_id,
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="UGS вернул пустой результат исследования (кэш)",
            )
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE research_projects
                SET
                    status = 'completed'::research_status,
                    result_summary = $2,
                    updated_at = NOW()
                WHERE id = $1
                  AND deleted_at IS NULL
                RETURNING *
                """,
                research_id,
                result_summary,
            )
        if row is None:
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE research_projects
                    SET status = 'failed'::research_status,
                        updated_at = NOW()
                    WHERE id = $1
                      AND deleted_at IS NULL
                    """,
                    research_id,
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Исследование не найдено после генерации",
            )
        research_out = normalize_research(row)
        run = await record_marketing_ai_run(
            db_pool,
            project_id=existing["project_id"],
            company_id=existing["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key="research_run",
            status_value="completed",
            prompt_excerpt=prompt_excerpt,
            result_excerpt=result_summary[:2000],
            metadata={
                "result_type": "research_run",
                "result_payload": research_out,
                "research_id": str(research_id),
            },
        )
        return MarketingAiAsyncStartResponse.model_validate({"run": run, "poll_after_ms": 0, "queue": None})

    if not request_id:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE research_projects
                SET status = 'failed'::research_status,
                    updated_at = NOW()
                WHERE id = $1
                  AND deleted_at IS NULL
                """,
                research_id,
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UGS не вернул request_id для исследования",
        )

    run = await record_marketing_ai_run(
        db_pool,
        project_id=existing["project_id"],
        company_id=existing["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key="research_run",
        status_value=initial_status if initial_status in {"queued", "processing"} else "processing",
        prompt_excerpt=prompt_excerpt,
        result_excerpt="",
        metadata={
            "result_type": "research_run",
            "research_id": str(research_id),
            "async_job": {
                "kind": "research_run",
                "research_id": str(research_id),
            },
        },
        finish_run=False,
    )
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE research_projects
            SET status = 'processing'::research_status,
                updated_at = NOW()
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            research_id,
        )
    return MarketingAiAsyncStartResponse.model_validate(
        {
            "run": run,
            "poll_after_ms": 2000,
            "queue": await build_marketing_queue_snapshot(ai_service, status_value=initial_status),
        }
    )


@router.post("/{research_id}/run", response_model=MarketingResearchOut)
async def run_research(
    research_id: UUID,
    payload: ResearchRunRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingResearchOut:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )

    existing = await _fetch_research(db_pool, research_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Исследование не найдено")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="researches"
    )
    await ensure_marketing_idempotency(
        "research_run",
        payload.idempotency_key,
        user_id=user_id,
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE research_projects
            SET status = 'processing'::research_status,
                updated_at = NOW()
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            research_id,
        )

    context = await build_project_context(db_pool, existing["project_id"], user_id)
    context_text = format_project_context_for_prompt(context)
    rq = str(existing.get("research_query") or existing.get("title") or "")
    context_text = await merge_project_context_text_with_rag(
        db_pool,
        project_id=existing["project_id"],
        user_id=user_id,
        query=rq,
        context_text=context_text,
    )
    prompt = _build_research_run_prompt(dict(existing), context_text)
    prompt = await _research_prompt_with_optional_web_search(
        prompt=prompt,
        research_query=rq,
        use_web_search=payload.use_web_search,
        web_search_quality=payload.web_search_quality,
        user_id=user_id,
        ai_service=ai_service,
    )
    request_id: str | None = None
    try:
        result = await ai_service.generate_text(
            user_id=str(user_id),
            prompt=prompt,
            project_id=str(existing["project_id"]),
            company_id=str(existing["company_id"]),
            model=payload.model,
            max_tokens=payload.max_tokens,
            type_key="text_chat",
        )
        request_id = result.get("request_id")
        result_summary = str(result.get("text") or "").strip()
        if not result_summary:
            raise ValueError("UGS вернул пустой результат исследования")
    except Exception as exc:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE research_projects
                SET status = 'failed'::research_status,
                    updated_at = NOW()
                WHERE id = $1
                  AND deleted_at IS NULL
                """,
                research_id,
            )
        await record_marketing_ai_run(
            db_pool,
            project_id=existing["project_id"],
            company_id=existing["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key="research_run",
            status_value="failed",
            prompt_excerpt=str(existing.get("research_query") or "")[:800],
            result_excerpt=str(exc),
            metadata={"research_id": str(research_id), "error": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось выполнить исследование через UGS: {exc}",
        ) from exc

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE research_projects
            SET
                status = 'completed'::research_status,
                result_summary = $2,
                updated_at = NOW()
            WHERE id = $1
              AND deleted_at IS NULL
            RETURNING *
            """,
            research_id,
            result_summary,
        )

    await record_marketing_ai_run(
        db_pool,
        project_id=existing["project_id"],
        company_id=existing["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key="research_run",
        status_value="completed",
        prompt_excerpt=str(existing.get("research_query") or "")[:800],
        result_excerpt=result_summary[:2000],
        metadata={"research_id": str(research_id)},
    )

    return MarketingResearchOut.model_validate(normalize_research(row))


@router.delete("/{research_id}", status_code=status.HTTP_200_OK, response_model=DeleteResearchResponse)
async def delete_research(
    research_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteResearchResponse:
    existing = await _fetch_research(db_pool, research_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Исследование не найдено")

    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="researches"
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE research_projects
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            research_id,
        )

    return DeleteResearchResponse.model_validate({"message": "Исследование удалено", "research_id": str(research_id)})
