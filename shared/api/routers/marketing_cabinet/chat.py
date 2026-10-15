# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/chat.py`: эндпоинты и контракт — в коде и
#   OpenAPI (chat message stream documents named text/event-stream payload, Wave B5b).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
#   - Chat SSE wire framing unchanged; OpenAPI names the JSON ``data:`` envelopes.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
#   - api/schemas/marketing_cabinet/sse.py
#   - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# ------------------------------------------------------------------------------
from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.routers.marketing_cabinet.ai_support import (
    build_company_context_text,
    ensure_marketing_idempotency,
    get_marketing_ai_service,
    record_marketing_ai_run,
)
from api.routers.marketing_cabinet.common import (
    build_project_context,
    format_project_context_for_prompt,
    get_accessible_company,
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.schemas.marketing_cabinet.sse import MarketingChatStreamSsePayloadDoc
from api.schemas.marketing_web_search import WebSearchQuality
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import (
    build_marketing_rag_query,
    merge_project_context_text_with_rag,
)
from api.services.marketing_web_search_context import (
    resolve_marketing_kbsew_context,
    resolve_marketing_web_search_context,
)
from api.utils.llm_wall_clock_context import append_llm_wall_clock_to_system_prompt

router = APIRouter(prefix="/chat", tags=["Marketing Cabinet - Context Chat"])
logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 80  # pairs of user/assistant; last N rows before current send

_MARKETING_CHAT_STREAM_RESPONSES = event_stream_openapi_responses(
    model=MarketingChatStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `event: started|progress|result|error` with named "
        "JSON `data:` (`MarketingChatStreamSsePayloadDoc`); keep-alive comments while waiting."
    ),
)


class MarketingChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=2)
    company_id: UUID | None = None
    project_id: UUID | None = None
    conversation_id: str | None = None
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)
    use_web_search: bool = False
    web_search_quality: WebSearchQuality = "off"


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str


class MarketingChatMessageResponse(BaseModel):
    conversation_id: str
    message: ChatMessageOut


class MarketingChatHistoryResponse(BaseModel):
    conversation_id: str | None
    messages: list[ChatMessageOut]


def _sse_event(event_type: str, payload: dict[str, object]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _chat_scope(
    payload: MarketingChatMessageRequest,
) -> tuple[str, UUID | None, UUID | None]:
    """Returns (mode, project_id, company_id) with exactly one of project/company set."""
    if payload.project_id is not None:
        return "project", payload.project_id, None
    if payload.company_id is not None:
        return "company", None, payload.company_id
    raise HTTPException(status_code=400, detail="project_id или company_id обязательны")


async def _verify_conversation(
    conn: asyncpg.Connection,
    *,
    conversation_id: UUID,
    user_id: UUID,
    mode: str,
    project_id: UUID | None,
    company_id: UUID | None,
) -> None:
    row = await conn.fetchrow(
        """
        SELECT id, user_id, project_id, company_id
        FROM marketing_cabinet_chat_conversations
        WHERE id = $1
        """,
        conversation_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Диалог не найден")
    if row["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ к диалогу запрещён")
    if mode == "project":
        if row["project_id"] != project_id or row["company_id"] is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversation_id не соответствует области проекта",
            )
    else:
        if row["company_id"] != company_id or row["project_id"] is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversation_id не соответствует области компании",
            )


def _build_chat_messages(
    *,
    context_text: str,
    prior_messages: list[asyncpg.Record],
    user_message: str,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": append_llm_wall_clock_to_system_prompt(
                "Ты ассистент маркетингового кабинета EliteEW. "
                "Отвечай только на основе переданного контекста проекта или компании. "
                "Пиши по-русски, конкретно, практично и без воды. "
                "Если данных или доказательств не хватает, прямо скажи, чего именно не хватает."
            ),
        }
    ]
    for row in prior_messages:
        messages.append({"role": row["role"], "content": row["content"]})
    messages.append(
        {
            "role": "user",
            "content": (f"Контекст:\n{context_text}\n\nВопрос:\n{user_message}"),
        }
    )
    return messages


def _recent_dialog_lines(prior_messages: list[asyncpg.Record], *, limit: int = 6) -> list[str]:
    out: list[str] = []
    for row in prior_messages[-limit:]:
        role_raw = str(row["role"] or "").strip().lower()
        if role_raw not in {"user", "assistant"}:
            continue
        content = str(row["content"] or "").strip()
        if not content:
            continue
        role = "Пользователь" if role_raw == "user" else "Ассистент"
        out.append(f"{role}: {content}")
    return out


