# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/ai.py`: эндпоинты и контракт — в коде и
#   OpenAPI (AI assist stream documents named text/event-stream payload, Wave B5b).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
#   - Assist SSE wire framing unchanged; OpenAPI names the JSON ``data:`` envelopes.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
#   - api/schemas/marketing_cabinet/sse.py
#   - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field, model_validator  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import get_postgres_session
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.routers.marketing_cabinet.ai_run_reconciliation import (
    reconcile_marketing_ai_run,
    reconcile_marketing_ai_run_rows,
)
from api.routers.marketing_cabinet.ai_support import (
    build_company_context_text,
    build_marketing_queue_snapshot,
    ensure_marketing_idempotency,
    fetch_marketing_ai_run_row,
    fetch_marketing_prompt_content,
)
from api.routers.marketing_cabinet.common import (
    build_project_context,
    format_project_context_for_prompt,
    get_accessible_company,
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_ai_run,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.schemas.marketing_cabinet import (
    MarketingAiAssistResponse,
    MarketingAiRunDetailResponse,
    MarketingAiRunListResponse,
)
from api.schemas.marketing_cabinet.sse import MarketingAiAssistStreamSsePayloadDoc
from api.schemas.marketing_web_search import WebSearchQuality
from api.services.marketing_cabinet.marketing_tool_agent_core import run_marketing_tool_agent_for_project
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import (
    merge_project_context_text_with_rag,
)
from api.services.marketing_web_search_context import (
    resolve_marketing_kbsew_context,
    resolve_marketing_web_search_context,
)

router = APIRouter(prefix="/ai", tags=["Marketing Cabinet - AI Studio"])
logger = logging.getLogger(__name__)

_MARKETING_AI_ASSIST_STREAM_RESPONSES = event_stream_openapi_responses(
    model=MarketingAiAssistStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `event: started|result|error` with named JSON "
        "`data:` (`MarketingAiAssistStreamSsePayloadDoc`); keep-alive comments while waiting."
    ),
)


class MarketingToolAgentRequest(BaseModel):
    """Llama router выбирает инструменты → сервер исполняет → ответ через UGS."""

    prompt: str = Field(..., min_length=4)
    project_id: UUID
    router_model: str = Field(
        default="",
        max_length=120,
        description="Пусто = MARKETING_CABINET_ROUTER_MODEL из .env.stack0.backend",
    )
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)
    chat_context_excerpt: str | None = Field(
        default=None,
        max_length=8000,
        description="Краткий контекст диалога (чат кабинета) — для синтеза и уточнения RAG.",
    )
    source: str | None = Field(
        default=None,
        max_length=32,
        description="Происхождение: chat | ai_studio — в metadata запуска.",
    )


class MarketingToolAgentResponse(BaseModel):
    output_text: str
    router_model: str
    planned_tools: list[dict[str, Any]]
    tool_traces: list[dict[str, Any]]
    run: dict[str, Any]


class MarketingAiAssistRequest(BaseModel):
    prompt: str = Field(..., min_length=4)
    tool_key: str = Field(default="general_analysis")
    project_id: UUID | None = None
    company_id: UUID | None = None
    content_id: UUID | None = None
    temperature: float = Field(default=0.3, ge=0, le=2)
    max_tokens: int = Field(default=3000, ge=128, le=12000)
    model: str | None = None
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)
    use_web_search: bool = False
    web_search_quality: WebSearchQuality = "off"

    @model_validator(mode="after")
    def validate_scope(self) -> MarketingAiAssistRequest:
        if self.project_id is None and self.company_id is None:
            raise ValueError("project_id или company_id обязательны")
        if self.project_id is not None and self.company_id is not None:
            raise ValueError("Нужно передать либо project_id, либо company_id")
        return MarketingAiAssistRequest.model_validate(self)


