# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/jtbd.py`: эндпоинты и контракт — в коде и
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
import structlog  # type: ignore[import-not-found]
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
    importance_score_api_to_db,
    normalize_job_story,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.schemas.marketing_cabinet import (
    DeleteJobStoryResponse,
    MarketingAiAsyncStartResponse,
    MarketingJobStoryListResponse,
    MarketingJobStoryOut,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import merge_project_context_text_with_rag

_MARKETING_JTBD_EXTRACT_TYPE_KEY = "marketing_jtbd_extract"

router = APIRouter(prefix="/jtbd", tags=["Marketing Cabinet - JTBD"])
logger = structlog.get_logger("api.routers.marketing_cabinet.jtbd")

JOB_CATEGORY_DB_VALUES = frozenset({"functional", "emotional", "social", "hybrid"})
JOB_PRIORITY_DB_VALUES = frozenset({"low", "medium", "high", "critical"})

# LLM / document extractors often emit labels outside the Postgres enum; map before INSERT.
_JOB_CATEGORY_SYNONYMS: dict[str, str] = {
    "strategic": "functional",
    "tactical": "functional",
    "transactional": "functional",
    "operational": "functional",
    "practical": "functional",
    "core": "functional",
    "aspirational": "emotional",
    "identity": "emotional",
    "personal": "emotional",
    "status": "social",
    "reputation": "social",
    "relational": "social",
    "blended": "hybrid",
    "mixed": "hybrid",
    "complex": "hybrid",
    "multi-dimensional": "hybrid",
    "multidimensional": "hybrid",
}

_JOB_PRIORITY_SYNONYMS: dict[str, str] = {
    "normal": "medium",
    "moderate": "medium",
    "avg": "medium",
    "average": "medium",
    "urgent": "high",
    "asap": "high",
    "highest": "critical",
    "top": "critical",
    "p1": "critical",
    "optional": "low",
    "minor": "low",
}


def normalize_job_category_for_db(value: str | None) -> str:
    """Coerce free-text or LLM category to a value accepted by job_category enum."""
    if value is None or not str(value).strip():
        return "functional"
    key = str(value).strip().lower()
    if key in _JOB_CATEGORY_SYNONYMS:
        return _JOB_CATEGORY_SYNONYMS[key]
    if key in JOB_CATEGORY_DB_VALUES:
        return key
    logger.debug("jtbd_category_unmapped", raw=value)
    return "functional"


def normalize_job_priority_for_db(value: str | None) -> str:
    """Coerce free-text or LLM priority to a value accepted by job_priority enum."""
    if value is None or not str(value).strip():
        return "medium"
    key = str(value).strip().lower()
    if key in _JOB_PRIORITY_SYNONYMS:
        return _JOB_PRIORITY_SYNONYMS[key]
    if key in JOB_PRIORITY_DB_VALUES:
        return key
    logger.debug("jtbd_priority_unmapped", raw=value)
    return "medium"


def _validate_job_category_enum(value: str) -> str:
    if value not in JOB_CATEGORY_DB_VALUES:
        allowed = ", ".join(sorted(JOB_CATEGORY_DB_VALUES))
        msg = f"Invalid JTBD category '{value}'. Allowed: {allowed}"
        raise ValueError(msg)
    return value


def _validate_job_priority_enum(value: str) -> str:
    if value not in JOB_PRIORITY_DB_VALUES:
        allowed = ", ".join(sorted(JOB_PRIORITY_DB_VALUES))
        msg = f"Invalid JTBD priority '{value}'. Allowed: {allowed}"
        raise ValueError(msg)
    return value


class JobStoryCreateRequest(BaseModel):
    project_id: UUID
    title: str = Field(..., min_length=3, max_length=255)
    situation: str = Field(..., min_length=3)
    motivation: str = Field(..., min_length=3)
    expected_outcome: str = Field(..., min_length=3)
    category: str = Field(default="functional")
    priority: str = Field(default="medium")
    importance_score: float | None = Field(default=None, ge=0, le=10)
    satisfaction_score: float | None = Field(default=None, ge=0, le=10)
    tags: list[str] = Field(default_factory=list)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return _validate_job_category_enum(value)

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        return _validate_job_priority_enum(value)


class JobStoryUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    situation: str | None = Field(default=None, min_length=3)
    motivation: str | None = Field(default=None, min_length=3)
    expected_outcome: str | None = Field(default=None, min_length=3)
    category: str | None = None
    priority: str | None = None
    importance_score: float | None = Field(default=None, ge=0, le=10)
    satisfaction_score: float | None = Field(default=None, ge=0, le=10)
    tags: list[str] | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_job_category_enum(value)

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_job_priority_enum(value)


class JobStoryExtractionRequest(BaseModel):
    project_id: UUID
    text: str = Field(..., min_length=100)
    max_stories: int = Field(default=6, ge=1, le=12)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)