async def _append_chat_web_search_context(
    *,
    messages: list[dict[str, str]],
    user_message: str,
    use_web_search: bool,
    web_search_quality: str | None,
    user_id: UUID,
    ai_service: MarketingCabinetAIService,
) -> None:
    web_block = await resolve_marketing_web_search_context(
        query=user_message,
        use_web_search=use_web_search,
        web_search_quality=web_search_quality,
        user_id=str(user_id),
        db=ai_service.ugs_service.db,
        log_prefix="marketing.chat.web_search",
    )
    kbsew_block = await resolve_marketing_kbsew_context(
        query=user_message,
        db=ai_service.ugs_service.db,
    )
    if not messages:
        return
    if web_block:
        sys = messages[0]
        if sys.get("role") == "system":
            sys["content"] = (
                f"{sys.get('content', '').rstrip()} "
                "Если ниже передан блок веб-поиска — используй его как дополнительный источник; "
                "не отказывайся от ответа из‑за «нет доступа к интернету»."
            )
    user_msg = messages[-1]
    if user_msg.get("role") != "user":
        return
    extra = user_msg.get("content", "").rstrip()
    if web_block:
        extra = f"{extra}\n\n## Срез из веб-поиска\n{web_block}"
    if kbsew_block:
        extra = f"{extra}\n\n## KBSEW knowledge base\n{kbsew_block}"
    if web_block or kbsew_block:
        user_msg["content"] = extra