async def get_marketing_ai_service(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AsyncGenerator[MarketingCabinetAIService]:
    service = MarketingCabinetAIService(db)
    try:
        yield service
    finally:
        await service.close()


async def _build_prompt_with_context(
    db_pool: asyncpg.Pool,
    *,
    payload: MarketingAiAssistRequest,
    user_id: UUID,
) -> tuple[str, str | None, str | None]:
    if payload.project_id is not None:
        context = await build_project_context(db_pool, payload.project_id, user_id)
        context_text = format_project_context_for_prompt(context)
        content_prompt_block = ""
        if payload.content_id is not None:
            _, content_prompt_block = await fetch_marketing_prompt_content(
                db_pool,
                content_id=payload.content_id,
                project_id=payload.project_id,
            )
        context_text = await merge_project_context_text_with_rag(
            db_pool,
            project_id=payload.project_id,
            user_id=user_id,
            query=payload.prompt,
            context_text=context_text,
        )
        prompt = (
            "Ты стратег маркетингового кабинета EliteEW.\n"
            "Отвечай по-русски, предметно и с фокусом на практические действия.\n\n"
            f"{context_text}\n\n"
            f"{content_prompt_block}\n\n"
            f"Инструмент: {payload.tool_key}\n"
            f"Запрос пользователя: {payload.prompt}"
        )
        return prompt, str(payload.project_id), str(context["project"]["company_id"])

    if payload.company_id is not None:
        context_text = await build_company_context_text(db_pool, payload.company_id, user_id)
        content_prompt_block = ""
        if payload.content_id is not None:
            _, content_prompt_block = await fetch_marketing_prompt_content(
                db_pool,
                content_id=payload.content_id,
                company_id=payload.company_id,
            )
        prompt = (
            "Ты стратег маркетингового кабинета EliteEW.\n"
            "Отвечай по-русски, предметно и с фокусом на практические действия.\n\n"
            f"{context_text}\n\n"
            f"{content_prompt_block}\n\n"
            f"Инструмент: {payload.tool_key}\n"
            f"Запрос пользователя: {payload.prompt}"
        )
        return prompt, None, str(payload.company_id)

    return payload.prompt, None, None


async def _assist_prompt_with_optional_web_search(
    *,
    prompt: str,
    query: str,
    use_web_search: bool,
    web_search_quality: str | None,
    user_id: UUID,
    ai_service: MarketingCabinetAIService,
) -> str:
    web_block = await resolve_marketing_web_search_context(
        query=query,
        use_web_search=use_web_search,
        web_search_quality=web_search_quality,
        user_id=str(user_id),
        db=ai_service.ugs_service.db,
        log_prefix="marketing.ai_assist.web_search",
    )
    kbsew_block = await resolve_marketing_kbsew_context(
        query=query,
        db=ai_service.ugs_service.db,
    )
    out = prompt
    if web_block:
        out = f"{out}\n\n## Срез из веб-поиска (live search для этого запуска)\n{web_block}"
    if kbsew_block:
        out = f"{out}\n\n## KBSEW knowledge base\n{kbsew_block}"
    return out


async def _record_ai_run(
    db_pool: asyncpg.Pool,
    *,
    project_id: str | None,
    company_id: str | None,
    user_id: UUID,
    request_id: str | None,
    tool_key: str,
    status: str,
    prompt_excerpt: str,
    result_excerpt: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_ai_runs (
                project_id,
                company_id,
                created_by,
                request_id,
                tool_key,
                status,
                prompt_excerpt,
                result_excerpt,
                metadata,
                started_at,
                finished_at,
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
                $9::jsonb,
                NOW(),
                NOW(),
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            project_id,
            company_id,
            user_id,
            request_id,
            tool_key,
            status,
            prompt_excerpt[:800],
            result_excerpt[:2000],
            json.dumps(metadata or {}),
        )
    return normalize_ai_run(row)


_AI_RUN_STATUS_VALUES = frozenset({"queued", "processing", "completed", "failed", "cancelled"})


async def _fetch_ai_run_page(
    db_pool: asyncpg.Pool,
    *,
    where_sql: str,
    params_without_limit: list[object],
    params_with_limit: list[object],
    limit_placeholder: int,
) -> tuple[int, list[asyncpg.Record]]:
    async with db_pool.acquire() as conn:
        total = await conn.fetchval(
            f"""
            SELECT COUNT(*)
            FROM marketing_ai_runs
            WHERE {where_sql}
            """,  # noqa: S608
            *params_without_limit,
        )
        rows = await conn.fetch(
            f"""
            SELECT *
            FROM marketing_ai_runs
            WHERE {where_sql}
            ORDER BY started_at DESC NULLS LAST, created_at DESC
            LIMIT ${limit_placeholder}
            """,  # noqa: S608
            *params_with_limit,
        )
    return int(total or 0), list(rows)


_ACTIVE_AI_RUN_STATUSES = ("queued", "processing")


async def count_active_marketing_ai_runs(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID | None = None,
    company_id: UUID | None = None,
) -> int:
    """COUNT активных marketing AI runs (без reconcile и без SELECT *)."""
    if project_id is not None:
        context_filter = "project_id = $1"
        context_value = project_id
    elif company_id is not None:
        context_filter = "company_id = $1"
        context_value = company_id
    else:
        raise ValueError("project_id or company_id required")
    where_sql = f"{context_filter} AND deleted_at IS NULL AND status = ANY($2::text[])"
    async with db_pool.acquire() as conn:
        total = await conn.fetchval(
            f"""
            SELECT COUNT(*)
            FROM marketing_ai_runs
            WHERE {where_sql}
            """,  # noqa: S608
            context_value,
            list(_ACTIVE_AI_RUN_STATUSES),
        )
    return int(total or 0)


@router.get("/runs", response_model=MarketingAiRunListResponse)
async def list_ai_runs(
    project_id: UUID | None = Query(None),
    company_id: UUID | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(
        None,
        description="Фильтр: exact статус или special `active` = queued+processing",
    ),
    tool_key: str | None = Query(None, min_length=2, max_length=120),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingAiRunListResponse:
    if project_id is None and company_id is None:
        raise HTTPException(status_code=400, detail="Передайте project_id или company_id")

    if project_id is not None:
        context_filter = "project_id = $1"
        context_value = project_id
        await get_accessible_project(db_pool, project_id, user_id)
    else:
        assert company_id is not None
        context_filter = "company_id = $1"
        context_value = company_id
        await get_accessible_company(db_pool, company_id, user_id)

    where_parts = [context_filter, "deleted_at IS NULL"]
    params: list[object] = [context_value]
    next_param = 2

    if status is not None:
        key = status.strip().lower()
        if key == "active":
            where_parts.append(f"status = ANY(${next_param}::text[])")
            params.append(["queued", "processing"])
            next_param += 1
        elif key in _AI_RUN_STATUS_VALUES:
            where_parts.append(f"status = ${next_param}")
            params.append(key)
            next_param += 1
        else:
            allowed = ", ".join(sorted(_AI_RUN_STATUS_VALUES)) + ", active"
            raise HTTPException(
                status_code=400,
                detail=f"Недопустимый status. Допустимо: {allowed}",
            )

    if tool_key is not None:
        where_parts.append(f"tool_key = ${next_param}")
        params.append(tool_key.strip())
        next_param += 1

    limit_placeholder = next_param
    params.append(limit)
    where_sql = " AND ".join(where_parts)

    total, rows = await _fetch_ai_run_page(
        db_pool,
        where_sql=where_sql,
        params_without_limit=params[:-1],
        params_with_limit=params,
        limit_placeholder=limit_placeholder,
    )
    if rows:
        items, changed = await reconcile_marketing_ai_run_rows(
            db_pool,
            rows=rows,
            ai_service=ai_service,
        )
    else:
        items, changed = [], False
    if changed:
        total, rows = await _fetch_ai_run_page(
            db_pool,
            where_sql=where_sql,
            params_without_limit=params[:-1],
            params_with_limit=params,
            limit_placeholder=limit_placeholder,
        )
        items = [normalize_ai_run(row) for row in rows]
    return MarketingAiRunListResponse.model_validate({"items": items, "total": total})


@router.get("/runs/{run_id}", response_model=MarketingAiRunDetailResponse)
async def get_ai_run_detail(
    run_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingAiRunDetailResponse:
    row = await fetch_marketing_ai_run_row(db_pool, run_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI run не найден")

    project_id = row.get("project_id")
    company_id = row.get("company_id")
    if project_id is not None:
        await get_accessible_project(db_pool, project_id, user_id)
    elif company_id is not None:
        await get_accessible_company(db_pool, company_id, user_id)
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI run без контекста не поддерживается")

    run = await reconcile_marketing_ai_run(
        db_pool,
        row=row,
        ai_service=ai_service,
    )
    metadata = run.get("metadata") or {}
    queue = None
    request_id = run.get("request_id")
    status_value = str(run.get("status") or "")

    if status_value in {"queued", "processing"}:
        ugs_status_value = status_value
        if request_id:
            try:
                ugs_status = await ai_service.ugs_service.get_status(request_id)
                ugs_status_value = str(ugs_status.get("status") or status_value)
                if ugs_status_value == "completed":
                    ugs_status_value = "processing"
            except Exception as exc:  # noqa: BLE001
                logger.warning("Marketing AI run status refresh failed for %s: %s", run_id, exc)

        queue = await build_marketing_queue_snapshot(
            ai_service,
            status_value=ugs_status_value,
        )

    error_message = None
    if run.get("status") in {"failed", "cancelled"}:
        error_message = str(metadata.get("error_message") or run.get("result_excerpt") or run.get("status"))

    poll_after_ms = 2000 if run.get("status") in {"queued", "processing"} else 0
    return MarketingAiRunDetailResponse.model_validate(
        {
            "run": run,
            "poll_after_ms": poll_after_ms,
            "queue": queue,
            "result_type": metadata.get("result_type"),
            "result": metadata.get("result_payload"),
            "error": error_message,
        }
    )


@router.post("/assist", response_model=MarketingAiAssistResponse)
async def assist_with_ai(
    payload: MarketingAiAssistRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingAiAssistResponse:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )
    if payload.project_id is not None:
        await get_accessible_project(
            db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="ai_studio"
        )
    prompt, project_id, company_id = await _build_prompt_with_context(db_pool, payload=payload, user_id=user_id)
    prompt = await _assist_prompt_with_optional_web_search(
        prompt=prompt,
        query=payload.prompt,
        use_web_search=payload.use_web_search,
        web_search_quality=payload.web_search_quality,
        user_id=user_id,
        ai_service=ai_service,
    )
    await ensure_marketing_idempotency("ai_assist", payload.idempotency_key, user_id=user_id)
    result = await ai_service.generate_text(
        user_id=str(user_id),
        prompt=prompt,
        project_id=project_id,
        company_id=company_id,
        model=payload.model,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        type_key="text_chat",
    )
    run = await _record_ai_run(
        db_pool,
        project_id=project_id,
        company_id=company_id,
        user_id=user_id,
        request_id=result.get("request_id"),
        tool_key=payload.tool_key,
        status="completed",
        prompt_excerpt=payload.prompt,
        result_excerpt=result.get("text") or "",
        metadata={"tool_key": payload.tool_key, "use_web_search": payload.use_web_search is True},
    )
    return MarketingAiAssistResponse.model_validate({"run": run, "output_text": result.get("text") or ""})


@router.post("/assist/stream", responses=_MARKETING_AI_ASSIST_STREAM_RESPONSES)
async def assist_with_ai_stream(
    payload: MarketingAiAssistRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> StreamingResponse:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )
    if payload.project_id is not None:
        await get_accessible_project(
            db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="ai_studio"
        )
    prompt, project_id, company_id = await _build_prompt_with_context(db_pool, payload=payload, user_id=user_id)
    prompt = await _assist_prompt_with_optional_web_search(
        prompt=prompt,
        query=payload.prompt,
        use_web_search=payload.use_web_search,
        web_search_quality=payload.web_search_quality,
        user_id=user_id,
        ai_service=ai_service,
    )
    await ensure_marketing_idempotency("ai_stream", payload.idempotency_key, user_id=user_id)

    async def event_stream() -> AsyncGenerator[str]:
        output_text = ""
        request_id: str | None = None
        try:
            async for event in ai_service.stream_text(
                user_id=str(user_id),
                prompt=prompt,
                project_id=project_id,
                company_id=company_id,
                model=payload.model,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
                type_key="text_chat",
            ):
                event_type = str(event.get("event") or "message")
                if event_type == "started":
                    request_id = str(event.get("request_id") or "")
                    yield f"event: started\ndata: {json.dumps({'request_id': request_id, 'status': event.get('status')})}\n\n"
                    continue
                if event_type == "keep_alive":
                    yield ": keep-alive\n\n"
                    continue
                if event_type == "result":
                    output_text = str(event.get("text") or "")
                    run = await _record_ai_run(
                        db_pool,
                        project_id=project_id,
                        company_id=company_id,
                        user_id=user_id,
                        request_id=request_id or event.get("request_id"),
                        tool_key=payload.tool_key,
                        status="completed",
                        prompt_excerpt=payload.prompt,
                        result_excerpt=output_text,
                        metadata={
                            "tool_key": payload.tool_key,
                            "stream": True,
                            "use_web_search": payload.use_web_search is True,
                        },
                    )
                    yield f"event: result\ndata: {json.dumps({'text': output_text, 'run': run})}\n\n"
                    return
                if event_type == "error":
                    yield f"event: error\ndata: {json.dumps({'error': event.get('error') or 'Неизвестная ошибка AI'})}\n\n"
                    return
                yield f"event: {event_type}\ndata: {json.dumps(event)}\n\n"
            yield f"event: error\ndata: {json.dumps({'error': 'AI-поток завершился без итогового результата'})}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/tool-agent", response_model=MarketingToolAgentResponse)
async def marketing_tool_agent(
    payload: MarketingToolAgentRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingToolAgentResponse:
    """
    Агент с инструментами: router-модель (Llama tool-calling) планирует вызовы,
    бэкенд исполняет whitelist, затем основная генерация через UGS (text_chat).
    """
    out = await run_marketing_tool_agent_for_project(
        db_pool,
        user_id,
        payload.project_id,
        prompt=payload.prompt,
        router_model=payload.router_model,
        chat_context_excerpt=payload.chat_context_excerpt,
        source=payload.source,
        idempotency_key=payload.idempotency_key,
        enforce_rate_limit=True,
    )
    return MarketingToolAgentResponse(**out)