async def _fetch_job_story(
    db_pool: asyncpg.Pool,
    story_id: UUID,
) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
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
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            story_id,
        )


async def _insert_job_story_with_connection(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    title: str,
    situation: str,
    motivation: str,
    outcome: str,
    category: str,
    priority: str,
    importance_score: float | None,
    satisfaction_score: float | None,
    tags: list[str],
    source: str,
    metadata_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata = {
        "title": title.strip(),
        **(metadata_extra or {}),
    }
    processing_data: dict[str, Any] = {}
    if satisfaction_score is not None:
        processing_data["satisfaction_score"] = satisfaction_score

    category_db = normalize_job_category_for_db(category)
    priority_db = normalize_job_priority_for_db(priority)

    # full_story is a GENERATED column in PostgreSQL — do not INSERT/UPDATE it.

    row = await conn.fetchrow(
        """
            INSERT INTO job_stories (
                project_id,
                company_id,
                created_by,
                situation,
                motivation,
                outcome,
                category,
                priority,
                tags,
                source,
                importance_score,
                metadata,
                processing_data,
                last_modified_by,
                last_modified_at,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7::job_category,
                $8::job_priority,
                $9::text[],
                $10::job_source,
                $11,
                $12::jsonb,
                $13::jsonb,
                $14,
                NOW(),
                NOW(),
                NOW()
            )
            RETURNING
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
            """,
        project_id,
        company_id,
        user_id,
        situation.strip(),
        motivation.strip(),
        outcome.strip(),
        category_db,
        priority_db,
        tags,
        source,
        importance_score_api_to_db(importance_score),
        json.dumps(metadata),
        json.dumps(processing_data),
        user_id,
    )

    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось создать job story")
    return normalize_job_story(row)


async def _insert_job_story(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    title: str,
    situation: str,
    motivation: str,
    outcome: str,
    category: str,
    priority: str,
    importance_score: float | None,
    satisfaction_score: float | None,
    tags: list[str],
    source: str,
    metadata_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    async with db_pool.acquire() as conn:
        return await _insert_job_story_with_connection(
            conn,
            project_id=project_id,
            company_id=company_id,
            user_id=user_id,
            title=title,
            situation=situation,
            motivation=motivation,
            outcome=outcome,
            category=category,
            priority=priority,
            importance_score=importance_score,
            satisfaction_score=satisfaction_score,
            tags=tags,
            source=source,
            metadata_extra=metadata_extra,
        )


def _extract_generation_text(payload: dict[str, Any]) -> str:
    return MarketingCabinetAIService._extract_text(payload)


def _parse_extracted_job_items(
    *,
    raw_output: str,
    max_stories: int,
) -> tuple[list[dict[str, Any]], bool]:
    try:
        parsed = extract_json_payload(raw_output)
        items_raw: Any = parsed
        if isinstance(parsed, dict):
            items_raw = parsed.get("items")
        if not isinstance(items_raw, list):
            raise ValueError("Expected JSON object with items array or legacy JSON array")
        extracted_items = [item for item in items_raw if isinstance(item, dict)][:max_stories]
        if not extracted_items:
            raise ValueError("No items extracted")
        used_legacy_array = isinstance(parsed, list)
        return extracted_items, used_legacy_array
    except Exception as exc:  # noqa: BLE001
        raise ValueError("UGS вернул невалидный JSON для JTBD extraction") from exc


async def _create_job_stories_from_extracted_items(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    transcript_text: str,
    extracted_items: list[dict[str, Any]],
    source_ai_run_id: str | None = None,
) -> list[dict[str, Any]]:
    created_items: list[dict[str, Any]] = []
    async with db_pool.acquire() as conn, conn.transaction():
        for item in extracted_items:
            title = str(item.get("title") or item.get("situation") or "Инсайт из интервью").strip()[:255]
            situation = str(item.get("situation") or "").strip()
            motivation = str(item.get("motivation") or "").strip()
            outcome = str(item.get("outcome") or "").strip()
            if not situation or not motivation or not outcome:
                continue
            created_items.append(
                await _insert_job_story_with_connection(
                    conn,
                    project_id=project_id,
                    company_id=company_id,
                    user_id=user_id,
                    title=title,
                    situation=situation,
                    motivation=motivation,
                    outcome=outcome,
                    category=str(item.get("category") or "functional"),
                    priority=str(item.get("priority") or "medium"),
                    importance_score=float(item["importance_score"])
                    if item.get("importance_score") is not None
                    else None,
                    satisfaction_score=float(item["satisfaction_score"])
                    if item.get("satisfaction_score") is not None
                    else None,
                    tags=[str(tag) for tag in list(item.get("tags") or [])][:10],
                    source="interview",
                    metadata_extra={
                        "extracted_from": "ugs",
                        "transcript_excerpt": transcript_text[:500],
                        "source_ai_run_id": source_ai_run_id,
                    },
                )
            )
    return created_items


async def _jtbd_prompt_context_with_rag(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    transcript: str,
) -> str:
    full = await build_project_context(db_pool, project_id, user_id)
    base = format_project_context_for_prompt(full)
    return await merge_project_context_text_with_rag(
        db_pool,
        project_id=project_id,
        user_id=user_id,
        query=(transcript or "")[:2000],
        context_text=base,
    )


def _build_jtbd_extract_prompt(prompt_context_text: str, payload: JobStoryExtractionRequest) -> str:
    return (
        "Ты извлекаешь Jobs-To-Be-Done из интервью и исследований клиентов.\n"
        "Ответ — JSON-объект (сервер llama.cpp ограничивает синтаксис JSON) с ключами "
        "summary (опционально), warnings (опционально), items — массив максимум из "
        f"{payload.max_stories} элементов.\n"
        "Каждый элемент в items должен содержать: title, situation, motivation, outcome, category, priority, "
        "importance_score, satisfaction_score, tags.\n"
        "Во всех текстовых полях используй русский язык.\n"
        "category используй из functional/emotional/social/hybrid, priority из low/medium/high/critical.\n\n"
        f"Контекст проекта:\n{prompt_context_text}\n\n"
        f"Транскрипт:\n{payload.text}\n"
    )


@router.get("/job-stories", response_model=MarketingJobStoryListResponse)
async def list_job_stories(
    project_id: UUID = Query(..., description="Project UUID"),
    search: str | None = Query(None, min_length=2),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingJobStoryListResponse:
    await get_accessible_project(db_pool, project_id, user_id)

    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)

    query = """
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
          AND deleted_at IS NULL
    """
    params: list[Any] = [project_id]
    if search:
        query += """
          AND (
            situation ILIKE $2
            OR motivation ILIKE $2
            OR outcome ILIKE $2
            OR full_story ILIKE $2
          )
        """
        params.append(f"%{search}%")

    query += " ORDER BY updated_at DESC NULLS LAST, created_at DESC"

    count_query = "SELECT COUNT(*)::int AS count FROM job_stories WHERE project_id = $1 AND deleted_at IS NULL"
    count_params: list[Any] = [project_id]
    if search:
        count_params.append(f"%{search}%")
        count_query += " AND (situation ILIKE $2 OR motivation ILIKE $2 OR outcome ILIKE $2 OR full_story ILIKE $2)"
    param_offset = len(params) + 1
    query += f" LIMIT ${param_offset} OFFSET ${param_offset + 1}"
    params.extend([effective_limit, effective_offset])

    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(count_query, *count_params)
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(query, *params)

    items = [normalize_job_story(row) for row in rows]
    return MarketingJobStoryListResponse.model_validate({"items": items, "total": total})


@router.post("/job-stories", status_code=status.HTTP_201_CREATED, response_model=MarketingJobStoryOut)
async def create_job_story(
    payload: JobStoryCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingJobStoryOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="jtbd"
    )
    return MarketingJobStoryOut.model_validate(
        await _insert_job_story(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            title=payload.title,
            situation=payload.situation,
            motivation=payload.motivation,
            outcome=payload.expected_outcome,
            category=payload.category,
            priority=payload.priority,
            importance_score=payload.importance_score,
            satisfaction_score=payload.satisfaction_score,
            tags=payload.tags,
            source="manual",
        )
    )


@router.patch("/job-stories/{story_id}", response_model=MarketingJobStoryOut)
async def update_job_story(
    story_id: UUID,
    payload: JobStoryUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingJobStoryOut:
    story = await _fetch_job_story(db_pool, story_id)
    if story is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JTBD-история не найдена")

    await get_accessible_project(db_pool, story["project_id"], user_id, for_mutation=True, required_mc_module="jtbd")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return MarketingJobStoryOut.model_validate(normalize_job_story(story))

    if "expected_outcome" in updates:
        updates["outcome"] = updates.pop("expected_outcome")

    # full_story is GENERATED from situation/motivation/outcome — never SET it.

    set_clauses: list[str] = []
    params: list[Any] = []
    p = 1
    if "situation" in updates:
        set_clauses.append(f"situation = ${p}")
        params.append(updates["situation"].strip())
        p += 1
    if "motivation" in updates:
        set_clauses.append(f"motivation = ${p}")
        params.append(updates["motivation"].strip())
        p += 1
    if "outcome" in updates:
        set_clauses.append(f"outcome = ${p}")
        params.append(updates["outcome"].strip())
        p += 1
    if "title" in updates:
        meta = story.get("metadata") or {}
        if isinstance(meta, str):
            meta = json.loads(meta) if meta else {}
        meta = dict(meta)
        meta["title"] = updates["title"].strip()
        set_clauses.append(f"metadata = ${p}::jsonb")
        params.append(json.dumps(meta))
        p += 1
    if "category" in updates:
        set_clauses.append(f"category = ${p}::job_category")
        params.append(updates["category"])
        p += 1
    if "priority" in updates:
        set_clauses.append(f"priority = ${p}::job_priority")
        params.append(updates["priority"])
        p += 1
    if "tags" in updates:
        set_clauses.append(f"tags = ${p}::text[]")
        params.append(updates["tags"])
        p += 1
    if "importance_score" in updates:
        set_clauses.append(f"importance_score = ${p}")
        params.append(importance_score_api_to_db(updates["importance_score"]))
        p += 1
    if "satisfaction_score" in updates:
        proc = story.get("processing_data") or {}
        if isinstance(proc, str):
            proc = json.loads(proc) if proc else {}
        proc = dict(proc)
        proc["satisfaction_score"] = updates["satisfaction_score"]
        set_clauses.append(f"processing_data = ${p}::jsonb")
        params.append(json.dumps(proc))
        p += 1

    if not set_clauses:
        return MarketingJobStoryOut.model_validate(normalize_job_story(story))

    set_clauses.append(f"last_modified_by = ${p}")
    params.append(user_id)
    p += 1
    set_clauses.append("last_modified_at = NOW()")
    set_clauses.append("updated_at = NOW()")
    params.append(story_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE job_stories
            SET {", ".join(set_clauses)}
            WHERE id = ${p} AND deleted_at IS NULL
            RETURNING
                id, project_id, company_id, situation, motivation, outcome, full_story,
                category::text AS category, priority::text AS priority, tags, source::text AS source,
                importance_score, quality_score, sentiment_score, is_validated, metadata, processing_data,
                created_at, updated_at,
                COALESCE((processing_data->>'satisfaction_score')::numeric, NULL) AS satisfaction_score,
                COALESCE(metadata->>'title', situation) AS title
            """,
            *params,
        )

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JTBD-история не найдена")
    return MarketingJobStoryOut.model_validate(normalize_job_story(row))


@router.delete("/job-stories/{story_id}", status_code=status.HTTP_200_OK, response_model=DeleteJobStoryResponse)
async def delete_job_story(
    story_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteJobStoryResponse:
    story = await _fetch_job_story(db_pool, story_id)
    if story is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="JTBD-история не найдена")

    await get_accessible_project(db_pool, story["project_id"], user_id, for_mutation=True, required_mc_module="jtbd")

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE job_stories
            SET deleted_at = NOW(), last_modified_by = $2, last_modified_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            story_id,
            user_id,
        )

    return DeleteJobStoryResponse.model_validate({"message": "Job story deleted", "story_id": str(story_id)})


@router.post("/extract/async", status_code=status.HTTP_202_ACCEPTED, response_model=MarketingAiAsyncStartResponse)
async def start_extract_job_stories_async(
    payload: JobStoryExtractionRequest,
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

    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="jtbd"
    )
    await ensure_marketing_idempotency("jtbd_extract_async", payload.idempotency_key, user_id=user_id)
    prompt_ctx = await _jtbd_prompt_context_with_rag(
        db_pool,
        project_id=payload.project_id,
        user_id=user_id,
        transcript=payload.text,
    )
    prompt = _build_jtbd_extract_prompt(prompt_ctx, payload)
    jtbd_input_data: dict[str, Any] = {
        "prompt": prompt,
        "options": {"temperature": 0.2, "num_predict": max(256, 2800)},
        "json_format": True,
    }
    try:
        start_payload = await ai_service.ugs_service.start_generation_for_stream(
            user_id=str(user_id),
            type_key=_MARKETING_JTBD_EXTRACT_TYPE_KEY,
            input_data=jtbd_input_data,
            project_id=str(payload.project_id),
            company_id=str(project["company_id"]),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось запустить JTBD extraction через UGS: {exc}",
        ) from exc

    initial_status = str(start_payload.get("status") or "processing")
    request_id = start_payload.get("request_id")
    prompt_excerpt = payload.text[:800]

    if start_payload.get("cached") and initial_status == "completed":
        raw_output = _extract_generation_text(start_payload)
        extracted_items, used_fallback = _parse_extracted_job_items(
            raw_output=raw_output,
            max_stories=payload.max_stories,
        )
        created_items = await _create_job_stories_from_extracted_items(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            transcript_text=payload.text,
            extracted_items=extracted_items,
        )
        if not created_items:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Из транскрипта не удалось извлечь валидные job stories",
            )
        run = await record_marketing_ai_run(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key="jtbd_extract",
            status_value="completed",
            prompt_excerpt=prompt_excerpt,
            result_excerpt=raw_output or json.dumps(extracted_items)[:2000],
            metadata={
                "result_type": "jtbd_extract",
                "result_payload": {
                    "items": created_items,
                    "total": len(created_items),
                },
                "created_items": len(created_items),
                "used_fallback": used_fallback,
            },
        )
        return MarketingAiAsyncStartResponse.model_validate({"run": run, "poll_after_ms": 0, "queue": None})

    if not request_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UGS не вернул request_id для JTBD extraction",
        )

    run = await record_marketing_ai_run(
        db_pool,
        project_id=payload.project_id,
        company_id=project["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key="jtbd_extract",
        status_value=initial_status if initial_status in {"queued", "processing"} else "processing",
        prompt_excerpt=prompt_excerpt,
        result_excerpt="",
        metadata={
            "result_type": "jtbd_extract",
            "async_job": {
                "kind": "jtbd_extract",
                "max_stories": payload.max_stories,
                "transcript_excerpt": payload.text[:500],
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


@router.post("/extract", status_code=status.HTTP_201_CREATED, response_model=MarketingJobStoryListResponse)
async def extract_job_stories(
    payload: JobStoryExtractionRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingJobStoryListResponse:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )

    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="jtbd"
    )
    await ensure_marketing_idempotency(
        "jtbd_extract",
        payload.idempotency_key,
        user_id=user_id,
    )
    prompt_ctx = await _jtbd_prompt_context_with_rag(
        db_pool,
        project_id=payload.project_id,
        user_id=user_id,
        transcript=payload.text,
    )
    prompt = _build_jtbd_extract_prompt(prompt_ctx, payload)

    extracted_items: list[dict[str, Any]]
    raw_output = ""
    request_id: str | None = None
    used_fallback = False
    try:
        result = await ai_service.generate_text(
            user_id=str(user_id),
            prompt=prompt,
            project_id=str(payload.project_id),
            company_id=str(project["company_id"]),
            temperature=0.2,
            max_tokens=2800,
            type_key=_MARKETING_JTBD_EXTRACT_TYPE_KEY,
            json_format=True,
        )
        raw_output = result.get("text") or ""
        request_id = result.get("request_id")
    except Exception as exc:
        await record_marketing_ai_run(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key="jtbd_extract",
            status_value="failed",
            prompt_excerpt=payload.text[:800],
            result_excerpt=str(exc),
            metadata={
                "result_type": "jtbd_extract",
                "error_message": str(exc),
                "error_kind": "generation_error",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось выполнить JTBD extraction через UGS: {exc}",
        ) from exc

    try:
        extracted_items, used_fallback = _parse_extracted_job_items(
            raw_output=raw_output,
            max_stories=payload.max_stories,
        )
    except ValueError as exc:
        await record_marketing_ai_run(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key="jtbd_extract",
            status_value="failed",
            prompt_excerpt=payload.text[:800],
            result_excerpt=raw_output[:2000] or str(exc),
            metadata={
                "result_type": "jtbd_extract",
                "error_message": str(exc),
                "error_kind": "invalid_ai_payload",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    created_items = await _create_job_stories_from_extracted_items(
        db_pool,
        project_id=payload.project_id,
        company_id=project["company_id"],
        user_id=user_id,
        transcript_text=payload.text,
        extracted_items=extracted_items,
    )

    if not created_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Из транскрипта не удалось извлечь валидные job stories",
        )

    await record_marketing_ai_run(
        db_pool,
        project_id=payload.project_id,
        company_id=project["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key="jtbd_extract",
        status_value="completed",
        prompt_excerpt=payload.text[:800],
        result_excerpt=raw_output or json.dumps(extracted_items)[:2000],
        metadata={
            "result_type": "jtbd_extract",
            "created_items": len(created_items),
            "used_fallback": used_fallback,
        },
    )
    return MarketingJobStoryListResponse.model_validate({"items": created_items, "total": len(created_items)})