async def _prepare_chat_completion(
    *,
    payload: MarketingChatMessageRequest,
    db_pool: asyncpg.Pool,
    user_id: UUID,
) -> tuple[UUID, UUID, list[dict[str, str]], UUID | None, UUID | None]:
    mode, scope_project_id, scope_company_id = _chat_scope(payload)

    await ensure_marketing_idempotency(
        "chat_message",
        payload.idempotency_key,
        user_id=user_id,
    )

    conversation_uuid: UUID
    async with db_pool.acquire() as conn:
        if payload.conversation_id:
            try:
                conversation_uuid = UUID(payload.conversation_id)
            except ValueError as exc:
                raise HTTPException(
                    status_code=400,
                    detail="Некорректный conversation_id",
                ) from exc
            await _verify_conversation(
                conn,
                conversation_id=conversation_uuid,
                user_id=user_id,
                mode=mode,
                project_id=scope_project_id,
                company_id=scope_company_id,
            )
        else:
            if mode == "project":
                conversation_uuid = await conn.fetchval(
                    """
                    INSERT INTO marketing_cabinet_chat_conversations (user_id, project_id, company_id)
                    VALUES ($1, $2, NULL)
                    RETURNING id
                    """,
                    user_id,
                    scope_project_id,
                )
            else:
                conversation_uuid = await conn.fetchval(
                    """
                    INSERT INTO marketing_cabinet_chat_conversations (user_id, project_id, company_id)
                    VALUES ($1, NULL, $2)
                    RETURNING id
                    """,
                    user_id,
                    scope_company_id,
                )

        prior = await conn.fetch(
            """
            SELECT role, content
            FROM marketing_cabinet_chat_messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            conversation_uuid,
            MAX_HISTORY_MESSAGES,
        )
        prior_chronological = list(reversed(prior))

    if payload.project_id is not None:
        context = await build_project_context(db_pool, payload.project_id, user_id)
        context_text = format_project_context_for_prompt(context)
        rag_query = build_marketing_rag_query(
            payload.message,
            recent_messages=_recent_dialog_lines(prior_chronological),
            max_chars=2800,
            max_recent_messages=6,
            max_recent_chars=1100,
        )
        context_text = await merge_project_context_text_with_rag(
            db_pool,
            project_id=payload.project_id,
            user_id=user_id,
            query=rag_query,
            context_text=context_text,
            limit=16,
            min_score=0.22,
        )
    else:
        await get_accessible_company(db_pool, payload.company_id, user_id)  # type: ignore[arg-type]
        context_text = await build_company_context_text(db_pool, payload.company_id, user_id)  # type: ignore[arg-type]

    llama_messages = _build_chat_messages(
        context_text=context_text,
        prior_messages=prior_chronological,
        user_message=payload.message,
    )

    async with db_pool.acquire() as conn:
        user_msg_id = await conn.fetchval(
            """
            INSERT INTO marketing_cabinet_chat_messages (conversation_id, role, content)
            VALUES ($1, 'user', $2)
            RETURNING id
            """,
            conversation_uuid,
            payload.message,
        )

    return conversation_uuid, user_msg_id, llama_messages, scope_project_id, scope_company_id


async def _cleanup_chat_user_message(
    db_pool: asyncpg.Pool,
    *,
    conversation_id: UUID,
    user_message_id: UUID,
) -> None:
    async with db_pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM marketing_cabinet_chat_messages WHERE id = $1",
            user_message_id,
        )
        await conn.execute(
            """
            DELETE FROM marketing_cabinet_chat_conversations c
            WHERE c.id = $1
              AND NOT EXISTS (
                SELECT 1 FROM marketing_cabinet_chat_messages m WHERE m.conversation_id = c.id
              )
            """,
            conversation_id,
        )


async def _persist_chat_assistant_message(
    db_pool: asyncpg.Pool,
    *,
    conversation_id: UUID,
    answer: str,
) -> ChatMessageOut:
    async with db_pool.acquire() as conn:
        assistant_msg_id = await conn.fetchval(
            """
            INSERT INTO marketing_cabinet_chat_messages (conversation_id, role, content)
            VALUES ($1, 'assistant', $2)
            RETURNING id
            """,
            conversation_id,
            answer,
        )
        await conn.execute(
            """
            UPDATE marketing_cabinet_chat_conversations
            SET updated_at = (NOW() AT TIME ZONE 'UTC')
            WHERE id = $1
            """,
            conversation_id,
        )
    return ChatMessageOut(
        id=str(assistant_msg_id),
        role="assistant",
        content=answer,
    )


@router.get("/history", response_model=MarketingChatHistoryResponse)
async def get_marketing_chat_history(
    project_id: UUID | None = Query(None),
    company_id: UUID | None = Query(None),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingChatHistoryResponse:
    if (project_id is None) == (company_id is None):
        raise HTTPException(
            status_code=400,
            detail="Передайте ровно один параметр: project_id или company_id",
        )
    if project_id is not None:
        await get_accessible_project(db_pool, project_id, user_id)
        scope_filter = "project_id = $2 AND company_id IS NULL"
        scope_val = project_id
    else:
        assert company_id is not None
        await get_accessible_company(db_pool, company_id, user_id)
        scope_filter = "company_id = $2 AND project_id IS NULL"
        scope_val = company_id

    async with db_pool.acquire() as conn:
        conv = await conn.fetchrow(
            f"""
            SELECT id
            FROM marketing_cabinet_chat_conversations
            WHERE user_id = $1 AND {scope_filter}
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 1
            """,
            user_id,
            scope_val,
        )
        if conv is None:
            return MarketingChatHistoryResponse(conversation_id=None, messages=[])

        cid = conv["id"]
        rows = await conn.fetch(
            """
            SELECT id, role, content
            FROM marketing_cabinet_chat_messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            LIMIT 500
            """,
            cid,
        )

    return MarketingChatHistoryResponse(
        conversation_id=str(cid),
        messages=[ChatMessageOut(id=str(r["id"]), role=r["role"], content=r["content"]) for r in rows],
    )


@router.post("/message", response_model=MarketingChatMessageResponse)
async def send_marketing_chat_message(
    payload: MarketingChatMessageRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingChatMessageResponse:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )

    (
        conversation_uuid,
        user_msg_id,
        llama_messages,
        scope_project_id,
        scope_company_id,
    ) = await _prepare_chat_completion(
        payload=payload,
        db_pool=db_pool,
        user_id=user_id,
    )

    await _append_chat_web_search_context(
        messages=llama_messages,
        user_message=payload.message,
        use_web_search=payload.use_web_search,
        web_search_quality=payload.web_search_quality,
        user_id=user_id,
        ai_service=ai_service,
    )

    request_id: str | None = None
    try:
        result = await ai_service.generate_text(
            user_id=str(user_id),
            messages=llama_messages,
            temperature=0.35,
            max_tokens=2400,
            type_key="text_chat",
            project_id=str(scope_project_id) if scope_project_id is not None else None,
            company_id=str(scope_company_id) if scope_company_id is not None else None,
        )
        answer = result.get("text") or ""
        request_id = result.get("request_id")
    except HTTPException:
        raise
    except Exception:
        await _cleanup_chat_user_message(
            db_pool,
            conversation_id=conversation_uuid,
            user_message_id=user_msg_id,
        )
        raise

    message = await _persist_chat_assistant_message(
        db_pool,
        conversation_id=conversation_uuid,
        answer=answer,
    )

    await record_marketing_ai_run(
        db_pool,
        project_id=str(scope_project_id) if scope_project_id is not None else None,
        company_id=str(scope_company_id) if scope_company_id is not None else None,
        user_id=user_id,
        request_id=request_id,
        tool_key="context_chat",
        status_value="completed",
        prompt_excerpt=payload.message,
        result_excerpt=answer,
        metadata={"conversation_id": str(conversation_uuid)},
    )
    return MarketingChatMessageResponse(
        conversation_id=str(conversation_uuid),
        message=message,
    )


@router.post("/message/stream", responses=_MARKETING_CHAT_STREAM_RESPONSES)
async def send_marketing_chat_message_stream(
    payload: MarketingChatMessageRequest,
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

    (
        conversation_uuid,
        user_msg_id,
        llama_messages,
        scope_project_id,
        scope_company_id,
    ) = await _prepare_chat_completion(
        payload=payload,
        db_pool=db_pool,
        user_id=user_id,
    )

    await _append_chat_web_search_context(
        messages=llama_messages,
        user_message=payload.message,
        use_web_search=payload.use_web_search,
        web_search_quality=payload.web_search_quality,
        user_id=user_id,
        ai_service=ai_service,
    )

    async def event_stream():
        request_id: str | None = None
        try:
            async for event in ai_service.stream_text(
                user_id=str(user_id),
                messages=llama_messages,
                temperature=0.35,
                max_tokens=2400,
                type_key="text_chat",
                project_id=str(scope_project_id) if scope_project_id is not None else None,
                company_id=str(scope_company_id) if scope_company_id is not None else None,
            ):
                event_type = str(event.get("event") or "message")
                if event_type == "started":
                    request_id = str(event.get("request_id") or "")
                    yield _sse_event(
                        "started",
                        {
                            "conversation_id": str(conversation_uuid),
                            "request_id": request_id,
                            "status": str(event.get("status") or "processing"),
                        },
                    )
                    continue
                if event_type == "keep_alive":
                    yield ": keep-alive\n\n"
                    continue
                if event_type == "progress":
                    yield _sse_event(
                        "progress",
                        {
                            "conversation_id": str(conversation_uuid),
                            "status": str(event.get("status") or "processing"),
                            "progress": event.get("progress"),
                        },
                    )
                    continue
                if event_type == "result":
                    answer = str(event.get("text") or "").strip()
                    if not answer:
                        raise ValueError("AI-поток завершился без итогового текста")
                    message = await _persist_chat_assistant_message(
                        db_pool,
                        conversation_id=conversation_uuid,
                        answer=answer,
                    )
                    run = await record_marketing_ai_run(
                        db_pool,
                        project_id=str(scope_project_id) if scope_project_id is not None else None,
                        company_id=str(scope_company_id) if scope_company_id is not None else None,
                        user_id=user_id,
                        request_id=request_id or event.get("request_id"),
                        tool_key="context_chat",
                        status_value="completed",
                        prompt_excerpt=payload.message,
                        result_excerpt=answer,
                        metadata={"conversation_id": str(conversation_uuid), "stream": True},
                    )
                    yield _sse_event(
                        "result",
                        {
                            "conversation_id": str(conversation_uuid),
                            "message": message.model_dump(),
                            "run": run,
                        },
                    )
                    return
                if event_type == "error":
                    raise ValueError(str(event.get("error") or "Неизвестная ошибка AI"))
            raise ValueError("AI-поток завершился без итогового результата")
        except asyncio.CancelledError:
            await _cleanup_chat_user_message(
                db_pool,
                conversation_id=conversation_uuid,
                user_message_id=user_msg_id,
            )
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Marketing chat stream failed for conversation %s: %s", conversation_uuid, exc)
            await _cleanup_chat_user_message(
                db_pool,
                conversation_id=conversation_uuid,
                user_message_id=user_msg_id,
            )
            if request_id:
                await record_marketing_ai_run(
                    db_pool,
                    project_id=str(scope_project_id) if scope_project_id is not None else None,
                    company_id=str(scope_company_id) if scope_company_id is not None else None,
                    user_id=user_id,
                    request_id=request_id,
                    tool_key="context_chat",
                    status_value="failed",
                    prompt_excerpt=payload.message,
                    result_excerpt=str(exc),
                    metadata={
                        "conversation_id": str(conversation_uuid),
                        "stream": True,
                        "error_message": str(exc),
                    },
                )
            yield _sse_event(
                "error",
                {
                    "conversation_id": str(conversation_uuid),
                    "error": str(exc),
                },
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
